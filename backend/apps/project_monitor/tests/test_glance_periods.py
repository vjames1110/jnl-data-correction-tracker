"""The "Today at a glance" period filter (service and API)."""

from datetime import date, timedelta
from decimal import Decimal

import pytest
from django.urls import reverse
from rest_framework.exceptions import ValidationError
from rest_framework.test import APIClient

from apps.authentication.tests.factories import (
    AdminUserFactory,
    DirectorUserFactory,
    ProjectManagerUserFactory,
)
from apps.project_monitor.models import DprEntry, DprEntrySource, DprItem
from apps.project_monitor.services import costing, hr
from apps.project_monitor.tests.finance_helpers import (
    days_ago,
    make_item,
)

TODAY = date(2026, 9, 19)


def _enter(site, pm, qty, day, rate="100"):
    """A DPR entry for any past day (history is not date-locked)."""
    item = DprItem.objects.filter(site=site).first() or make_item(
        site, rate=Decimal(rate)
    )
    DprEntry.objects.create(
        item=item,
        date=day,
        qty=Decimal(qty),
        rate=item.rate,
        source=DprEntrySource.EXCEL,
        created_by=pm,
        updated_by=pm,
    )
    return item


def _glance(site, **kwargs):
    return costing.today_at_a_glance(site, today=TODAY, **kwargs)


@pytest.mark.django_db
def test_defaults_to_today_and_keeps_the_four_blocks(site, pm):
    _enter(site, pm, "5", TODAY)

    glance = _glance(site)

    assert glance["selected"]["period"] == "today"
    assert glance["selected"]["label"] == "Today"
    assert glance["selected"]["single_day"] is True
    assert glance["selected"]["value"] == Decimal("500")
    # Existing consumers keep their blocks.
    assert glance["today"]["value"] == Decimal("500")
    assert glance["month_to_date"]["value"] == Decimal("500")


@pytest.mark.django_db
def test_yesterday_shows_only_yesterdays_figures(site, pm):
    _enter(site, pm, "5", TODAY)
    _enter(site, pm, "3", TODAY - timedelta(days=1))

    selected = _glance(site, period="yesterday")["selected"]

    assert selected["label"] == "Yesterday"
    assert selected["value"] == Decimal("300")
    assert selected["start"] == selected["end"] == TODAY - timedelta(days=1)


@pytest.mark.django_db
def test_last_7_days_includes_today_and_stops_seven_days_back(site, pm):
    _enter(site, pm, "1", TODAY)
    _enter(site, pm, "2", TODAY - timedelta(days=6))
    _enter(site, pm, "4", TODAY - timedelta(days=7))

    selected = _glance(site, period="last_7_days")["selected"]

    assert selected["single_day"] is False
    assert selected["days"] == 7
    assert selected["value"] == Decimal("300")


@pytest.mark.django_db
def test_month_to_date_and_last_month_split_at_the_month_boundary(site, pm):
    _enter(site, pm, "1", date(2026, 9, 1))
    _enter(site, pm, "2", date(2026, 8, 31))
    _enter(site, pm, "4", date(2026, 8, 1))

    mtd = _glance(site, period="month_to_date")["selected"]
    last = _glance(site, period="last_month")["selected"]

    assert mtd["value"] == Decimal("100")
    assert mtd["start"] == date(2026, 9, 1)
    assert last["label"] == "Last month"
    assert (last["start"], last["end"]) == (
        date(2026, 8, 1),
        date(2026, 8, 31),
    )
    assert last["value"] == Decimal("600")


@pytest.mark.django_db
def test_whole_project_starts_at_the_first_dpr_entry(site, pm):
    _enter(site, pm, "1", date(2026, 9, 10))
    _enter(site, pm, "2", TODAY)

    selected = _glance(site, period="whole_project")["selected"]

    assert selected["start"] == date(2026, 9, 10)
    assert selected["value"] == Decimal("300")


@pytest.mark.django_db
def test_whole_project_with_no_entries_is_empty_not_an_error(site):
    selected = _glance(site, period="whole_project")["selected"]

    assert selected["start"] is None
    assert selected["days"] == 0
    assert selected["value"] == Decimal("0")


@pytest.mark.django_db
def test_a_chosen_day_shows_that_day(site, pm):
    _enter(site, pm, "7", date(2026, 9, 12))

    selected = _glance(site, period="date", on=date(2026, 9, 12))["selected"]

    assert selected["label"] == "12-09-2026"
    assert selected["value"] == Decimal("700")
    assert selected["single_day"] is True


@pytest.mark.django_db
def test_a_chosen_day_must_be_given_and_not_in_the_future(site):
    with pytest.raises(ValidationError):
        _glance(site, period="date")
    with pytest.raises(ValidationError):
        _glance(site, period="date", on=TODAY + timedelta(days=1))


@pytest.mark.django_db
def test_an_unknown_period_is_refused(site):
    with pytest.raises(ValidationError):
        _glance(site, period="next_year")


@pytest.mark.django_db
def test_a_range_counts_man_days_and_a_day_counts_people_on_site(site, pm):
    for offset, nos in ((0, "10"), (1, "6")):
        hr.create_labour(
            site=site,
            day=TODAY - timedelta(days=offset),
            category="Mason",
            nos=Decimal(nos),
            rate=Decimal("100"),
            actor=pm,
            today=TODAY,
        )

    day = _glance(site)["selected"]
    week = _glance(site, period="last_7_days")["selected"]

    assert day["labour"] == {"kind": "on_site", "value": Decimal("10.00")}
    assert week["labour"] == {"kind": "man_days", "value": Decimal("16.00")}


@pytest.mark.django_db
def test_days_missing_a_feed_are_counted_for_the_period(site, pm):
    for offset in range(3):
        _enter(site, pm, "1", TODAY - timedelta(days=offset))
    hr.create_labour(
        site=site,
        day=TODAY,
        category="Mason",
        nos=Decimal("1"),
        rate=Decimal("10"),
        actor=pm,
        today=TODAY,
    )

    selected = _glance(site, period="last_7_days")["selected"]

    # DPR on 3 of the 7 days; HR on 1; no machinery at all.
    assert selected["missing_feeds"] == {
        "dpr": 4,
        "hr": 6,
        "machinery": 7,
    }


@pytest.mark.django_db
def test_a_range_is_flagged_once_expense_passes_ninety_percent(site, pm):
    _enter(site, pm, "1", TODAY - timedelta(days=1), rate="100")
    hr.create_labour(
        site=site,
        day=TODAY - timedelta(days=1),
        category="Mason",
        nos=Decimal("1"),
        rate=Decimal("95"),
        actor=pm,
        today=TODAY,
    )

    selected = _glance(site, period="last_7_days")["selected"]

    assert selected["flagged"] is True
    assert selected["margin"] == Decimal("5")


# ---- API -------------------------------------------------------------------


def _get(site, user, **params):
    client = APIClient()
    client.force_authenticate(user=user)
    return client.get(
        reverse("project-monitor-api:costing-glance"),
        {"site": str(site.id), **params},
    )


@pytest.mark.django_db
def test_api_passes_the_period_and_date_through(site):
    made = _get(site, AdminUserFactory(), period="yesterday")

    assert made.status_code == 200, made.data
    assert made.data["data"]["selected"]["label"] == "Yesterday"

    picked = _get(
        site,
        AdminUserFactory(),
        period="date",
        on=days_ago(3).isoformat(),
    )
    assert picked.data["data"]["selected"]["single_day"] is True


@pytest.mark.django_db
def test_api_defaults_to_today(site):
    selected = _get(site, DirectorUserFactory()).data["data"]["selected"]

    assert selected["period"] == "today"


@pytest.mark.django_db
@pytest.mark.parametrize(
    "params",
    [
        {"period": "next_year"},
        {"period": "date"},
        {"period": "date", "on": "not-a-date"},
        {"period": "date", "on": "2999-01-01"},
    ],
)
def test_api_bad_periods_are_a_400(site, params):
    assert _get(site, AdminUserFactory(), **params).status_code == 400


@pytest.mark.django_db
def test_api_access_is_unchanged(site):
    assert _get(site, DirectorUserFactory(), period="last_month").status_code == 200
    assert (
        _get(site, ProjectManagerUserFactory(), period="last_month").status_code
        == 403
    )
