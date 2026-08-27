from decimal import Decimal

from django.db import models as django_models

from apps.reconciliation.models import (
    ReconciliationEntryStatus,
    ReconciliationFlag,
    ReconciliationFlagType,
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
    is_incomplete = (
        entry.opening_stock is None
        or entry.receipts is None
        or entry.closing_stock is None
        if is_norm_based
        else entry.book_stock is None
        or entry.physical_count is None
    )

    if is_norm_based:
        rate, theoretical = (
            _resolve_norm_based_theoretical(
                entry, item
            )
        )
    else:
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
        actual = opening + receipts - closing
    else:
        actual = entry.physical_count

    actual = _quantize(actual, QUANTITY_QUANTUM)
    theoretical = _quantize(
        theoretical, QUANTITY_QUANTUM
    )
    variance = actual - theoretical
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
        variance=variance,
        base=theoretical,
        period=entry.period,
    )


def _resolve_norm_based_theoretical(entry, item):
    """
    Theoretical consumption for a norm-based item, computed per
    production grade and summed - production output recorded under
    grade M20 uses M20's mix ratio (if configured), M25 uses M25's,
    and so on, each falling back to the item's blank-grade default
    when no grade-specific standard exists.

    ``rate`` (used only for costing ``variance_value``) is a
    quantity-weighted average across the grades actually produced
    this period: actual consumption itself isn't split by grade in
    this model, so a single blended rate is the best available
    approximation. Returns ``(None, None)`` if any grade that was
    actually produced has no resolvable rate/mix ratio at all - that
    should be flagged as a configuration gap, not silently ignored.
    """
    output_rows = list(
        ReconciliationOutputEntry.objects.filter(
            period_id=entry.period_id,
            item_id=item.id,
        )
        .values("grade_label")
        .annotate(
            total_quantity=django_models.Sum(
                "output_quantity"
            )
        )
    )

    if not output_rows:
        resolved = resolve_standard(
            item=item,
            site=entry.period.site,
            on_date=entry.period.period_month,
            period=entry.period,
        )
        return resolved.rate, ZERO

    theoretical = ZERO
    weighted_rate_total = ZERO
    output_total = ZERO

    for row in output_rows:
        quantity = row["total_quantity"] or ZERO
        resolved = resolve_standard(
            item=item,
            site=entry.period.site,
            on_date=entry.period.period_month,
            grade_label=row["grade_label"] or "",
            period=entry.period,
        )
        if (
            resolved.rate is None
            or resolved.mix_ratio is None
        ):
            return None, None

        theoretical += quantity * resolved.mix_ratio
        weighted_rate_total += (
            quantity * resolved.rate
        )
        output_total += quantity

    rate = (
        weighted_rate_total / output_total
        if output_total
        else None
    )
    return rate, theoretical


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

        ReconciliationFlag.objects.create(
            period=entry.period,
            entry=entry,
            flag_type=(
                ReconciliationFlagType
                .MISSING_MIX_OR_RATE
            ),
            message=(
                "No rate or mix ratio is "
                "configured for this item at "
                "this site."
            ),
        )
        return

    flags = []

    if (
        entry.actual_quantity is not None
        and entry.actual_quantity < ZERO
    ):
        flags.append(
            (
                ReconciliationFlagType
                .NEGATIVE_CONSUMPTION,
                "Actual consumption is negative "
                "- check units and entered "
                "figures.",
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
