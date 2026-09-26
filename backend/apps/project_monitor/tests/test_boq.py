"""Railway BOQ items: bid rate, escalation, group tree, import."""

import io
from decimal import Decimal

import openpyxl
import pytest
from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse
from rest_framework import status
from rest_framework.exceptions import ValidationError
from rest_framework.test import APIClient

from apps.authentication.tests.factories import (
    AdminUserFactory,
    DirectorUserFactory,
)
from apps.project_monitor.models import (
    DprEntry,
    DprItem,
    RaBillLine,
    RateEscalation,
)
from apps.project_monitor.services import (
    billing,
    boq,
    contract_finance,
    costing,
    dpr,
    dpr_import,
)
from apps.project_monitor.tests.finance_helpers import (
    days_ago,
    make_item,
)

D = Decimal


def make_group(site, item_no, description, parent=None):
    return dpr.create_item(
        site=site,
        item_no=item_no,
        description=description,
        is_heading=True,
        parent=parent,
    )


def make_boq_item(site, authority, percent=None, **overrides):
    values = {
        "item_no": "",
        "description": "BOQ item",
        "unit": "cum",
        "scope_qty": D("10"),
        "authority_rate": D(str(authority)),
    }
    if percent is not None:
        values["tender_percent"] = D(str(percent))
    values.update(overrides)
    return dpr.create_item(site=site, **values)


def set_contract_percent(site, percent):
    site.tender_percent = None if percent is None else D(str(percent))
    site.save()


def enter(site, item, qty, day, actor=None):
    return dpr.add_detailed_entry(
        site=site,
        item=item,
        day=day,
        qty=D(str(qty)),
        actor=actor,
    )


# ---- bid rate ---------------------------------------------------------


@pytest.mark.django_db
@pytest.mark.parametrize(
    "contract_percent,authority,expected",
    [
        ("5", "1000", "1050.00"),
        ("-5", "1000", "950.00"),
        ("0", "1000", "1000.00"),
        (None, "1000", "1000.00"),
        ("-5.5", "250", "236.25"),
        ("2.345", "999.99", "1023.44"),
    ],
)
def test_bid_rate_from_authority_rate_and_contract_percent(
    site, contract_percent, authority, expected
):
    set_contract_percent(site, contract_percent)

    item = make_boq_item(site, authority)

    assert item.rate == D(expected)


@pytest.mark.django_db
def test_item_percent_overrides_the_contract_percent(site):
    set_contract_percent(site, "5")

    own = make_boq_item(site, 1000, percent="-2")
    at_par = make_boq_item(site, 1000, percent="0")
    contract = make_boq_item(site, 1000)

    assert own.rate == D("980.00")
    assert at_par.rate == D("1000.00")  # an explicit 0 is an override
    assert contract.rate == D("1050.00")


@pytest.mark.django_db
def test_an_item_without_an_authority_rate_keeps_its_typed_rate(
    site,
):
    set_contract_percent(site, "5")

    item = make_item(site, rate=D("123.45"))

    assert item.authority_rate is None
    assert item.rate == D("123.45")
    item.scope_qty = D("7")
    item.save()
    item.refresh_from_db()
    assert item.rate == D("123.45")


@pytest.mark.django_db
def test_new_fields_default_so_existing_items_are_untouched(site):
    item = make_item(site)

    assert item.parent_id is None
    assert item.is_heading is False
    assert item.authority_rate is None
    assert item.tender_percent is None
    assert item.rate == D("100")
    assert item.amount == D("100000")


@pytest.mark.django_db
def test_changing_the_contract_percent_reprices_items_only(site, pm):
    set_contract_percent(site, "5")
    follows = make_boq_item(site, 1000)
    own = make_boq_item(site, 1000, percent="-2")
    typed = make_item(site, rate=D("77"))
    today = days_ago(0)
    enter(site, follows, 3, today, actor=pm)

    set_contract_percent(site, "-10")
    result = boq.recalculate_rates(site, actor=pm)

    for item in (follows, own, typed):
        item.refresh_from_db()
    assert follows.rate == D("900.00")
    assert own.rate == D("980.00")
    assert typed.rate == D("77")
    assert result == {"items_changed": 1, "entries_on_old_rate": 1}
    # The entry recorded before the change keeps the old rate.
    assert DprEntry.objects.get(item=follows).rate == D("1050.00")


# ---- escalation -------------------------------------------------------


@pytest.mark.django_db
def test_escalation_is_the_total_from_the_latest_step_on_or_before(
    site,
):
    boq.create_escalation(
        site=site, effective_from=days_ago(10), percent=D("4")
    )
    boq.create_escalation(
        site=site, effective_from=days_ago(3), percent=D("6.5")
    )
    series = boq.escalation_series(site)

    assert boq.escalation_percent(series, days_ago(11)) == 0
    assert boq.escalation_percent(series, days_ago(10)) == D("4")
    assert boq.escalation_percent(series, days_ago(4)) == D("4")
    assert boq.escalation_percent(series, days_ago(3)) == D("6.5")
    assert boq.escalation_percent(series, days_ago(0)) == D("6.5")
    assert boq.escalation_percent([], days_ago(0)) == 0


@pytest.mark.django_db
def test_effective_rate_is_bid_rate_times_escalation(site):
    set_contract_percent(site, "-5")
    item = make_boq_item(site, 1000)  # bid 950
    boq.create_escalation(
        site=site, effective_from=days_ago(2), percent=D("10")
    )

    assert boq.effective_rate(item, days_ago(3)) == D("950.00")
    assert boq.effective_rate(item, days_ago(2)) == D("1045.00")
    assert boq.effective_rate(item, days_ago(0)) == D("1045.00")


@pytest.mark.django_db
def test_escalation_validation(site):
    boq.create_escalation(
        site=site, effective_from=days_ago(1), percent=D("3")
    )

    with pytest.raises(ValidationError):
        boq.create_escalation(
            site=site, effective_from=days_ago(1), percent=D("5")
        )
    for bad in (None, D("501"), D("-501")):
        with pytest.raises(ValidationError):
            boq.create_escalation(
                site=site, effective_from=days_ago(5), percent=bad
            )
    assert RateEscalation.objects.filter(site=site).count() == 1


@pytest.mark.django_db
def test_new_work_is_priced_at_the_escalated_rate_and_old_work_is_not(
    site, pm
):
    item = make_item(site, rate=D("100"))
    boq.create_escalation(
        site=site, effective_from=days_ago(2), percent=D("10")
    )

    enter(site, item, 5, days_ago(3), actor=pm)  # before the step
    enter(site, item, 5, days_ago(1), actor=pm)  # after it
    dpr.save_grid(
        site=site,
        edits=[{"item": item, "date": days_ago(0), "qty": D("4")}],
        actor=pm,
    )

    rates = {
        e.date: e.rate for e in DprEntry.objects.filter(item=item)
    }
    assert rates[days_ago(3)] == D("100")
    assert rates[days_ago(1)] == D("110.00")
    assert rates[days_ago(0)] == D("110.00")


@pytest.mark.django_db
def test_recorded_entries_never_change_when_escalation_changes(
    site, pm
):
    item = make_item(site, rate=D("100"))
    entry = enter(site, item, 5, days_ago(1), actor=pm)
    step = boq.create_escalation(
        site=site, effective_from=days_ago(3), percent=D("20")
    )
    # Recorded before the step existed: still at 100 ...
    entry.refresh_from_db()
    assert entry.rate == D("100")
    # ... and deleting the step later does not touch it either.
    boq.delete_escalation(step)
    entry.refresh_from_db()
    assert entry.rate == D("100")


@pytest.mark.django_db
def test_bill_lines_use_the_rate_in_force_on_the_bill_date(site):
    item = make_item(site, rate=D("100"))
    enter(site, item, 20, days_ago(1))
    boq.create_escalation(
        site=site, effective_from=days_ago(5), percent=D("10")
    )

    early = billing.create_bill(
        site=site,
        bill_no="RA-1",
        bill_date=days_ago(6),
        lines=[{"item": item, "qty": D("5")}],
    )
    late = billing.create_bill(
        site=site,
        bill_no="RA-2",
        bill_date=days_ago(0),
        lines=[{"item": item, "qty": D("5")}],
    )

    assert RaBillLine.objects.get(bill=early).rate == D("100")
    assert RaBillLine.objects.get(bill=late).rate == D("110.00")


@pytest.mark.django_db
def test_unbilled_value_uses_the_rate_in_force(site):
    item = make_item(site, rate=D("100"))
    enter(site, item, 10, days_ago(1))
    boq.create_escalation(
        site=site, effective_from=days_ago(2), percent=D("10")
    )

    assert billing.unbilled_value(site) == D("1100.00")
    report = contract_finance.financial_report(site)
    assert report["totals"]["unbilled_value"] == D("1100.00")


# ---- hierarchy --------------------------------------------------------


@pytest.mark.django_db
def test_items_nest_three_levels_and_no_further(site):
    top = make_group(site, "4", "Earthwork")
    middle = make_group(site, "4.1", "Embankment", parent=top)
    leaf = make_item(site, item_no="4.1.1", parent=middle)

    assert (top.level(), middle.level(), leaf.level()) == (1, 2, 3)

    deep_group = make_group(site, "4.1.2", "Too deep", parent=middle)
    with pytest.raises(DjangoValidationError):
        make_item(site, item_no="4.1.2.1", parent=deep_group)


@pytest.mark.django_db
def test_a_parent_must_be_a_group_on_the_same_project(
    site, other_site
):
    leaf = make_item(site, item_no="1")
    foreign_group = make_group(other_site, "9", "Elsewhere")

    with pytest.raises(DjangoValidationError):
        make_item(site, item_no="1.1", parent=leaf)
    with pytest.raises(DjangoValidationError):
        make_item(site, item_no="9.1", parent=foreign_group)


@pytest.mark.django_db
def test_a_group_carries_no_quantity_rate_or_materials(site):
    for bad in (
        {"scope_qty": D("1")},
        {"rate": D("1")},
        {"authority_rate": D("1")},
        {"concrete_per_unit": D("1")},
        {"tmt_kg_per_unit": D("1")},
    ):
        with pytest.raises(DjangoValidationError):
            dpr.create_item(
                site=site,
                description="Group",
                is_heading=True,
                **bad,
            )


@pytest.mark.django_db
def test_an_item_with_entries_cannot_become_a_group_or_vice_versa(
    site, pm
):
    item = make_item(site)
    enter(site, item, 1, days_ago(0), actor=pm)
    item.is_heading = True
    item.scope_qty = D("0")
    item.rate = D("0")
    with pytest.raises(DjangoValidationError):
        item.save()

    group = make_group(site, "4", "Earthwork")
    make_item(site, item_no="4.1", parent=group)
    group.is_heading = False
    with pytest.raises(DjangoValidationError):
        group.save()


@pytest.mark.django_db
def test_a_group_takes_no_entries_grid_edits_or_bill_lines(site):
    group = make_group(site, "4", "Earthwork")

    with pytest.raises(ValidationError):
        enter(site, group, 1, days_ago(0))
    with pytest.raises(ValidationError):
        dpr.save_grid(
            site=site,
            edits=[
                {"item": group, "date": days_ago(0), "qty": D("1")}
            ],
        )
    with pytest.raises(ValidationError):
        billing.create_bill(
            site=site,
            bill_no="RA-1",
            bill_date=days_ago(0),
            lines=[{"item": group, "qty": D("1")}],
        )


@pytest.mark.django_db
def test_a_group_with_items_cannot_be_deleted(site):
    group = make_group(site, "4", "Earthwork")
    child = make_item(site, item_no="4.1", parent=group)

    with pytest.raises(ValidationError):
        dpr.delete_item(group)

    dpr.delete_item(child)
    dpr.delete_item(group)
    assert not DprItem.objects.filter(site=site).exists()


@pytest.mark.django_db
def test_creating_a_group_with_sub_items_is_all_or_nothing(site):
    group = dpr.create_item_with_children(
        site=site,
        item_no="4",
        description="Earthwork",
        is_heading=True,
        children=[
            {
                "item_no": "4.1",
                "description": "Embankment",
                "scope_qty": D("10"),
                "authority_rate": D("100"),
            },
            {
                "item_no": "4.2",
                "description": "Blanketing",
                "scope_qty": D("5"),
                "rate": D("50"),
            },
        ],
    )
    assert group.children.count() == 2

    with pytest.raises(DjangoValidationError):
        dpr.create_item_with_children(
            site=site,
            item_no="5",
            description="Concrete",
            is_heading=True,
            children=[
                {"item_no": "5.1", "description": "Good"},
                {"item_no": "4.1", "description": "Duplicate no"},
            ],
        )
    assert not DprItem.objects.filter(item_no="5").exists()
    assert not DprItem.objects.filter(item_no="5.1").exists()

    with pytest.raises(ValidationError):
        dpr.create_item_with_children(
            site=site,
            description="Not a group",
            children=[{"description": "Child"}],
        )


@pytest.mark.django_db
def test_rows_are_in_tree_order_with_roll_ups_and_no_double_count(
    site, pm
):
    top = make_group(site, "4", "Earthwork")
    a = make_item(
        site, item_no="4.1", parent=top, scope_qty=D("10"), rate=D("100")
    )
    middle = make_group(site, "4.2", "Filling", parent=top)
    c = make_item(
        site,
        item_no="4.2.1",
        parent=middle,
        scope_qty=D("5"),
        rate=D("200"),
    )
    lone = make_item(
        site, item_no="5", scope_qty=D("2"), rate=D("300")
    )
    enter(site, a, 3, days_ago(0), actor=pm)
    enter(site, c, 2, days_ago(0), actor=pm)

    rows = dpr.build_item_rows(site)
    by_id = {row["id"]: row for row in rows}

    assert [row["id"] for row in rows] == [
        top.id,
        a.id,
        middle.id,
        c.id,
        lone.id,
    ]
    assert [row["level"] for row in rows] == [1, 2, 2, 3, 1]
    assert by_id[middle.id]["amount"] == D("1000")
    assert by_id[top.id]["amount"] == D("2000")
    assert by_id[top.id]["executed_value"] == D("700")
    assert by_id[middle.id]["executed_value"] == D("400")
    assert by_id[top.id]["executed_qty"] == 0
    # 2000 of 2600 - a group is not a "major item" of its own.
    assert boq.boq_total(site) == D("2600")
    assert all(
        not by_id[g.id]["is_major"] for g in (top, middle)
    )
    # Contract-wide figures come from the entries, not from summing
    # every row (which would count a group and its items twice).
    assert dpr.executed_totals(site)[a.id] == (D("3"), D("300"))


@pytest.mark.django_db
def test_rows_carry_the_boq_columns(site):
    set_contract_percent(site, "-5")
    boq.create_escalation(
        site=site, effective_from=days_ago(1), percent=D("10")
    )
    item = make_boq_item(site, 1000)

    row = dpr.build_item_rows(site)[0]

    assert row["id"] == item.id
    assert row["authority_rate"] == D("1000.00")
    assert row["applied_tender_percent"] == D("-5.000")
    assert row["tender_percent"] is None
    assert row["bid_rate"] == D("950.00")
    assert row["escalation_percent"] == D("10")
    assert row["effective_rate"] == D("1045.00")
    assert row["authority_amount"] == D("10000.00")


@pytest.mark.django_db
def test_financial_report_lists_the_group_path_of_each_item(site, pm):
    top = make_group(site, "4", "Earthwork")
    middle = make_group(site, "4.1", "Embankment", parent=top)
    leaf = make_item(site, item_no="4.1.1", parent=middle)
    enter(site, leaf, 2, days_ago(0), actor=pm)

    rows = contract_finance.financial_report(site)["rows"]

    assert rows[0]["group"] == ["4 Earthwork", "4.1 Embankment"]


@pytest.mark.django_db
def test_costing_links_list_only_items_and_use_the_escalated_rate(
    site,
):
    group = make_group(site, "4", "Earthwork")
    leaf = make_item(
        site,
        item_no="4.1",
        parent=group,
        rate=D("1000"),
        concrete_per_unit=D("1"),
    )
    boq.create_escalation(
        site=site, effective_from=days_ago(1), percent=D("10")
    )

    rows = costing.item_links(site)["items"]

    assert [row["id"] for row in rows] == [leaf.id]
    assert rows[0]["bid_rate"] == D("1000")
    assert rows[0]["contract_rate"] == D("1100.00")


# ---- import -----------------------------------------------------------


def xlsx_upload(rows, name="boq.xlsx"):
    workbook = openpyxl.Workbook()
    sheet = workbook.active
    for row in rows:
        sheet.append(row)
    buffer = io.BytesIO()
    workbook.save(buffer)
    return SimpleUploadedFile(name, buffer.getvalue())


BOQ_HEADER = [
    "Item no",
    "Description",
    "Unit",
    "Qty",
    "Authority rate",
    "Tender % (+ above / - below)",
    "Quoted rate",
]
BOQ_ROWS = [
    ["Schedule of items"],
    BOQ_HEADER,
    ["4", "Earthwork"],
    ["4.1", "Embankment", "cum", 1000, 250, -5.5],
    ["4.2", "Blanketing", "cum", 400, 900, None, 936],
    ["4.3", "Plain rate", "cum", 10, None, None, 120],
    ["5", "Group with nothing under it"],
    ["6.1", "No group above", "cum", 5, 100, "Below 3.5%"],
]


@pytest.mark.django_db
def test_boq_import_builds_the_tree_and_the_rates(site, pm):
    result = dpr_import.import_items(
        site, xlsx_upload(BOQ_ROWS), actor=pm
    )

    assert result["created"] == 5
    assert result["headings"] == 1
    assert result["skipped_invalid"] == 1
    assert "Row 7" in result["errors"][0]
    items = {
        i.item_no: i for i in DprItem.objects.filter(site=site)
    }
    assert items["4"].is_heading
    assert items["4.1"].parent_id == items["4"].id
    assert items["4.1"].authority_rate == D("250.00")
    assert items["4.1"].tender_percent == D("-5.500")
    assert items["4.1"].rate == D("236.25")
    # Only the quoted rate was given: the percentage is worked back.
    assert items["4.2"].tender_percent == D("4.000")
    assert items["4.2"].rate == D("936.00")
    assert result["notes"] == []
    # A rate with no authority rate is a plain item, as before.
    assert items["4.3"].authority_rate is None
    assert items["4.3"].rate == D("120")
    assert items["4.3"].parent_id == items["4"].id
    # No "6" group in the file: the item goes to the top level.
    assert items["6.1"].parent_id is None
    assert items["6.1"].tender_percent == D("-3.500")
    assert items["6.1"].rate == D("96.50")


@pytest.mark.django_db
def test_boq_import_is_idempotent(site, pm):
    dpr_import.import_items(site, xlsx_upload(BOQ_ROWS), actor=pm)

    again = dpr_import.import_items(
        site, xlsx_upload(BOQ_ROWS), actor=pm
    )

    assert again["created"] == 0
    assert again["skipped_existing"] == 5
    assert DprItem.objects.filter(site=site).count() == 5


@pytest.mark.django_db
def test_boq_import_without_a_percentage_follows_the_contract_percent(
    site, pm
):
    set_contract_percent(site, "10")

    dpr_import.import_items(
        site,
        xlsx_upload(
            [
                ["Item no", "Description", "Qty", "Authority rate"],
                ["1", "Item", 4, 200],
            ]
        ),
        actor=pm,
    )

    item = DprItem.objects.get(site=site)
    assert item.tender_percent is None
    assert item.rate == D("220.00")


@pytest.mark.django_db
def test_boq_import_rejects_a_silly_percentage(site, pm):
    result = dpr_import.import_items(
        site,
        xlsx_upload(
            [
                ["Description", "Qty", "Authority rate", "Tender %"],
                ["Item", 4, 200, 900],
            ]
        ),
        actor=pm,
    )

    assert result["created"] == 0
    assert "percentage" in result["errors"][0]


@pytest.mark.django_db
def test_amount_columns_are_not_mistaken_for_rates(site, pm):
    result = dpr_import.import_items(
        site,
        xlsx_upload(
            [
                [
                    "Item no",
                    "Description",
                    "Unit",
                    "Qty",
                    "Authority amount",
                    "Authority rate",
                    "Amount at quoted rate",
                    "Quoted rate",
                ],
                ["1", "Item", "cum", 4, 99999, 200, 88888, 210],
            ]
        ),
        actor=pm,
    )

    assert result["created"] == 1
    item = DprItem.objects.get(site=site)
    assert item.authority_rate == D("200.00")
    assert item.rate == D("210.00")


@pytest.mark.django_db
def test_dpr_upload_refuses_a_group_row(site, pm):
    make_group(site, "4", "Earthwork")
    header = [
        "Date (YYYY-MM-DD)",
        "Item no",
        "Description",
        "Unit",
        "Qty done",
    ]

    result = dpr_import.import_dpr_entries(
        site,
        xlsx_upload([header, [days_ago(0), "4", "", "cum", 5]]),
        actor=pm,
    )

    assert result["created"] == 0
    assert DprEntry.objects.count() == 0


@pytest.mark.django_db
def test_upload_template_shows_the_boq_columns():
    workbook = openpyxl.load_workbook(
        io.BytesIO(dpr_import.build_item_template())
    )
    headers = [cell.value for cell in workbook.active[1]]

    assert "Authority rate" in headers
    assert any("Tender %" in str(h) for h in headers)


# ---- API --------------------------------------------------------------


@pytest.fixture
def api():
    return APIClient()


def url(name, *args):
    return reverse(f"project-monitor-api:{name}", args=args)


@pytest.mark.django_db
def test_api_creates_a_group_with_sub_items_and_lists_the_tree(
    api, site, assigned_pm
):
    api.force_authenticate(user=assigned_pm)
    set_contract_percent(site, "-5")

    created = api.post(
        url("dpr-item-list"),
        {
            "site": str(site.id),
            "item_no": "4",
            "description": "Earthwork",
            "is_heading": True,
            "children": [
                {
                    "item_no": "4.1",
                    "description": "Embankment",
                    "unit": "cum",
                    "scope_qty": "10",
                    "authority_rate": "1000",
                },
                {
                    "item_no": "4.2",
                    "description": "Blanketing",
                    "unit": "cum",
                    "scope_qty": "5",
                    "authority_rate": "800",
                    "tender_percent": "2",
                },
            ],
        },
        format="json",
    )
    assert created.status_code == status.HTTP_200_OK

    listing = api.get(
        url("dpr-item-list"), {"site": str(site.id)}
    ).data["data"]
    rows = listing["items"]
    assert [r["item_no"] for r in rows] == ["4", "4.1", "4.2"]
    assert rows[1]["parent_id"] == rows[0]["id"]
    assert rows[1]["bid_rate"] == D("950.00")
    assert rows[2]["bid_rate"] == D("816.00")
    assert listing["tender_percent"] == D("-5")
    assert listing["boq_total"] == D("13580.00")
    assert rows[0]["amount"] == D("13580.00")


@pytest.mark.django_db
def test_api_sub_items_need_a_group_and_bad_parents_are_400(
    api, site, other_site, assigned_pm
):
    api.force_authenticate(user=assigned_pm)
    foreign = make_group(other_site, "9", "Elsewhere")

    not_a_group = api.post(
        url("dpr-item-list"),
        {
            "site": str(site.id),
            "description": "Item",
            "children": [{"description": "Child"}],
        },
        format="json",
    )
    foreign_parent = api.post(
        url("dpr-item-list"),
        {
            "site": str(site.id),
            "description": "Item",
            "scope_qty": "1",
            "rate": "1",
            "parent": str(foreign.id),
        },
        format="json",
    )

    assert not_a_group.status_code == status.HTTP_400_BAD_REQUEST
    assert foreign_parent.status_code == status.HTTP_400_BAD_REQUEST
    assert DprItem.objects.filter(site=site).count() == 0


@pytest.mark.django_db
def test_api_can_move_an_item_under_a_group(api, site, assigned_pm):
    api.force_authenticate(user=assigned_pm)
    group = make_group(site, "4", "Earthwork")
    item = make_item(site, item_no="4.1")

    moved = api.patch(
        url("dpr-item-detail", item.id),
        {"parent": str(group.id)},
        format="json",
    )
    assert moved.status_code == status.HTTP_200_OK
    item.refresh_from_db()
    assert item.parent_id == group.id

    back = api.patch(
        url("dpr-item-detail", item.id),
        {"parent": None},
        format="json",
    )
    assert back.status_code == status.HTTP_200_OK
    item.refresh_from_db()
    assert item.parent_id is None


@pytest.mark.django_db
def test_api_grid_rejects_a_group_cell(api, site, assigned_pm):
    api.force_authenticate(user=assigned_pm)
    group = make_group(site, "4", "Earthwork")

    response = api.put(
        url("dpr-grid"),
        {
            "site": str(site.id),
            "edits": [
                {
                    "item": str(group.id),
                    "date": str(days_ago(0)),
                    "qty": "3",
                }
            ],
        },
        format="json",
    )

    assert response.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
def test_api_contract_percent_reprices_and_reports_the_effect(
    api, site, assigned_pm, pm
):
    api.force_authenticate(user=assigned_pm)
    item = make_boq_item(site, 1000)
    enter(site, item, 2, days_ago(0), actor=pm)

    response = api.patch(
        url("dpr-contract") + f"?site={site.id}",
        {"tender_percent": "-4"},
        format="json",
    )

    assert response.status_code == status.HTTP_200_OK
    data = response.data["data"]
    assert data["tender_percent"] == D("-4")
    assert data["recalculated"] == {
        "items_changed": 1,
        "entries_on_old_rate": 1,
    }
    assert data["boq_total"] == D("9600.00")
    item.refresh_from_db()
    assert item.rate == D("960.00")
    assert DprEntry.objects.get(item=item).rate == D("1000.00")

    same = api.patch(
        url("dpr-contract") + f"?site={site.id}",
        {"tender_percent": "-4"},
        format="json",
    )
    assert "recalculated" not in same.data["data"]

    silly = api.patch(
        url("dpr-contract") + f"?site={site.id}",
        {"tender_percent": "900"},
        format="json",
    )
    assert silly.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
def test_api_escalation_endpoints_and_permissions(
    api, site, assigned_pm
):
    body = {
        "site": str(site.id),
        "effective_from": str(days_ago(2)),
        "percent": "8.5",
        "note": "Price variation as per clause 46",
    }

    api.force_authenticate(user=DirectorUserFactory())
    assert (
        api.get(
            url("dpr-escalation-list"), {"site": str(site.id)}
        ).status_code
        == status.HTTP_200_OK
    )
    assert (
        api.post(
            url("dpr-escalation-list"), body, format="json"
        ).status_code
        == status.HTTP_403_FORBIDDEN
    )

    api.force_authenticate(user=assigned_pm)
    created = api.post(
        url("dpr-escalation-list"), body, format="json"
    )
    assert created.status_code == status.HTTP_200_OK
    listing = api.get(
        url("dpr-escalation-list"), {"site": str(site.id)}
    ).data["data"]
    assert [row["percent"] for row in listing] == [D("8.5")]

    duplicate = api.post(
        url("dpr-escalation-list"), body, format="json"
    )
    assert duplicate.status_code == status.HTTP_400_BAD_REQUEST

    api.force_authenticate(user=DirectorUserFactory())
    assert (
        api.delete(
            url("dpr-escalation-detail", created.data["data"]["id"])
        ).status_code
        == status.HTTP_403_FORBIDDEN
    )
    api.force_authenticate(user=AdminUserFactory())
    assert (
        api.delete(
            url("dpr-escalation-detail", created.data["data"]["id"])
        ).status_code
        == status.HTTP_200_OK
    )
    assert not RateEscalation.objects.filter(site=site).exists()


@pytest.mark.django_db
def test_api_escalation_is_refused_for_an_unassigned_manager(
    api, site, pm
):
    api.force_authenticate(user=pm)

    response = api.post(
        url("dpr-escalation-list"),
        {
            "site": str(site.id),
            "effective_from": str(days_ago(1)),
            "percent": "5",
        },
        format="json",
    )

    assert response.status_code == status.HTTP_403_FORBIDDEN
