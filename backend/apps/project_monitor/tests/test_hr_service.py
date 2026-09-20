from datetime import date, timedelta
from decimal import Decimal

import pytest
from rest_framework.exceptions import ValidationError

from apps.project_monitor.models import (
    StaffDayOverride,
    StaffMember,
)
from apps.project_monitor.services import hr

TODAY = date(2026, 9, 15)


def staff(site, salary="30000", start=date(2026, 1, 1), end=None):
    return StaffMember.objects.create(
        site=site,
        name="Ravi Kumar",
        designation="Site Engineer",
        monthly_salary=Decimal(salary),
        from_date=start,
        to_date=end,
    )


# ---- staff cost per day -------------------------------------------


@pytest.mark.django_db
@pytest.mark.parametrize(
    "day, expected",
    [
        (date(2026, 2, 10), "1071.43"),  # 28 days
        (date(2026, 4, 10), "1000.00"),  # 30 days
        (date(2026, 1, 10), "967.74"),  # 31 days
        (date(2028, 2, 10), "1034.48"),  # leap February, 29 days
    ],
)
def test_daily_rate_uses_the_actual_days_in_that_month(
    site, day, expected
):
    member = staff(site, start=date(2025, 1, 1))
    assert hr.staff_cost_on(member, day) == Decimal(expected)


@pytest.mark.django_db
def test_no_cost_outside_the_payroll_window(site):
    member = staff(
        site, start=date(2026, 3, 10), end=date(2026, 3, 20)
    )
    assert hr.staff_cost_on(member, date(2026, 3, 9)) == 0
    assert hr.staff_cost_on(member, date(2026, 3, 10)) > 0
    assert hr.staff_cost_on(member, date(2026, 3, 20)) > 0
    assert hr.staff_cost_on(member, date(2026, 3, 21)) == 0


@pytest.mark.django_db
def test_mid_month_joiner_costs_the_full_daily_rate(site):
    member = staff(site, start=date(2026, 4, 25))
    # No proration: the first day is a whole day's cost.
    assert hr.staff_cost_on(
        member, date(2026, 4, 25)
    ) == Decimal("1000.00")


@pytest.mark.django_db
def test_day_override_replaces_the_daily_rate(site):
    member = staff(site)
    hr.set_override(
        staff=member,
        day=date(2026, 4, 10),
        amount=Decimal("0"),
        note="Absent",
        today=TODAY,
    )
    hr.set_override(
        staff=member,
        day=date(2026, 4, 11),
        amount=Decimal("1500"),
        today=TODAY,
    )
    assert hr.staff_cost_on(member, date(2026, 4, 10)) == 0
    assert hr.staff_cost_on(
        member, date(2026, 4, 11)
    ) == Decimal("1500.00")
    assert hr.staff_cost_on(
        member, date(2026, 4, 12)
    ) == Decimal("1000.00")


@pytest.mark.django_db
def test_setting_an_override_twice_replaces_it(site):
    member = staff(site)
    _, created = hr.set_override(
        staff=member, day=date(2026, 4, 10), amount=10, today=TODAY
    )
    _, created_again = hr.set_override(
        staff=member, day=date(2026, 4, 10), amount=20, today=TODAY
    )
    assert created is True
    assert created_again is False
    assert StaffDayOverride.objects.count() == 1
    assert StaffDayOverride.objects.get().amount == 20


@pytest.mark.django_db
def test_override_rejected_outside_the_window_or_in_the_future(site):
    member = staff(site, start=date(2026, 4, 10))
    with pytest.raises(ValidationError):
        hr.set_override(
            staff=member,
            day=date(2026, 4, 9),
            amount=0,
            today=TODAY,
        )
    with pytest.raises(ValidationError):
        hr.set_override(
            staff=member,
            day=TODAY + timedelta(days=1),
            amount=0,
            today=TODAY,
        )


# ---- labour --------------------------------------------------------


@pytest.mark.django_db
def test_labour_amount_defaults_to_nos_times_rate(site):
    entry = hr.create_labour(
        site=site,
        day=TODAY,
        category="Mason",
        nos=Decimal("12"),
        rate=Decimal("900"),
        today=TODAY,
    )
    assert entry.amount == Decimal("10800.00")


@pytest.mark.django_db
def test_labour_can_state_its_own_lump_sum(site):
    entry = hr.create_labour(
        site=site,
        day=TODAY,
        category="Shuttering gang",
        nos=Decimal("8"),
        rate=Decimal("900"),
        amount=Decimal("5000"),
        today=TODAY,
    )
    assert entry.amount == Decimal("5000.00")


@pytest.mark.django_db
@pytest.mark.parametrize(
    "kwargs",
    [
        {"category": "  "},
        {"nos": Decimal("0")},
        {"day": TODAY + timedelta(days=1)},
    ],
)
def test_labour_validation(site, kwargs):
    values = {
        "site": site,
        "day": TODAY,
        "category": "Mason",
        "nos": Decimal("3"),
        "rate": Decimal("900"),
        "today": TODAY,
    }
    values.update(kwargs)
    with pytest.raises(ValidationError):
        hr.create_labour(**values)


# ---- day-wise table ------------------------------------------------


@pytest.mark.django_db
def test_day_table_combines_labour_and_staff_and_skips_future(site):
    member = staff(site, salary="30000", start=date(2026, 9, 1))
    hr.create_labour(
        site=site,
        day=date(2026, 9, 2),
        category="Mason",
        nos=Decimal("10"),
        rate=Decimal("800"),
        today=TODAY,
    )
    hr.create_labour(
        site=site,
        day=date(2026, 9, 2),
        category="Helper",
        nos=Decimal("5"),
        rate=Decimal("500"),
        today=TODAY,
    )
    hr.set_override(
        staff=member,
        day=date(2026, 9, 3),
        amount=0,
        today=TODAY,
    )

    summary = hr.month_summary(site, 2026, 9, today=TODAY)
    days = {row["date"]: row for row in summary["days"]}

    # September has 30 days: 30000 / 30 = 1000 a day.
    assert len(summary["days"]) == 15  # 1st .. 15th, never later
    assert max(days) == TODAY
    day2 = days[date(2026, 9, 2)]
    assert day2["labour_nos"] == Decimal("15.00")
    assert day2["labour_cost"] == Decimal("10500.00")
    assert day2["staff_cost"] == Decimal("1000.00")
    assert day2["total"] == Decimal("11500.00")
    assert days[date(2026, 9, 3)]["staff_cost"] == 0

    totals = summary["totals"]
    assert totals["labour_cost"] == Decimal("10500.00")
    assert totals["staff_cost"] == Decimal("14000.00")  # 14 x 1000
    assert totals["total"] == Decimal("24500.00")
    categories = {
        row["category"]: row
        for row in summary["labour_by_category"]
    }
    assert categories["Mason"]["cost"] == Decimal("8000.00")
    assert categories["Helper"]["man_days"] == Decimal("5.00")


@pytest.mark.django_db
def test_a_month_with_no_data_is_all_zero(site):
    summary = hr.month_summary(site, 2026, 8, today=TODAY)
    assert len(summary["days"]) == 31
    assert summary["totals"]["total"] == 0
    assert hr.month_summary(site, 2026, 10, today=TODAY)["days"] == []


def test_parse_month():
    assert hr.parse_month("2026-03") == (2026, 3)
    assert hr.parse_month(None, today=TODAY) == (2026, 9)
    with pytest.raises(ValidationError):
        hr.parse_month("2026-13")
    with pytest.raises(ValidationError):
        hr.parse_month("March")
