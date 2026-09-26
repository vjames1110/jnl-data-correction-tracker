"""
The worked example in docs/project-monitor/dpr-to-costing.md, run for
real, so the tutorial's numbers cannot drift from what Costing does.
"""

from datetime import date
from decimal import Decimal

import pytest

from apps.project_monitor.models import MaterialKind
from apps.project_monitor.services import boq, costing, dpr
from apps.project_monitor.tests.finance_helpers import days_ago

D = Decimal


@pytest.fixture
def wall(site):
    """RCC retaining wall: authority 12,500 at +12% = bid 14,000."""
    site.tender_percent = D("12")
    site.save()
    costing.create_rate(
        site=site,
        kind=MaterialKind.CONCRETE,
        effective_from=date(2026, 1, 1),
        rate=D("5200"),
    )
    costing.create_rate(
        site=site,
        kind=MaterialKind.TMT,
        effective_from=date(2026, 1, 1),
        rate=D("62000"),
    )
    return dpr.create_item(
        site=site,
        item_no="4.1",
        description="RCC retaining wall",
        unit="cum",
        scope_qty=D("500"),
        authority_rate=D("12500"),
        concrete_per_unit=D("1"),
        tmt_kg_per_unit=D("80"),
    )


@pytest.mark.django_db
def test_the_bid_rate_is_the_tutorials_14000(wall):
    assert wall.rate == D("14000.00")


@pytest.mark.django_db
def test_ten_cum_gives_the_tutorials_value_and_material_costs(
    site, wall
):
    day = days_ago(0)
    dpr.add_detailed_entry(site=site, item=wall, day=day, qty=D("10"))

    row = costing.cost_on(site, day)

    assert row["value"] == D("140000")
    assert row["concrete_cost"] == D("52000")
    assert row["concrete_source"] == "ESTIMATED"
    assert row["tmt_mt"] == D("0.8")
    assert row["tmt_cost"] == D("49600")
    assert row["total_expense"] == D("101600")
    assert row["margin"] == D("38400")


@pytest.mark.django_db
def test_a_stores_figure_replaces_the_concrete_estimate(site, wall):
    day = days_ago(0)
    dpr.add_detailed_entry(site=site, item=wall, day=day, qty=D("10"))
    costing.create_production(
        site=site,
        day=day,
        cum=D("10"),
        cement_cost=D("40000"),
        aggregate_cost=D("10000"),
        sand_cost=D("5000"),
    )

    row = costing.cost_on(site, day)

    assert row["concrete_cost"] == D("55000")
    assert row["concrete_source"] == "STORES"
    # Replaced, never added: 55,000 + TMT 49,600.
    assert row["total_expense"] == D("104600")


@pytest.mark.django_db
def test_escalation_reprices_new_work_but_not_the_materials(site, wall):
    boq.create_escalation(
        site=site, effective_from=days_ago(1), percent=D("5")
    )
    day = days_ago(0)
    dpr.add_detailed_entry(site=site, item=wall, day=day, qty=D("10"))

    row = costing.cost_on(site, day)

    # 14,000 x 1.05 = 14,700 a cum ...
    assert row["value"] == D("147000")
    # ... while the material costs are exactly as before.
    assert row["concrete_cost"] == D("52000")
    assert row["tmt_cost"] == D("49600")
