"""``manage.py recompute_reconciliation`` - repairs stale stored figures."""

from datetime import date
from decimal import Decimal
from io import StringIO

import pytest
from django.core.management import call_command

from apps.organization.models import Company, Site
from apps.reconciliation.models import (
    Item,
    ItemCategory,
    ItemStandard,
    ReconciliationEntry,
    ReconciliationEntryStatus,
    ReconciliationOutputEntry,
    ReconciliationPeriod,
    ReconciliationPeriodStatus,
    ReconciliationType,
)


@pytest.fixture
def stale_entry():
    company = Company.objects.create(
        company_code="JNL", company_name="Jhajharia Nirman Limited"
    )
    site = Site.objects.create(
        company=company, site_code="RCP", site_name="Recompute Site"
    )
    category = ItemCategory.objects.create(
        category_name="Concrete", is_production_output=True
    )
    item = Item.objects.create(
        item_name="Cement",
        reconciliation_type=ReconciliationType.NORM_BASED,
        uom="MT",
    )
    item.categories.add(category)
    ItemStandard.objects.create(
        item=item,
        rate=Decimal("6500.00"),
        mix_ratio=Decimal("0.32"),
        effective_from=date(2026, 1, 1),
    )
    period = ReconciliationPeriod.objects.create(
        site=site, period_month=date(2026, 4, 1)
    )
    ReconciliationOutputEntry.objects.create(
        period=period,
        category=category,
        output_quantity=Decimal("100.000"),
    )
    entry = ReconciliationEntry.objects.create(
        period=period,
        item=item,
        opening_stock=Decimal("10.000"),
        receipts=Decimal("30.000"),
        closing_stock=Decimal("8.000"),
    )
    # What an older calculation left behind, never saved again since.
    ReconciliationEntry.objects.filter(pk=entry.pk).update(
        actual_quantity=None,
        theoretical_or_book_quantity=None,
        variance_quantity=None,
        variance_value=None,
        status=ReconciliationEntryStatus.NOT_CALCULATED,
    )
    return entry


def _run(*args):
    out = StringIO()
    call_command("recompute_reconciliation", *args, stdout=out)
    return out.getvalue()


@pytest.mark.django_db
def test_dry_run_reports_but_writes_nothing(stale_entry):
    output = _run()

    assert "Would update 1 of 1" in output
    stale_entry.refresh_from_db()
    assert stale_entry.actual_quantity is None


@pytest.mark.django_db
def test_apply_writes_the_recalculated_figures(stale_entry):
    _run("--apply")

    stale_entry.refresh_from_db()
    assert stale_entry.actual_quantity == Decimal("32.000")
    assert (
        stale_entry.status
        == ReconciliationEntryStatus.WITHIN_TOLERANCE
    )
    assert "Would update 0 of 1" in _run()


@pytest.mark.django_db
def test_approved_periods_need_explicit_opt_in(stale_entry):
    ReconciliationPeriod.objects.filter(
        pk=stale_entry.period_id
    ).update(status=ReconciliationPeriodStatus.APPROVED)

    assert "Updated 0 of 0" in _run("--apply")
    stale_entry.refresh_from_db()
    assert stale_entry.actual_quantity is None

    _run("--apply", "--include-approved")
    stale_entry.refresh_from_db()
    assert stale_entry.actual_quantity == Decimal("32.000")
