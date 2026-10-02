from django.utils import timezone
from rest_framework import serializers

from apps.organization.api.serializers import (
    CleanModelSerializer,
)
from apps.organization.models import Site
from apps.project_monitor.models import (
    ActionItem,
    Activity,
    ActivityComment,
    ActivityDateEntry,
    ActivityEditAccessRequest,
    ActivityKind,
    ActivityStatus,
    Building,
    ChainageSegment,
    GirderJob,
    GirderScope,
    GirderSpan,
    GirderStructureKind,
    LinearItem,
    LinearSide,
    LinearUnit,
    MaterialStatus,
    ProgressEntry,
    ProjectExtension,
    RdsoSpanLibraryEntry,
    ScopePatch,
    Structure,
    StructureLocation,
    StructureLocationType,
    StructureTypeDefinition,
)
from apps.project_monitor.services.linear_diagram import (
    compute_diagram,
)
from apps.project_monitor.services.linear_stats import (
    compute_item_stats,
)
from apps.project_monitor.services.notifications import (
    resolve_activity_site,
)
from apps.project_monitor.services.structure_generator import (
    validate_definition_schema,
)
from apps.project_monitor.services.timeline import (
    days_remaining,
    effective_end_date,
)

COUNTDOWN_GREEN_THRESHOLD_DAYS = 30
COUNTDOWN_ORANGE_THRESHOLD_DAYS = 15


class ChainageSegmentSerializer(
    serializers.ModelSerializer
):
    class Meta:
        model = ChainageSegment
        fields = [
            "id",
            "from_chainage_km",
            "to_chainage_km",
            "vendor",
        ]
        read_only_fields = fields


class ChainageSegmentCreateSerializer(
    serializers.Serializer
):
    from_chainage_km = serializers.DecimalField(
        max_digits=8, decimal_places=3
    )
    to_chainage_km = serializers.DecimalField(
        max_digits=8, decimal_places=3
    )
    vendor = serializers.CharField(
        required=False,
        allow_blank=True,
        default="",
        max_length=150,
    )


class ProjectExtensionSerializer(
    serializers.ModelSerializer
):
    created_by_name = serializers.CharField(
        source="created_by.full_name",
        read_only=True,
        default="",
    )

    class Meta:
        model = ProjectExtension
        fields = [
            "id",
            "new_end_date",
            "reason",
            "created_by_name",
            "created_at",
        ]
        read_only_fields = fields


class ProjectExtensionCreateSerializer(
    serializers.Serializer
):
    new_end_date = serializers.DateField()
    reason = serializers.CharField(
        required=False,
        allow_blank=True,
        default="",
    )


class ProjectSiteSerializer(serializers.ModelSerializer):
    """
    The subset of Site fields the Project Monitor overview needs -
    Project Monitor treats an existing Site as its "project" (see
    the Phase 1 plan), so this reads straight off Site rather than a
    separate parent entity.
    """

    site_director_name = serializers.CharField(
        source="site_director.full_name",
        read_only=True,
        default="",
    )
    site_hod_name = serializers.CharField(
        source="site_hod.full_name",
        read_only=True,
        default="",
    )
    extensions = ProjectExtensionSerializer(
        many=True, read_only=True
    )
    chainage_segments = ChainageSegmentSerializer(
        many=True, read_only=True
    )
    effective_end_date = (
        serializers.SerializerMethodField()
    )
    days_remaining = (
        serializers.SerializerMethodField()
    )
    countdown_status = (
        serializers.SerializerMethodField()
    )

    class Meta:
        model = Site
        fields = [
            "id",
            "site_code",
            "site_name",
            "project_name",
            "client_or_section",
            "chainage_start_km",
            "chainage_end_km",
            "project_value",
            "start_date",
            "end_date",
            "extensions",
            "chainage_segments",
            "effective_end_date",
            "days_remaining",
            "countdown_status",
            "site_director",
            "site_director_name",
            "site_hod",
            "site_hod_name",
        ]
        read_only_fields = fields

    def get_effective_end_date(self, obj):
        return effective_end_date(obj)

    def get_days_remaining(self, obj):
        return days_remaining(obj)

    def get_countdown_status(self, obj):
        days_remaining = self.get_days_remaining(
            obj
        )
        if days_remaining is None:
            return None
        if (
            days_remaining
            > COUNTDOWN_GREEN_THRESHOLD_DAYS
        ):
            return "GREEN"
        if (
            days_remaining
            >= COUNTDOWN_ORANGE_THRESHOLD_DAYS
        ):
            return "ORANGE"
        return "RED"


class ProjectSiteDetailsUpdateSerializer(
    CleanModelSerializer
):
    """
    The narrow slice of Site fields a Project Manager may edit from
    the Project Monitor overview page - deliberately NOT the full
    Site write surface, since ``HasOrganizationAccess`` reserves
    that for Admin/Super Admin. A Project Manager has no
    organization-wide write access, so this update goes through
    Project Monitor's own ``HasProjectMonitorPortalAccess``-gated
    endpoint instead of the organization Sites endpoint.
    """

    class Meta:
        model = Site
        fields = [
            "project_name",
            "start_date",
            "end_date",
            "project_value",
            "chainage_start_km",
            "chainage_end_km",
            "client_or_section",
        ]


class ActivityDateEntrySerializer(
    serializers.ModelSerializer
):
    class Meta:
        model = ActivityDateEntry
        fields = [
            "id",
            "target_date",
            "meeting_date",
        ]
        read_only_fields = fields


class ActivityCommentSerializer(
    serializers.ModelSerializer
):
    created_by_name = serializers.CharField(
        source="created_by.full_name",
        read_only=True,
        default="",
    )

    class Meta:
        model = ActivityComment
        fields = [
            "id",
            "meeting_date",
            "text",
            "created_by_name",
            "created_at",
        ]
        read_only_fields = fields


class ActivityCommentMeetingDateUpdateSerializer(
    serializers.Serializer
):
    """
    Correcting a past meeting-update's meeting date (e.g. typed by
    mistake) - the one field of an otherwise append-only
    ``ActivityComment`` that may be fixed after the fact, gated by the
    same 48-hour edit window as every other change to the activity
    (see ``ActivityCommentUpdateAPIView``).
    """

    meeting_date = serializers.DateField()


class ActivitySerializer(serializers.ModelSerializer):
    """
    One Activity row plus its full date-revision history and
    meeting-dated comment log - the shape the frontend's timeline
    component (segmented progress bar -> expandable vertical
    timeline) reads directly. Expects ``date_entries``/``comments``
    to already be prefetched by the view (see
    ``StructureSerializer.get_groups``) - no query happens here.
    """

    current_target_date = (
        serializers.SerializerMethodField()
    )
    date_history = ActivityDateEntrySerializer(
        source="date_entries",
        many=True,
        read_only=True,
    )
    comments = ActivityCommentSerializer(
        many=True,
        read_only=True,
    )
    reviewed_by_name = serializers.CharField(
        source="reviewed_by.full_name",
        read_only=True,
        default="",
    )

    class Meta:
        model = Activity
        fields = [
            "id",
            "name",
            "kind",
            "unit",
            "total_qty",
            "done_qty",
            "status",
            "is_doc",
            "material_tracked",
            "material_status",
            "completed_on",
            "row_order",
            "current_target_date",
            "date_history",
            "comments",
            "is_hindrance",
            "hindrance_expected_removal_date",
            "hindrance_actual_removal_date",
            "hindrance_remarks",
            "reviewed_by_name",
            "reviewed_at",
            "review_remarks",
            "is_custom",
            "is_hidden",
        ]
        read_only_fields = fields

    def get_current_target_date(self, obj):
        entries = list(obj.date_entries.all())
        return (
            entries[-1].target_date.isoformat()
            if entries
            else None
        )


class ActivityGroupedSerializerMixin:
    """
    Re-assembles a parent's (Structure's or Building's) Activity rows
    into the same ``groups`` shape the generator produced them in
    (Approvals first, then each generator group in order) - relies
    on the view's ``Prefetch`` ordering ``activities`` by
    ``(group_order, row_order)`` so this does zero extra queries.
    Shared because Buildings need exactly the same re-assembly logic
    Structures do.
    """

    def get_groups(self, obj):
        activities = [
            a
            for a in obj.activities.all()
            if not a.is_hidden
        ]
        docs = [
            a for a in activities if a.group_order == 0
        ]
        grouped = {}
        order_seen = []
        for activity in activities:
            if activity.group_order == 0:
                continue
            key = (
                activity.group_order,
                activity.group_title,
                activity.group_subtitle,
            )
            if key not in grouped:
                grouped[key] = []
                order_seen.append(key)
            grouped[key].append(activity)

        result = []
        if docs:
            result.append(
                {
                    "group_title": "Approvals",
                    "group_subtitle": "",
                    "group_order": 0,
                    "rows": ActivitySerializer(
                        docs, many=True
                    ).data,
                }
            )
        for key in order_seen:
            group_order, title, subtitle = key
            result.append(
                {
                    "group_title": title,
                    "group_subtitle": subtitle,
                    "group_order": group_order,
                    "rows": ActivitySerializer(
                        grouped[key], many=True
                    ).data,
                }
            )
        return result

    def get_overall_progress(self, obj):
        activities = [
            a
            for a in obj.activities.all()
            if not a.is_hidden
            and a.status
            != ActivityStatus.NOT_APPLICABLE
        ]
        done = sum(
            1
            for a in activities
            if a.status == ActivityStatus.COMPLETE
        )
        return {
            "done": done,
            "total": len(activities),
        }

    def get_hidden_activities(self, obj):
        """
        The rows hidden from this sheet - shown separately so they
        can be brought back (see ``ActivityUnhideAPIView``), never
        mixed into ``groups`` itself.
        """
        return [
            {
                "id": str(activity.id),
                "name": activity.name,
                "group_title": activity.group_title,
            }
            for activity in obj.activities.all()
            if activity.is_hidden
        ]


class StructureLocationSerializer(
    serializers.ModelSerializer
):
    class Meta:
        model = StructureLocation
        fields = [
            "id",
            "location_type",
            "name",
            "chainage_km",
            "remarks",
        ]
        read_only_fields = fields


class StructureLocationCreateSerializer(
    serializers.Serializer
):
    location_type = serializers.ChoiceField(
        choices=StructureLocationType.choices,
        required=False,
        default=StructureLocationType.CHAINAGE,
    )
    name = serializers.CharField(
        required=False,
        allow_blank=True,
        default="",
        max_length=100,
    )
    chainage_km = serializers.DecimalField(
        max_digits=8,
        decimal_places=3,
        required=False,
        allow_null=True,
    )
    remarks = serializers.CharField(
        required=False,
        allow_blank=True,
        default="",
    )


class StructureSerializer(
    ActivityGroupedSerializerMixin,
    serializers.ModelSerializer,
):
    """
    A Structure with its Activity rows re-assembled into the
    ``groups`` shape - see ``ActivityGroupedSerializerMixin``.
    """

    groups = serializers.SerializerMethodField()
    overall_progress = (
        serializers.SerializerMethodField()
    )
    hidden_activities = (
        serializers.SerializerMethodField()
    )
    structure_type_code = serializers.CharField(
        source="structure_type.code",
        read_only=True,
    )
    structure_type_name = serializers.CharField(
        source="structure_type.name",
        read_only=True,
    )
    locations = StructureLocationSerializer(
        many=True, read_only=True
    )

    class Meta:
        model = Structure
        fields = [
            "id",
            "site",
            "structure_type",
            "structure_type_code",
            "structure_type_name",
            "name",
            "chainage_km",
            "config",
            "description",
            "locations",
            "created_at",
            "updated_at",
            "groups",
            "overall_progress",
            "hidden_activities",
        ]
        read_only_fields = fields


class BuildingSerializer(
    ActivityGroupedSerializerMixin,
    serializers.ModelSerializer,
):
    """
    A Building with its Activity rows re-assembled into the
    ``groups`` shape - see ``ActivityGroupedSerializerMixin``.
    """

    groups = serializers.SerializerMethodField()
    overall_progress = (
        serializers.SerializerMethodField()
    )
    hidden_activities = (
        serializers.SerializerMethodField()
    )

    class Meta:
        model = Building
        fields = [
            "id",
            "site",
            "station_label",
            "name",
            "chainage_km",
            "config",
            "description",
            "created_at",
            "updated_at",
            "groups",
            "overall_progress",
            "hidden_activities",
        ]
        read_only_fields = fields


class BuildingCreateSerializer(
    serializers.Serializer
):
    """
    Input validation only - ``create_building`` does the actual
    config normalization/generation via the shared template engine.
    """

    name = serializers.CharField(max_length=150)
    station_label = serializers.CharField(
        max_length=150,
        required=False,
        allow_blank=True,
    )
    chainage_km = serializers.DecimalField(
        max_digits=8,
        decimal_places=3,
        required=False,
        allow_null=True,
    )
    config = serializers.DictField(required=False)

    def validate_name(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError(
                "Give the building a name."
            )
        return value


class StructureTypeSerializer(
    serializers.ModelSerializer
):
    """
    The full Structure Type master record, JSON schema fields
    included - both the Admin "Structure Types" settings page (full
    CRUD) and the Project Manager's "Add a structure" form (read
    only, to know what fields/groups to render) use this same
    shape.

    ``owner_site``/``distributed_sites`` are deliberately not
    writable here - who may own or distribute a type is a permission
    decision (see ``services.structure_type_scope``), set by the view
    directly on the model instance, never from client-supplied data.
    """

    owner_site_name = serializers.CharField(
        source="owner_site.site_name",
        read_only=True,
        default=None,
    )
    distributed_site_ids = serializers.PrimaryKeyRelatedField(
        source="distributed_sites",
        many=True,
        read_only=True,
    )
    distributed_site_names = serializers.SerializerMethodField()

    class Meta:
        model = StructureTypeDefinition
        fields = [
            "id",
            "code",
            "name",
            "description_template",
            "config_schema",
            "group_templates",
            "include_approval_docs",
            "display_order",
            "is_active",
            "owner_site",
            "owner_site_name",
            "distributed_site_ids",
            "distributed_site_names",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "owner_site",
            "created_at",
            "updated_at",
        ]

    def get_distributed_site_names(self, obj):
        return [
            site.site_name
            for site in obj.distributed_sites.all()
        ]

    def validate(self, attrs):
        attrs = super().validate(attrs)

        config_schema = attrs.get(
            "config_schema",
            getattr(
                self.instance,
                "config_schema",
                [],
            ),
        )
        group_templates = attrs.get(
            "group_templates",
            getattr(
                self.instance,
                "group_templates",
                [],
            ),
        )
        errors = validate_definition_schema(
            config_schema, group_templates
        )
        if errors:
            raise serializers.ValidationError(
                {"group_templates": errors}
            )
        return attrs


class StructureCreateSerializer(serializers.Serializer):
    """
    Input validation only - ``create_structure`` (the service that
    actually builds the Activity rows) does its own, per-type
    normalization of ``config`` via ``normalize_config``.
    """

    structure_type = (
        serializers.PrimaryKeyRelatedField(
            queryset=(
                StructureTypeDefinition.objects.filter(
                    is_active=True
                )
            ),
        )
    )
    name = serializers.CharField(max_length=150)
    chainage_km = serializers.DecimalField(
        max_digits=8,
        decimal_places=3,
        required=False,
        allow_null=True,
    )
    config = serializers.DictField(required=False)

    def validate_name(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError(
                "Give the structure an ID / name."
            )
        return value


class StructureUpdateSerializer(serializers.Serializer):
    """
    Everything about a structure that "Add a structure" itself
    collects - name, chainage, and the parametric ``config`` -
    editable after the fact. When ``config`` is included, the view
    re-runs ``structure_generator.update_structure`` to reconcile the
    activity sheet against it (see that function's docstring for
    the reconciliation rule); when it is left out, this is a plain
    name/chainage edit that never touches the activity sheet.
    """

    name = serializers.CharField(
        max_length=150, required=False
    )
    chainage_km = serializers.DecimalField(
        max_digits=8,
        decimal_places=3,
        required=False,
        allow_null=True,
    )
    config = serializers.DictField(
        required=False
    )

    def validate_name(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError(
                "Give the structure an ID / name."
            )
        return value


class ActivityUpdateSerializer(serializers.Serializer):
    """
    One "meeting update" action - passed straight through to
    ``activity_engine.apply_update``, which composes whatever
    changed into a single dated log line.
    """

    meeting_date = serializers.DateField()
    new_target_date = serializers.DateField(
        required=False,
        allow_null=True,
    )
    status = serializers.ChoiceField(
        choices=ActivityStatus.choices,
        required=False,
        allow_null=True,
    )
    done_qty = serializers.DecimalField(
        max_digits=12,
        decimal_places=3,
        required=False,
        allow_null=True,
    )
    comment = serializers.CharField(
        required=False,
        allow_blank=True,
        default="",
    )
    material_status = serializers.ChoiceField(
        choices=MaterialStatus.choices,
        required=False,
        allow_null=True,
    )
    is_hindrance = serializers.BooleanField(
        required=False,
    )
    hindrance_expected_removal_date = (
        serializers.DateField(
            required=False,
            allow_null=True,
        )
    )
    hindrance_actual_removal_date = (
        serializers.DateField(
            required=False,
            allow_null=True,
        )
    )
    hindrance_remarks = serializers.CharField(
        required=False,
        allow_blank=True,
    )


class CustomActivityCreateSerializer(serializers.Serializer):
    """
    Input for the "+" next to a sheet's section button
    (``activity_engine.add_custom_activity``): which existing section
    it joins, its name and kind, and where in that section it lands.
    """

    group_title = serializers.CharField(max_length=150)
    name = serializers.CharField(max_length=200)
    kind = serializers.ChoiceField(
        choices=ActivityKind.choices,
        default=ActivityKind.TASK,
    )
    unit = serializers.CharField(
        max_length=20,
        required=False,
        allow_blank=True,
        default="",
    )
    position = serializers.ChoiceField(
        choices=["end", "before", "after"],
        default="end",
    )
    relative_activity_id = serializers.UUIDField(
        required=False,
        allow_null=True,
    )

    def validate(self, attrs):
        if (
            attrs["position"] in ("before", "after")
            and not attrs.get("relative_activity_id")
        ):
            raise serializers.ValidationError(
                {
                    "relative_activity_id": (
                        "Pick which task this goes "
                        f"{attrs['position']}."
                    )
                }
            )
        return attrs


class ReviewInputSerializer(serializers.Serializer):
    """
    Input for both the per-activity review endpoint and the
    "review every activity on this sheet" consolidated endpoint -
    an optional remark is all either one takes.
    """

    remarks = serializers.CharField(
        required=False,
        allow_blank=True,
        default="",
    )


class EditAccessRequestCreateSerializer(
    serializers.Serializer
):
    reason = serializers.CharField(
        required=False,
        allow_blank=True,
        default="",
    )


class EditAccessDecisionSerializer(
    serializers.Serializer
):
    remarks = serializers.CharField(
        required=False,
        allow_blank=True,
        default="",
    )


class ActivityEditAccessRequestSerializer(
    serializers.ModelSerializer
):
    """
    One Project Manager/Incharge's request to keep editing or hiding
    a task past its 48-hour window - enough context (which task, on
    which site/element) for an Admin/Director to decide it without
    opening the sheet itself.
    """

    activity_name = serializers.CharField(
        source="activity.name", read_only=True
    )
    activity_group_title = serializers.CharField(
        source="activity.group_title",
        read_only=True,
    )
    parent_label = serializers.SerializerMethodField()
    site_id = serializers.SerializerMethodField()
    site_name = serializers.SerializerMethodField()
    requested_by_name = serializers.CharField(
        source="created_by.full_name",
        read_only=True,
        default="",
    )
    decided_by_name = serializers.CharField(
        source="decided_by.full_name",
        read_only=True,
        default="",
    )

    class Meta:
        model = ActivityEditAccessRequest
        fields = [
            "id",
            "activity",
            "activity_name",
            "activity_group_title",
            "parent_label",
            "site_id",
            "site_name",
            "reason",
            "status",
            "requested_by_name",
            "created_at",
            "decided_by_name",
            "decided_at",
            "decision_remarks",
            "access_until",
        ]
        read_only_fields = fields

    def get_parent_label(self, obj):
        parent = obj.activity.parent
        if parent is None:
            return ""
        for attr in ("name", "bridge_name", "label"):
            value = getattr(parent, attr, None)
            if value:
                return value
        return ""

    def get_site_id(self, obj):
        site = resolve_activity_site(obj.activity)
        return str(site.id) if site else None

    def get_site_name(self, obj):
        site = resolve_activity_site(obj.activity)
        if not site:
            return ""
        return site.project_name or site.site_name


class RdsoSpanLibraryEntrySerializer(
    serializers.ModelSerializer
):
    """
    Admin-editable master of standard RDSO spans - read access is
    open to anyone with portal/reporting access (needed to populate
    the "Add girder job" span picker), writes are Admin-only,
    exactly mirroring ``StructureTypeSerializer``/
    ``HasProjectMonitorMasterAccess``.
    """

    class Meta:
        model = RdsoSpanLibraryEntry
        fields = [
            "id",
            "span_length_m",
            "girder_type",
            "drawing_no",
            "qty_per_span_mt",
            "display_order",
            "is_active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "created_at",
            "updated_at",
        ]


class GirderSpanSerializer(
    ActivityGroupedSerializerMixin,
    serializers.ModelSerializer,
):
    """
    One span's full detail - its three generated chains (Girder
    fabrication always; Bearings/Expansion Joints unless the parent
    job is a FOB) re-assembled into the same ``groups`` shape as
    everything else via the shared mixin.
    """

    groups = serializers.SerializerMethodField()
    overall_progress = (
        serializers.SerializerMethodField()
    )
    hidden_activities = (
        serializers.SerializerMethodField()
    )

    class Meta:
        model = GirderSpan
        fields = [
            "id",
            "label",
            "is_standard",
            "drawing_no",
            "span_length_m",
            "girder_type",
            "qty_mt",
            "vendor",
            "po_number",
            "bearings_count",
            "expansion_joints_count",
            "row_order",
            "groups",
            "overall_progress",
            "hidden_activities",
        ]
        read_only_fields = fields


class GirderJobSerializer(
    ActivityGroupedSerializerMixin,
    serializers.ModelSerializer,
):
    """
    One bridge's girder tracking - its own bridge-level GAD row
    (re-assembled into ``groups`` the same way a Structure's own
    Approvals group is) plus every one of its spans, each with its
    own full chain detail. ``overall_progress`` is overridden (not
    the mixin's default) to roll every span's activities into the
    bridge's own total, not just the GAD row.
    """

    groups = serializers.SerializerMethodField()
    overall_progress = (
        serializers.SerializerMethodField()
    )
    hidden_activities = (
        serializers.SerializerMethodField()
    )
    spans = GirderSpanSerializer(
        many=True, read_only=True
    )
    structure_kind_display = (
        serializers.CharField(
            source="get_structure_kind_display",
            read_only=True,
        )
    )
    girder_scope_display = serializers.CharField(
        source="get_girder_scope_display",
        read_only=True,
    )

    class Meta:
        model = GirderJob
        fields = [
            "id",
            "site",
            "structure",
            "structure_kind",
            "structure_kind_display",
            "bridge_name",
            "chainage_km",
            "girder_scope",
            "girder_scope_display",
            "created_at",
            "updated_at",
            "groups",
            "spans",
            "overall_progress",
            "hidden_activities",
        ]
        read_only_fields = fields

    def get_overall_progress(self, obj):
        activities = [
            a
            for a in obj.activities.all()
            if not a.is_hidden
            and a.status
            != ActivityStatus.NOT_APPLICABLE
        ]
        for span in obj.spans.all():
            activities += [
                a
                for a in span.activities.all()
                if not a.is_hidden
                and a.status
                != ActivityStatus.NOT_APPLICABLE
            ]
        done = sum(
            1
            for a in activities
            if a.status
            == ActivityStatus.COMPLETE
        )
        return {
            "done": done,
            "total": len(activities),
        }


class GirderSpanInputSerializer(
    serializers.Serializer
):
    label = serializers.CharField(
        max_length=50
    )
    is_standard = serializers.BooleanField(
        required=False, default=False
    )
    drawing_no = serializers.CharField(
        required=False,
        allow_blank=True,
        default="",
    )
    span_length_m = serializers.DecimalField(
        max_digits=6,
        decimal_places=2,
        required=False,
        allow_null=True,
    )
    girder_type = serializers.CharField(
        required=False,
        allow_blank=True,
        default="",
    )
    qty_mt = serializers.DecimalField(
        max_digits=10,
        decimal_places=3,
        required=False,
        default=0,
    )
    vendor = serializers.CharField(
        required=False,
        allow_blank=True,
        default="",
    )
    po_number = serializers.CharField(
        required=False,
        allow_blank=True,
        default="",
    )
    bearings_count = serializers.IntegerField(
        required=False,
        default=4,
        min_value=0,
    )
    expansion_joints_count = (
        serializers.IntegerField(
            required=False,
            default=2,
            min_value=0,
        )
    )

    def validate_label(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError(
                "Give the span a label."
            )
        return value


class GirderJobCreateSerializer(
    serializers.Serializer
):
    structure = (
        serializers.PrimaryKeyRelatedField(
            queryset=Structure.objects.all(),
            required=False,
            allow_null=True,
        )
    )
    structure_kind = serializers.ChoiceField(
        choices=GirderStructureKind.choices,
    )
    bridge_name = serializers.CharField(
        max_length=150
    )
    chainage_km = serializers.DecimalField(
        max_digits=8,
        decimal_places=3,
        required=False,
        allow_null=True,
    )
    girder_scope = serializers.ChoiceField(
        choices=GirderScope.choices,
    )
    spans = GirderSpanInputSerializer(
        many=True
    )

    def validate_bridge_name(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError(
                "Give the bridge a name / number."
            )
        return value

    def validate_spans(self, value):
        if not value:
            raise serializers.ValidationError(
                "Add at least one span."
            )
        return value


class GirderSpanUpdateSerializer(
    serializers.Serializer
):
    """
    The handful of span fields that stay freely editable after
    creation - vendor/PO/drawing no - matching the prototype's own
    "Vendor/PO fields are freely editable per span" behaviour.
    Progress itself is tracked on the span's Activity rows via the
    normal ``activity-update`` endpoint, not here.
    """

    vendor = serializers.CharField(
        required=False,
        allow_blank=True,
    )
    po_number = serializers.CharField(
        required=False,
        allow_blank=True,
    )
    drawing_no = serializers.CharField(
        required=False,
        allow_blank=True,
    )


class ActionItemSerializer(
    serializers.ModelSerializer
):
    """
    An Action Item's single generic ``Activity`` (status/target-
    date-history/comments/review) nested alongside the two fields
    the Activity itself doesn't carry - ``responsibility`` and the
    persistent ``remarks``. ``is_overdue`` is derived from the
    linked Activity's own current target date and status, not
    stored - the whole point of "Open"/"Completed" is that they're
    just a read of the Activity's own state.
    """

    activity = serializers.SerializerMethodField()
    is_overdue = serializers.SerializerMethodField()

    class Meta:
        model = ActionItem
        fields = [
            "id",
            "site",
            "responsibility",
            "remarks",
            "activity",
            "is_overdue",
            "created_at",
        ]
        read_only_fields = fields

    def _activity(self, obj):
        activities = list(obj.activities.all())
        return activities[0] if activities else None

    def get_activity(self, obj):
        activity = self._activity(obj)
        return (
            ActivitySerializer(activity).data
            if activity
            else None
        )

    def get_is_overdue(self, obj):
        activity = self._activity(obj)
        if not activity or activity.status in (
            ActivityStatus.COMPLETE,
            ActivityStatus.NOT_APPLICABLE,
        ):
            return False

        date_entries = list(
            activity.date_entries.all()
        )
        if not date_entries:
            return False

        target_date = date_entries[-1].target_date
        return target_date < timezone.localdate()


class ActionItemCreateSerializer(
    serializers.Serializer
):
    name = serializers.CharField(max_length=200)
    responsibility = serializers.CharField(
        required=False,
        allow_blank=True,
        default="",
        max_length=150,
    )
    remarks = serializers.CharField(
        required=False,
        allow_blank=True,
        default="",
    )
    target_date = serializers.DateField(
        required=False,
        allow_null=True,
    )

    def validate_name(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError(
                "Give the action item a name."
            )
        return value


class ActionItemUpdateSerializer(
    serializers.Serializer
):
    """
    The persistent fields an Action Item's own PATCH endpoint edits
    directly - deliberately separate from the dated meeting-log the
    normal ``activity-update`` endpoint writes to.
    """

    responsibility = serializers.CharField(
        required=False,
        allow_blank=True,
        max_length=150,
    )
    remarks = serializers.CharField(
        required=False,
        allow_blank=True,
    )


class ScopePatchSerializer(
    serializers.ModelSerializer
):
    class Meta:
        model = ScopePatch
        fields = [
            "id",
            "from_chainage_km",
            "to_chainage_km",
            "side",
            "qty",
            "remarks",
            "created_at",
        ]
        read_only_fields = fields


class ScopePatchCreateSerializer(
    serializers.Serializer
):
    from_chainage_km = serializers.DecimalField(
        max_digits=8, decimal_places=3
    )
    to_chainage_km = serializers.DecimalField(
        max_digits=8, decimal_places=3
    )
    side = serializers.ChoiceField(
        choices=LinearSide.choices,
        required=False,
        default=LinearSide.BOTH,
    )
    qty = serializers.DecimalField(
        max_digits=12,
        decimal_places=3,
        required=False,
        allow_null=True,
    )
    remarks = serializers.CharField(
        required=False,
        allow_blank=True,
        default="",
    )


class ProgressEntrySerializer(
    serializers.ModelSerializer
):
    class Meta:
        model = ProgressEntry
        fields = [
            "id",
            "date",
            "from_chainage_km",
            "to_chainage_km",
            "qty",
            "side",
            "contractor",
            "status",
            "remarks",
            "meeting_date",
            "created_at",
        ]
        read_only_fields = fields


class ProgressEntryCreateSerializer(
    serializers.Serializer
):
    date = serializers.DateField()
    meeting_date = serializers.DateField()
    from_chainage_km = serializers.DecimalField(
        max_digits=8, decimal_places=3
    )
    to_chainage_km = serializers.DecimalField(
        max_digits=8, decimal_places=3
    )
    side = serializers.ChoiceField(
        choices=LinearSide.choices,
        required=False,
        default=LinearSide.BOTH,
    )
    qty = serializers.DecimalField(
        max_digits=12,
        decimal_places=3,
        required=False,
        allow_null=True,
    )
    contractor = serializers.CharField(
        required=False,
        allow_blank=True,
        default="",
    )
    status = serializers.ChoiceField(
        choices=ProgressEntry.LINEAR_STATUS_CHOICES,
        required=False,
        default=ActivityStatus.IN_PROGRESS,
    )
    remarks = serializers.CharField(
        required=False,
        allow_blank=True,
        default="",
    )


class ProgressEntryUpdateSerializer(
    serializers.Serializer
):
    """
    Editing an existing progress entry - mirrors the prototype's
    own ``editEntry`` action, so every field stays changeable, not
    just remarks/status.
    """

    date = serializers.DateField(
        required=False
    )
    from_chainage_km = serializers.DecimalField(
        max_digits=8,
        decimal_places=3,
        required=False,
    )
    to_chainage_km = serializers.DecimalField(
        max_digits=8,
        decimal_places=3,
        required=False,
    )
    side = serializers.ChoiceField(
        choices=LinearSide.choices,
        required=False,
    )
    qty = serializers.DecimalField(
        max_digits=12,
        decimal_places=3,
        required=False,
        allow_null=True,
    )
    contractor = serializers.CharField(
        required=False,
        allow_blank=True,
    )
    status = serializers.ChoiceField(
        choices=ProgressEntry.LINEAR_STATUS_CHOICES,
        required=False,
    )
    remarks = serializers.CharField(
        required=False,
        allow_blank=True,
    )


class LinearItemSerializer(
    serializers.ModelSerializer
):
    scope_patches = ScopePatchSerializer(
        many=True, read_only=True
    )
    progress_entries = ProgressEntrySerializer(
        many=True, read_only=True
    )
    stats = serializers.SerializerMethodField()
    diagram = serializers.SerializerMethodField()

    class Meta:
        model = LinearItem
        fields = [
            "id",
            "site",
            "name",
            "unit",
            "scope_patches",
            "progress_entries",
            "stats",
            "diagram",
            "created_at",
        ]
        read_only_fields = fields

    def get_stats(self, obj):
        return compute_item_stats(obj)

    def get_diagram(self, obj):
        return compute_diagram(
            obj,
            chainage_start_km=self.context.get(
                "chainage_start_km"
            ),
            chainage_end_km=self.context.get(
                "chainage_end_km"
            ),
            segment_length_km=self.context.get(
                "segment_length_km"
            ),
        )


class LinearItemCreateSerializer(
    serializers.Serializer
):
    name = serializers.CharField(max_length=150)
    unit = serializers.ChoiceField(
        choices=LinearUnit.choices,
        required=False,
        default=LinearUnit.M,
    )

    def validate_name(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError(
                "Give the linear item a name."
            )
        return value
