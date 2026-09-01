import os
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
from apps.corrections.models import (
    ALLOWED_ATTACHMENT_CONTENT_TYPES,
    ALLOWED_ATTACHMENT_EXTENSIONS,
    MAX_ATTACHMENT_SIZE_BYTES,
    ApprovalStepStatus,
)
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

    ``is_production_output`` marks a category as a production type
    (e.g. "Concrete") rather than a plain grouping: every item
    assigned to it is one of its recipe materials, and the category
    itself becomes selectable as a product on the Production Output
    entry form. A production-type category's items don't need to be
    Norm Based themselves (though the recipe/mix-ratio machinery only
    means anything for the norm-based ones); a category left
    unflagged is just an ordinary grouping with no recipe meaning.
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
    is_production_output = models.BooleanField(
        default=False,
        help_text=(
            "This is a production type (e.g. "
            "Concrete) - every item assigned to "
            "it is one of its recipe materials, "
            "and it becomes selectable as a "
            "product on Production Output."
        ),
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


class ItemCategoryGrade(
    UUIDPrimaryKeyModel,
    TimeStampedModel,
):
    """
    One valid production grade for a Production Type category (e.g.
    M10/M20/M25/M30 for "Concrete Materials") - a controlled
    vocabulary so a grade is picked from a fixed list everywhere it
    matters (Production Output, Company Defaults, Site Overrides)
    instead of free-typed, which invited inconsistencies like "M20"
    vs "m20" vs "M-20". Only meaningful for a category with
    ``is_production_output=True``; a plain category has none.
    """

    category = models.ForeignKey(
        ItemCategory,
        on_delete=models.CASCADE,
        related_name="grades",
    )
    grade_label = models.CharField(max_length=50)
    display_order = models.PositiveIntegerField(
        default=0,
    )

    class Meta:
        db_table = (
            "reconciliation_item_category_grade"
        )
        ordering = [
            "display_order",
            "grade_label",
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["category", "grade_label"],
                name="reco_cat_grade_uniq",
            ),
        ]
        verbose_name = "Item Category Grade"
        verbose_name_plural = (
            "Item Category Grades"
        )

    def __str__(self) -> str:
        return (
            f"{self.category.category_code} - "
            f"{self.grade_label}"
        )

    def clean(self):
        super().clean()

        if self.grade_label:
            self.grade_label = normalize_whitespace(
                self.grade_label
            ).upper()

        errors = {}
        if not self.grade_label:
            errors["grade_label"] = (
                "Grade is required."
            )
        if (
            self.category_id
            and not self.category.is_production_output
        ):
            errors["category"] = (
                "Grades can only be added to a "
                "category marked as a production "
                "type."
            )
        if errors:
            raise ValidationError(errors)

    def save(self, *args, **kwargs):
        self.full_clean()
        return super().save(*args, **kwargs)


def _validate_grade_against_category(
    *,
    category: "ItemCategory | None",
    grade_label: str,
    allow_blank: bool,
) -> dict:
    """
    If ``category`` is a production type with a configured grade
    list, ``grade_label`` must be one of those grades (blank
    included only when ``allow_blank`` and the field is empty) - a
    category with no grades configured yet, or a non-production
    category, imposes no restriction, so this stays backward
    compatible with data entered before grades existed.
    """
    if category is None or not category.is_production_output:
        return {}

    valid_grades = set(
        category.grades.values_list(
            "grade_label", flat=True
        )
    )
    if not valid_grades:
        return {}

    if allow_blank and not grade_label:
        return {}

    if grade_label not in valid_grades:
        return {
            "grade_label": (
                f"'{grade_label or '(blank)'}' is "
                "not a configured grade for "
                f"{category.category_name}. Add it "
                "in Item Category Management first, "
                "or leave this blank."
                if allow_blank
                else f"'{grade_label or '(blank)'}' "
                "is not a configured grade for "
                f"{category.category_name}. Add it "
                "in Item Category Management first."
            )
        }
    return {}


def _validate_grade_against_item_categories(
    *,
    item: "Item | None",
    grade_label: str,
    allow_blank: bool,
) -> dict:
    """
    Same idea as ``_validate_grade_against_category``, but for a
    rate/mix row (``ItemStandard``/``SiteItemConfig``) that's scoped
    to an item rather than a single category - an item can now
    belong to more than one production-type category, so the valid
    grade set is the union across all of them. Blank grade is always
    ignored here too when ``allow_blank``.
    """
    if item is None:
        return {}

    if allow_blank and not grade_label:
        return {}

    valid_grades = set()
    has_any_configured = False
    for category in item.categories.filter(
        is_production_output=True
    ):
        category_grades = set(
            category.grades.values_list(
                "grade_label", flat=True
            )
        )
        if category_grades:
            has_any_configured = True
            valid_grades.update(category_grades)

    if not has_any_configured:
        return {}

    if grade_label not in valid_grades:
        return {
            "grade_label": (
                f"'{grade_label or '(blank)'}' is "
                "not a configured grade for any of "
                "this item's production-type "
                "categories. Add it in Item "
                "Category Management first"
                + (
                    ", or leave this blank."
                    if allow_blank
                    else "."
                )
            )
        }
    return {}


class Item(BusinessModel):
    """
    Store item master covering every reconciliation category.

    ``reconciliation_type`` is a fixed two-value enum (the calculation
    strategy), but which category and behaviour a given item has is
    pure data - new categories never require a code change.

    ``categories`` is many-to-many: a shared raw material (Cement,
    Water, Admixture) is often required across more than one
    production type - or the same product split into one category
    per grade - and needs to be created exactly once and linked to
    every category it participates in, rather than duplicated per
    category. Which ONE of an item's categories a given reconciliation
    entry is actually for is recorded on the entry itself
    (``ReconciliationEntry.category``), not inferred here.
    """

    item_code = models.CharField(
        max_length=30,
        blank=True,
        unique=True,
        db_index=True,
    )
    item_name = models.CharField(
        max_length=150,
    )
    categories = models.ManyToManyField(
        ItemCategory,
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
        ordering = ["item_name"]
        indexes = [
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
        errors.update(
            _validate_grade_against_item_categories(
                item=self.item if self.item_id else None,
                grade_label=self.grade_label,
                allow_blank=True,
            )
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

    ``period`` splits this into two tiers sharing one table: a
    standing site override (``period`` blank, the behaviour above)
    and a month-only override (``period`` set) that applies for that
    one ``ReconciliationPeriod`` only, on top of - i.e. resolved
    before - the standing override. Both can be active at once for
    the same (item, site, grade); only one active row is allowed per
    exact (item, site, grade, period) combination.
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
    period = models.ForeignKey(
        "ReconciliationPeriod",
        on_delete=models.PROTECT,
        related_name="site_item_overrides",
        null=True,
        blank=True,
        help_text=(
            "Leave blank for a standing site override. "
            "Set to a specific period to override the "
            "rate/mix for that one month only, on top of "
            "the standing site override."
        ),
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
                condition=Q(period__isnull=True),
                name="reco_site_item_grade_date_uniq",
            ),
            models.UniqueConstraint(
                fields=["item", "site", "grade_label"],
                condition=Q(
                    is_active=True,
                    period__isnull=True,
                ),
                name="reco_site_item_grade_active_uniq",
            ),
            # Period-scoped rows are a separate tier - a standing
            # override (period NULL) and a month-only override
            # (period set) for the same (item, site, grade) can both
            # be active at once, but only one active row is allowed
            # per exact period.
            models.UniqueConstraint(
                fields=[
                    "item",
                    "site",
                    "grade_label",
                    "period",
                ],
                condition=Q(
                    is_active=True,
                    period__isnull=False,
                ),
                name="reco_site_item_grade_period_active_uniq",
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
        period_suffix = (
            f" [{self.period.period_month:%b %Y}]"
            if self.period_id
            else ""
        )
        return (
            f"{self.site.site_code} - "
            f"{self.item.item_code}{grade_suffix}{period_suffix}"
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
        errors.update(
            _validate_grade_against_item_categories(
                item=self.item if self.item_id else None,
                grade_label=self.grade_label,
                allow_blank=True,
            )
        )
        if (
            self.period_id
            and self.site_id
            and self.period.site_id != self.site_id
        ):
            errors["period"] = (
                "Period must belong to the selected site."
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
    category = models.ForeignKey(
        ItemCategory,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="reconciliation_entries",
        help_text=(
            "Which of the item's (possibly "
            "several) production-type categories "
            "this entry's theoretical consumption "
            "is derived from - must be one of "
            "the item's own categories. Blank for "
            "a material not tied to any specific "
            "product's output batch."
        ),
    )
    grade_label = models.CharField(
        max_length=50,
        blank=True,
        default="",
        help_text=(
            "Which production grade this "
            "material's actual consumption is "
            "for (e.g. M20) - blank for a "
            "material not tied to a specific "
            "grade's output batch, or for a "
            "material with no recipe at all. A "
            "norm-based item can have one entry "
            "per grade produced this period."
        ),
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
            # Split in two because Postgres/SQLite treat NULL as
            # distinct from NULL - a single constraint spanning the
            # nullable `category` column would silently let a
            # category-less item (Other Items, no recipe) collect
            # duplicate entries for the same grade.
            models.UniqueConstraint(
                fields=[
                    "period",
                    "item",
                    "grade_label",
                ],
                condition=Q(category__isnull=True),
                name="reco_entry_period_item_grade_uniq",
            ),
            models.UniqueConstraint(
                fields=[
                    "period",
                    "item",
                    "category",
                    "grade_label",
                ],
                condition=Q(
                    category__isnull=False
                ),
                name="reco_entry_period_item_cat_grade_uniq",
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
        grade_suffix = (
            f" ({self.grade_label})"
            if self.grade_label
            else ""
        )
        category_suffix = (
            f" [{self.category.category_code}]"
            if self.category_id
            else ""
        )
        return (
            f"{self.period} - "
            f"{self.item.item_code}"
            f"{category_suffix}{grade_suffix}"
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
        if self.grade_label:
            self.grade_label = normalize_whitespace(
                self.grade_label
            ).upper()

        errors = {}

        if self.category_id and self.item_id:
            if not self.item.categories.filter(
                id=self.category_id
            ).exists():
                errors["category"] = (
                    "This category isn't one of "
                    "the item's assigned "
                    "categories."
                )
            else:
                errors.update(
                    _validate_grade_against_category(
                        category=self.category,
                        grade_label=self.grade_label,
                        allow_blank=True,
                    )
                )

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
    A batch of the thing actually produced this period (e.g. cum of
    Concrete, at a given grade) - not a raw material. ``category``
    must be one flagged ``is_production_output`` on the item
    category master; every ``Item`` assigned to that same category
    is one of its recipe materials.

    A norm-based material's theoretical consumption is derived from
    all of a period's output batches logged against ITS OWN
    category, grouped by ``grade_label`` (normalized to uppercase,
    e.g. "M20") and matched against that material's own
    ``ItemStandard``/``SiteItemConfig`` row for the same grade to
    resolve its mix ratio; a grade with no matching row falls back
    to the material's blank-grade default. See
    ``services.resolution.resolve_standard`` and
    ``services.variance._resolve_norm_based_theoretical``.
    """

    period = models.ForeignKey(
        ReconciliationPeriod,
        on_delete=models.PROTECT,
        related_name="output_entries",
    )
    category = models.ForeignKey(
        ItemCategory,
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
        ordering = ["category__category_name"]
        indexes = [
            models.Index(
                fields=["period", "category"],
                name="reco_output_period_cat_idx",
            ),
        ]
        verbose_name = "Reconciliation Output Entry"
        verbose_name_plural = (
            "Reconciliation Output Entries"
        )

    def __str__(self) -> str:
        return (
            f"{self.period} - "
            f"{self.category.category_code} - "
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
            self.category_id
            and not self.category.is_production_output
        ):
            errors["category"] = (
                "Only categories marked as a "
                "production type (e.g. Concrete) "
                "can be logged here - raw "
                "materials are reconciled through "
                "Reconciliation Entries instead."
            )
        elif self.category_id:
            errors.update(
                _validate_grade_against_category(
                    category=self.category,
                    grade_label=self.grade_label,
                    allow_blank=False,
                )
            )

        if errors:
            raise ValidationError(errors)

    def save(self, *args, **kwargs):
        self.full_clean()
        result = super().save(*args, **kwargs)
        self._refresh_norm_based_entries()
        return result

    def delete(self, *args, **kwargs):
        period = self.period
        category_id = self.category_id
        grade_label = self.grade_label
        result = super().delete(*args, **kwargs)

        for entry in period.entries.filter(
            category_id=category_id,
            grade_label=grade_label,
            item__reconciliation_type=(
                ReconciliationType.NORM_BASED
            ),
        ):
            entry.save()

        return result

    def _refresh_norm_based_entries(self):
        # A production-output batch is the shared basis every
        # norm-based material entry explicitly linked to THIS SAME
        # CATEGORY, FOR THIS EXACT GRADE, derives its theoretical
        # consumption from (see
        # services.variance._resolve_norm_based_theoretical) - an
        # entry's own `category` (not its item's, which may now span
        # more than one) decides which output batches apply to it.
        for entry in self.period.entries.filter(
            category_id=self.category_id,
            grade_label=self.grade_label,
            item__reconciliation_type=(
                ReconciliationType.NORM_BASED
            ),
        ):
            entry.save()


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


def reconciliation_attachment_upload_to(
    instance,
    filename,
) -> str:
    period = (
        instance.period
        if instance.period_id
        else None
    )
    period_label = (
        f"{period.site.site_code}-{period.period_month}"
        if period
        else "unassigned"
    )
    return (
        "reconciliation/attachments/"
        f"{period_label}/{filename}"
    )


class ReconciliationPeriodAttachment(
    UUIDPrimaryKeyModel,
    TimeStampedModel,
    SoftDeleteModel,
):
    """
    Uploaded evidence (e.g. a physical stock-count photo, a signed
    stock sheet scan) for one site's monthly reconciliation period -
    mirrors CorrectionRequestAttachment's shape and validation rules,
    scoped to ReconciliationPeriod instead of CorrectionRequest.
    """

    period = models.ForeignKey(
        ReconciliationPeriod,
        on_delete=models.PROTECT,
        related_name="attachments",
    )
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="reconciliation_attachments",
    )
    file = models.FileField(
        upload_to=reconciliation_attachment_upload_to,
    )
    original_name = models.CharField(
        max_length=255,
        blank=True,
    )
    content_type = models.CharField(
        max_length=120,
        blank=True,
    )
    size_bytes = models.PositiveIntegerField(
        default=0,
    )
    notes = models.CharField(
        max_length=255,
        blank=True,
    )

    class Meta:
        db_table = (
            "reconciliation_period_attachment"
        )
        ordering = ["-created_at"]
        indexes = [
            models.Index(
                fields=["period", "is_deleted"],
                name="reco_attach_period_del_idx",
            ),
        ]
        verbose_name = (
            "Reconciliation Period Attachment"
        )
        verbose_name_plural = (
            "Reconciliation Period Attachments"
        )

    def __str__(self) -> str:
        return self.original_name or str(self.file)

    def clean(self):
        super().clean()

        errors = {}
        file_name = (
            self.original_name
            or getattr(self.file, "name", "")
        )
        extension = os.path.splitext(
            file_name
        )[1].lower()

        if (
            extension
            not in ALLOWED_ATTACHMENT_EXTENSIONS
        ):
            errors["file"] = (
                "Only PDF, Excel, CSV, and image "
                "files are allowed."
            )

        if (
            self.content_type
            and self.content_type
            not in ALLOWED_ATTACHMENT_CONTENT_TYPES
        ):
            errors["content_type"] = (
                "Uploaded file type is not allowed."
            )

        if (
            self.size_bytes
            > MAX_ATTACHMENT_SIZE_BYTES
        ):
            errors["file"] = (
                "Attachment size cannot exceed 10 MB."
            )

        if errors:
            raise ValidationError(errors)

    def save(self, *args, **kwargs):
        if self.file:
            if not self.original_name:
                self.original_name = (
                    os.path.basename(
                        self.file.name
                    )
                )
            if not self.size_bytes:
                self.size_bytes = getattr(
                    self.file,
                    "size",
                    0,
                )

        self.full_clean()
        return super().save(*args, **kwargs)
