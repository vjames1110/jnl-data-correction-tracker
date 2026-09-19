from datetime import date, timedelta
from decimal import Decimal

import pytest
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.project_monitor.models import (
    DprEntry,
    DprEntrySource,
)
from apps.project_monitor.services import billing, dpr
from apps.project_monitor.tests.finance_helpers import (
    days_ago,
    make_item,
)

TODAY = date(2026, 9, 19)


@pytest.mark.django_db
@pytest.mark.parametrize(
    "offset,expected",
    [
        (0, True),
        (1, True),
        (3, True),
        (4, False),
        (30, False),
        (-1, False),
    ],
)
def test_edit_window_boundaries(site, offset, expected):
    day = TODAY - timedelta(days=offset)

    assert (
        dpr.is_day_editable(site, day, today=TODAY)
        is expected
    )


@pytest.mark.django_db
def test_admin_unlock_reopens_a_past_day_but_not_the_future(
    site, pm
):
    old_day = days_ago(20)
    assert not dpr.is_day_editable(site, old_day)

    dpr.unlock_day(
        site=site,
        day=old_day,
        reason="Missed entries after site audit",
        actor=pm,
    )

    assert dpr.is_day_editable(site, old_day)
    with pytest.raises(ValidationError):
        dpr.unlock_day(
            site=site,
            day=timezone.localdate() + timedelta(days=2),
            reason="nope",
            actor=pm,
        )
    with pytest.raises(ValidationError):
        dpr.unlock_day(
            site=site, day=days_ago(9), reason="  ", actor=pm
        )


@pytest.mark.django_db
def test_grid_save_snapshots_the_rate_and_replaces_its_own_entry(
    site, pm
):
    item = make_item(site)
    day = timezone.localdate()

    dpr.save_grid(
        site=site,
        edits=[{"item": item, "date": day, "qty": Decimal("40")}],
        actor=pm,
    )
    dpr.save_grid(
        site=site,
        edits=[{"item": item, "date": day, "qty": Decimal("55")}],
        actor=pm,
    )

    entries = DprEntry.objects.filter(item=item, date=day)
    assert entries.count() == 1
    entry = entries.get()
    assert entry.qty == Decimal("55")
    assert entry.rate == Decimal("100")
    assert entry.source == DprEntrySource.MANUAL_GRID
    assert dpr.dpr_value_on(site, day) == Decimal("5500")


@pytest.mark.django_db
def test_changing_an_items_rate_never_rewrites_recorded_value(
    site, pm
):
    item = make_item(site)
    day = timezone.localdate()
    dpr.save_grid(
        site=site,
        edits=[{"item": item, "date": day, "qty": Decimal("10")}],
        actor=pm,
    )

    item.rate = Decimal("999")
    item.save()

    assert dpr.dpr_value_on(site, day) == Decimal("1000")


@pytest.mark.django_db
def test_grid_keeps_detailed_entries_and_fills_the_remainder(
    site, pm
):
    item = make_item(site)
    day = timezone.localdate()
    dpr.add_detailed_entry(
        site=site,
        item=item,
        day=day,
        qty=Decimal("30"),
        location="Ch 12.5",
        actor=pm,
    )

    result = dpr.save_grid(
        site=site,
        edits=[{"item": item, "date": day, "qty": Decimal("50")}],
        actor=pm,
    )

    quantities = sorted(
        DprEntry.objects.filter(item=item, date=day).values_list(
            "qty", flat=True
        )
    )
    assert quantities == [Decimal("20"), Decimal("30")]
    assert result["saved"] == 1
    assert result["below_detailed"] == []


@pytest.mark.django_db
def test_grid_below_the_detailed_total_is_reported_not_applied(
    site, pm
):
    item = make_item(site)
    day = timezone.localdate()
    dpr.add_detailed_entry(
        site=site, item=item, day=day, qty=Decimal("30"), actor=pm
    )

    result = dpr.save_grid(
        site=site,
        edits=[{"item": item, "date": day, "qty": Decimal("10")}],
        actor=pm,
    )

    assert DprEntry.objects.filter(item=item, date=day).count() == 1
    assert result["below_detailed"][0]["detailed_total"] == Decimal(
        "30"
    )


@pytest.mark.django_db
def test_grid_skips_locked_days_and_reports_them(site, pm):
    item = make_item(site)

    result = dpr.save_grid(
        site=site,
        edits=[
            {
                "item": item,
                "date": days_ago(10),
                "qty": Decimal("5"),
            },
            {
                "item": item,
                "date": timezone.localdate(),
                "qty": Decimal("5"),
            },
        ],
        actor=pm,
    )

    assert result["saved"] == 1
    assert len(result["skipped_locked"]) == 1
    assert DprEntry.objects.count() == 1


@pytest.mark.django_db
def test_grid_rejects_negative_quantities_and_foreign_items(
    site, other_site, pm
):
    item = make_item(site)
    foreign = make_item(other_site)
    day = timezone.localdate()

    with pytest.raises(ValidationError):
        dpr.save_grid(
            site=site,
            edits=[{"item": item, "date": day, "qty": Decimal("-1")}],
            actor=pm,
        )
    with pytest.raises(ValidationError):
        dpr.save_grid(
            site=site,
            edits=[{"item": foreign, "date": day, "qty": Decimal("1")}],
            actor=pm,
        )


@pytest.mark.django_db
def test_detailed_entries_and_deletes_respect_the_lock(site, pm):
    item = make_item(site)

    with pytest.raises(ValidationError):
        dpr.add_detailed_entry(
            site=site,
            item=item,
            day=days_ago(12),
            qty=Decimal("5"),
            actor=pm,
        )

    entry = dpr.add_detailed_entry(
        site=site,
        item=item,
        day=timezone.localdate(),
        qty=Decimal("5"),
        actor=pm,
    )
    dpr.delete_entry(entry)
    assert not DprEntry.objects.exists()


@pytest.mark.django_db
def test_an_item_with_entries_cannot_be_deleted(site, pm):
    item = make_item(site)
    dpr.add_detailed_entry(
        site=site,
        item=item,
        day=timezone.localdate(),
        qty=Decimal("5"),
        actor=pm,
    )

    with pytest.raises(ValidationError):
        dpr.delete_item(item)

    empty = make_item(site, item_no="2.1", description="Other")
    dpr.delete_item(empty)


@pytest.mark.django_db
def test_item_rows_flag_major_items_and_compute_balances(site, pm):
    # Contract value is 10,00,000: 2% is 20,000.
    big = make_item(
        site,
        item_no="1",
        description="Big item",
        scope_qty=Decimal("1000"),
        rate=Decimal("100"),
    )
    small = make_item(
        site,
        item_no="2",
        description="Small item",
        scope_qty=Decimal("10"),
        rate=Decimal("100"),
    )
    dpr.add_detailed_entry(
        site=site,
        item=big,
        day=timezone.localdate(),
        qty=Decimal("250"),
        actor=pm,
    )

    rows = {r["item_no"]: r for r in dpr.build_item_rows(site)}

    assert rows["1"]["is_major"] is True
    assert rows["1"]["percent_of_contract"] == Decimal("10.00")
    assert rows["1"]["balance_qty"] == Decimal("750")
    assert rows["1"]["executed_value"] == Decimal("25000")
    assert rows["2"]["is_major"] is False
    assert small.amount == Decimal("1000")


@pytest.mark.django_db
def test_contract_value_prefers_the_varied_value(site):
    assert dpr.contract_value(site) == Decimal("1000000")

    site.varied_value = Decimal("1200000")
    assert dpr.contract_value(site) == Decimal("1200000")


@pytest.mark.django_db
def test_seven_day_average_uses_the_seven_days_before_today(
    site, pm
):
    item = make_item(site, rate=Decimal("10"))
    today = timezone.localdate()
    for offset in range(1, 8):
        DprEntry.objects.create(
            item=item,
            date=today - timedelta(days=offset),
            qty=Decimal("7"),
            rate=Decimal("10"),
            source=DprEntrySource.DETAILED,
        )
    # Today itself must not be counted.
    DprEntry.objects.create(
        item=item,
        date=today,
        qty=Decimal("1000"),
        rate=Decimal("10"),
        source=DprEntrySource.DETAILED,
    )

    assert dpr.seven_day_average(site, today) == Decimal("70")


@pytest.mark.django_db
def test_billed_qty_and_gross_use_snapshotted_rates(site, pm):
    item = make_item(site)
    bill = billing.create_bill(
        site=site,
        bill_no="RA-1",
        bill_date=timezone.localdate(),
        lines=[{"item": item, "qty": Decimal("10")}],
        actor=pm,
    )
    item.rate = Decimal("500")
    item.save()

    assert billing.bill_gross(bill) == Decimal("1000")
    assert dpr.billed_qty_map(site)[item.id] == Decimal("10")
