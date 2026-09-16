from django.utils import timezone
from rest_framework import serializers

from apps.organization.api.serializers import (
    CleanModelSerializer,
)
from apps.organization.models import Site
from apps.project_monitor.models import (
    Activity,
    ActivityComment,
    ActivityDateEntry,
    ActivityStatus,
    Building,
    GirderJob,
    GirderScope,
    GirderSpan,
    GirderStructureKind,
    MaterialStatus,
    ProjectExtension,
    RdsoSpanLibraryEntry,
    Structure,
    StructureTypeDefinition,
)
from apps.project_monitor.services.structure_generator import (
    validate_definition_schema,
)

COUNTDOWN_GREEN_THRESHOLD_DAYS = 30
COUNTDOWN_ORANGE_THRESHOLD_DAYS = 15


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
            "effective_end_date",
            "days_remaining",
            "countdown_status",
            "site_director",
            "site_director_name",
            "site_hod",
            "site_hod_name",
        ]
        read_only_fields = fields

    def _effective_end_date(self, obj):
        extension_dates = [
            extension.new_end_date
            for extension in obj.extensions.all()
        ]
        if extension_dates:
            return max(extension_dates)
        return obj.end_date

    def get_effective_end_date(self, obj):
        return self._effective_end_date(obj)

    def get_days_remaining(self, obj):
        effective_end_date = (
            self._effective_end_date(obj)
        )
        if effective_end_date is None:
            return None
        return (
            effective_end_date
            - timezone.localdate()
        ).days

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
        activities = list(obj.activities.all())
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
            if a.status
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
    structure_type_code = serializers.CharField(
        source="structure_type.code",
        read_only=True,
    )
    structure_type_name = serializers.CharField(
        source="structure_type.name",
        read_only=True,
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
            "created_at",
            "updated_at",
            "groups",
            "overall_progress",
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
    """

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
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "created_at",
            "updated_at",
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
        ]
        read_only_fields = fields

    def get_overall_progress(self, obj):
        activities = [
            a
            for a in obj.activities.all()
            if a.status
            != ActivityStatus.NOT_APPLICABLE
        ]
        for span in obj.spans.all():
            activities += [
                a
                for a in span.activities.all()
                if a.status
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
