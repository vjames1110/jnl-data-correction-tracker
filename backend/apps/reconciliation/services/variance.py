from decimal import Decimal

from django.db import models as django_models

from apps.reconciliation.models import (
    ReconciliationEntryStatus,
    ReconciliationFlag,
    ReconciliationFlagType,
    ReconciliationMiscUsage,
    ReconciliationOutputEntry,
    ReconciliationToleranceSettings,
    ReconciliationType,
)
from apps.reconciliation.services.resolution import (
    resolve_standard,
)

ZERO = Decimal("0")
QUANTITY_QUANTUM = Decimal("0.001")
VALUE_QUANTUM = Decimal("0.01")


def _quantize(value: Decimal, quantum: Decimal) -> Decimal:
    return value.quantize(quantum)


def _miscellaneous_quantity(entry, item) -> Decimal:
    """
    What this material was consumed on OUTSIDE production this
    month (see ``ReconciliationMiscUsage``). Only a norm-based
    material's consumption is derived from stock movement, so only
    it has anything to deduct - a direct-count item is counted, not
    derived, and always reads ZERO here.
    """
    if (
        item.reconciliation_type
        != ReconciliationType.NORM_BASED
        or not entry.period_id
    ):
        return ZERO
    total = ReconciliationMiscUsage.objects.filter(
        period_id=entry.period_id,
        item=item,
    ).aggregate(
        total=django_models.Sum("quantity")
    )["total"]
    return total or ZERO


def compute_entry_variance(entry) -> None:
    """
    Resolve the effective rate/mix ratio and populate an entry's
    computed columns in place. Does not save.
    """
    item = entry.item
    is_norm_based = (
        item.reconciliation_type
        == ReconciliationType.NORM_BASED
    )
    # Snapshotted even while the entry is still incomplete, so the
    # figure is visible as soon as it is logged.
    entry.miscellaneous_quantity = (
        _miscellaneous_quantity(entry, item)
    )
    is_incomplete = (
        entry.opening_stock is None
        or entry.receipts is None
        or entry.closing_stock is None
        if is_norm_based
        else entry.book_stock is None
        or entry.physical_count is None
    )

    if is_norm_based:
        rate, theoretical, missing_grades = (
            _resolve_norm_based_theoretical(
                entry, item
            )
        )
        entry._missing_ratio_grades = missing_grades
    else:
        entry._missing_ratio_grades = []
        resolved = resolve_standard(
            item=item,
            site=entry.period.site,
            on_date=entry.period.period_month,
            period=entry.period,
        )
        rate, theoretical = (
            resolved.rate,
            entry.book_stock,
        )

    if rate is None or is_incomplete:
        entry.actual_quantity = None
        entry.theoretical_or_book_quantity = None
        entry.variance_quantity = None
        entry.variance_value = None
        entry.resolved_rate = rate
        entry.status = (
            ReconciliationEntryStatus.NOT_CALCULATED
        )
        return

    if is_norm_based:
        opening = entry.opening_stock
        receipts = entry.receipts
        closing = entry.closing_stock
        # Everything that left stock, less what went to non-
        # production work - what is left is production use, the
        # only thing the recipe (theoretical) can be compared with.
        actual = (
            opening
            + receipts
            - closing
            - entry.miscellaneous_quantity
        )
    else:
        actual = entry.physical_count

    actual = _quantize(actual, QUANTITY_QUANTUM)
    theoretical = _quantize(
        theoretical, QUANTITY_QUANTUM
    )
    # "Variance" is a profit/loss figure, not a raw difference, and
    # which raw quantity counts as "used more" depends on the item
    # type:
    # - Norm-based: theoretical is what the recipe says should have
    #   been consumed for the production achieved. Using LESS than
    #   that (actual < theoretical) is a saving - a positive
    #   "profit" - so variance = theoretical - actual.
    # - Direct-count: theoretical is really "book stock", the
    #   recorded quantity - not a target to beat. Physically
    #   counting LESS than the book says (actual < theoretical) is a
    #   shortage/shrinkage - a loss, not a saving - so this one
    #   keeps the plain actual - theoretical direction instead of
    #   flipping it.
    deviation = actual - theoretical
    variance = (
        -deviation if is_norm_based else deviation
    )
    variance_value = _quantize(
        variance * rate, VALUE_QUANTUM
    )

    entry.actual_quantity = actual
    entry.theoretical_or_book_quantity = (
        theoretical
    )
    entry.variance_quantity = variance
    entry.variance_value = variance_value
    entry.resolved_rate = rate
    entry.status = _resolve_status(
        variance=deviation,
        base=theoretical,
        period=entry.period,
    )


def _resolve_norm_based_theoretical(entry, item):
    """
    Theoretical consumption for a norm-based material for the whole
    month - one entry per material, summed across every production
    grade it's used for.

    A store produces one thing (e.g. Concrete) at several grades;
    raw-material stock (opening/receipts/closing) is a single
    physical figure entered once. Theoretical consumption is
    therefore the sum, over every ``ReconciliationOutputEntry`` in
    the period whose category contains this material, of
    ``output_quantity x mix_ratio`` for that batch's grade - each
    grade's mix ratio resolved independently via
    ``resolve_standard``.

    Returns ``(rate, theoretical, missing_grades)``:
    - ``rate`` - the material's rate (rates don't vary by grade
      here, so the first produced grade that resolves one wins;
      falls back to the blank-grade standard when nothing was
      produced).
    - ``theoretical`` - summed across the grades that DO have a mix
      ratio (``ZERO`` when nothing was produced against any of the
      material's categories).
    - ``missing_grades`` - grades produced this period for which no
      mix ratio could be resolved; the caller flags these but still
      keeps the partial figure.
    """
    site = entry.period.site
    on_date = entry.period.period_month

    output_by_grade = list(
        ReconciliationOutputEntry.objects.filter(
            period_id=entry.period_id,
            category__items=item,
        )
        .values("grade_label")
        .annotate(
            total=django_models.Sum(
                "output_quantity"
            )
        )
    )

    if not output_by_grade:
        blank = resolve_standard(
            item=item,
            site=site,
            on_date=on_date,
            grade_label="",
            period=entry.period,
        )
        return blank.rate, ZERO, []

    theoretical = ZERO
    rate = None
    missing_grades = []

    for row in output_by_grade:
        grade = row["grade_label"] or ""
        total = row["total"] or ZERO
        resolved = resolve_standard(
            item=item,
            site=site,
            on_date=on_date,
            grade_label=grade,
            period=entry.period,
        )
        if (
            rate is None
            and resolved.rate is not None
        ):
            rate = resolved.rate
        if resolved.mix_ratio is None:
            missing_grades.append(
                grade or "(no grade)"
            )
            continue
        theoretical += total * resolved.mix_ratio

    return rate, theoretical, missing_grades


def _resolve_status(
    *,
    variance: Decimal,
    base: Decimal,
    period,
) -> str:
    settings_row = (
        ReconciliationToleranceSettings.get_solo()
    )
    tolerance_percentage = (
        period.tolerance_percentage
        if period.tolerance_percentage is not None
        else settings_row.default_tolerance_percentage
    )
    reference = abs(base) if base else ZERO

    if reference == ZERO:
        return (
            ReconciliationEntryStatus.WITHIN_TOLERANCE
            if variance == ZERO
            else ReconciliationEntryStatus.OVER_TOLERANCE
        )

    variance_percentage = (
        abs(variance) / reference * Decimal("100")
    )
    watch_threshold = (
        tolerance_percentage
        * settings_row.watch_multiplier
    )

    if variance_percentage <= tolerance_percentage:
        return (
            ReconciliationEntryStatus.WITHIN_TOLERANCE
        )
    if variance_percentage <= watch_threshold:
        return ReconciliationEntryStatus.WATCH
    return ReconciliationEntryStatus.OVER_TOLERANCE


def refresh_entry_flags(entry) -> None:
    """
    Delete and regenerate the automatic data-quality flags for one
    entry, based on its just-computed variance columns.
    """
    ReconciliationFlag.objects.filter(
        entry=entry
    ).delete()

    missing_grades = getattr(
        entry, "_missing_ratio_grades", []
    )
    missing_grade_flag = None
    if missing_grades:
        missing_grade_flag = (
            ReconciliationFlagType.MISSING_MIX_OR_RATE,
            "No mix ratio configured for grade(s): "
            f"{', '.join(missing_grades)}.",
        )

    if (
        entry.status
        == ReconciliationEntryStatus.NOT_CALCULATED
    ):
        is_norm_based = (
            entry.item.reconciliation_type
            == ReconciliationType.NORM_BASED
        )
        is_incomplete = (
            entry.opening_stock is None
            or entry.receipts is None
            or entry.closing_stock is None
            if is_norm_based
            else entry.book_stock is None
            or entry.physical_count is None
        )
        if is_incomplete:
            # Entry data isn't complete yet (e.g. book
            # stock arrived via CSV but physical count
            # hasn't been entered) - expected mid-month
            # state, not a data-quality issue worth
            # flagging.
            return

        flag_type, message = missing_grade_flag or (
            ReconciliationFlagType.MISSING_MIX_OR_RATE,
            "No rate or mix ratio is configured for "
            "this item at this site.",
        )
        ReconciliationFlag.objects.create(
            period=entry.period,
            entry=entry,
            flag_type=flag_type,
            message=message,
        )
        return

    flags = []

    if missing_grade_flag is not None:
        flags.append(missing_grade_flag)

    if (
        entry.actual_quantity is not None
        and entry.actual_quantity < ZERO
    ):
        flags.append(
            (
                ReconciliationFlagType
                .NEGATIVE_CONSUMPTION,
                (
                    "Actual consumption is negative "
                    "- the miscellaneous use entered "
                    "is more than was taken out of "
                    "stock this month; check the "
                    "figures."
                    if entry.miscellaneous_quantity
                    else "Actual consumption is "
                    "negative - check units and "
                    "entered figures."
                ),
            )
        )

    if (
        entry.item.reconciliation_type
        == ReconciliationType.NORM_BASED
        and entry.actual_quantity
        and entry.actual_quantity > ZERO
        and (
            entry.theoretical_or_book_quantity
            or ZERO
        )
        == ZERO
    ):
        flags.append(
            (
                ReconciliationFlagType
                .NO_MATCHING_PRODUCTION,
                "Material was consumed but no "
                "matching production/output was "
                "recorded for this period.",
            )
        )

    if (
        entry.status
        == ReconciliationEntryStatus.OVER_TOLERANCE
    ):
        flags.append(
            (
                ReconciliationFlagType.OVER_TOLERANCE,
                "Variance exceeds the tolerance "
                "threshold.",
            )
        )

    if flags:
        ReconciliationFlag.objects.bulk_create(
            [
                ReconciliationFlag(
                    period=entry.period,
                    entry=entry,
                    flag_type=flag_type,
                    message=message,
                )
                for flag_type, message in flags
            ]
        )
