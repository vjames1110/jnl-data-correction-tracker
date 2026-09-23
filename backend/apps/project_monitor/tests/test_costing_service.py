from datetime import date, timedelta
from decimal import Decimal

import pytest
from rest_framework.exceptions import ValidationError

from apps.project_monitor.models import MaterialKind
from apps.project_monitor.services import costing, dpr, hr
from apps.project_monitor.tests.finance_helpers import (
    days_ago,
    make_item,
)

TODAY = date(2026, 9, 19)


@pytest.mark.django_db
def test_rate_on_uses_the_latest_row_on_or_before_the_day(site):
    costing.create_rate(
        site=site,
        kind=MaterialKind.CONCRETE,
        effective_from=date(2026, 1, 1),
        rate=Decimal("5000"),
    )
    costing.create_rate(
        site=site,
        kind=MaterialKind.CONCRETE,
        effective_from=date(2026, 6, 1),
        rate=Decimal("5500"),
    )

    assert costing.rate_on(
        site, MaterialKind.CONCRETE, date(2026, 3, 1)
    ) == Decimal("5000")
    assert costing.rate_on(
        site, MaterialKind.CONCRETE, date(2026, 6, 1)
    ) == Decimal("5500")
    assert costing.rate_on(
        site, MaterialKind.CONCRETE, date(2025, 12, 31)
    ) == Decimal("0")


@pytest.mark.django_db
def test_a_rate_cannot_repeat_the_same_day_or_be_zero(site):
    costing.create_rate(
        site=site,
        kind=MaterialKind.TMT,
        effective_from=date(2026, 1, 1),
        rate=Decimal("60000"),
    )

    with pytest.raises(ValidationError):
        costing.create_rate(
            site=site,
            kind=MaterialKind.TMT,
            effective_from=date(2026, 1, 1),
            rate=Decimal("61000"),
        )
    with pytest.raises(ValidationError):
        costing.create_rate(
            site=site,
            kind=MaterialKind.TMT,
            effective_from=date(2026, 2, 1),
            rate=Decimal("0"),
        )


@pytest.mark.django_db
def test_concrete_cost_estimated_from_dpr_execution_at_the_wef_rate(
    site, pm
):
    item = make_item(
        site,
        rate=Decimal("100"),
        concrete_per_unit=Decimal("0.5"),
    )
    day = days_ago(1)
    dpr.add_detailed_entry(
        site=site, item=item, day=day, qty=Decimal("20"), actor=pm
    )
    costing.create_rate(
        site=site,
        kind=MaterialKind.CONCRETE,
        effective_from=day - timedelta(days=10),
        rate=Decimal("6000"),
    )

    row = costing.cost_on(site, day)

    assert row["concrete_cum"] == Decimal("10.0")
    assert row["concrete_cost"] == Decimal("60000.0")
    assert row["concrete_source"] == "ESTIMATED"


@pytest.mark.django_db
def test_a_stores_figure_replaces_the_estimate_rather_than_adding_to_it(
    site, pm
):
    item = make_item(
        site,
        rate=Decimal("100"),
        concrete_per_unit=Decimal("0.5"),
    )
    day = days_ago(1)
    dpr.add_detailed_entry(
        site=site, item=item, day=day, qty=Decimal("20"), actor=pm
    )
    costing.create_rate(
        site=site,
        kind=MaterialKind.CONCRETE,
        effective_from=day - timedelta(days=10),
        rate=Decimal("6000"),
    )
    costing.create_production(
        site=site,
        day=day,
        cum=Decimal("8"),
        cement_cost=Decimal("30000"),
        aggregate_cost=Decimal("5000"),
    )

    row = costing.cost_on(site, day)

    # 8 cum @ actual cost - not 10 cum @ the estimated rate, and the
    # two figures are not summed together.
    assert row["concrete_cum"] == Decimal("8")
    assert row["concrete_cost"] == Decimal("35000")
    assert row["concrete_source"] == "STORES"


@pytest.mark.django_db
def test_tmt_cost_is_always_computed_with_no_stores_override(
    site, pm
):
    item = make_item(
        site,
        rate=Decimal("100"),
        tmt_kg_per_unit=Decimal("50"),
    )
    day = days_ago(1)
    dpr.add_detailed_entry(
        site=site, item=item, day=day, qty=Decimal("10"), actor=pm
    )
    costing.create_rate(
        site=site,
        kind=MaterialKind.TMT,
        effective_from=day - timedelta(days=10),
        rate=Decimal("60"),
    )

    row = costing.cost_on(site, day)

    # 10 qty x 50 kg/unit = 500 kg = 0.5 MT x 60/MT = 30.
    assert row["tmt_mt"] == Decimal("0.5")
    assert row["tmt_cost"] == Decimal("30.0")


@pytest.mark.django_db
def test_margin_and_the_ninety_percent_flag(site, pm):
    item = make_item(site, rate=Decimal("1000"))
    day = days_ago(1)
    dpr.add_detailed_entry(
        site=site, item=item, day=day, qty=Decimal("10"), actor=pm
    )
    hr.create_labour(
        site=site,
        day=day,
        category="Mason",
        nos=Decimal("10"),
        rate=Decimal("950"),
        actor=pm,
    )

    row = costing.cost_on(site, day)

    assert row["value"] == Decimal("10000")
    assert row["total_expense"] == Decimal("9500.00")
    assert row["margin"] == Decimal("500.00")
    assert row["flagged"] is True


@pytest.mark.django_db
def test_days_with_nothing_at_all_are_clean_and_not_flagged(site):
    row = costing.cost_on(site, days_ago(2))

    assert row["value"] == Decimal("0")
    assert row["total_expense"] == Decimal("0")
    assert row["expense_ratio"] is None
    assert row["flagged"] is False
    assert row["complete"] == {
        "dpr": False,
        "hr": False,
        "machinery": False,
        "stores": False,
    }


@pytest.mark.django_db
def test_future_days_are_never_costed(site):
    tomorrow = TODAY + timedelta(days=1)

    row = costing.cost_on(site, tomorrow, today=TODAY)

    assert row["value"] == Decimal("0")
    assert row["complete"]["dpr"] is False


@pytest.mark.django_db
def test_completeness_flags_each_feed_that_has_something_that_day(
    site, pm
):
    item = make_item(site, rate=Decimal("100"))
    day = days_ago(1)
    dpr.add_detailed_entry(
        site=site, item=item, day=day, qty=Decimal("1"), actor=pm
    )

    row = costing.cost_on(site, day)

    assert row["complete"]["dpr"] is True
    assert row["complete"]["hr"] is False
    assert row["complete"]["machinery"] is False
    assert row["complete"]["stores"] is False


@pytest.mark.django_db
def test_cost_table_totals_add_up_across_the_range(site, pm):
    item = make_item(site, rate=Decimal("500"))
    for offset, qty in ((1, Decimal("4")), (2, Decimal("6"))):
        dpr.add_detailed_entry(
            site=site,
            item=item,
            day=days_ago(offset),
            qty=qty,
            actor=pm,
        )

    table = costing.cost_table(
        site, days_ago(5), days_ago(0)
    )

    assert table["totals"]["value"] == Decimal("5000")
    assert len(table["days"]) == 6


@pytest.mark.django_db
def test_today_at_a_glance_combines_today_yesterday_and_month_to_date(
    site, pm
):
    item = make_item(site, rate=Decimal("200"))
    dpr.add_detailed_entry(
        site=site,
        item=item,
        day=TODAY,
        qty=Decimal("5"),
        actor=pm,
        today=TODAY,
    )
    dpr.add_detailed_entry(
        site=site,
        item=item,
        day=TODAY - timedelta(days=1),
        qty=Decimal("3"),
        actor=pm,
        today=TODAY,
    )

    glance = costing.today_at_a_glance(site, today=TODAY)

    assert glance["today"]["value"] == Decimal("1000")
    assert glance["yesterday"]["value"] == Decimal("600")
    assert glance["month_to_date"]["value"] == Decimal("1600")
    assert glance["cumulative"]["value"] == Decimal("1600")


@pytest.mark.django_db
def test_today_at_a_glance_has_no_cumulative_before_any_dpr_entry(
    site,
):
    glance = costing.today_at_a_glance(site, today=TODAY)

    assert glance["cumulative"] is None
