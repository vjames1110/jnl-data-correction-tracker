from datetime import date, timedelta
from decimal import Decimal

import pytest
from rest_framework.exceptions import ValidationError

from apps.project_monitor.models import (
    FuelEntry,
    HireBasis,
    Machine,
    MachineSource,
    MachineUsage,
)
from apps.project_monitor.services import machinery

TODAY = date(2026, 9, 15)


def make_machine(site, **overrides):
    values = {
        "name": "JCB 3DX",
        "source": MachineSource.MARKET,
        "hire_basis": HireBasis.DAY,
        "rate": Decimal("9000"),
    }
    values.update(overrides)
    return Machine.objects.create(site=site, **values)


# ---- hire ------------------------------------------------------------


@pytest.mark.django_db
@pytest.mark.parametrize(
    "basis, rate, qty, expected",
    [
        (HireBasis.DAY, "9000", "2", "18000.00"),
        (HireBasis.HOUR, "1200", "7.5", "9000.00"),
        # Monthly hire uses a flat 30 days, whatever the month.
        (HireBasis.MONTH, "90000", "1", "3000.00"),
        (HireBasis.MONTH, "90000", "10", "30000.00"),
    ],
)
def test_hire_uses_the_basis(site, basis, rate, qty, expected):
    machine = make_machine(
        site, hire_basis=basis, rate=Decimal(rate)
    )
    assert machinery.hire_for(machine, Decimal(qty)) == Decimal(
        expected
    )


@pytest.mark.django_db
def test_usage_snapshots_the_hire_at_entry_time(site):
    machine = make_machine(site)
    usage, _ = machinery.save_usage(
        machine=machine, day=TODAY, qty=Decimal("1"), today=TODAY
    )
    assert usage.hire_amount == Decimal("9000.00")

    # A rate revision never rewrites a day already recorded.
    machine.rate = Decimal("12000")
    machine.save()
    usage.refresh_from_db()
    assert usage.hire_amount == Decimal("9000.00")


@pytest.mark.django_db
def test_usage_can_state_its_own_hire(site):
    machine = make_machine(site)
    usage, _ = machinery.save_usage(
        machine=machine,
        day=TODAY,
        qty=Decimal("1"),
        hire_amount=Decimal("7500"),
        today=TODAY,
    )
    assert usage.hire_amount == Decimal("7500.00")


@pytest.mark.django_db
def test_entering_a_day_again_replaces_it(site):
    machine = make_machine(site)
    _, created = machinery.save_usage(
        machine=machine, day=TODAY, qty=Decimal("1"), today=TODAY
    )
    _, created_again = machinery.save_usage(
        machine=machine, day=TODAY, qty=Decimal("2"), today=TODAY
    )
    assert created is True
    assert created_again is False
    assert MachineUsage.objects.get().qty == Decimal("2.00")


@pytest.mark.django_db
@pytest.mark.parametrize(
    "kwargs",
    [
        {"day": TODAY + timedelta(days=1), "qty": Decimal("1")},
        {"qty": Decimal("-1")},
        {"qty": Decimal("0")},  # nothing at all to record
        {"qty": Decimal("1"), "maintenance": Decimal("-5")},
    ],
)
def test_usage_validation(site, kwargs):
    machine = make_machine(site)
    values = {"machine": machine, "day": TODAY, "today": TODAY}
    values.update(kwargs)
    with pytest.raises(ValidationError):
        machinery.save_usage(**values)


@pytest.mark.django_db
def test_maintenance_alone_is_a_valid_day(site):
    machine = make_machine(site)
    usage, _ = machinery.save_usage(
        machine=machine,
        day=TODAY,
        maintenance=Decimal("2500"),
        today=TODAY,
    )
    assert usage.hire_amount == 0
    assert usage.maintenance == Decimal("2500.00")


@pytest.mark.django_db
def test_an_inactive_machine_takes_no_new_usage(site):
    machine = make_machine(site, is_active=False)
    with pytest.raises(ValidationError):
        machinery.save_usage(
            machine=machine,
            day=TODAY,
            qty=Decimal("1"),
            today=TODAY,
        )


# ---- fuel ------------------------------------------------------------


@pytest.mark.django_db
def test_fuel_from_rate_or_from_total(site):
    by_rate = machinery.add_fuel(
        site=site,
        day=TODAY,
        litres=Decimal("40"),
        rate=Decimal("95.50"),
        today=TODAY,
    )
    assert by_rate.amount == Decimal("3820.00")

    by_total = machinery.add_fuel(
        site=site,
        day=TODAY,
        litres=Decimal("40"),
        amount=Decimal("4000"),
        today=TODAY,
    )
    assert by_total.rate == Decimal("100.00")


@pytest.mark.django_db
def test_fuel_validation(site, other_site):
    foreign = make_machine(other_site)
    with pytest.raises(ValidationError):
        machinery.add_fuel(
            site=site, day=TODAY, litres=Decimal("0"),
            rate=Decimal("90"), today=TODAY,
        )
    with pytest.raises(ValidationError):
        machinery.add_fuel(
            site=site, day=TODAY, litres=Decimal("10"), today=TODAY
        )
    with pytest.raises(ValidationError):
        machinery.add_fuel(
            site=site, day=TODAY, litres=Decimal("10"),
            rate=Decimal("90"), machine=foreign, today=TODAY,
        )
    with pytest.raises(ValidationError):
        machinery.add_fuel(
            site=site,
            day=TODAY + timedelta(days=1),
            litres=Decimal("10"),
            rate=Decimal("90"),
            today=TODAY,
        )


# ---- day-wise table -----------------------------------------------------


@pytest.mark.django_db
def test_day_table_separates_market_and_ho_and_skips_future(site):
    market = make_machine(site)
    ho = make_machine(
        site,
        name="Transit mixer",
        source=MachineSource.HO,
        hire_basis=HireBasis.HOUR,
        rate=Decimal("500"),
    )
    day = date(2026, 9, 2)
    machinery.save_usage(
        machine=market, day=day, qty=Decimal("1"),
        maintenance=Decimal("300"), today=TODAY,
    )
    machinery.save_usage(
        machine=ho, day=day, qty=Decimal("8"),
        other=Decimal("100"), today=TODAY,
    )
    machinery.add_fuel(
        site=site, machine=market, day=day,
        litres=Decimal("40"), amount=Decimal("4000"), today=TODAY,
    )
    machinery.add_fuel(
        site=site, day=day, litres=Decimal("10"),
        amount=Decimal("1000"), today=TODAY,
    )

    summary = machinery.month_summary(site, 2026, 9, today=TODAY)
    days = {row["date"]: row for row in summary["days"]}

    assert len(summary["days"]) == 15  # 1st .. 15th only
    row = days[day]
    assert row["market_hire"] == Decimal("9000.00")
    assert row["ho_hire"] == Decimal("4000.00")
    assert row["fuel"] == Decimal("5000.00")
    assert row["maintenance"] == Decimal("300.00")
    assert row["other"] == Decimal("100.00")
    assert row["total"] == Decimal("18400.00")
    assert summary["totals"]["total"] == Decimal("18400.00")

    # Per-machine figures plus untied site fuel add back to the total.
    by_machine = {m["name"]: m for m in summary["by_machine"]}
    assert by_machine["JCB 3DX"]["fuel"] == Decimal("4000.00")
    assert by_machine["Transit mixer"]["qty"] == Decimal("8.00")
    assert summary["site_fuel"] == Decimal("1000.00")
    assert (
        sum(m["total"] for m in summary["by_machine"])
        + summary["site_fuel"]
        == summary["totals"]["total"]
    )


@pytest.mark.django_db
def test_an_empty_month_is_all_zero(site):
    summary = machinery.month_summary(site, 2026, 8, today=TODAY)
    assert len(summary["days"]) == 31
    assert summary["totals"]["total"] == 0
    assert summary["by_machine"] == []
    assert (
        machinery.month_summary(site, 2026, 10, today=TODAY)["days"]
        == []
    )


@pytest.mark.django_db
def test_other_sites_are_not_mixed_in(site, other_site):
    machinery.save_usage(
        machine=make_machine(other_site),
        day=TODAY,
        qty=Decimal("1"),
        today=TODAY,
    )
    machinery.add_fuel(
        site=other_site, day=TODAY, litres=Decimal("5"),
        rate=Decimal("90"), today=TODAY,
    )
    summary = machinery.month_summary(site, 2026, 9, today=TODAY)
    assert summary["totals"]["total"] == 0
    assert FuelEntry.objects.count() == 1
