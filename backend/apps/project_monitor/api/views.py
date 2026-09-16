from collections import Counter

from django.contrib.contenttypes.models import ContentType
from django.db.models import Count, Prefetch
from django.db.models.deletion import ProtectedError
from rest_framework.exceptions import (
    NotFound,
    ValidationError,
)
from rest_framework.views import APIView

from apps.core.api.responses import success_response
from apps.organization.models import Site
from apps.project_monitor.api.permissions import (
    HasProjectMonitorMasterAccess,
    HasProjectMonitorPortalAccess,
    HasProjectMonitorReportingAccess,
)
from apps.project_monitor.api.serializers import (
    ActivitySerializer,
    ActivityUpdateSerializer,
    BuildingCreateSerializer,
    BuildingSerializer,
    GirderJobCreateSerializer,
    GirderJobSerializer,
    GirderSpanSerializer,
    GirderSpanUpdateSerializer,
    ProjectExtensionCreateSerializer,
    ProjectExtensionSerializer,
    ProjectSiteDetailsUpdateSerializer,
    ProjectSiteSerializer,
    RdsoSpanLibraryEntrySerializer,
    ReviewInputSerializer,
    StructureCreateSerializer,
    StructureSerializer,
    StructureTypeSerializer,
)
from apps.project_monitor.models import (
    Activity,
    ActivityStatus,
    Building,
    GirderJob,
    GirderSpan,
    ProjectExtension,
    RdsoSpanLibraryEntry,
    Structure,
    StructureTypeDefinition,
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
from apps.project_monitor.services.review import (
    apply_review,
    review_activities,
)
from apps.project_monitor.services.structure_generator import (
    create_structure,
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


def _get_site_from_query(request):
    site_id = request.query_params.get("site")
    if not site_id:
        raise ValidationError(
            {"site": "Site is required."}
        )

    try:
        return Site.objects.get(pk=site_id)
    except (
        Site.DoesNotExist,
        ValueError,
        TypeError,
    ) as exc:
        raise ValidationError(
            {"site": "Site not found."}
        ) from exc


class ProjectOverviewAPIView(APIView):
    """
    One project's (= one Site's) Project Monitor overview: its core
    identity/chainage plus a KPI-shaped counts block. Structures/
    Buildings/Girders counts are real as of their respective phases;
    Linear/Action Items stay zero until their own phases land, so
    the frontend overview page doesn't need to change contract as
    the module grows.

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
        site = _get_site_from_query(request)

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
            "linear": {
                "done_m": 0,
                "scope_m": 0,
            },
            "action_items": {
                "open": 0,
                "overdue": 0,
            },
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
        site = _get_site_from_query(request)

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
        site = _get_site_from_query(request)
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
        site = _get_site_from_query(request)

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

        extension.delete()

        return success_response(
            message=(
                "Project extension deleted "
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
        site = _get_site_from_query(request)
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
        site = _get_site_from_query(request)

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
    read access) or its deletion (DELETE - entry-role only),
    mirroring the prototype's "Delete this structure sheet and all
    its data?" action. Deleting cascades to every Activity row via
    ``Structure.activities`` (a ``GenericRelation``).
    """

    def get_permissions(self):
        if self.request.method == "DELETE":
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
        return success_response(
            message=(
                "Structure retrieved successfully."
            ),
            data=StructureSerializer(structure).data,
        )

    def delete(self, request, pk, *args, **kwargs):
        structure = self._get_structure(pk)
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

        serializer = ReviewInputSerializer(
            data=request.data
        )
        serializer.is_valid(raise_exception=True)

        review_activities(
            structure.activities.all(),
            remarks=serializer.validated_data[
                "remarks"
            ],
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
        site = _get_site_from_query(request)

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
        site = _get_site_from_query(request)

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
        return success_response(
            message=(
                "Building retrieved successfully."
            ),
            data=BuildingSerializer(building).data,
        )

    def delete(self, request, pk, *args, **kwargs):
        building = self._get_building(pk)
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

        serializer = ReviewInputSerializer(
            data=request.data
        )
        serializer.is_valid(raise_exception=True)

        review_activities(
            building.activities.all(),
            remarks=serializer.validated_data[
                "remarks"
            ],
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
        site = _get_site_from_query(request)

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
        site = _get_site_from_query(request)

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
        return success_response(
            message=(
                "Girder job retrieved "
                "successfully."
            ),
            data=GirderJobSerializer(job).data,
        )

    def delete(self, request, pk, *args, **kwargs):
        job = self._get_job(pk)
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

        serializer = ReviewInputSerializer(
            data=request.data
        )
        serializer.is_valid(raise_exception=True)
        remarks = serializer.validated_data[
            "remarks"
        ]

        activities = list(job.activities.all())
        for span in job.spans.all():
            activities += list(
                span.activities.all()
            )
        review_activities(
            activities,
            remarks=remarks,
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
