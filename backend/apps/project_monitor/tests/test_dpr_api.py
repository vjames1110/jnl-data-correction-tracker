import io
from datetime import timedelta
from decimal import Decimal

import openpyxl
import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from apps.authentication.tests.factories import (
    AdminUserFactory,
    DirectorUserFactory,
    ProjectManagerUserFactory,
    UserFactory,
)
from apps.project_monitor.models import (
    DprEntry,
    ProjectSiteAccess,
)
from apps.project_monitor.tests.finance_helpers import (
    days_ago,
    make_item,
)


@pytest.fixture
def api():
    return APIClient()


def url(name, *args):
    return reverse(f"project-monitor-api:{name}", args=args)


def get(api, name, site, **params):
    return api.get(url(name), {"site": str(site.id), **params})


# ---- permission matrix ----------------------------------------------


@pytest.mark.django_db
def test_access_flags_per_role(api, site, assigned_pm, pm):
    def flags(user):
        api.force_authenticate(user=user)
        return get(api, "dpr-access", site).data["data"]

    assert flags(assigned_pm) == {
        "can_view": True,
        "can_enter": True,
        "can_unlock": False,
        "edit_window_days": 3,
    }
    assert flags(pm)["can_view"] is False
    assert flags(pm)["can_enter"] is False
    director = flags(DirectorUserFactory())
    assert director["can_view"] is True
    assert director["can_enter"] is False
    admin = flags(AdminUserFactory())
    assert admin["can_enter"] is True
    assert admin["can_unlock"] is True


@pytest.mark.django_db
def test_read_and_write_matrix_on_dpr_items(
    api, site, other_site, assigned_pm, pm
):
    payload = {
        "site": str(site.id),
        "description": "PCC",
        "scope_qty": "10",
        "rate": "100",
    }

    def attempt(user):
        api.force_authenticate(user=user)
        return (
            get(api, "dpr-item-list", site).status_code,
            api.post(
                url("dpr-item-list"), payload, format="json"
            ).status_code,
        )

    ok, forbidden = 200, status.HTTP_403_FORBIDDEN
    assert attempt(assigned_pm) == (ok, ok)
    assert attempt(pm) == (forbidden, forbidden)
    assert attempt(DirectorUserFactory()) == (ok, forbidden)
    assert attempt(AdminUserFactory()) == (ok, ok)
    assert attempt(UserFactory()) == (forbidden, forbidden)

    # An assigned PM has no rights on a *different* site.
    api.force_authenticate(user=assigned_pm)
    assert (
        get(api, "dpr-item-list", other_site).status_code
        == forbidden
    )


@pytest.mark.django_db
def test_bad_or_missing_site_is_a_400_not_a_500(api, assigned_pm):
    api.force_authenticate(user=assigned_pm)

    assert (
        api.get(url("dpr-item-list")).status_code
        == status.HTTP_400_BAD_REQUEST
    )
    assert (
        api.get(
            url("dpr-item-list"), {"site": "not-a-uuid"}
        ).status_code
        == status.HTTP_400_BAD_REQUEST
    )


# ---- items -------------------------------------------------------------


@pytest.mark.django_db
def test_item_lifecycle(api, site, assigned_pm):
    api.force_authenticate(user=assigned_pm)
    created = api.post(
        url("dpr-item-list"),
        {
            "site": str(site.id),
            "item_no": "3.1",
            "description": "Steel",
            "unit": "MT",
            "scope_qty": "5",
            "rate": "60000",
            "concrete_per_unit": "0",
            "tmt_kg_per_unit": "1000",
        },
        format="json",
    )
    assert created.status_code == status.HTTP_200_OK
    item_id = created.data["data"]["id"]

    listing = get(api, "dpr-item-list", site).data["data"]
    assert listing["contract_value"] == Decimal("1000000")
    row = listing["items"][0]
    assert row["amount"] == Decimal("300000")
    assert row["is_major"] is True

    patched = api.patch(
        url("dpr-item-detail", item_id),
        {"rate": "65000", "is_active": False},
        format="json",
    )
    assert patched.status_code == status.HTTP_200_OK

    api.delete(url("dpr-item-detail", item_id))
    assert (
        get(api, "dpr-item-list", site).data["data"]["items"]
        == []
    )


@pytest.mark.django_db
def test_duplicate_item_no_and_undeletable_items_are_400(
    api, site, assigned_pm
):
    make_item(site, item_no="1.1")
    api.force_authenticate(user=assigned_pm)

    duplicate = api.post(
        url("dpr-item-list"),
        {
            "site": str(site.id),
            "item_no": "1.1",
            "description": "Same number again",
        },
        format="json",
    )
    assert duplicate.status_code == status.HTTP_400_BAD_REQUEST

    item = make_item(site, item_no="2.2", description="Used")
    api.put(
        url("dpr-grid"),
        {
            "site": str(site.id),
            "edits": [
                {
                    "item": str(item.id),
                    "date": str(timezone.localdate()),
                    "qty": "5",
                }
            ],
        },
        format="json",
    )
    blocked = api.delete(url("dpr-item-detail", item.id))
    assert blocked.status_code == status.HTTP_400_BAD_REQUEST


# ---- grid, entries, lock, unlock --------------------------------------


@pytest.mark.django_db
def test_grid_get_and_save(api, site, assigned_pm):
    item = make_item(site)
    today = timezone.localdate()
    api.force_authenticate(user=assigned_pm)

    saved = api.put(
        url("dpr-grid"),
        {
            "site": str(site.id),
            "edits": [
                {
                    "item": str(item.id),
                    "date": str(today),
                    "qty": "25",
                },
                {
                    "item": str(item.id),
                    "date": str(days_ago(20)),
                    "qty": "9",
                },
            ],
        },
        format="json",
    )
    assert saved.data["data"]["saved"] == 1
    assert len(saved.data["data"]["skipped_locked"]) == 1

    grid = get(api, "dpr-grid", site).data["data"]
    assert len(grid["dates"]) == 31
    assert grid["dates"][0]["date"] == today
    editable = [d["date"] for d in grid["dates"] if d["editable"]]
    assert editable == [today - timedelta(days=n) for n in range(4)]
    row = grid["items"][0]
    assert row["days"][today.isoformat()] == Decimal("25")
    assert row["executed_qty"] == Decimal("25")
    assert grid["dates"][0]["value"] == Decimal("2500")


@pytest.mark.django_db
def test_director_and_unassigned_pm_cannot_save_the_grid(
    api, site, pm
):
    item = make_item(site)
    body = {
        "site": str(site.id),
        "edits": [
            {
                "item": str(item.id),
                "date": str(timezone.localdate()),
                "qty": "1",
            }
        ],
    }

    for user in (DirectorUserFactory(), pm):
        api.force_authenticate(user=user)
        assert (
            api.put(url("dpr-grid"), body, format="json").status_code
            == status.HTTP_403_FORBIDDEN
        )


@pytest.mark.django_db
def test_grid_rejects_an_item_from_another_site(
    api, site, other_site, assigned_pm
):
    foreign = make_item(other_site)
    api.force_authenticate(user=assigned_pm)

    response = api.put(
        url("dpr-grid"),
        {
            "site": str(site.id),
            "edits": [
                {
                    "item": str(foreign.id),
                    "date": str(timezone.localdate()),
                    "qty": "1",
                }
            ],
        },
        format="json",
    )

    assert response.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
def test_detailed_entry_register_and_delete(api, site, assigned_pm):
    item = make_item(site)
    api.force_authenticate(user=assigned_pm)

    created = api.post(
        url("dpr-entry-list"),
        {
            "site": str(site.id),
            "item": str(item.id),
            "date": str(timezone.localdate()),
            "qty": "12.5",
            "location": "Ch 3.2",
            "agency": "ABC Infra",
        },
        format="json",
    )
    assert created.status_code == status.HTTP_200_OK

    register = get(api, "dpr-entry-list", site).data["data"]
    assert register["total_value"] == Decimal("1250")
    entry = register["entries"][0]
    assert entry["location"] == "Ch 3.2"
    assert entry["entered_by"]

    api.delete(url("dpr-entry-detail", entry["id"]))
    assert DprEntry.objects.count() == 0

    locked = api.post(
        url("dpr-entry-list"),
        {
            "site": str(site.id),
            "item": str(item.id),
            "date": str(days_ago(30)),
            "qty": "1",
        },
        format="json",
    )
    assert locked.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
def test_only_an_admin_can_unlock_and_it_reopens_the_day(
    api, site, assigned_pm
):
    item = make_item(site)
    old_day = days_ago(25)
    body = {
        "site": str(site.id),
        "date": str(old_day),
        "reason": "Late site records",
    }

    for user in (assigned_pm, DirectorUserFactory()):
        api.force_authenticate(user=user)
        assert (
            api.post(
                url("dpr-unlock"), body, format="json"
            ).status_code
            == status.HTTP_403_FORBIDDEN
        )

    api.force_authenticate(user=AdminUserFactory())
    assert (
        api.post(
            url("dpr-unlock"), body, format="json"
        ).status_code
        == status.HTTP_200_OK
    )
    assert (
        api.post(
            url("dpr-unlock"),
            {**body, "reason": ""},
            format="json",
        ).status_code
        == status.HTTP_400_BAD_REQUEST
    )

    api.force_authenticate(user=assigned_pm)
    saved = api.put(
        url("dpr-grid"),
        {
            "site": str(site.id),
            "edits": [
                {
                    "item": str(item.id),
                    "date": str(old_day),
                    "qty": "4",
                }
            ],
        },
        format="json",
    )
    assert saved.data["data"]["saved"] == 1
    listed = get(api, "dpr-unlock", site).data["data"]
    assert listed[0]["reason"] == "Late site records"


# ---- import / template -------------------------------------------------


def _xlsx(rows, name="items.xlsx"):
    workbook = openpyxl.Workbook()
    for row in rows:
        workbook.active.append(row)
    buffer = io.BytesIO()
    workbook.save(buffer)
    return SimpleUploadedFile(name, buffer.getvalue())


@pytest.mark.django_db
def test_item_import_endpoint_and_templates(api, site, assigned_pm):
    api.force_authenticate(user=assigned_pm)

    response = api.post(
        url("dpr-item-import"),
        {
            "site": str(site.id),
            "file": _xlsx(
                [
                    ["Item no", "Description", "Unit", "Qty", "Rate"],
                    ["1", "Earthwork", "cum", 100, 250],
                ]
            ),
        },
        format="multipart",
    )
    assert response.data["data"]["created"] == 1

    missing = api.post(
        url("dpr-item-import"),
        {"site": str(site.id)},
        format="multipart",
    )
    assert missing.status_code == status.HTTP_400_BAD_REQUEST

    template = get(api, "dpr-template", site)
    assert template.status_code == status.HTTP_200_OK
    assert "spreadsheetml" in template["Content-Type"]
    assert "dpr-upload-template.xlsx" in template[
        "Content-Disposition"
    ]
    items_template = get(
        api, "dpr-template", site, kind="items"
    )
    assert "item-list" in items_template["Content-Disposition"]


@pytest.mark.django_db
def test_dpr_upload_endpoint_needs_entry_rights(
    api, site, assigned_pm
):
    make_item(site)
    upload = _xlsx(
        [
            ["Date", "Item no", "Qty done"],
            [str(timezone.localdate()), "1.1", 3],
        ],
        name="dpr.xlsx",
    )
    api.force_authenticate(user=DirectorUserFactory())
    denied = api.post(
        url("dpr-upload"),
        {"site": str(site.id), "file": upload},
        format="multipart",
    )
    assert denied.status_code == status.HTTP_403_FORBIDDEN

    api.force_authenticate(user=assigned_pm)
    ok = api.post(
        url("dpr-upload"),
        {
            "site": str(site.id),
            "file": _xlsx(
                [
                    ["Date", "Item no", "Qty done"],
                    [str(timezone.localdate()), "1.1", 3],
                ],
                name="dpr.xlsx",
            ),
        },
        format="multipart",
    )
    assert ok.data["data"]["created"] == 1


# ---- bills & finance ---------------------------------------------------


@pytest.mark.django_db
def test_bill_lifecycle_through_the_api(api, site, assigned_pm):
    item = make_item(site)
    api.force_authenticate(user=assigned_pm)

    created = api.post(
        url("ra-bill-list"),
        {
            "site": str(site.id),
            "bill_no": "RA-1",
            "bill_date": str(days_ago(3)),
            "lines": [{"item": str(item.id), "qty": "40"}],
        },
        format="json",
    )
    assert created.status_code == status.HTTP_200_OK
    bill_id = created.data["data"]["id"]

    api.patch(
        url("ra-bill-detail", bill_id),
        {
            "received_amount": "1500",
            "received_on": str(days_ago(1)),
        },
        format="json",
    )
    bills = get(api, "ra-bill-list", site).data["data"]
    assert bills["bills"][0]["gross"] == Decimal("4000")
    assert bills["bills"][0]["outstanding"] == Decimal("2500")

    empty = api.post(
        url("ra-bill-list"),
        {
            "site": str(site.id),
            "bill_no": "RA-2",
            "bill_date": str(days_ago(1)),
            "lines": [],
        },
        format="json",
    )
    assert empty.status_code == status.HTTP_400_BAD_REQUEST

    api.delete(url("ra-bill-detail", bill_id))
    assert (
        get(api, "ra-bill-list", site).data["data"]["bills"] == []
    )


@pytest.mark.django_db
def test_director_can_read_but_not_write_bills(
    api, site, assigned_pm
):
    item = make_item(site)
    api.force_authenticate(user=DirectorUserFactory())

    assert (
        get(api, "ra-bill-list", site).status_code
        == status.HTTP_200_OK
    )
    assert (
        api.post(
            url("ra-bill-list"),
            {
                "site": str(site.id),
                "bill_no": "RA-1",
                "bill_date": str(days_ago(1)),
                "lines": [{"item": str(item.id), "qty": "1"}],
            },
            format="json",
        ).status_code
        == status.HTTP_403_FORBIDDEN
    )


@pytest.mark.django_db
def test_contract_details_edit_and_validation(
    api, site, assigned_pm
):
    api.force_authenticate(user=assigned_pm)

    ok = api.patch(
        f"{url('dpr-contract')}?site={site.id}",
        {
            "contract_no": "LOA/2025/17",
            "varied_value": "1200000",
            "opening_billed_value": "250000",
            "opening_bill_no": "RA-4",
            "opening_bill_date": str(days_ago(60)),
        },
        format="json",
    )
    assert ok.status_code == status.HTTP_200_OK
    assert ok.data["data"]["varied_value"] == Decimal("1200000")

    site.refresh_from_db()
    assert site.opening_bill_no == "RA-4"

    missing_date = api.patch(
        f"{url('dpr-contract')}?site={site.id}",
        {"opening_billed_value": "10"},
        format="json",
    )
    assert missing_date.status_code == status.HTTP_400_BAD_REQUEST

    api.force_authenticate(user=DirectorUserFactory())
    assert (
        api.patch(
            f"{url('dpr-contract')}?site={site.id}",
            {"contract_no": "x"},
            format="json",
        ).status_code
        == status.HTTP_403_FORBIDDEN
    )


@pytest.mark.django_db
def test_financial_endpoints_follow_visibility(
    api, site, assigned_pm, pm
):
    item = make_item(site, scope_qty=Decimal("10000"))
    DprEntry.objects.create(
        item=item,
        date=days_ago(1),
        qty=Decimal("10"),
        rate=item.rate,
    )

    for user in (assigned_pm, DirectorUserFactory()):
        api.force_authenticate(user=user)
        summary = get(api, "financial-summary", site)
        assert summary.status_code == status.HTTP_200_OK
        assert summary.data["data"]["executed_yesterday"] == (
            Decimal("1000")
        )
        report = get(
            api,
            "financial-report",
            site,
            as_on=str(timezone.localdate()),
        )
        assert report.data["data"]["rows"][0]["executed_qty"] == (
            Decimal("10")
        )

    api.force_authenticate(user=pm)
    assert (
        get(api, "financial-summary", site).status_code
        == status.HTTP_403_FORBIDDEN
    )
    api.force_authenticate(user=assigned_pm)
    assert (
        get(
            api, "financial-report", site, as_on="20-09-2026"
        ).status_code
        == status.HTTP_400_BAD_REQUEST
    )


# ---- site access admin ------------------------------------------------


@pytest.mark.django_db
def test_admin_assigns_and_removes_site_access(api, site):
    manager = ProjectManagerUserFactory()
    api.force_authenticate(user=AdminUserFactory())

    granted = api.post(
        url("site-access-list"),
        {"site": str(site.id), "user": str(manager.id)},
        format="json",
    )
    assert granted.status_code == status.HTTP_200_OK
    assert granted.data["data"]["role"] == "DPR_BILLS"

    duplicate = api.post(
        url("site-access-list"),
        {"site": str(site.id), "user": str(manager.id)},
        format="json",
    )
    assert duplicate.status_code == status.HTTP_400_BAD_REQUEST

    listing = api.get(
        url("site-access-list"), {"site": str(site.id)}
    )
    assert len(listing.data["data"]) == 1

    api.delete(
        url("site-access-detail", granted.data["data"]["id"])
    )
    assert ProjectSiteAccess.objects.count() == 0


@pytest.mark.django_db
def test_only_project_managers_can_be_assigned_and_only_by_admins(
    api, site, assigned_pm
):
    api.force_authenticate(user=AdminUserFactory())
    not_a_pm = api.post(
        url("site-access-list"),
        {
            "site": str(site.id),
            "user": str(DirectorUserFactory().id),
        },
        format="json",
    )
    assert not_a_pm.status_code == status.HTTP_400_BAD_REQUEST

    for user in (assigned_pm, DirectorUserFactory()):
        api.force_authenticate(user=user)
        assert (
            api.get(url("site-access-list")).status_code
            == status.HTTP_403_FORBIDDEN
        )
        assert (
            api.post(
                url("site-access-list"),
                {"site": str(site.id), "user": str(user.id)},
                format="json",
            ).status_code
            == status.HTTP_403_FORBIDDEN
        )
