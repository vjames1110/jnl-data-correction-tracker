from datetime import timedelta
from decimal import Decimal

import pytest
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.project_monitor.models import (
    DprEntry,
    DprEntrySource,
    RaBill,
)
from apps.project_monitor.services import (
    billing,
    contract_finance,
)
from apps.project_monitor.tests.finance_helpers import (
    days_ago,
    make_item,
)


def add_entry(item, day, qty):
    return DprEntry.objects.create(
        item=item,
        date=day,
        qty=Decimal(qty),
        rate=item.rate,
        source=DprEntrySource.DETAILED,
    )


def add_bill(site, item, qty, day, number="RA-1", **kwargs):
    return billing.create_bill(
        site=site,
        bill_no=number,
        bill_date=day,
        lines=[{"item": item, "qty": Decimal(qty)}],
        **kwargs,
    )


# ---- billing ---------------------------------------------------------


@pytest.mark.django_db
def test_gross_outstanding_and_cumulative_billed(site, pm):
    item = make_item(site)
    site.opening_billed_value = Decimal("50000")
    site.opening_bill_no = "RA-0"
    site.opening_bill_date = days_ago(90)
    site.save()

    bill = add_bill(
        site,
        item,
        "100",
        days_ago(10),
        received_amount=Decimal("6000"),
        received_on=days_ago(2),
        actor=pm,
    )

    rows = billing.bill_rows(site)
    assert rows["bills"][0]["gross"] == Decimal("10000")
    assert rows["bills"][0]["outstanding"] == Decimal("4000")
    assert rows["totals"]["outstanding"] == Decimal("4000")
    assert billing.cumulative_billed(site) == Decimal("60000")
    assert billing.last_bill(site) == ("RA-1", bill.bill_date)


@pytest.mark.django_db
def test_deleting_a_bill_recomputes_cumulative_billed(site):
    item = make_item(site)
    bill = add_bill(site, item, "100", days_ago(5))
    assert billing.cumulative_billed(site) == Decimal("10000")

    bill.delete()

    assert billing.cumulative_billed(site) == Decimal("0")
    assert billing.last_bill(site) == ("", None)


@pytest.mark.django_db
def test_last_bill_is_the_latest_by_date_else_the_opening_bill(
    site,
):
    item = make_item(site)
    site.opening_bill_no = "RA-0"
    site.opening_bill_date = days_ago(200)
    site.save()
    assert billing.last_bill(site) == ("RA-0", days_ago(200))

    add_bill(site, item, "1", days_ago(5), number="RA-2")
    add_bill(site, item, "1", days_ago(30), number="RA-1")

    assert billing.last_bill(site) == ("RA-2", days_ago(5))


@pytest.mark.django_db
def test_bill_validation(site, other_site):
    item = make_item(site)
    foreign = make_item(other_site)

    with pytest.raises(ValidationError):
        billing.create_bill(
            site=site,
            bill_no="",
            bill_date=days_ago(1),
            lines=[{"item": item, "qty": Decimal("1")}],
        )
    with pytest.raises(ValidationError):
        billing.create_bill(
            site=site,
            bill_no="RA-1",
            bill_date=days_ago(1),
            lines=[{"item": item, "qty": Decimal("0")}],
        )
    with pytest.raises(ValidationError):
        billing.create_bill(
            site=site,
            bill_no="RA-1",
            bill_date=days_ago(1),
            lines=[{"item": foreign, "qty": Decimal("1")}],
        )
    with pytest.raises(ValidationError):
        billing.create_bill(
            site=site,
            bill_no="RA-1",
            bill_date=days_ago(1),
            lines=[
                {"item": item, "qty": Decimal("1")},
                {"item": item, "qty": Decimal("2")},
            ],
        )
    with pytest.raises(ValidationError):
        add_bill(
            site,
            item,
            "1",
            days_ago(1),
            received_amount=Decimal("100"),
        )

    add_bill(site, item, "1", days_ago(1))
    with pytest.raises(ValidationError):
        add_bill(site, item, "1", days_ago(1))
    assert RaBill.objects.count() == 1


@pytest.mark.django_db
def test_zero_quantity_lines_are_ignored_when_others_are_billed(
    site,
):
    first = make_item(site)
    second = make_item(site, item_no="1.2", description="Other")

    bill = billing.create_bill(
        site=site,
        bill_no="RA-1",
        bill_date=days_ago(1),
        lines=[
            {"item": first, "qty": Decimal("5")},
            {"item": second, "qty": Decimal("0")},
        ],
    )

    assert bill.lines.count() == 1


# ---- financial summary ----------------------------------------------


@pytest.fixture
def scheduled_site(site):
    """Contract value 10,00,000; project ends in 10 days."""
    site.end_date = timezone.localdate() + timedelta(days=10)
    site.save()
    return site


@pytest.mark.django_db
def test_summary_after_last_bill_balance_and_pace(scheduled_site):
    site = scheduled_site
    item = make_item(site, scope_qty=Decimal("10000"))
    today = timezone.localdate()
    add_entry(item, today - timedelta(days=7), "500")  # before bill
    add_entry(item, today - timedelta(days=3), "200")  # after bill
    add_entry(item, today - timedelta(days=1), "300")  # after bill
    add_bill(site, item, "1000", today - timedelta(days=5))

    summary = contract_finance.financial_summary(site)

    assert summary["valued"] == Decimal("1000000")
    assert summary["work_done_to_last_bill"] == Decimal("100000")
    assert summary["dpr_value_after_last_bill"] == Decimal("50000")
    assert summary["work_done_total"] == Decimal("150000")
    assert summary["balance_value"] == Decimal("850000")
    assert summary["percent_done"] == Decimal("15.0")
    assert summary["days_remaining"] == 10
    assert summary["per_day_required"] == Decimal("85000")
    assert summary["executed_yesterday"] == Decimal("30000")
    assert summary["pace"] == "SHORT_BY"
    assert summary["shortfall"] == Decimal("55000")
    assert summary["seven_day_average"] == Decimal("100000") / 7
    assert summary["last_bill_no"] == "RA-1"


@pytest.mark.django_db
def test_summary_is_on_pace_when_yesterday_meets_the_requirement(
    scheduled_site,
):
    site = scheduled_site
    item = make_item(site, scope_qty=Decimal("10000"))
    add_entry(
        item, timezone.localdate() - timedelta(days=1), "1000"
    )  # 1,00,000 > 99,000 per day required

    summary = contract_finance.financial_summary(site)

    assert summary["pace"] == "ON_PACE"
    assert summary["shortfall"] is None


@pytest.mark.django_db
def test_summary_counts_all_dpr_when_no_bill_exists(
    scheduled_site,
):
    site = scheduled_site
    item = make_item(site, scope_qty=Decimal("10000"))
    add_entry(item, days_ago(40), "100")

    summary = contract_finance.financial_summary(site)

    assert summary["last_bill_date"] is None
    assert summary["dpr_value_after_last_bill"] == Decimal("10000")
    assert summary["work_done_total"] == Decimal("10000")


@pytest.mark.django_db
def test_summary_uses_opening_billing_and_varied_value(
    scheduled_site,
):
    site = scheduled_site
    site.varied_value = Decimal("1200000")
    site.opening_billed_value = Decimal("300000")
    site.opening_bill_no = "RA-0"
    site.opening_bill_date = days_ago(20)
    site.save()
    item = make_item(site, scope_qty=Decimal("10000"))
    add_entry(item, days_ago(30), "1000")  # before opening bill
    add_entry(item, days_ago(10), "100")  # after opening bill

    summary = contract_finance.financial_summary(site)

    assert summary["valued"] == Decimal("1200000")
    assert summary["work_done_total"] == Decimal("310000")
    assert summary["balance_value"] == Decimal("890000")


@pytest.mark.django_db
def test_summary_has_no_pace_when_the_project_has_ended_or_is_undated(
    site,
):
    assert (
        contract_finance.financial_summary(site)["per_day_required"]
        is None
    )

    site.end_date = days_ago(3)
    site.save()
    summary = contract_finance.financial_summary(site)
    assert summary["days_remaining"] == -3
    assert summary["per_day_required"] is None
    assert summary["pace"] is None


@pytest.mark.django_db
def test_summary_uses_the_extended_end_date(scheduled_site):
    from apps.project_monitor.models import ProjectExtension

    site = scheduled_site
    ProjectExtension.objects.create(
        site=site,
        new_end_date=timezone.localdate() + timedelta(days=50),
    )

    assert (
        contract_finance.financial_summary(site)["days_remaining"]
        == 50
    )


@pytest.mark.django_db
def test_financial_report_as_on_a_date(site):
    item = make_item(site, scope_qty=Decimal("1000"))
    idle = make_item(site, item_no="1.2", description="Idle item")
    today = timezone.localdate()
    add_entry(item, today - timedelta(days=2), "100")
    add_entry(item, today - timedelta(days=1), "50")
    add_entry(item, today, "999")  # after the as-on date
    add_bill(site, item, "120", today - timedelta(days=1))

    report = contract_finance.financial_report(
        site, today - timedelta(days=1)
    )

    assert [row["item_no"] for row in report["rows"]] == ["1.1"]
    row = report["rows"][0]
    assert row["executed_qty"] == Decimal("150")
    assert row["executed_value"] == Decimal("15000")
    assert row["percent_of_item"] == Decimal("15.0")
    assert row["today_qty"] == Decimal("50")
    assert row["billed_qty"] == Decimal("120")
    assert row["unbilled_value"] == Decimal("3000")
    assert report["totals"]["executed_value"] == Decimal("15000")
    assert idle.id not in [r["id"] for r in report["rows"]]


@pytest.mark.django_db
def test_financial_report_excludes_bills_dated_after_the_as_on(
    site,
):
    item = make_item(site)
    today = timezone.localdate()
    add_entry(item, today - timedelta(days=5), "100")
    add_bill(site, item, "100", today)

    report = contract_finance.financial_report(
        site, today - timedelta(days=1)
    )

    assert report["rows"][0]["billed_qty"] == Decimal("0")
    assert report["rows"][0]["unbilled_value"] == Decimal("10000")
