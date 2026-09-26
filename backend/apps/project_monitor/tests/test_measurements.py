"""Daily measurement sheets behind DPR quantities."""

from decimal import Decimal

import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.exceptions import ValidationError
from rest_framework.test import APIClient

from apps.authentication.tests.factories import (
    AdminUserFactory,
    DirectorUserFactory,
    ProjectHoUserFactory,
)
from apps.project_monitor.models import DprMeasurement
from apps.project_monitor.services import dpr, measurement
from apps.project_monitor.tests.finance_helpers import (
    days_ago,
    make_item,
)

D = Decimal


def line(**values):
    base = {"description": "", "is_deduction": False}
    base.update(values)
    return base


def quantity(**dimensions):
    return DprMeasurement(**dimensions).quantity


# ---- the quantity of a line -------------------------------------------


def test_quantity_multiplies_only_the_filled_dimensions():
    assert quantity(nos=D("2"), length=D("10"), breadth=D("1.5")) == D(
        "30.000"
    )
    assert quantity(
        nos=D("2"), length=D("10"), breadth=D("1.5"), depth=D("0.5")
    ) == D("15.000")
    assert quantity(length=D("12.5")) == D("12.500")
    assert quantity(length=D("4"), breadth=D("2.5")) == D("10.000")


def test_nos_alone_is_a_plain_count():
    assert quantity(nos=D("7")) == D("7.000")


def test_a_deduction_counts_negatively():
    assert quantity(
        nos=D("1"), length=D("2"), breadth=D("2"), is_deduction=True
    ) == D("-4.000")


def test_quantity_is_rounded_to_three_places():
    assert quantity(length=D("1.111"), breadth=D("1.111")) == D("1.234")


def test_a_line_with_nothing_measured_is_zero():
    assert quantity() == D("0.000")


# ---- saving a sheet ---------------------------------------------------


@pytest.mark.django_db
def test_a_sheet_is_saved_and_totalled(site, pm):
    item = make_item(site)

    sheet = measurement.replace_sheet(
        site=site,
        item=item,
        day=days_ago(0),
        lines=[
            line(description="Wall A", nos=D("2"), length=D("5")),
            line(
                description="Opening",
                nos=D("1"),
                length=D("1"),
                breadth=D("2"),
                is_deduction=True,
            ),
        ],
        actor=pm,
    )

    assert sheet["total"] == D("8.000")
    assert [ln.description for ln in sheet["lines"]] == [
        "Wall A",
        "Opening",
    ]
    assert [ln.row_order for ln in sheet["lines"]] == [0, 1]


@pytest.mark.django_db
def test_saving_replaces_the_days_lines_and_an_empty_list_clears_them(
    site,
):
    item = make_item(site)
    day = days_ago(0)
    measurement.replace_sheet(
        site=site, item=item, day=day, lines=[line(nos=D("3"))]
    )

    measurement.replace_sheet(
        site=site,
        item=item,
        day=day,
        lines=[line(nos=D("1")), line(nos=D("1"))],
    )
    assert DprMeasurement.objects.filter(item=item).count() == 2

    cleared = measurement.replace_sheet(
        site=site, item=item, day=day, lines=[]
    )
    assert cleared["lines"] == []
    assert cleared["total"] == D("0")
    assert DprMeasurement.objects.filter(item=item).count() == 0


@pytest.mark.django_db
def test_other_days_and_items_are_left_alone(site):
    item = make_item(site)
    other = make_item(site, item_no="1.2", description="Other")
    measurement.replace_sheet(
        site=site, item=item, day=days_ago(1), lines=[line(nos=D("1"))]
    )
    measurement.replace_sheet(
        site=site, item=other, day=days_ago(0), lines=[line(nos=D("1"))]
    )

    measurement.replace_sheet(
        site=site, item=item, day=days_ago(0), lines=[line(nos=D("9"))]
    )

    assert DprMeasurement.objects.count() == 3
    assert (
        measurement.measured_map(site, days_ago(3), days_ago(0))[
            (item.id, days_ago(1))
        ]
        == D("1.000")
    )


@pytest.mark.django_db
def test_lines_are_validated(site):
    item = make_item(site)

    for bad in (
        [line()],  # nothing measured
        [line(length=D("-1"))],  # negative: use Deduct
        [line(nos=D("1"))] * (measurement.MAX_LINES + 1),
    ):
        with pytest.raises(ValidationError):
            measurement.replace_sheet(
                site=site, item=item, day=days_ago(0), lines=bad
            )
    assert not DprMeasurement.objects.exists()


@pytest.mark.django_db
def test_a_failed_save_keeps_the_existing_sheet(site):
    item = make_item(site)
    measurement.replace_sheet(
        site=site, item=item, day=days_ago(0), lines=[line(nos=D("5"))]
    )

    with pytest.raises(ValidationError):
        measurement.replace_sheet(
            site=site,
            item=item,
            day=days_ago(0),
            lines=[line(nos=D("1")), line()],
        )

    assert DprMeasurement.objects.get(item=item).nos == D("5")


@pytest.mark.django_db
def test_the_dpr_edit_window_applies(site):
    item = make_item(site)

    with pytest.raises(ValidationError):
        measurement.replace_sheet(
            site=site,
            item=item,
            day=days_ago(20),
            lines=[line(nos=D("1"))],
        )
    with pytest.raises(ValidationError):
        measurement.replace_sheet(
            site=site,
            item=item,
            day=days_ago(-1),
            lines=[line(nos=D("1"))],
        )

    dpr.unlock_day(
        site=site,
        day=days_ago(20),
        reason="Late measurement",
        actor=AdminUserFactory(),
    )
    measurement.replace_sheet(
        site=site,
        item=item,
        day=days_ago(20),
        lines=[line(nos=D("1"))],
    )


@pytest.mark.django_db
def test_a_group_or_foreign_item_has_no_measurements(site, other_site):
    group = dpr.create_item(
        site=site, item_no="4", description="Earthwork", is_heading=True
    )
    foreign = make_item(other_site)

    for target in (group, foreign):
        with pytest.raises(ValidationError):
            measurement.replace_sheet(
                site=site,
                item=target,
                day=days_ago(0),
                lines=[line(nos=D("1"))],
            )


@pytest.mark.django_db
def test_an_item_with_measurements_cannot_be_deleted(site):
    item = make_item(site)
    measurement.replace_sheet(
        site=site, item=item, day=days_ago(0), lines=[line(nos=D("1"))]
    )

    with pytest.raises(ValidationError):
        dpr.delete_item(item)


@pytest.mark.django_db
def test_measurements_never_change_the_dpr_quantity(site):
    item = make_item(site)
    dpr.save_grid(
        site=site,
        edits=[{"item": item, "date": days_ago(0), "qty": D("15")}],
    )

    measurement.replace_sheet(
        site=site,
        item=item,
        day=days_ago(0),
        lines=[line(length=D("12.5"))],
    )

    assert dpr.executed_totals(site)[item.id][0] == D("15")


# ---- API ---------------------------------------------------------------


@pytest.fixture
def api():
    return APIClient()


def url(name, *args):
    return reverse(f"project-monitor-api:{name}", args=args)


def put_sheet(api, site, item, day, lines):
    return api.put(
        url("dpr-measurements"),
        {
            "site": str(site.id),
            "item": str(item.id),
            "date": str(day),
            "lines": lines,
        },
        format="json",
    )


@pytest.mark.django_db
def test_api_saves_and_reads_a_sheet(api, site, assigned_pm):
    item = make_item(site)
    api.force_authenticate(user=assigned_pm)

    saved = put_sheet(
        api,
        site,
        item,
        days_ago(0),
        [
            {"description": "Wall", "nos": "2", "length": "5"},
            {
                "description": "Door",
                "nos": "1",
                "length": "1",
                "breadth": "2",
                "is_deduction": True,
            },
        ],
    )

    assert saved.status_code == status.HTTP_200_OK
    assert saved.data["data"]["total"] == D("8.000")
    assert [
        row["quantity"] for row in saved.data["data"]["lines"]
    ] == [D("10.000"), D("-2.000")]

    listing = api.get(
        url("dpr-measurements"),
        {"site": str(site.id), "item": str(item.id)},
    ).data["data"]
    assert len(listing) == 1
    assert listing[0]["date"] == days_ago(0)
    assert listing[0]["total"] == D("8.000")

    by_day = api.get(
        url("dpr-measurements"),
        {"site": str(site.id), "date": str(days_ago(5))},
    ).data["data"]
    assert by_day == []


@pytest.mark.django_db
def test_api_grid_reports_the_measured_total_per_day(
    api, site, assigned_pm
):
    item = make_item(site)
    api.force_authenticate(user=assigned_pm)
    put_sheet(
        api, site, item, days_ago(0), [{"nos": "3", "length": "4"}]
    )

    grid = api.get(
        url("dpr-grid"), {"site": str(site.id)}
    ).data["data"]

    row = grid["items"][0]
    assert row["measured"] == {days_ago(0).isoformat(): D("12.000")}


@pytest.mark.django_db
def test_api_bad_lines_are_a_400(api, site, assigned_pm):
    item = make_item(site)
    api.force_authenticate(user=assigned_pm)

    empty_line = put_sheet(api, site, item, days_ago(0), [{}])
    locked = put_sheet(
        api, site, item, days_ago(20), [{"nos": "1"}]
    )
    unknown = api.put(
        url("dpr-measurements"),
        {
            "site": str(site.id),
            "item": "00000000-0000-0000-0000-000000000000",
            "date": str(days_ago(0)),
            "lines": [{"nos": "1"}],
        },
        format="json",
    )

    assert empty_line.status_code == status.HTTP_400_BAD_REQUEST
    assert locked.status_code == status.HTTP_400_BAD_REQUEST
    assert unknown.status_code == status.HTTP_404_NOT_FOUND


@pytest.mark.django_db
def test_api_permissions(api, site, assigned_pm, pm):
    item = make_item(site)
    body = [{"nos": "1"}]

    api.force_authenticate(user=assigned_pm)
    assert (
        put_sheet(api, site, item, days_ago(0), body).status_code
        == status.HTTP_200_OK
    )

    # Project HO reads, never writes.
    api.force_authenticate(user=ProjectHoUserFactory())
    assert (
        api.get(
            url("dpr-measurements"), {"site": str(site.id)}
        ).status_code
        == status.HTTP_200_OK
    )
    assert (
        put_sheet(api, site, item, days_ago(0), body).status_code
        == status.HTTP_403_FORBIDDEN
    )

    # The Director has every entry right, like an Admin.
    api.force_authenticate(user=DirectorUserFactory())
    assert (
        put_sheet(api, site, item, days_ago(0), body).status_code
        == status.HTTP_200_OK
    )

    # A manager with no DPR & Bills grant on the site gets nothing.
    api.force_authenticate(user=pm)
    assert (
        api.get(
            url("dpr-measurements"), {"site": str(site.id)}
        ).status_code
        == status.HTTP_403_FORBIDDEN
    )
    assert (
        put_sheet(api, site, item, days_ago(0), body).status_code
        == status.HTTP_403_FORBIDDEN
    )
