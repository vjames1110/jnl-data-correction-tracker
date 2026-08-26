from decimal import Decimal

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.db.models import Q
from django.utils import timezone

from apps.core.models import (
    BusinessModel,
    SoftDeleteModel,
    TimeStampedModel,
    UUIDPrimaryKeyModel,
    UserTrackingModel,
)
from apps.corrections.models import ApprovalStepStatus
from apps.core.utils.codes import (
    build_abbreviation,
    next_unique_code,
)
from apps.core.utils.text import (
    normalize_code,
    normalize_whitespace,
)
from apps.organization.models import Site


class ReconciliationType(models.TextChoices):
    NORM_BASED = "NORM_BASED", "Norm Based"
    DIRECT_COUNT = "DIRECT_COUNT", "Direct Count"


class ItemCategory(BusinessModel):
    """
    Store item category master (e.g. Cement, Steel, Fuel).
    """

    category_code = models.CharField(
        max_length=30,
        blank=True,
        unique=True,
        db_index=True,
    )
    category_name = models.CharField(
        max_length=150,
        unique=True,
    )
    description = models.TextField(
        blank=True,
    )
    display_order = models.PositiveIntegerField(
        default=0,
        db_index=True,
    )

    class Meta:
        db_table = "reconciliation_item_category"
        ordering = [
            "display_order",
            "category_name",
        ]
        indexes = [
            models.Index(
                fields=["category_code", "is_active"],
                name="reco_cat_code_active_idx",
            ),
            models.Index(
                fields=["display_order", "category_name"],
                name="reco_cat_order_name_idx",
            ),
        ]
        verbose_name = "Item Category"
        verbose_name_plural = "Item Categories"

    def __str__(self) -> str:
        return f"{self.category_code} - {self.category_name}"

    def clean(self):
        super().clean()

        self.category_name = normalize_whitespace(
            self.category_name
        )
        self.category_code = normalize_code(
            self.category_code
        )

        if not self.category_code:
            self.category_code = next_unique_code(
                ItemCategory,
                "category_code",
                build_abbreviation(
                    self.category_name
                ),
                exclude_pk=self.pk,
            )

        if self.description:
            self.description = normalize_whitespace(
                self.description
            )

    def save(self, *args, **kwargs):
        self.full_clean()
        return super().save(*args, **kwargs)


class Item(BusinessModel):
    """
    Store item master covering every reconciliation category.

    ``reconciliation_type`` is a fixed two-value enum (the calculation
    strategy), but which category and behaviour a given item has is
    pure data - new categories never require a code change.
    """

    item_code = models.CharField(
        max_length=30,
        blank=True,
        db_index=True,
    )
    item_name = models.CharField(
        max_length=150,
    )
    category = models.ForeignKey(
        ItemCategory,
        on_delete=models.PROTECT,
        related_name="items",
    )
    reconciliation_type = models.CharField(
        max_length=20,
        choices=ReconciliationType.choices,
        db_index=True,
    )
    uom = models.CharField(
        max_length=20,
        help_text="Unit of measure, e.g. MT, NOS, LTR.",
    )
    erp_item_code = models.CharField(
        max_length=50,
        blank=True,
        db_index=True,
    )
    description = models.TextField(
        blank=True,
    )

    class Meta:
        db_table = "reconciliation_item"
        ordering = [
            "category__display_order",
            "item_name",
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["category", "item_code"],
                name="reco_item_category_code_uniq",
            ),
        ]
        indexes = [
            models.Index(
                fields=["category", "is_active"],
                name="reco_item_cat_active_idx",
            ),
            models.Index(
                fields=[
                    "reconciliation_type",
                    "is_active",
                ],
                name="reco_item_type_active_idx",
            ),
        ]
        verbose_name = "Item"
        verbose_name_plural = "Items"

    def __str__(self) -> str:
        return f"{self.item_code} - {self.item_name}"

    def clean(self):
        super().clean()

        self.item_name = normalize_whitespace(
            self.item_name
        )
        self.item_code = normalize_code(
            self.item_code
        )
        self.uom = normalize_code(self.uom)

        if not self.item_code:
            self.item_code = next_unique_code(
                Item,
                "item_code",
                build_abbreviation(self.item_name),
                exclude_pk=self.pk,
                scope={
                    "category_id": self.category_id,
                }
                if self.category_id
                else None,
            )

        if self.erp_item_code:
            self.erp_item_code = normalize_code(
                self.erp_item_code
            )

        if self.description:
            self.description = normalize_whitespace(
                self.description
            )

    def save(self, *args, **kwargs):
        self.full_clean()
        return super().save(*args, **kwargs)


def _validate_rate_and_mix_ratio(
    *,
    item: "Item | None",
    rate,
    mix_ratio,
) -> dict:
    errors = {}

    if rate is not None and rate < Decimal("0"):
        errors["rate"] = "Rate cannot be negative."

    if item is None:
        return errors

    if item.reconciliation_type == (
        ReconciliationType.NORM_BASED
    ):
        if mix_ratio is None:
            errors["mix_ratio"] = (
                "Mix ratio is required for "
                "norm-based items."
            )
        elif mix_ratio <= Decimal("0"):
            errors["mix_ratio"] = (
                "Mix ratio must be greater than zero."
            )
    elif mix_ratio is not None:
        errors["mix_ratio"] = (
            "Mix ratio only applies to norm-based items."
        )

    return errors


class ItemStandard(BusinessModel, UserTrackingModel):
    """
    Company-wide default rate/mix-ratio tier for an item.

    Overridable per site (``SiteItemConfig``); once a site has its own
    active configuration, changes here stop cascading to that site.
    """

    item = models.ForeignKey(
        Item,
        on_delete=models.PROTECT,
        related_name="company_standards",
    )
    grade_label = models.CharField(
        max_length=50,
        blank=True,
        help_text=(
            "Leave blank to apply to every "
            "production grade of this item. Set "
            "to override the mix ratio (and rate) "
            "for one specific grade only, e.g. "
            "M20 - must match the grade recorded "
            "on production output."
        ),
    )
    rate = models.DecimalField(
        max_digits=14,
        decimal_places=2,
    )
    mix_ratio = models.DecimalField(
        max_digits=10,
        decimal_places=6,
        null=True,
        blank=True,
        help_text=(
            "Required for norm-based items; unused "
            "for direct-count items."
        ),
    )
    effective_from = models.DateField()
    notes = models.TextField(
        blank=True,
    )

    class Meta:
        db_table = "reconciliation_item_standard"
        ordering = [
            "item__item_name",
            "grade_label",
            "-effective_from",
        ]
        constraints = [
            models.UniqueConstraint(
                fields=[
                    "item",
                    "grade_label",
                    "effective_from",
                ],
                name="reco_item_standard_item_grade_date_uniq",
            ),
        ]
        indexes = [
            models.Index(
                fields=["item", "is_active"],
                name="reco_std_item_active_idx",
            ),
            models.Index(
                fields=["effective_from"],
                name="reco_std_eff_date_idx",
            ),
        ]
        verbose_name = "Item Standard (Company Default)"
        verbose_name_plural = (
            "Item Standards (Company Defaults)"
        )

    def __str__(self) -> str:
        grade_suffix = (
            f" ({self.grade_label})"
            if self.grade_label
            else ""
        )
        return (
            f"{self.item.item_code} - default"
            f"{grade_suffix} - {self.effective_from}"
        )

    def clean(self):
        super().clean()

        if self.notes:
            self.notes = normalize_whitespace(
                self.notes
            )
        if self.grade_label:
            self.grade_label = normalize_whitespace(
                self.grade_label
            ).upper()

        errors = _validate_rate_and_mix_ratio(
            item=self.item if self.item_id else None,
            rate=self.rate,
            mix_ratio=self.mix_ratio,
        )
        if errors:
            raise ValidationError(errors)

    def save(self, *args, **kwargs):
        self.full_clean()
        return super().save(*args, **kwargs)


class SiteItemConfig(BusinessModel, UserTrackingModel):
    """
    Site-level override of the company default rate/mix ratio.

    An active row here is the "locked to this site" state described
    in the reconciliation build prompt: once saved, company-default
    changes no longer cascade to this site until this row is
    deactivated. Only one active row per (item, site, grade) is
    allowed - a site can lock its blank-grade default independently
    of any grade-specific overrides, and vice versa.
    """

    item = models.ForeignKey(
        Item,
        on_delete=models.PROTECT,
        related_name="site_configs",
    )
    site = models.ForeignKey(
        Site,
        on_delete=models.PROTECT,
        related_name="reconciliation_item_configs",
    )
    grade_label = models.CharField(
        max_length=50,
        blank=True,
        help_text=(
            "Leave blank to apply to every "
            "production grade of this item at "
            "this site. Set to override the mix "
            "ratio (and rate) for one specific "
            "grade only."
        ),
    )
    rate = models.DecimalField(
        max_digits=14,
        decimal_places=2,
    )
    mix_ratio = models.DecimalField(
        max_digits=10,
        decimal_places=6,
        null=True,
        blank=True,
    )
    effective_from = models.DateField()
    notes = models.TextField(
        blank=True,
    )

    class Meta:
        db_table = "reconciliation_site_item_config"
        ordering = [
            "site__site_name",
            "item__item_name",
            "grade_label",
            "-effective_from",
        ]
        constraints = [
            models.UniqueConstraint(
                fields=[
                    "item",
                    "site",
                    "grade_label",
                    "effective_from",
                ],
                name="reco_site_item_grade_date_uniq",
            ),
            models.UniqueConstraint(
                fields=["item", "site", "grade_label"],
                condition=Q(is_active=True),
                name="reco_site_item_grade_active_uniq",
            ),
        ]
        indexes = [
            models.Index(
                fields=["site", "item", "is_active"],
                name="reco_site_item_active_idx",
            ),
        ]
        verbose_name = "Site Item Configuration"
        verbose_name_plural = (
            "Site Item Configurations"
        )

    def __str__(self) -> str:
        grade_suffix = (
            f" ({self.grade_label})"
            if self.grade_label
            else ""
        )
        return (
            f"{self.site.site_code} - "
            f"{self.item.item_code}{grade_suffix}"
        )

    def clean(self):
        super().clean()

        if self.notes:
            self.notes = normalize_whitespace(
                self.notes
            )
        if self.grade_label:
            self.grade_label = normalize_whitespace(
                self.grade_label
            ).upper()

        errors = _validate_rate_and_mix_ratio(
            item=self.item if self.item_id else None,
            rate=self.rate,
            mix_ratio=self.mix_ratio,
        )
        if errors:
            raise ValidationError(errors)

    def save(self, *args, **kwargs):
        self.full_clean()
        return super().save(*args, **kwargs)


class ReconciliationToleranceSettings(
    UUIDPrimaryKeyModel,
    TimeStampedModel,
):
    """
    Singleton policy controlling the tolerance band used to classify
    reconciliation entry variance.
    """

    default_tolerance_percentage = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=Decimal("2.00"),
    )
    watch_multiplier = models.DecimalField(
        max_digits=4,
        decimal_places=2,
        default=Decimal("1.50"),
        help_text=(
            "Variance above tolerance x this "
            "multiplier is Over Tolerance; below "
            "it is Watch."
        ),
    )

    class Meta:
        db_table = (
            "reconciliation_tolerance_settings"
        )
        verbose_name = "Tolerance Settings"
        verbose_name_plural = "Tolerance Settings"

    def __str__(self) -> str:
        return (
            "Tolerance settings "
            f"({self.default_tolerance_percentage}%)"
        )

    @classmethod
    def get_solo(
        cls,
    ) -> "ReconciliationToleranceSettings":
        instance = cls.objects.order_by(
            "created_at"
        ).first()
        if instance is not None:
            return instance

        return cls.objects.create()

    def clean(self):
        super().clean()

        errors = {}

        if self.default_tolerance_percentage < Decimal(
            "0"
        ):
            errors[
                "default_tolerance_percentage"
            ] = "Tolerance percentage cannot be negative."

        if self.watch_multiplier < Decimal("1"):
            errors["watch_multiplier"] = (
                "Watch multiplier must be at "
                "least 1."
            )

        if ReconciliationToleranceSettings.objects.exclude(
            pk=self.pk
        ).exists():
            errors["__all__"] = (
                "Tolerance settings already exist; "
                "edit the existing record instead "
                "of creating a new one."
            )

        if errors:
            raise ValidationError(errors)

    def save(self, *args, **kwargs):
        self.full_clean()
        return super().save(*args, **kwargs)


class ReconciliationPeriodStatus(
    models.TextChoices
):
    DRAFT = "DRAFT", "Draft"
    SUBMITTED = "SUBMITTED", "Submitted"
    PENDING_APPROVAL = (
        "PENDING_APPROVAL",
        "Pending Approval",
    )
    APPROVED = "APPROVED", "Approved"
    REJECTED = "REJECTED", "Rejected"


class ReconciliationPeriod(
    UUIDPrimaryKeyModel,
    TimeStampedModel,
    SoftDeleteModel,
):
    """
    One site's reconciliation for one calendar month.
    """

    site = models.ForeignKey(
        Site,
        on_delete=models.PROTECT,
        related_name="reconciliation_periods",
    )
    period_month = models.DateField(
        help_text=(
            "Normalized to the first day of the "
            "month."
        ),
    )
    status = models.CharField(
        max_length=20,
        choices=ReconciliationPeriodStatus.choices,
        default=ReconciliationPeriodStatus.DRAFT,
        db_index=True,
    )
    tolerance_percentage = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        null=True,
        blank=True,
        help_text=(
            "Overrides the global default "
            "tolerance for this period only."
        ),
    )
    opening_stock_date = models.DateField(
        null=True,
        blank=True,
        help_text=(
            "The date the opening physical stock "
            "count was taken, if recorded. "
            "Informational only - printed on the "
            "statement, not used in the "
            "calculation."
        ),
    )
    closing_stock_date = models.DateField(
        null=True,
        blank=True,
        help_text=(
            "The date the closing physical stock "
            "count was taken, if recorded."
        ),
    )
    submitted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="submitted_reconciliation_periods",
        null=True,
        blank=True,
    )
    submitted_at = models.DateTimeField(
        null=True,
        blank=True,
    )
    notes = models.TextField(
        blank=True,
    )

    class Meta:
        db_table = "reconciliation_period"
        ordering = [
            "-period_month",
            "site__site_name",
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["site", "period_month"],
                condition=Q(is_deleted=False),
                name="reco_period_site_month_uniq",
            ),
        ]
        indexes = [
            models.Index(
                fields=["site", "status"],
                name="reco_period_site_status_idx",
            ),
            models.Index(
                fields=["period_month", "status"],
                name="reco_period_month_status_idx",
            ),
        ]
        verbose_name = "Reconciliation Period"
        verbose_name_plural = (
            "Reconciliation Periods"
        )

    def __str__(self) -> str:
        return (
            f"{self.site.site_code} - "
            f"{self.period_month:%Y-%m}"
        )

    @property
    def is_editable(self) -> bool:
        return (
            self.status
            == ReconciliationPeriodStatus.DRAFT
        )

    def clean(self):
        super().clean()

        if self.period_month:
            self.period_month = (
                self.period_month.replace(day=1)
            )

        errors = {}

        if (
            self.tolerance_percentage is not None
            and self.tolerance_percentage
            < Decimal("0")
        ):
            errors["tolerance_percentage"] = (
                "Tolerance percentage cannot be "
                "negative."
            )

        if (
            self.opening_stock_date
            and self.closing_stock_date
            and self.closing_stock_date
            < self.opening_stock_date
        ):
            errors["closing_stock_date"] = (
                "Closing stock date cannot be "
                "before the opening stock date."
            )

        if errors:
            raise ValidationError(errors)

    def save(self, *args, **kwargs):
        self.full_clean()
        return super().save(*args, **kwargs)


class ReconciliationEntryStatus(
    models.TextChoices
):
    WITHIN_TOLERANCE = (
        "WITHIN_TOLERANCE",
        "Within Tolerance",
    )
    WATCH = "WATCH", "Watch"
    OVER_TOLERANCE = (
        "OVER_TOLERANCE",
        "Over Tolerance",
    )
    NOT_CALCULATED = (
        "NOT_CALCULATED",
        "Not Calculated",
    )


class ReconciliationEntry(
    UUIDPrimaryKeyModel,
    TimeStampedModel,
    UserTrackingModel,
):
    """
    One item's monthly reconciliation entry for a period.

    Actual/theoretical/variance columns are computed by
    ``apps.reconciliation.services.variance`` on every save so
    reports can query them directly instead of recomputing.
    """

    period = models.ForeignKey(
        ReconciliationPeriod,
        on_delete=models.PROTECT,
        related_name="entries",
    )
    item = models.ForeignKey(
        Item,
        on_delete=models.PROTECT,
        related_name="reconciliation_entries",
    )
    opening_stock = models.DecimalField(
        max_digits=14,
        decimal_places=3,
        null=True,
        blank=True,
    )
    receipts = models.DecimalField(
        max_digits=14,
        decimal_places=3,
        null=True,
        blank=True,
    )
    closing_stock = models.DecimalField(
        max_digits=14,
        decimal_places=3,
        null=True,
        blank=True,
    )
    book_stock = models.DecimalField(
        max_digits=14,
        decimal_places=3,
        null=True,
        blank=True,
    )
    physical_count = models.DecimalField(
        max_digits=14,
        decimal_places=3,
        null=True,
        blank=True,
    )
    section = models.CharField(
        max_length=100,
        blank=True,
        help_text=(
            "Physical storage section for this "
            "item at the site, e.g. Section A. "
            "Optional, informational only."
        ),
    )
    rack = models.CharField(
        max_length=100,
        blank=True,
        help_text=(
            "Rack / bin location within the "
            "section. Optional, informational "
            "only."
        ),
    )
    resolved_rate = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        null=True,
        blank=True,
        help_text=(
            "Rate used to cost this entry's "
            "variance, snapshotted whenever the "
            "variance is recomputed - shown on "
            "the printed statement."
        ),
    )
    actual_quantity = models.DecimalField(
        max_digits=14,
        decimal_places=3,
        null=True,
        blank=True,
    )
    theoretical_or_book_quantity = (
        models.DecimalField(
            max_digits=14,
            decimal_places=3,
            null=True,
            blank=True,
        )
    )
    variance_quantity = models.DecimalField(
        max_digits=14,
        decimal_places=3,
        null=True,
        blank=True,
    )
    variance_value = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        null=True,
        blank=True,
    )
    status = models.CharField(
        max_length=20,
        choices=ReconciliationEntryStatus.choices,
        default=(
            ReconciliationEntryStatus.NOT_CALCULATED
        ),
        db_index=True,
    )
    notes = models.TextField(
        blank=True,
    )

    class Meta:
        db_table = "reconciliation_entry"
        ordering = ["item__item_name"]
        constraints = [
            models.UniqueConstraint(
                fields=["period", "item"],
                name="reco_entry_period_item_uniq",
            ),
        ]
        indexes = [
            models.Index(
                fields=["period", "status"],
                name="reco_entry_period_status_idx",
            ),
        ]
        verbose_name = "Reconciliation Entry"
        verbose_name_plural = (
            "Reconciliation Entries"
        )

    def __str__(self) -> str:
        return (
            f"{self.period} - "
            f"{self.item.item_code}"
        )

    def clean(self):
        super().clean()

        if self.notes:
            self.notes = normalize_whitespace(
                self.notes
            )
        if self.section:
            self.section = normalize_whitespace(
                self.section
            )
        if self.rack:
            self.rack = normalize_whitespace(
                self.rack
            )

        errors = {}

        if self.item_id and self.period_id:
            is_norm_based = (
                self.item.reconciliation_type
                == ReconciliationType.NORM_BASED
            )
            norm_fields = [
                "opening_stock",
                "receipts",
                "closing_stock",
            ]
            direct_fields = [
                "book_stock",
                "physical_count",
            ]
            other = (
                direct_fields
                if is_norm_based
                else norm_fields
            )

            # Fields for the item's own reconciliation
            # type are intentionally NOT required here:
            # book_stock may arrive via CSV import before
            # a store person records physical_count (and
            # vice versa for the norm-based fields). An
            # entry with incomplete data simply stays
            # NOT_CALCULATED until it's complete - see
            # apps.reconciliation.services.variance.
            for field in other:
                if (
                    getattr(self, field)
                    is not None
                ):
                    errors[field] = (
                        "This field does not "
                        "apply to "
                        f"{self.item.get_reconciliation_type_display()} "
                        "items."
                    )

        for field in (
            "opening_stock",
            "receipts",
            "closing_stock",
            "book_stock",
            "physical_count",
        ):
            value = getattr(self, field)
            if value is not None and value < Decimal(
                "0"
            ):
                errors[field] = (
                    "Value cannot be negative."
                )

        if errors:
            raise ValidationError(errors)

    def save(self, *args, **kwargs):
        from apps.reconciliation.services.variance import (
            compute_entry_variance,
            refresh_entry_flags,
        )

        compute_entry_variance(self)
        self.full_clean()
        super().save(*args, **kwargs)
        refresh_entry_flags(self)
        return self


class ReconciliationOutputEntry(
    UUIDPrimaryKeyModel,
    TimeStampedModel,
    UserTrackingModel,
):
    """
    Production/output batch that theoretical consumption is derived
    from for norm-based items (e.g. cum of concrete produced).

    ``grade_label`` (normalized to uppercase, e.g. "M20") is matched
    against ``ItemStandard``/``SiteItemConfig`` rows with the same
    grade to resolve a grade-specific mix ratio; output batches with
    no matching grade-specific row fall back to the item's blank-grade
    default. See ``services.resolution.resolve_standard``.
    """

    period = models.ForeignKey(
        ReconciliationPeriod,
        on_delete=models.PROTECT,
        related_name="output_entries",
    )
    item = models.ForeignKey(
        Item,
        on_delete=models.PROTECT,
        related_name="reconciliation_output_entries",
    )
    grade_label = models.CharField(
        max_length=50,
        blank=True,
    )
    output_quantity = models.DecimalField(
        max_digits=14,
        decimal_places=3,
    )

    class Meta:
        db_table = (
            "reconciliation_output_entry"
        )
        ordering = ["item__item_name"]
        indexes = [
            models.Index(
                fields=["period", "item"],
                name="reco_output_period_item_idx",
            ),
        ]
        verbose_name = "Reconciliation Output Entry"
        verbose_name_plural = (
            "Reconciliation Output Entries"
        )

    def __str__(self) -> str:
        return (
            f"{self.period} - "
            f"{self.item.item_code} - "
            f"{self.output_quantity}"
        )

    def clean(self):
        super().clean()

        errors = {}

        if self.grade_label:
            self.grade_label = normalize_whitespace(
                self.grade_label
            ).upper()

        if (
            self.output_quantity is not None
            and self.output_quantity <= Decimal("0")
        ):
            errors["output_quantity"] = (
                "Output quantity must be greater "
                "than zero."
            )

        if (
            self.item_id
            and self.item.reconciliation_type
            != ReconciliationType.NORM_BASED
        ):
            errors["item"] = (
                "Only norm-based items track "
                "production output."
            )

        if errors:
            raise ValidationError(errors)

    def save(self, *args, **kwargs):
        self.full_clean()
        result = super().save(*args, **kwargs)

        for entry in self.period.entries.filter(
            item=self.item
        ):
            entry.save()

        return result

    def delete(self, *args, **kwargs):
        period = self.period
        item = self.item
        result = super().delete(*args, **kwargs)

        for entry in period.entries.filter(
            item=item
        ):
            entry.save()

        return result


class ReconciliationFlagType(models.TextChoices):
    NEGATIVE_CONSUMPTION = (
        "NEGATIVE_CONSUMPTION",
        "Negative Consumption",
    )
    NO_MATCHING_PRODUCTION = (
        "NO_MATCHING_PRODUCTION",
        "No Matching Production",
    )
    MISSING_MIX_OR_RATE = (
        "MISSING_MIX_OR_RATE",
        "Missing Mix Ratio Or Rate",
    )
    OVER_TOLERANCE = (
        "OVER_TOLERANCE",
        "Over Tolerance",
    )


class ReconciliationFlag(
    UUIDPrimaryKeyModel,
    TimeStampedModel,
):
    """
    Automatic data-quality flag, regenerated on every entry save.
    """

    period = models.ForeignKey(
        ReconciliationPeriod,
        on_delete=models.PROTECT,
        related_name="flags",
    )
    entry = models.ForeignKey(
        ReconciliationEntry,
        on_delete=models.CASCADE,
        related_name="flags",
        null=True,
        blank=True,
    )
    flag_type = models.CharField(
        max_length=30,
        choices=ReconciliationFlagType.choices,
        db_index=True,
    )
    message = models.CharField(
        max_length=255,
    )

    class Meta:
        db_table = "reconciliation_flag"
        ordering = ["-created_at"]
        indexes = [
            models.Index(
                fields=["period", "flag_type"],
                name="reco_flag_period_type_idx",
            ),
            models.Index(
                fields=["entry", "flag_type"],
                name="reco_flag_entry_type_idx",
            ),
        ]
        verbose_name = "Reconciliation Flag"
        verbose_name_plural = (
            "Reconciliation Flags"
        )

    def __str__(self) -> str:
        return f"{self.period} - {self.flag_type}"


class ReconciliationApproverType(models.TextChoices):
    STORE_HO = "STORE_HO", "Store HO"
    DIRECTOR = "DIRECTOR", "Director"
    ADMIN_FINAL = "ADMIN_FINAL", "Admin Final Approval"
    CUSTOM = "CUSTOM", "Custom Approver"


class ReconciliationApprovalStep(
    UUIDPrimaryKeyModel,
    TimeStampedModel,
):
    """
    Approval route snapshot for one submission round of a period.

    ``round_number`` distinguishes submission cycles: a returned
    period goes back to Draft, gets corrected, and is resubmitted -
    that resubmission creates a fresh set of steps (round 2, 3, ...)
    rather than reusing the first round's already-decided rows, so
    the full history of every round stays on record for audit.
    """

    period = models.ForeignKey(
        ReconciliationPeriod,
        on_delete=models.PROTECT,
        related_name="approval_steps",
    )
    round_number = models.PositiveSmallIntegerField(
        default=1,
    )
    sequence = models.PositiveSmallIntegerField(
        db_index=True,
    )
    level_name = models.CharField(
        max_length=120,
        blank=True,
    )
    approver_type = models.CharField(
        max_length=30,
        choices=ReconciliationApproverType.choices,
        db_index=True,
    )
    approver = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="reconciliation_approval_steps",
    )
    status = models.CharField(
        max_length=30,
        choices=ApprovalStepStatus.choices,
        default=ApprovalStepStatus.PENDING,
        db_index=True,
    )
    is_current = models.BooleanField(
        default=False,
        db_index=True,
    )
    decided_at = models.DateTimeField(
        null=True,
        blank=True,
    )
    comment = models.TextField(
        blank=True,
    )
    approver_employee_id_snapshot = models.CharField(
        max_length=30,
        blank=True,
    )
    approver_name_snapshot = models.CharField(
        max_length=150,
        blank=True,
    )

    class Meta:
        db_table = "reconciliation_approval_step"
        ordering = ["period", "round_number", "sequence"]
        constraints = [
            models.UniqueConstraint(
                fields=[
                    "period",
                    "round_number",
                    "sequence",
                ],
                name="reco_approval_step_period_round_seq_uniq",
            ),
        ]
        indexes = [
            models.Index(
                fields=["period", "status"],
                name="reco_step_period_status_idx",
            ),
            models.Index(
                fields=["approver", "status"],
                name="reco_step_approver_status_idx",
            ),
            models.Index(
                fields=["period", "is_current"],
                name="reco_step_period_current_idx",
            ),
        ]
        verbose_name = "Reconciliation Approval Step"
        verbose_name_plural = (
            "Reconciliation Approval Steps"
        )

    def __str__(self) -> str:
        return (
            f"{self.period} - round {self.round_number} - "
            f"{self.sequence} - {self.approver_type}"
        )

    def save(self, *args, **kwargs):
        if self.approver_id:
            if not self.approver_employee_id_snapshot:
                self.approver_employee_id_snapshot = (
                    self.approver.employee_id
                )
            if not self.approver_name_snapshot:
                self.approver_name_snapshot = (
                    self.approver.full_name
                )

        return super().save(*args, **kwargs)
