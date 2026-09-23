from collections import Counter

from django.contrib.contenttypes.models import ContentType
from django.core.exceptions import (
    ValidationError as DjangoValidationError,
)
from django.db.models import Count, Prefetch
from django.db.models.deletion import ProtectedError
from django.utils import timezone
from rest_framework.exceptions import (
    NotFound,
    ValidationError,
)
from rest_framework.views import APIView

from apps.core.api.responses import success_response
from apps.organization.models import Site
from apps.project_monitor.api.common import as_drf_validation
from apps.project_monitor.services import project_scope
from apps.project_monitor.services.notifications import (
    resolve_activity_site,
    resolve_activity_task,
)
from apps.project_monitor.api.permissions import (
    HasProjectMonitorMasterAccess,
    HasProjectMonitorPortalAccess,
    HasProjectMonitorReportingAccess,
)
from apps.project_monitor.api.serializers import (
    ActionItemCreateSerializer,
    ActionItemSerializer,
    ActionItemUpdateSerializer,
    ActivitySerializer,
    ActivityUpdateSerializer,
    BuildingCreateSerializer,
    BuildingSerializer,
    ChainageSegmentCreateSerializer,
    ChainageSegmentSerializer,
    GirderJobCreateSerializer,
    GirderJobSerializer,
    GirderSpanSerializer,
    GirderSpanUpdateSerializer,
    LinearItemCreateSerializer,
    LinearItemSerializer,
    ProgressEntryCreateSerializer,
    ProgressEntrySerializer,
    ProgressEntryUpdateSerializer,
    ProjectExtensionCreateSerializer,
    ProjectExtensionSerializer,
    ProjectSiteDetailsUpdateSerializer,
    ProjectSiteSerializer,
    RdsoSpanLibraryEntrySerializer,
    ReviewInputSerializer,
    ScopePatchCreateSerializer,
    ScopePatchSerializer,
    StructureCreateSerializer,
    StructureSerializer,
    StructureTypeSerializer,
    StructureUpdateSerializer,
)
from apps.project_monitor.models import (
    ActionItem,
    Activity,
    ActivityStatus,
    Building,
    ChainageSegment,
    GirderJob,
    GirderSpan,
    LinearItem,
    LinearUnit,
    ProgressEntry,
    ProjectExtension,
    RdsoSpanLibraryEntry,
    ScopePatch,
    Structure,
    StructureTypeDefinition,
)
from apps.project_monitor.services.action_item_generator import (
    create_action_item,
)
from apps.project_monitor.services.activity_engine import (
    apply_material_status_update,
    apply_update,
)
from apps.project_monitor.services.building_generator import (
    create_building,
)
from apps.project_monitor.services.girder_generator import (
    create_girder_job,
)
from apps.project_monitor.services.linear_generator import (
    create_linear_item,
    create_progress_entry,
    create_scope_patch,
)
from apps.project_monitor.services.linear_stats import (
    compute_item_stats,
)
from apps.project_monitor.services.notifications import (
    notify_activity_reviewed,
    notify_director_of_update,
    notify_sheet_reviewed,
)
from apps.project_monitor.services.review import (
    apply_review,
    review_activities,
)
from apps.project_monitor.services.structure_generator import (
    create_structure,
    update_structure,
)


def _activities_prefetch():
    return Prefetch(
        "activities",
        queryset=(
            Activity.objects.order_by(
                "group_order", "row_order"
            ).prefetch_related(
                "date_entries", "comments"
            )
        ),
    )


def _structure_counts_for_site(site):
    structures = Structure.objects.filter(site=site)

    by_type = (
        structures.values(
            "structure_type__code",
            "structure_type__name",
        )
        .annotate(count=Count("id"))
        .order_by("structure_type__name")
    )
    counts = {
        "by_type": [
            {
                "code": row[
                    "structure_type__code"
                ],
                "name": row[
                    "structure_type__name"
                ],
                "count": row["count"],
            }
            for row in by_type
        ],
    }

    structure_ct = ContentType.objects.get_for_model(
        Structure
    )
    activities = Activity.objects.filter(
        content_type=structure_ct,
        object_id__in=structures.values_list(
            "id", flat=True
        ),
    ).exclude(
        status=ActivityStatus.NOT_APPLICABLE
    )
    counts["activities_total"] = activities.count()
    counts["activities_done"] = activities.filter(
        status=ActivityStatus.COMPLETE
    ).count()
    return counts


def _building_counts_for_site(site):
    buildings = Building.objects.filter(site=site)
    built_up_area_sqm = sum(
        (
            building.config or {}
        ).get("totalBuiltUpArea", 0)
        for building in buildings
    )
    return {
        "count": buildings.count(),
        "built_up_area_sqm": built_up_area_sqm,
    }


def _girder_span_prefetch():
    return Prefetch(
        "spans",
        queryset=(
            GirderSpan.objects.order_by(
                "row_order"
            ).prefetch_related(
                _activities_prefetch()
            )
        ),
    )


def _girder_counts_for_site(site):
    spans = GirderSpan.objects.filter(
        job__site=site
    )
    span_ct = ContentType.objects.get_for_model(
        GirderSpan
    )
    spans_launched = Activity.objects.filter(
        content_type=span_ct,
        object_id__in=spans.values_list(
            "id", flat=True
        ),
        group_title="Girder fabrication",
        name="Launching status",
        status=ActivityStatus.COMPLETE,
    ).count()
    return {
        "spans_tracked": spans.count(),
        "spans_launched": spans_launched,
    }


def _action_item_counts_for_site(site):
    action_item_ct = ContentType.objects.get_for_model(
        ActionItem
    )
    open_activities = Activity.objects.filter(
        content_type=action_item_ct,
        object_id__in=ActionItem.objects.filter(
            site=site
        ).values_list("id", flat=True),
    ).exclude(
        status__in=[
            ActivityStatus.COMPLETE,
            ActivityStatus.NOT_APPLICABLE,
        ]
    )

    overdue = 0
    for activity in open_activities.prefetch_related(
        "date_entries"
    ):
        entries = list(
            activity.date_entries.all()
        )
        if (
            entries
            and entries[-1].target_date
            < timezone.localdate()
        ):
            overdue += 1

    return {
        "open": open_activities.count(),
        "overdue": overdue,
    }


def _linear_counts_for_site(site):
    done_m = 0
    scope_m = 0
    for item in LinearItem.objects.filter(
        site=site, unit=LinearUnit.M
    ).prefetch_related(
        "scope_patches", "progress_entries"
    ):
        stats = compute_item_stats(item)
        done_m += stats["done"]
        scope_m += stats["scope"]

    return {
        "done_m": done_m,
        "scope_m": scope_m,
    }


TASK = project_scope.Task


def _authorize_site(request, site, task=None, *, write=False):
    """
    Site Access: Director/Admin see every task on every site; a
    Project Incharge or Project Manager only the tasks an Admin
    granted on that site. ``task=None`` means "any task on this site"
    (the Overview summary); writes always name their task.
    """
    if write:
        project_scope.ensure_can_enter_task(
            request.user, site, task
        )
    elif task is None:
        project_scope.ensure_can_view_site(
            request.user, site
        )
    else:
        project_scope.ensure_can_view_task(
            request.user, site, task
        )


def _get_site_from_query(request, task=None, *, write=False):
    site_id = request.query_params.get("site")
    if not site_id:
        raise ValidationError(
            {"site": "Site is required."}
        )

    try:
        site = Site.objects.get(pk=site_id)
    except (
        Site.DoesNotExist,
        ValueError,
        TypeError,
    ) as exc:
        raise ValidationError(
            {"site": "Site not found."}
        ) from exc

    _authorize_site(request, site, task, write=write)
    return site


class ProjectOverviewAPIView(APIView):
    """
    One project's (= one Site's) Project Monitor overview: its core
    identity/chainage plus a KPI-shaped counts block. Every section's
    counts (Structures/Buildings/Girders/Action Items/Linear) are
    real now that every phase has landed.

    GET is Director-and-below read access
    (``HasProjectMonitorReportingAccess``); PATCH - editing the
    project's own chainage/client details - is entry-role access
    only (``HasProjectMonitorPortalAccess``), since a Project
    Manager has no organization-wide Site write access.
    """

    def get_permissions(self):
        if self.request.method == "PATCH":
            return [HasProjectMonitorPortalAccess()]
        return [HasProjectMonitorReportingAccess()]

    def get(self, request, *args, **kwargs):
        site = _get_site_from_query(request, None)

        counts = {
            "structures": _structure_counts_for_site(
                site
            ),
            "buildings": _building_counts_for_site(
                site
            ),
            "girders": _girder_counts_for_site(
                site
            ),
            "linear": _linear_counts_for_site(
                site
            ),
            "action_items": _action_item_counts_for_site(
                site
            ),
        }

        return success_response(
            message=(
                "Project Monitor overview "
                "retrieved successfully."
            ),
            data={
                "site": ProjectSiteSerializer(
                    site
                ).data,
                "counts": counts,
            },
        )

    def patch(self, request, *args, **kwargs):
        site = _get_site_from_query(request, TASK.OVERVIEW.value, write=True)

        serializer = ProjectSiteDetailsUpdateSerializer(
            site,
            data=request.data,
            partial=True,
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()

        return success_response(
            message=(
                "Project details updated "
                "successfully."
            ),
            data={
                "site": ProjectSiteSerializer(
                    site
                ).data,
            },
        )


class ProjectExtensionListCreateAPIView(
    APIView
):
    """
    A site's contract-extension history (E1, E2, E3... in the order
    they were entered, per ``ProjectExtension.Meta.ordering``) - GET
    is Director-and-below read access, same as the rest of this
    module's status views (this list is already nested in
    ``ProjectOverviewAPIView``'s response too; this endpoint exists
    for direct access/refresh). POST records a new extension -
    entry-role only, same convention as every other write here.
    """

    def get_permissions(self):
        if self.request.method == "POST":
            return [HasProjectMonitorPortalAccess()]
        return [HasProjectMonitorReportingAccess()]

    def get(self, request, *args, **kwargs):
        site = _get_site_from_query(request, None)
        extensions = ProjectExtension.objects.filter(
            site=site
        ).select_related("created_by")

        return success_response(
            message=(
                "Project extensions retrieved "
                "successfully."
            ),
            data=ProjectExtensionSerializer(
                extensions, many=True
            ).data,
        )

    def post(self, request, *args, **kwargs):
        site = _get_site_from_query(request, TASK.OVERVIEW.value, write=True)

        serializer = (
            ProjectExtensionCreateSerializer(
                data=request.data
            )
        )
        serializer.is_valid(raise_exception=True)

        extension = ProjectExtension.objects.create(
            site=site,
            new_end_date=serializer.validated_data[
                "new_end_date"
            ],
            reason=serializer.validated_data[
                "reason"
            ],
            created_by=request.user,
            updated_by=request.user,
        )

        return success_response(
            message=(
                "Project extension recorded "
                "successfully."
            ),
            data=ProjectExtensionSerializer(
                extension
            ).data,
        )


class ProjectExtensionDetailAPIView(APIView):
    """
    Deletes a mistakenly-recorded extension - entry-role only.
    """

    permission_classes = [
        HasProjectMonitorPortalAccess,
    ]

    def delete(self, request, pk, *args, **kwargs):
        try:
            extension = ProjectExtension.objects.get(
                pk=pk
            )
        except (
            ProjectExtension.DoesNotExist,
            ValueError,
            TypeError,
        ) as exc:
            raise NotFound(
                "Project extension not found."
            ) from exc

        _authorize_site(
            request,
            extension.site,
            TASK.OVERVIEW.value,
            write=True,
        )

        extension.delete()

        return success_response(
            message=(
                "Project extension deleted "
                "successfully."
            ),
            data=None,
        )


class ChainageSegmentListCreateAPIView(APIView):
    """
    A site's chainage breakdown - who (if anyone) is working which
    stretch. GET is Director-and-below read access (also already
    nested in ``ProjectOverviewAPIView``'s response; this endpoint
    exists for direct access/refresh); POST records a new segment -
    entry-role only, same convention as extensions.
    """

    def get_permissions(self):
        if self.request.method == "POST":
            return [HasProjectMonitorPortalAccess()]
        return [HasProjectMonitorReportingAccess()]

    def get(self, request, *args, **kwargs):
        site = _get_site_from_query(request, None)
        segments = ChainageSegment.objects.filter(
            site=site
        )

        return success_response(
            message=(
                "Chainage segments retrieved "
                "successfully."
            ),
            data=ChainageSegmentSerializer(
                segments, many=True
            ).data,
        )

    def post(self, request, *args, **kwargs):
        site = _get_site_from_query(request, TASK.OVERVIEW.value, write=True)

        serializer = (
            ChainageSegmentCreateSerializer(
                data=request.data
            )
        )
        serializer.is_valid(raise_exception=True)

        with as_drf_validation():
            segment = ChainageSegment.objects.create(
                site=site,
                from_chainage_km=serializer.validated_data[
                    "from_chainage_km"
                ],
                to_chainage_km=serializer.validated_data[
                    "to_chainage_km"
                ],
                vendor=serializer.validated_data[
                    "vendor"
                ],
                created_by=request.user,
                updated_by=request.user,
            )

        return success_response(
            message=(
                "Chainage segment recorded "
                "successfully."
            ),
            data=ChainageSegmentSerializer(
                segment
            ).data,
        )


class ChainageSegmentDetailAPIView(APIView):
    """
    Deletes a mistakenly-recorded chainage segment - entry-role only.
    """

    permission_classes = [
        HasProjectMonitorPortalAccess,
    ]

    def delete(self, request, pk, *args, **kwargs):
        try:
            segment = ChainageSegment.objects.get(
                pk=pk
            )
        except (
            ChainageSegment.DoesNotExist,
            ValueError,
            TypeError,
        ) as exc:
            raise NotFound(
                "Chainage segment not found."
            ) from exc

        _authorize_site(
            request,
            segment.site,
            TASK.OVERVIEW.value,
            write=True,
        )

        segment.delete()

        return success_response(
            message=(
                "Chainage segment deleted "
                "successfully."
            ),
            data=None,
        )


class StructureListCreateAPIView(APIView):
    """
    List every Structure (Minor/Major Bridge, RUB, ROB) on a Site
    with its full activity groups (GET - Director-and-below read
    access), or generate a new one from its parametric inputs
    (POST - entry-role only) - the server-side port of the
    prototype's "+ Add a structure" -> "Generate sheet" action.
    """

    def get_permissions(self):
        if self.request.method == "POST":
            return [HasProjectMonitorPortalAccess()]
        return [HasProjectMonitorReportingAccess()]

    def get(self, request, *args, **kwargs):
        site = _get_site_from_query(request, TASK.STRUCTURES.value)
        structure_type = request.query_params.get(
            "structure_type"
        )

        queryset = Structure.objects.filter(
            site=site
        ).select_related(
            "structure_type"
        ).prefetch_related(
            _activities_prefetch()
        )
        if structure_type:
            queryset = queryset.filter(
                structure_type_id=structure_type
            )

        return success_response(
            message=(
                "Structures retrieved successfully."
            ),
            data=StructureSerializer(
                queryset, many=True
            ).data,
        )

    def post(self, request, *args, **kwargs):
        site = _get_site_from_query(request, TASK.STRUCTURES.value, write=True)

        serializer = StructureCreateSerializer(
            data=request.data
        )
        serializer.is_valid(raise_exception=True)

        structure = create_structure(
            site=site,
            structure_type=serializer.validated_data[
                "structure_type"
            ],
            name=serializer.validated_data["name"],
            chainage_km=serializer.validated_data.get(
                "chainage_km"
            ),
            config=serializer.validated_data.get(
                "config"
            )
            or {},
            actor=request.user,
        )

        structure = Structure.objects.select_related(
            "structure_type"
        ).prefetch_related(
            _activities_prefetch()
        ).get(pk=structure.pk)

        return success_response(
            message=(
                "Structure sheet generated "
                "successfully."
            ),
            data=StructureSerializer(structure).data,
        )


class StructureDetailAPIView(APIView):
    """
    One Structure's full detail sheet (GET - Director-and-below
    read access), editing its name/chainage (PATCH - entry-role
    only; the generated activity sheet is untouched), or its
    deletion (DELETE - entry-role only), mirroring the prototype's
    "Delete this structure sheet and all its data?" action. Deleting
    cascades to every Activity row via ``Structure.activities`` (a
    ``GenericRelation``).
    """

    def get_permissions(self):
        if self.request.method in ("PATCH", "DELETE"):
            return [HasProjectMonitorPortalAccess()]
        return [HasProjectMonitorReportingAccess()]

    def _get_structure(self, pk):
        try:
            return Structure.objects.select_related(
                "structure_type"
            ).prefetch_related(
                _activities_prefetch()
            ).get(pk=pk)
        except (
            Structure.DoesNotExist,
            ValueError,
            TypeError,
        ) as exc:
            raise NotFound(
                "Structure not found."
            ) from exc

    def get(self, request, pk, *args, **kwargs):
        structure = self._get_structure(pk)
        _authorize_site(
            request,
            structure.site,
            TASK.STRUCTURES.value,
            write=False,
        )
        return success_response(
            message=(
                "Structure retrieved successfully."
            ),
            data=StructureSerializer(structure).data,
        )

    def patch(self, request, pk, *args, **kwargs):
        structure = self._get_structure(pk)
        _authorize_site(
            request,
            structure.site,
            TASK.STRUCTURES.value,
            write=True,
        )

        serializer = StructureUpdateSerializer(
            data=request.data, partial=True
        )
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        with as_drf_validation():
            if "config" in data:
                update_structure(
                    structure=structure,
                    config=data["config"],
                    name=data.get(
                        "name", structure.name
                    ),
                    chainage_km=data.get(
                        "chainage_km",
                        structure.chainage_km,
                    ),
                    actor=request.user,
                )
            else:
                for field, value in data.items():
                    setattr(
                        structure, field, value
                    )
                structure.updated_by = request.user
                structure.full_clean()
                structure.save()

        structure = self._get_structure(pk)
        return success_response(
            message=(
                "Structure updated successfully."
            ),
            data=StructureSerializer(structure).data,
        )

    def delete(self, request, pk, *args, **kwargs):
        structure = self._get_structure(pk)
        _authorize_site(
            request,
            structure.site,
            TASK.STRUCTURES.value,
            write=True,
        )
        structure.delete()
        return success_response(
            message=(
                "Structure deleted successfully."
            ),
            data=None,
        )


class StructureReviewAPIView(APIView):
    """
    The consolidated "review this whole sheet" action - marks every
    Activity row on the Structure as reviewed at once, all with the
    same reviewer/timestamp/remark, per the confirmed "review all in
    one structure/building at a time" design.
    """

    permission_classes = [
        HasProjectMonitorReportingAccess,
    ]

    def post(self, request, pk, *args, **kwargs):
        try:
            structure = Structure.objects.get(
                pk=pk
            )
        except (
            Structure.DoesNotExist,
            ValueError,
            TypeError,
        ) as exc:
            raise NotFound(
                "Structure not found."
            ) from exc

        _authorize_site(
            request,
            structure.site,
            TASK.STRUCTURES.value,
            write=False,
        )

        serializer = ReviewInputSerializer(
            data=request.data
        )
        serializer.is_valid(raise_exception=True)

        reviewed_activities = list(
            structure.activities.select_related(
                "updated_by"
            ).all()
        )
        review_activities(
            reviewed_activities,
            remarks=serializer.validated_data[
                "remarks"
            ],
            actor=request.user,
        )
        notify_sheet_reviewed(
            activities=reviewed_activities,
            site=structure.site,
            label=structure.name,
            actor=request.user,
        )

        structure = Structure.objects.select_related(
            "structure_type"
        ).prefetch_related(
            _activities_prefetch()
        ).get(pk=structure.pk)

        return success_response(
            message=(
                "Structure reviewed successfully."
            ),
            data=StructureSerializer(structure).data,
        )


class BuildingListCreateAPIView(APIView):
    """
    List every Building on a Site with its full activity groups
    (GET - Director-and-below read access), or generate a new one
    from its parametric inputs (POST - entry-role only) - the
    server-side port of the prototype's "+ Add a building" ->
    "Generate sheet" action. Unlike Structures, there's one fixed
    building shape, so there's no type selector here.
    """

    def get_permissions(self):
        if self.request.method == "POST":
            return [HasProjectMonitorPortalAccess()]
        return [HasProjectMonitorReportingAccess()]

    def get(self, request, *args, **kwargs):
        site = _get_site_from_query(request, TASK.BUILDINGS.value)

        queryset = Building.objects.filter(
            site=site
        ).prefetch_related(
            _activities_prefetch()
        )

        return success_response(
            message=(
                "Buildings retrieved successfully."
            ),
            data=BuildingSerializer(
                queryset, many=True
            ).data,
        )

    def post(self, request, *args, **kwargs):
        site = _get_site_from_query(request, TASK.BUILDINGS.value, write=True)

        serializer = BuildingCreateSerializer(
            data=request.data
        )
        serializer.is_valid(raise_exception=True)

        building = create_building(
            site=site,
            name=serializer.validated_data["name"],
            station_label=serializer.validated_data.get(
                "station_label"
            ),
            chainage_km=serializer.validated_data.get(
                "chainage_km"
            ),
            config=serializer.validated_data.get(
                "config"
            )
            or {},
            actor=request.user,
        )

        building = Building.objects.prefetch_related(
            _activities_prefetch()
        ).get(pk=building.pk)

        return success_response(
            message=(
                "Building sheet generated "
                "successfully."
            ),
            data=BuildingSerializer(building).data,
        )


class BuildingDetailAPIView(APIView):
    """
    One Building's full detail sheet (GET - Director-and-below read
    access) or its deletion (DELETE - entry-role only). Deleting
    cascades to every Activity row via ``Building.activities`` (a
    ``GenericRelation``).
    """

    def get_permissions(self):
        if self.request.method == "DELETE":
            return [HasProjectMonitorPortalAccess()]
        return [HasProjectMonitorReportingAccess()]

    def _get_building(self, pk):
        try:
            return Building.objects.prefetch_related(
                _activities_prefetch()
            ).get(pk=pk)
        except (
            Building.DoesNotExist,
            ValueError,
            TypeError,
        ) as exc:
            raise NotFound(
                "Building not found."
            ) from exc

    def get(self, request, pk, *args, **kwargs):
        building = self._get_building(pk)
        _authorize_site(
            request,
            building.site,
            TASK.BUILDINGS.value,
            write=False,
        )
        return success_response(
            message=(
                "Building retrieved successfully."
            ),
            data=BuildingSerializer(building).data,
        )

    def delete(self, request, pk, *args, **kwargs):
        building = self._get_building(pk)
        _authorize_site(
            request,
            building.site,
            TASK.BUILDINGS.value,
            write=True,
        )
        building.delete()
        return success_response(
            message=(
                "Building deleted successfully."
            ),
            data=None,
        )


class BuildingReviewAPIView(APIView):
    """
    The consolidated "review this whole sheet" action for a
    Building - see ``StructureReviewAPIView``.
    """

    permission_classes = [
        HasProjectMonitorReportingAccess,
    ]

    def post(self, request, pk, *args, **kwargs):
        try:
            building = Building.objects.get(pk=pk)
        except (
            Building.DoesNotExist,
            ValueError,
            TypeError,
        ) as exc:
            raise NotFound(
                "Building not found."
            ) from exc

        _authorize_site(
            request,
            building.site,
            TASK.BUILDINGS.value,
            write=False,
        )

        serializer = ReviewInputSerializer(
            data=request.data
        )
        serializer.is_valid(raise_exception=True)

        reviewed_activities = list(
            building.activities.select_related(
                "updated_by"
            ).all()
        )
        review_activities(
            reviewed_activities,
            remarks=serializer.validated_data[
                "remarks"
            ],
            actor=request.user,
        )
        notify_sheet_reviewed(
            activities=reviewed_activities,
            site=building.site,
            label=building.name,
            actor=request.user,
        )

        building = Building.objects.prefetch_related(
            _activities_prefetch()
        ).get(pk=building.pk)

        return success_response(
            message=(
                "Building reviewed successfully."
            ),
            data=BuildingSerializer(building).data,
        )


def _girder_job_queryset():
    return GirderJob.objects.select_related(
        "structure",
        "structure__structure_type",
    ).prefetch_related(
        _activities_prefetch(),
        _girder_span_prefetch(),
    )


class GirderJobListCreateAPIView(APIView):
    """
    List every Girder Job (one row per bridge tracked) on a Site
    with its full span-by-span chain detail (GET - Director-and-
    below read access), or generate a new one from its parametric
    inputs (POST - entry-role only) - the server-side port of the
    prototype's "+ Add girder job" -> ``addGirderJob()`` action.
    """

    def get_permissions(self):
        if self.request.method == "POST":
            return [HasProjectMonitorPortalAccess()]
        return [HasProjectMonitorReportingAccess()]

    def get(self, request, *args, **kwargs):
        site = _get_site_from_query(request, TASK.GIRDERS.value)

        queryset = _girder_job_queryset().filter(
            site=site
        )

        return success_response(
            message=(
                "Girder jobs retrieved "
                "successfully."
            ),
            data=GirderJobSerializer(
                queryset, many=True
            ).data,
        )

    def post(self, request, *args, **kwargs):
        site = _get_site_from_query(request, TASK.GIRDERS.value, write=True)

        serializer = GirderJobCreateSerializer(
            data=request.data
        )
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        job = create_girder_job(
            site=site,
            structure=data.get("structure"),
            structure_kind=data[
                "structure_kind"
            ],
            bridge_name=data["bridge_name"],
            chainage_km=data.get(
                "chainage_km"
            ),
            girder_scope=data["girder_scope"],
            spans=data["spans"],
            actor=request.user,
        )

        job = _girder_job_queryset().get(
            pk=job.pk
        )

        return success_response(
            message=(
                "Girder job generated "
                "successfully."
            ),
            data=GirderJobSerializer(job).data,
        )


class GirderJobDetailAPIView(APIView):
    """
    One Girder Job's full detail (GET - Director-and-below read
    access) or its deletion (DELETE - entry-role only). Deleting
    cascades to every span (``GirderSpan.job``) and, via each
    span's/the job's own generic ``activities`` relation, every
    generated Activity row.
    """

    def get_permissions(self):
        if self.request.method == "DELETE":
            return [HasProjectMonitorPortalAccess()]
        return [HasProjectMonitorReportingAccess()]

    def _get_job(self, pk):
        try:
            return _girder_job_queryset().get(
                pk=pk
            )
        except (
            GirderJob.DoesNotExist,
            ValueError,
            TypeError,
        ) as exc:
            raise NotFound(
                "Girder job not found."
            ) from exc

    def get(self, request, pk, *args, **kwargs):
        job = self._get_job(pk)
        _authorize_site(
            request,
            job.site,
            TASK.GIRDERS.value,
            write=False,
        )
        return success_response(
            message=(
                "Girder job retrieved "
                "successfully."
            ),
            data=GirderJobSerializer(job).data,
        )

    def delete(self, request, pk, *args, **kwargs):
        job = self._get_job(pk)
        _authorize_site(
            request,
            job.site,
            TASK.GIRDERS.value,
            write=True,
        )
        job.delete()
        return success_response(
            message=(
                "Girder job deleted "
                "successfully."
            ),
            data=None,
        )


class GirderJobReviewAPIView(APIView):
    """
    The consolidated "review this whole bridge" action - marks the
    bridge-level GAD row and every activity on every span as
    reviewed at once, all with the same reviewer/timestamp/remark -
    see ``StructureReviewAPIView``.
    """

    permission_classes = [
        HasProjectMonitorReportingAccess,
    ]

    def post(self, request, pk, *args, **kwargs):
        try:
            job = GirderJob.objects.prefetch_related(
                "spans"
            ).get(pk=pk)
        except (
            GirderJob.DoesNotExist,
            ValueError,
            TypeError,
        ) as exc:
            raise NotFound(
                "Girder job not found."
            ) from exc

        _authorize_site(
            request,
            job.site,
            TASK.GIRDERS.value,
            write=False,
        )

        serializer = ReviewInputSerializer(
            data=request.data
        )
        serializer.is_valid(raise_exception=True)
        remarks = serializer.validated_data[
            "remarks"
        ]

        activities = list(
            job.activities.select_related(
                "updated_by"
            ).all()
        )
        for span in job.spans.all():
            activities += list(
                span.activities.select_related(
                    "updated_by"
                ).all()
            )
        review_activities(
            activities,
            remarks=remarks,
            actor=request.user,
        )
        notify_sheet_reviewed(
            activities=activities,
            site=job.site,
            label=job.bridge_name,
            actor=request.user,
        )

        job = _girder_job_queryset().get(
            pk=job.pk
        )

        return success_response(
            message=(
                "Girder job reviewed "
                "successfully."
            ),
            data=GirderJobSerializer(job).data,
        )


class GirderSpanUpdateAPIView(APIView):
    """
    Updates a span's freely-editable vendor/PO/drawing-no fields -
    entry-role only. Progress itself goes through the normal
    ``activity-update`` endpoint against that span's own Activity
    rows, not here.
    """

    permission_classes = [
        HasProjectMonitorPortalAccess,
    ]

    def patch(self, request, pk, *args, **kwargs):
        try:
            span = GirderSpan.objects.get(pk=pk)
        except (
            GirderSpan.DoesNotExist,
            ValueError,
            TypeError,
        ) as exc:
            raise NotFound(
                "Girder span not found."
            ) from exc

        _authorize_site(
            request,
            span.job.site,
            TASK.GIRDERS.value,
            write=True,
        )

        serializer = GirderSpanUpdateSerializer(
            data=request.data,
            partial=True,
        )
        serializer.is_valid(raise_exception=True)
        for (
            field,
            value,
        ) in serializer.validated_data.items():
            setattr(span, field, value)
        span.save(
            update_fields=list(
                serializer.validated_data.keys()
            )
            + ["updated_at"]
        )

        span = (
            GirderSpan.objects.prefetch_related(
                _activities_prefetch()
            ).get(pk=span.pk)
        )

        return success_response(
            message=(
                "Girder span updated "
                "successfully."
            ),
            data=GirderSpanSerializer(
                span
            ).data,
        )


def _action_item_queryset():
    return ActionItem.objects.prefetch_related(
        _activities_prefetch()
    )


class ActionItemListCreateAPIView(APIView):
    """
    List every Action Item on a Site (GET - Director-and-below read
    access; "Open"/"Completed" and the overdue flag are all derived
    client-side from each item's nested ``activity.status``/
    ``is_overdue``, so one list serves both tables) or record a new
    one (POST - entry-role only) - the plainest use of the shared
    Activity engine, via ``create_action_item``.
    """

    def get_permissions(self):
        if self.request.method == "POST":
            return [HasProjectMonitorPortalAccess()]
        return [HasProjectMonitorReportingAccess()]

    def get(self, request, *args, **kwargs):
        site = _get_site_from_query(request, TASK.ACTION_ITEMS.value)
        queryset = _action_item_queryset().filter(
            site=site
        )

        return success_response(
            message=(
                "Action items retrieved "
                "successfully."
            ),
            data=ActionItemSerializer(
                queryset, many=True
            ).data,
        )

    def post(self, request, *args, **kwargs):
        site = _get_site_from_query(request, TASK.ACTION_ITEMS.value, write=True)

        serializer = ActionItemCreateSerializer(
            data=request.data
        )
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        item = create_action_item(
            site=site,
            name=data["name"],
            responsibility=data.get(
                "responsibility", ""
            ),
            remarks=data.get("remarks", ""),
            target_date=data.get(
                "target_date"
            ),
            actor=request.user,
        )

        item = _action_item_queryset().get(
            pk=item.pk
        )

        return success_response(
            message=(
                "Action item recorded "
                "successfully."
            ),
            data=ActionItemSerializer(
                item
            ).data,
        )


class ActionItemDetailAPIView(APIView):
    """
    One Action Item's detail (GET - Director-and-below read access),
    editing its persistent ``responsibility``/``remarks`` (PATCH -
    entry-role only, deliberately separate from the dated meeting-
    log the normal ``activity-update`` endpoint writes to), or its
    deletion (DELETE - entry-role only).
    """

    def get_permissions(self):
        if self.request.method in (
            "PATCH",
            "DELETE",
        ):
            return [HasProjectMonitorPortalAccess()]
        return [HasProjectMonitorReportingAccess()]

    def _get_item(self, pk):
        try:
            return _action_item_queryset().get(
                pk=pk
            )
        except (
            ActionItem.DoesNotExist,
            ValueError,
            TypeError,
        ) as exc:
            raise NotFound(
                "Action item not found."
            ) from exc

    def get(self, request, pk, *args, **kwargs):
        item = self._get_item(pk)
        _authorize_site(
            request,
            item.site,
            TASK.ACTION_ITEMS.value,
            write=False,
        )
        return success_response(
            message=(
                "Action item retrieved "
                "successfully."
            ),
            data=ActionItemSerializer(
                item
            ).data,
        )

    def patch(self, request, pk, *args, **kwargs):
        item = self._get_item(pk)
        _authorize_site(
            request,
            item.site,
            TASK.ACTION_ITEMS.value,
            write=True,
        )

        serializer = ActionItemUpdateSerializer(
            data=request.data,
            partial=True,
        )
        serializer.is_valid(raise_exception=True)
        for (
            field,
            value,
        ) in serializer.validated_data.items():
            setattr(item, field, value)
        item.updated_by = request.user
        item.save(
            update_fields=list(
                serializer.validated_data.keys()
            )
            + ["updated_by", "updated_at"]
        )

        return success_response(
            message=(
                "Action item updated "
                "successfully."
            ),
            data=ActionItemSerializer(
                item
            ).data,
        )

    def delete(self, request, pk, *args, **kwargs):
        item = self._get_item(pk)
        _authorize_site(
            request,
            item.site,
            TASK.ACTION_ITEMS.value,
            write=True,
        )
        item.delete()
        return success_response(
            message=(
                "Action item deleted "
                "successfully."
            ),
            data=None,
        )


def _linear_item_queryset():
    return LinearItem.objects.prefetch_related(
        "scope_patches", "progress_entries"
    )


class LinearItemListCreateAPIView(APIView):
    """
    List every Linear Item (chainage-tracked continuous work) on a
    Site with its scope patches/progress entries/computed stats
    nested (GET - Director-and-below read access), or add a new one
    (POST - entry-role only). Deliberately not built on the generic
    Activity engine - see ``models.LinearItem``'s own docstring.
    """

    def get_permissions(self):
        if self.request.method == "POST":
            return [HasProjectMonitorPortalAccess()]
        return [HasProjectMonitorReportingAccess()]

    def get(self, request, *args, **kwargs):
        site = _get_site_from_query(request, TASK.LINEAR_WORKS.value)
        queryset = _linear_item_queryset().filter(
            site=site
        )

        return success_response(
            message=(
                "Linear items retrieved "
                "successfully."
            ),
            data=LinearItemSerializer(
                queryset, many=True
            ).data,
        )

    def post(self, request, *args, **kwargs):
        site = _get_site_from_query(request, TASK.LINEAR_WORKS.value, write=True)

        serializer = LinearItemCreateSerializer(
            data=request.data
        )
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        item = create_linear_item(
            site=site,
            name=data["name"],
            unit=data["unit"],
            actor=request.user,
        )

        item = _linear_item_queryset().get(
            pk=item.pk
        )

        return success_response(
            message=(
                "Linear item created "
                "successfully."
            ),
            data=LinearItemSerializer(
                item
            ).data,
        )


class LinearItemDetailAPIView(APIView):
    """
    One Linear Item's detail (GET) or its deletion (DELETE - entry-
    role only), cascading to every scope patch/progress entry.
    """

    def get_permissions(self):
        if self.request.method == "DELETE":
            return [HasProjectMonitorPortalAccess()]
        return [HasProjectMonitorReportingAccess()]

    def _get_item(self, pk):
        try:
            return _linear_item_queryset().get(
                pk=pk
            )
        except (
            LinearItem.DoesNotExist,
            ValueError,
            TypeError,
        ) as exc:
            raise NotFound(
                "Linear item not found."
            ) from exc

    def get(self, request, pk, *args, **kwargs):
        item = self._get_item(pk)
        _authorize_site(
            request,
            item.site,
            TASK.LINEAR_WORKS.value,
            write=False,
        )
        return success_response(
            message=(
                "Linear item retrieved "
                "successfully."
            ),
            data=LinearItemSerializer(
                item
            ).data,
        )

    def delete(self, request, pk, *args, **kwargs):
        item = self._get_item(pk)
        _authorize_site(
            request,
            item.site,
            TASK.LINEAR_WORKS.value,
            write=True,
        )
        item.delete()
        return success_response(
            message=(
                "Linear item deleted "
                "successfully."
            ),
            data=None,
        )


class ScopePatchListCreateAPIView(APIView):
    """
    Adds a scope patch to a Linear Item - entry-role only. An item
    with zero scope patches is treated as fully unrestricted (see
    ``services.linear_stats``), so this is optional, not required,
    before progress can be logged.
    """

    permission_classes = [
        HasProjectMonitorPortalAccess,
    ]

    def post(
        self, request, linear_item_pk, *args, **kwargs
    ):
        try:
            linear_item = LinearItem.objects.get(
                pk=linear_item_pk
            )
        except (
            LinearItem.DoesNotExist,
            ValueError,
            TypeError,
        ) as exc:
            raise NotFound(
                "Linear item not found."
            ) from exc

        _authorize_site(
            request,
            linear_item.site,
            TASK.LINEAR_WORKS.value,
            write=True,
        )

        serializer = ScopePatchCreateSerializer(
            data=request.data
        )
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        try:
            create_scope_patch(
                linear_item=linear_item,
                from_chainage_km=data[
                    "from_chainage_km"
                ],
                to_chainage_km=data[
                    "to_chainage_km"
                ],
                side=data["side"],
                qty=data.get("qty"),
                remarks=data.get(
                    "remarks", ""
                ),
                actor=request.user,
            )
        except DjangoValidationError as exc:
            raise ValidationError(
                exc.message_dict
            ) from exc

        linear_item = _linear_item_queryset().get(
            pk=linear_item.pk
        )

        return success_response(
            message=(
                "Scope patch added "
                "successfully."
            ),
            data=LinearItemSerializer(
                linear_item
            ).data,
        )


class ScopePatchDetailAPIView(APIView):
    """Deletes a scope patch - entry-role only."""

    permission_classes = [
        HasProjectMonitorPortalAccess,
    ]

    def delete(self, request, pk, *args, **kwargs):
        try:
            patch = ScopePatch.objects.get(
                pk=pk
            )
        except (
            ScopePatch.DoesNotExist,
            ValueError,
            TypeError,
        ) as exc:
            raise NotFound(
                "Scope patch not found."
            ) from exc

        _authorize_site(
            request,
            patch.linear_item.site,
            TASK.LINEAR_WORKS.value,
            write=True,
        )

        patch.delete()

        return success_response(
            message=(
                "Scope patch deleted "
                "successfully."
            ),
            data=None,
        )


class ProgressEntryListCreateAPIView(APIView):
    """
    Logs a progress entry against a Linear Item - entry-role only.
    Accepted regardless of scope coverage (the interval math already
    naturally excludes any out-of-scope portion from the Done/
    Ongoing totals - see ``services.linear_stats``); there's no hard
    block here, only the chainage-range validation on the model
    itself.
    """

    permission_classes = [
        HasProjectMonitorPortalAccess,
    ]

    def post(
        self, request, linear_item_pk, *args, **kwargs
    ):
        try:
            linear_item = LinearItem.objects.get(
                pk=linear_item_pk
            )
        except (
            LinearItem.DoesNotExist,
            ValueError,
            TypeError,
        ) as exc:
            raise NotFound(
                "Linear item not found."
            ) from exc

        _authorize_site(
            request,
            linear_item.site,
            TASK.LINEAR_WORKS.value,
            write=True,
        )

        serializer = (
            ProgressEntryCreateSerializer(
                data=request.data
            )
        )
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        try:
            create_progress_entry(
                linear_item=linear_item,
                date=data["date"],
                from_chainage_km=data[
                    "from_chainage_km"
                ],
                to_chainage_km=data[
                    "to_chainage_km"
                ],
                side=data["side"],
                status=data["status"],
                meeting_date=data[
                    "meeting_date"
                ],
                qty=data.get("qty"),
                contractor=data.get(
                    "contractor", ""
                ),
                remarks=data.get(
                    "remarks", ""
                ),
                actor=request.user,
            )
        except DjangoValidationError as exc:
            raise ValidationError(
                exc.message_dict
            ) from exc

        linear_item = _linear_item_queryset().get(
            pk=linear_item.pk
        )

        return success_response(
            message=(
                "Progress entry recorded "
                "successfully."
            ),
            data=LinearItemSerializer(
                linear_item
            ).data,
        )


class ProgressEntryDetailAPIView(APIView):
    """
    Editing (PATCH - matching the prototype's own ``editEntry``) or
    deleting (DELETE) a progress entry - entry-role only.
    """

    permission_classes = [
        HasProjectMonitorPortalAccess,
    ]

    def _get_entry(self, pk):
        try:
            return ProgressEntry.objects.get(
                pk=pk
            )
        except (
            ProgressEntry.DoesNotExist,
            ValueError,
            TypeError,
        ) as exc:
            raise NotFound(
                "Progress entry not found."
            ) from exc

    def patch(self, request, pk, *args, **kwargs):
        entry = self._get_entry(pk)
        _authorize_site(
            request,
            entry.linear_item.site,
            TASK.LINEAR_WORKS.value,
            write=True,
        )

        serializer = (
            ProgressEntryUpdateSerializer(
                data=request.data,
                partial=True,
            )
        )
        serializer.is_valid(raise_exception=True)
        for (
            field,
            value,
        ) in serializer.validated_data.items():
            setattr(entry, field, value)
        entry.updated_by = request.user
        try:
            entry.save(
                update_fields=list(
                    serializer.validated_data.keys()
                )
                + ["updated_by", "updated_at"]
            )
        except DjangoValidationError as exc:
            raise ValidationError(
                exc.message_dict
            ) from exc

        linear_item = (
            _linear_item_queryset().get(
                pk=entry.linear_item_id
            )
        )

        return success_response(
            message=(
                "Progress entry updated "
                "successfully."
            ),
            data=LinearItemSerializer(
                linear_item
            ).data,
        )

    def delete(self, request, pk, *args, **kwargs):
        entry = self._get_entry(pk)
        _authorize_site(
            request,
            entry.linear_item.site,
            TASK.LINEAR_WORKS.value,
            write=True,
        )
        entry.delete()
        return success_response(
            message=(
                "Progress entry deleted "
                "successfully."
            ),
            data=None,
        )


class ActivityUpdateAPIView(APIView):
    """
    Apply one "meeting update" action to a single Activity row -
    entry-role only. Direct port of the prototype's ``applyUpdate``
    call from its cell-click editor / inline update row, via the
    shared ``activity_engine.apply_update`` built in Phase 1.
    """

    permission_classes = [
        HasProjectMonitorPortalAccess,
    ]

    def _get_activity(self, pk):
        try:
            return Activity.objects.get(pk=pk)
        except (
            Activity.DoesNotExist,
            ValueError,
            TypeError,
        ) as exc:
            raise NotFound(
                "Activity not found."
            ) from exc

    def patch(self, request, pk, *args, **kwargs):
        activity = self._get_activity(pk)
        _authorize_site(
            request,
            resolve_activity_site(activity),
            resolve_activity_task(activity),
            write=True,
        )

        serializer = ActivityUpdateSerializer(
            data=request.data
        )
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        apply_update(
            activity,
            meeting_date=data["meeting_date"],
            new_target_date=data.get(
                "new_target_date"
            ),
            status=data.get("status"),
            done_qty=data.get("done_qty"),
            comment=data.get("comment", ""),
            is_hindrance=data.get(
                "is_hindrance"
            ),
            hindrance_expected_removal_date=data.get(
                "hindrance_expected_removal_date"
            ),
            hindrance_actual_removal_date=data.get(
                "hindrance_actual_removal_date"
            ),
            hindrance_remarks=data.get(
                "hindrance_remarks"
            ),
            actor=request.user,
        )

        if data.get("material_status"):
            apply_material_status_update(
                activity,
                material_status=data[
                    "material_status"
                ],
                meeting_date=data[
                    "meeting_date"
                ],
                actor=request.user,
            )

        notify_director_of_update(
            activity=activity,
            meeting_date=data["meeting_date"],
            actor=request.user,
        )

        activity = Activity.objects.prefetch_related(
            "date_entries", "comments"
        ).get(pk=activity.pk)

        return success_response(
            message=(
                "Activity updated successfully."
            ),
            data=ActivitySerializer(activity).data,
        )


class ActivityReviewAPIView(APIView):
    """
    Mark one Activity row as reviewed - a lightweight Director/PM
    sign-off (who + when + an optional remark), entirely separate
    from editing. Re-reviewing simply overwrites the previous
    sign-off. Open to Director-and-below (the same role set that can
    already see this data), not just entry-role users - reviewing
    isn't gated by who can edit.
    """

    permission_classes = [
        HasProjectMonitorReportingAccess,
    ]

    def post(self, request, pk, *args, **kwargs):
        try:
            activity = Activity.objects.get(pk=pk)
        except (
            Activity.DoesNotExist,
            ValueError,
            TypeError,
        ) as exc:
            raise NotFound(
                "Activity not found."
            ) from exc

        _authorize_site(
            request,
            resolve_activity_site(activity),
            resolve_activity_task(activity),
            write=False,
        )

        serializer = ReviewInputSerializer(
            data=request.data
        )
        serializer.is_valid(raise_exception=True)

        apply_review(
            activity,
            remarks=serializer.validated_data[
                "remarks"
            ],
            actor=request.user,
        )

        notify_activity_reviewed(
            activity=activity,
            actor=request.user,
        )

        activity = Activity.objects.prefetch_related(
            "date_entries", "comments"
        ).get(pk=activity.pk)

        return success_response(
            message=(
                "Activity reviewed successfully."
            ),
            data=ActivitySerializer(activity).data,
        )


class StructureTypeListCreateAPIView(APIView):
    """
    The Structure Type master: every type (Minor Bridge/Major
    Bridge/RUB/ROB seeded as built-ins, plus whatever an Admin has
    since added) that the "Add a structure" form and matrix can
    offer. GET defaults to active types only (what an entry user
    should be offered); pass ``?all=1`` (the Admin settings page)
    to see inactive ones too, so they can be reactivated.
    """

    permission_classes = [
        HasProjectMonitorMasterAccess,
    ]

    def get(self, request, *args, **kwargs):
        queryset = (
            StructureTypeDefinition.objects.all()
        )
        if not request.query_params.get("all"):
            queryset = queryset.filter(
                is_active=True
            )

        return success_response(
            message=(
                "Structure types retrieved "
                "successfully."
            ),
            data=StructureTypeSerializer(
                queryset, many=True
            ).data,
        )

    def post(self, request, *args, **kwargs):
        serializer = StructureTypeSerializer(
            data=request.data
        )
        serializer.is_valid(raise_exception=True)
        instance = serializer.save(
            created_by=request.user,
            updated_by=request.user,
        )

        return success_response(
            message=(
                "Structure type created "
                "successfully."
            ),
            data=StructureTypeSerializer(
                instance
            ).data,
        )


class StructureTypeDetailAPIView(APIView):
    """
    Update or delete one Structure Type master row. A type still
    used by real structures is protected at the database level
    (``on_delete=PROTECT``) - deactivate it instead so it stops
    being offered on the "Add a structure" form without losing the
    history of structures already built from it.
    """

    permission_classes = [
        HasProjectMonitorMasterAccess,
    ]

    def _get_definition(self, pk):
        try:
            return (
                StructureTypeDefinition.objects.get(
                    pk=pk
                )
            )
        except (
            StructureTypeDefinition.DoesNotExist,
            ValueError,
            TypeError,
        ) as exc:
            raise NotFound(
                "Structure type not found."
            ) from exc

    def patch(self, request, pk, *args, **kwargs):
        definition = self._get_definition(pk)
        serializer = StructureTypeSerializer(
            definition,
            data=request.data,
            partial=True,
        )
        serializer.is_valid(raise_exception=True)
        serializer.save(
            updated_by=request.user
        )

        return success_response(
            message=(
                "Structure type updated "
                "successfully."
            ),
            data=StructureTypeSerializer(
                definition
            ).data,
        )

    def delete(self, request, pk, *args, **kwargs):
        definition = self._get_definition(pk)

        try:
            definition.delete()
        except ProtectedError as exc:
            raise ValidationError(
                "This structure type can't be "
                "deleted - it's still referenced "
                "by "
                f"{self._describe_protected_objects(exc)}. "
                "Deactivate it instead so it "
                "stops being offered without "
                "losing that history."
            ) from exc

        return success_response(
            message=(
                "Structure type deleted "
                "successfully."
            ),
            data=None,
        )

    @staticmethod
    def _describe_protected_objects(exc):
        counts = Counter(
            type(obj)._meta.verbose_name_plural
            for obj in exc.protected_objects
        )
        return ", ".join(
            f"{count} {label}"
            for label, count in sorted(
                counts.items()
            )
        )


class RdsoSpanLibraryEntryListCreateAPIView(
    APIView
):
    """
    The RDSO standard span library: every entry (the 7 built-in
    standard spans, plus whatever an Admin has since added/edited)
    that the "Add girder job" span picker offers. GET defaults to
    active entries only; pass ``?all=1`` (the Admin settings page)
    to see inactive ones too, mirroring
    ``StructureTypeListCreateAPIView``.
    """

    permission_classes = [
        HasProjectMonitorMasterAccess,
    ]

    def get(self, request, *args, **kwargs):
        queryset = (
            RdsoSpanLibraryEntry.objects.all()
        )
        if not request.query_params.get("all"):
            queryset = queryset.filter(
                is_active=True
            )

        return success_response(
            message=(
                "RDSO span library retrieved "
                "successfully."
            ),
            data=RdsoSpanLibraryEntrySerializer(
                queryset, many=True
            ).data,
        )

    def post(self, request, *args, **kwargs):
        serializer = (
            RdsoSpanLibraryEntrySerializer(
                data=request.data
            )
        )
        serializer.is_valid(raise_exception=True)
        instance = serializer.save(
            created_by=request.user,
            updated_by=request.user,
        )

        return success_response(
            message=(
                "RDSO span library entry "
                "created successfully."
            ),
            data=RdsoSpanLibraryEntrySerializer(
                instance
            ).data,
        )


class RdsoSpanLibraryEntryDetailAPIView(
    APIView
):
    """
    Update or delete one RDSO span library entry. Unlike Structure
    Types, an entry isn't FK-referenced by anything (a span copies
    its values in at pick-time, display/audit only), so a real
    delete is always safe - deactivate instead only if it's still
    wanted for history's sake.
    """

    permission_classes = [
        HasProjectMonitorMasterAccess,
    ]

    def _get_entry(self, pk):
        try:
            return (
                RdsoSpanLibraryEntry.objects.get(
                    pk=pk
                )
            )
        except (
            RdsoSpanLibraryEntry.DoesNotExist,
            ValueError,
            TypeError,
        ) as exc:
            raise NotFound(
                "RDSO span library entry not "
                "found."
            ) from exc

    def patch(self, request, pk, *args, **kwargs):
        entry = self._get_entry(pk)
        serializer = (
            RdsoSpanLibraryEntrySerializer(
                entry,
                data=request.data,
                partial=True,
            )
        )
        serializer.is_valid(raise_exception=True)
        serializer.save(
            updated_by=request.user
        )

        return success_response(
            message=(
                "RDSO span library entry "
                "updated successfully."
            ),
            data=RdsoSpanLibraryEntrySerializer(
                entry
            ).data,
        )

    def delete(self, request, pk, *args, **kwargs):
        entry = self._get_entry(pk)
        entry.delete()

        return success_response(
            message=(
                "RDSO span library entry "
                "deleted successfully."
            ),
            data=None,
        )
