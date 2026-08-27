import copy

from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from apps.reconciliation.models import (
    Item,
    ItemCategory,
    ItemStandard,
    ReconciliationApprovalStep,
    ReconciliationEntry,
    ReconciliationFlag,
    ReconciliationOutputEntry,
    ReconciliationPeriod,
    ReconciliationPeriodAttachment,
    ReconciliationToleranceSettings,
    SiteItemConfig,
)


class ReconciliationCleanModelSerializer(
    serializers.ModelSerializer
):
    """
    Run full model validation (``clean()``) on top of DRF validation.
    """

    def validate(self, attrs):
        attrs = super().validate(attrs)
        model_instance = (
            copy.copy(self.instance)
            if self.instance is not None
            else self.Meta.model()
        )

        for attr, value in attrs.items():
            setattr(model_instance, attr, value)

        try:
            model_instance.full_clean()
        except DjangoValidationError as exc:
            raise serializers.ValidationError(
                getattr(exc, "message_dict", None)
                or exc.messages
            ) from exc

        return attrs


class ItemCategorySerializer(
    ReconciliationCleanModelSerializer
):
    category_code = serializers.CharField(
        required=False,
        allow_blank=True,
    )

    class Meta:
        model = ItemCategory
        fields = [
            "id",
            "category_code",
            "category_name",
            "description",
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


class ItemSerializer(ReconciliationCleanModelSerializer):
    item_code = serializers.CharField(
        required=False,
        allow_blank=True,
    )
    category_code = serializers.CharField(
        source="category.category_code",
        read_only=True,
    )
    category_name = serializers.CharField(
        source="category.category_name",
        read_only=True,
    )
    reconciliation_type_display = serializers.CharField(
        source="get_reconciliation_type_display",
        read_only=True,
    )

    class Meta:
        model = Item
        fields = [
            "id",
            "item_code",
            "item_name",
            "category",
            "category_code",
            "category_name",
            "reconciliation_type",
            "reconciliation_type_display",
            "uom",
            "erp_item_code",
            "description",
            "is_active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "category_code",
            "category_name",
            "reconciliation_type_display",
            "created_at",
            "updated_at",
        ]
        validators = []


class ItemStandardSerializer(
    ReconciliationCleanModelSerializer
):
    item_code = serializers.CharField(
        source="item.item_code",
        read_only=True,
    )
    item_name = serializers.CharField(
        source="item.item_name",
        read_only=True,
    )
    uom = serializers.CharField(
        source="item.uom",
        read_only=True,
    )
    reconciliation_type = serializers.CharField(
        source="item.reconciliation_type",
        read_only=True,
    )
    created_by_employee_id = serializers.CharField(
        source="created_by.employee_id",
        read_only=True,
        default="",
    )

    class Meta:
        model = ItemStandard
        fields = [
            "id",
            "item",
            "item_code",
            "item_name",
            "uom",
            "reconciliation_type",
            "grade_label",
            "rate",
            "mix_ratio",
            "effective_from",
            "notes",
            "is_active",
            "created_by_employee_id",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "item_code",
            "item_name",
            "uom",
            "reconciliation_type",
            "created_by_employee_id",
            "created_at",
            "updated_at",
        ]
        validators = []


class SiteItemConfigSerializer(
    ReconciliationCleanModelSerializer
):
    item_code = serializers.CharField(
        source="item.item_code",
        read_only=True,
    )
    item_name = serializers.CharField(
        source="item.item_name",
        read_only=True,
    )
    site_code = serializers.CharField(
        source="site.site_code",
        read_only=True,
    )
    site_name = serializers.CharField(
        source="site.site_name",
        read_only=True,
    )
    period_month = serializers.DateField(
        source="period.period_month",
        read_only=True,
        default=None,
    )
    created_by_employee_id = serializers.CharField(
        source="created_by.employee_id",
        read_only=True,
        default="",
    )

    class Meta:
        model = SiteItemConfig
        fields = [
            "id",
            "item",
            "item_code",
            "item_name",
            "site",
            "site_code",
            "site_name",
            "period",
            "period_month",
            "grade_label",
            "rate",
            "mix_ratio",
            "effective_from",
            "notes",
            "is_active",
            "created_by_employee_id",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "item_code",
            "item_name",
            "site_code",
            "site_name",
            "period_month",
            "created_by_employee_id",
            "created_at",
            "updated_at",
        ]
        validators = []


class ReconciliationToleranceSettingsSerializer(
    ReconciliationCleanModelSerializer
):
    class Meta:
        model = ReconciliationToleranceSettings
        fields = [
            "id",
            "default_tolerance_percentage",
            "watch_multiplier",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "created_at",
            "updated_at",
        ]


class ReconciliationFlagSerializer(
    serializers.ModelSerializer
):
    flag_type_display = serializers.CharField(
        source="get_flag_type_display",
        read_only=True,
    )

    class Meta:
        model = ReconciliationFlag
        fields = [
            "id",
            "period",
            "entry",
            "flag_type",
            "flag_type_display",
            "message",
            "created_at",
        ]
        read_only_fields = fields


class ReconciliationApprovalStepSerializer(
    serializers.ModelSerializer
):
    approver_type_display = serializers.CharField(
        source="get_approver_type_display",
        read_only=True,
    )
    status_display = serializers.CharField(
        source="get_status_display",
        read_only=True,
    )
    approver_name = serializers.CharField(
        source="approver_name_snapshot",
        read_only=True,
    )
    approver_employee_id = serializers.CharField(
        source="approver_employee_id_snapshot",
        read_only=True,
    )

    class Meta:
        model = ReconciliationApprovalStep
        fields = [
            "id",
            "period",
            "round_number",
            "sequence",
            "level_name",
            "approver_type",
            "approver_type_display",
            "approver",
            "approver_name",
            "approver_employee_id",
            "status",
            "status_display",
            "is_current",
            "decided_at",
            "comment",
            "created_at",
        ]
        read_only_fields = fields


class ReconciliationPeriodSerializer(
    ReconciliationCleanModelSerializer
):
    site_code = serializers.CharField(
        source="site.site_code",
        read_only=True,
    )
    site_name = serializers.CharField(
        source="site.site_name",
        read_only=True,
    )
    status_display = serializers.CharField(
        source="get_status_display",
        read_only=True,
    )
    submitted_by_employee_id = (
        serializers.CharField(
            source="submitted_by.employee_id",
            read_only=True,
            default="",
        )
    )
    entry_count = serializers.IntegerField(
        source="entries.count",
        read_only=True,
    )
    flag_count = serializers.IntegerField(
        source="flags.count",
        read_only=True,
    )
    approval_steps = ReconciliationApprovalStepSerializer(
        many=True,
        read_only=True,
    )
    current_approver_name = serializers.SerializerMethodField()
    current_approver_role = serializers.SerializerMethodField()

    class Meta:
        model = ReconciliationPeriod
        fields = [
            "id",
            "site",
            "site_code",
            "site_name",
            "period_month",
            "status",
            "status_display",
            "tolerance_percentage",
            "opening_stock_date",
            "closing_stock_date",
            "submitted_by_employee_id",
            "submitted_at",
            "entry_count",
            "flag_count",
            "approval_steps",
            "current_approver_name",
            "current_approver_role",
            "notes",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "site",
            "site_code",
            "site_name",
            "period_month",
            "status",
            "status_display",
            "submitted_by_employee_id",
            "submitted_at",
            "entry_count",
            "flag_count",
            "approval_steps",
            "current_approver_name",
            "current_approver_role",
            "created_at",
            "updated_at",
        ]

    def _current_step(self, obj):
        for step in obj.approval_steps.all():
            if step.is_current:
                return step
        return None

    def get_current_approver_name(self, obj):
        step = self._current_step(obj)
        return step.approver_name_snapshot if step else ""

    def get_current_approver_role(self, obj):
        step = self._current_step(obj)
        return (
            step.get_approver_type_display()
            if step
            else ""
        )


class ReconciliationEntrySerializer(
    ReconciliationCleanModelSerializer
):
    item_code = serializers.CharField(
        source="item.item_code",
        read_only=True,
    )
    item_name = serializers.CharField(
        source="item.item_name",
        read_only=True,
    )
    uom = serializers.CharField(
        source="item.uom",
        read_only=True,
    )
    reconciliation_type = serializers.CharField(
        source="item.reconciliation_type",
        read_only=True,
    )
    status_display = serializers.CharField(
        source="get_status_display",
        read_only=True,
    )
    flags = ReconciliationFlagSerializer(
        many=True,
        read_only=True,
    )

    class Meta:
        model = ReconciliationEntry
        fields = [
            "id",
            "period",
            "item",
            "item_code",
            "item_name",
            "uom",
            "reconciliation_type",
            "opening_stock",
            "receipts",
            "closing_stock",
            "book_stock",
            "physical_count",
            "section",
            "rack",
            "actual_quantity",
            "theoretical_or_book_quantity",
            "variance_quantity",
            "variance_value",
            "resolved_rate",
            "status",
            "status_display",
            "flags",
            "notes",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "item_code",
            "item_name",
            "uom",
            "reconciliation_type",
            "actual_quantity",
            "theoretical_or_book_quantity",
            "variance_quantity",
            "variance_value",
            "resolved_rate",
            "status",
            "status_display",
            "flags",
            "created_at",
            "updated_at",
        ]


class ReconciliationOutputEntrySerializer(
    ReconciliationCleanModelSerializer
):
    item_code = serializers.CharField(
        source="item.item_code",
        read_only=True,
    )
    item_name = serializers.CharField(
        source="item.item_name",
        read_only=True,
    )
    resolved_mix_ratio = (
        serializers.SerializerMethodField()
    )

    class Meta:
        model = ReconciliationOutputEntry
        fields = [
            "id",
            "period",
            "item",
            "item_code",
            "item_name",
            "grade_label",
            "output_quantity",
            "resolved_mix_ratio",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "item_code",
            "item_name",
            "resolved_mix_ratio",
            "created_at",
            "updated_at",
        ]

    def get_resolved_mix_ratio(self, obj):
        from apps.reconciliation.services.resolution import (
            resolve_standard,
        )

        resolved = resolve_standard(
            item=obj.item,
            site=obj.period.site,
            on_date=obj.period.period_month,
            grade_label=obj.grade_label,
            period=obj.period,
        )
        return resolved.mix_ratio


class ReconciliationPeriodAttachmentSerializer(
    serializers.ModelSerializer
):
    file = serializers.FileField(
        write_only=True,
        required=True,
    )
    uploaded_by_employee_id = serializers.CharField(
        source="uploaded_by.employee_id",
        read_only=True,
    )
    uploaded_by_name = serializers.CharField(
        source="uploaded_by.full_name",
        read_only=True,
    )
    site_code = serializers.CharField(
        source="period.site.site_code",
        read_only=True,
    )
    period_month = serializers.DateField(
        source="period.period_month",
        read_only=True,
    )
    download_url = (
        serializers.SerializerMethodField()
    )

    class Meta:
        model = ReconciliationPeriodAttachment
        fields = [
            "id",
            "period",
            "site_code",
            "period_month",
            "uploaded_by",
            "uploaded_by_employee_id",
            "uploaded_by_name",
            "file",
            "original_name",
            "content_type",
            "size_bytes",
            "notes",
            "download_url",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "site_code",
            "period_month",
            "uploaded_by",
            "uploaded_by_employee_id",
            "uploaded_by_name",
            "original_name",
            "content_type",
            "size_bytes",
            "download_url",
            "created_at",
            "updated_at",
        ]

    def get_download_url(self, obj):
        request = self.context.get("request")
        if request is None:
            return ""

        return request.build_absolute_uri(
            "/api/v1/reconciliation/attachments/"
            f"{obj.id}/download/"
        )
