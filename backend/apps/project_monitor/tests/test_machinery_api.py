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
    HrDepartmentUserFactory,
    MachineryDepartmentUserFactory,
    ProjectHoUserFactory,
    ProjectManagerUserFactory,
    UserFactory,
)
from apps.project_monitor.models import (
    FuelEntry,
    Machine,
    MachineSource,
    MachineUsage,
    ProjectSiteAccess,
    ProjectSiteAccessRole,
)
from apps.project_monitor.services import machinery

FORBIDDEN = status.HTTP_403_FORBIDDEN
BAD = status.HTTP_400_BAD_REQUEST


@pytest.fixture
def api():
    return APIClient()


@pytest.fixture
def mech_user():
    """The Machinery Department account: company-wide, machinery only."""
    return MachineryDepartmentUserFactory()


@pytest.fixture
def hr_user():
    return HrDepartmentUserFactory()


def url(name, *args):
    return reverse(f"project-monitor-api:{name}", args=args)


def today():
    return timezone.localdate()


def days_ago(count):
    return today() - timedelta(days=count)


def make_machine(site, **overrides):
    values = {
        "name": "JCB 3DX",
        "source": MachineSource.MARKET,
        "rate": Decimal("9000"),
    }
    values.update(overrides)
    return Machine.objects.create(site=site, **values)


def workbook_file(rows):
    workbook = openpyxl.Workbook()
    for row in rows:
        workbook.active.append(row)
    buffer = io.BytesIO()
    workbook.save(buffer)
    return SimpleUploadedFile("m.xlsx", buffer.getvalue())


HEADER = [
    "Project",
    "Date",
    "Machine",
    "Source",
    "Days-hrs",
    "Hire cost",
    "Fuel litres",
    "Fuel cost",
    "Maintenance",
    "Other",
    "Remarks",
]


def upload(api, rows, **extra):
    return api.post(
        url("machinery-upload"),
        {"file": workbook_file(rows), **extra},
        format="multipart",
    )


# ---- permissions ---------------------------------------------------


@pytest.mark.django_db
def test_access_flags_per_role(api, site, mech_user, hr_user, assigned_pm, pm):
    def flags(user):
        api.force_authenticate(user=user)
        return api.get(
            url("machinery-access"), {"site": str(site.id)}
        ).data["data"]

    assert flags(mech_user) == {"can_view": True, "can_enter": True}
    # HR and DPR roles are separate feeds: no machinery rights.
    assert flags(hr_user) == {"can_view": False, "can_enter": False}
    assert flags(ProjectHoUserFactory())["can_view"] is False
    assert flags(assigned_pm)["can_view"] is False
    assert flags(pm)["can_view"] is False
    assert flags(DirectorUserFactory()) == {
        "can_view": True,
        "can_enter": True,
    }
    assert flags(AdminUserFactory()) == {
        "can_view": True,
        "can_enter": True,
    }


@pytest.mark.django_db
def test_read_and_write_matrix(api, site, other_site, mech_user, hr_user, pm):
    payload = {"site": str(site.id), "name": "Roller"}

    def attempt(user):
        api.force_authenticate(user=user)
        name = f"M-{user.id}"
        return (
            api.get(
                url("machinery-machine-list"),
                {"site": str(site.id)},
            ).status_code,
            api.post(
                url("machinery-machine-list"),
                {**payload, "name": name},
                format="json",
            ).status_code,
        )

    assert attempt(mech_user) == (200, 200)
    assert attempt(DirectorUserFactory()) == (200, 200)
    assert attempt(AdminUserFactory()) == (200, 200)
    assert attempt(hr_user) == (FORBIDDEN, FORBIDDEN)
    assert attempt(pm) == (FORBIDDEN, FORBIDDEN)
    assert attempt(UserFactory()) == (FORBIDDEN, FORBIDDEN)

    # The Machinery Department works on every site.
    api.force_authenticate(user=mech_user)
    assert (
        api.get(
            url("machinery-summary"), {"site": str(other_site.id)}
        ).status_code
        == 200
    )


@pytest.mark.django_db
def test_bad_site_is_a_400(api, mech_user):
    api.force_authenticate(user=mech_user)
    assert api.get(url("machinery-summary")).status_code == BAD
    assert (
        api.get(
            url("machinery-summary"), {"site": "nope"}
        ).status_code
        == BAD
    )


# ---- machines ------------------------------------------------------


@pytest.mark.django_db
def test_machine_crud_and_duplicate_guard(api, site, mech_user):
    api.force_authenticate(user=mech_user)
    body = {
        "site": str(site.id),
        "name": "Excavator",
        "reg_no": "UP70 AB 1234",
        "source": "MARKET",
        "agency": "ABC",
        "hire_basis": "MONTH",
        "rate": "90000",
    }
    created = api.post(
        url("machinery-machine-list"), body, format="json"
    )
    assert created.status_code == 200
    machine_id = created.data["data"]["id"]

    duplicate = api.post(
        url("machinery-machine-list"),
        {**body, "name": "excavator"},
        format="json",
    )
    assert duplicate.status_code == BAD

    edited = api.patch(
        url("machinery-machine-detail", machine_id),
        {"rate": "95000"},
        format="json",
    )
    assert edited.status_code == 200
    assert Machine.objects.get().rate == Decimal("95000.00")

    assert (
        api.delete(
            url("machinery-machine-detail", machine_id)
        ).status_code
        == 200
    )
    assert Machine.objects.count() == 0


@pytest.mark.django_db
def test_a_machine_with_history_cannot_be_deleted(api, site, mech_user):
    machine = make_machine(site)
    machinery.save_usage(
        machine=machine, day=days_ago(1), qty=Decimal("1")
    )
    api.force_authenticate(user=mech_user)
    response = api.delete(
        url("machinery-machine-detail", machine.id)
    )
    assert response.status_code == BAD
    assert "inactive" in str(response.data)
    assert Machine.objects.count() == 1

    deactivated = api.patch(
        url("machinery-machine-detail", machine.id),
        {"is_active": False},
        format="json",
    )
    assert deactivated.status_code == 200


@pytest.mark.django_db
def test_setting_the_rate_clears_the_review_flag(api, site, mech_user):
    machine = make_machine(site, rate=Decimal("0"), needs_review=True)
    api.force_authenticate(user=mech_user)
    api.patch(
        url("machinery-machine-detail", machine.id),
        {"name": "Renamed"},
        format="json",
    )
    machine.refresh_from_db()
    assert machine.needs_review is True

    api.patch(
        url("machinery-machine-detail", machine.id),
        {"rate": "8000"},
        format="json",
    )
    machine.refresh_from_db()
    assert machine.needs_review is False


@pytest.mark.django_db
def test_only_the_owner_can_edit_a_machine(api, site, hr_user):
    machine = make_machine(site)
    api.force_authenticate(user=hr_user)
    assert (
        api.patch(
            url("machinery-machine-detail", machine.id),
            {"rate": "1"},
            format="json",
        ).status_code
        == FORBIDDEN
    )


# ---- usage and fuel ---------------------------------------------------


@pytest.mark.django_db
def test_usage_flow_and_summary(api, site, mech_user):
    machine = make_machine(site)
    api.force_authenticate(user=mech_user)
    saved = api.post(
        url("machinery-usage-list"),
        {
            "machine": str(machine.id),
            "date": days_ago(1).isoformat(),
            "qty": "2",
            "maintenance": "500",
        },
        format="json",
    )
    assert saved.status_code == 200
    assert Decimal(str(saved.data["data"]["hire_amount"])) == Decimal(
        "18000.00"
    )

    # Same machine and day again replaces it.
    again = api.post(
        url("machinery-usage-list"),
        {
            "machine": str(machine.id),
            "date": days_ago(1).isoformat(),
            "qty": "1",
        },
        format="json",
    )
    assert again.status_code == 200
    assert MachineUsage.objects.count() == 1

    month = days_ago(1).strftime("%Y-%m")
    listing = api.get(
        url("machinery-usage-list"),
        {"site": str(site.id), "month": month},
    )
    assert len(listing.data["data"]) == 1

    summary = api.get(
        url("machinery-summary"),
        {"site": str(site.id), "month": month},
    ).data["data"]
    assert Decimal(str(summary["totals"]["market_hire"])) == Decimal(
        "9000.00"
    )

    assert (
        api.delete(
            url(
                "machinery-usage-detail", saved.data["data"]["id"]
            )
        ).status_code
        == 200
    )
    assert MachineUsage.objects.count() == 0


@pytest.mark.django_db
def test_usage_follows_the_machines_own_site(
    api, site, other_site, mech_user
):
    foreign = make_machine(other_site)
    payload = {
        "machine": str(foreign.id),
        "date": days_ago(1).isoformat(),
        "qty": "1",
    }

    # The department may enter for a machine on any site...
    api.force_authenticate(user=mech_user)
    assert (
        api.post(
            url("machinery-usage-list"), payload, format="json"
        ).status_code
        == 200
    )
    # ...but nobody without machinery rights may, on any site.
    api.force_authenticate(user=ProjectHoUserFactory())
    assert (
        api.post(
            url("machinery-usage-list"),
            {**payload, "date": days_ago(2).isoformat()},
            format="json",
        ).status_code
        == FORBIDDEN
    )


@pytest.mark.django_db
def test_future_and_empty_usage_are_rejected(api, site, mech_user):
    machine = make_machine(site)
    api.force_authenticate(user=mech_user)
    future = api.post(
        url("machinery-usage-list"),
        {
            "machine": str(machine.id),
            "date": (today() + timedelta(days=1)).isoformat(),
            "qty": "1",
        },
        format="json",
    )
    empty = api.post(
        url("machinery-usage-list"),
        {"machine": str(machine.id), "date": today().isoformat()},
        format="json",
    )
    assert future.status_code == BAD
    assert empty.status_code == BAD


@pytest.mark.django_db
def test_fuel_flow(api, site, mech_user):
    machine = make_machine(site)
    api.force_authenticate(user=mech_user)
    created = api.post(
        url("machinery-fuel-list"),
        {
            "site": str(site.id),
            "machine": str(machine.id),
            "date": days_ago(1).isoformat(),
            "litres": "40",
            "rate": "95",
        },
        format="json",
    )
    assert created.status_code == 200
    assert Decimal(str(created.data["data"]["amount"])) == Decimal(
        "3800.00"
    )

    site_fuel = api.post(
        url("machinery-fuel-list"),
        {
            "site": str(site.id),
            "date": days_ago(1).isoformat(),
            "litres": "10",
            "amount": "1000",
        },
        format="json",
    )
    assert site_fuel.status_code == 200
    assert site_fuel.data["data"]["machine_name"] == ""

    no_price = api.post(
        url("machinery-fuel-list"),
        {
            "site": str(site.id),
            "date": days_ago(1).isoformat(),
            "litres": "10",
        },
        format="json",
    )
    assert no_price.status_code == BAD

    assert (
        api.delete(
            url("machinery-fuel-detail", created.data["data"]["id"])
        ).status_code
        == 200
    )
    assert FuelEntry.objects.count() == 1


# ---- bulk upload ---------------------------------------------------------


@pytest.mark.django_db
def test_upload_creates_usage_fuel_and_flags_new_machines(
    api, site, mech_user
):
    make_machine(site)
    day = days_ago(2)
    api.force_authenticate(user=mech_user)
    result = upload(
        api,
        [
            HEADER,
            [site.site_code, day, "JCB 3DX", "Market", 1, None, 40, 4000, 0, 0, ""],
            [site.site_code, day, "New Crane", "HO", 8, 6000, None, None, 250, 0, "Hours"],
        ],
    ).data["data"]

    assert result["usage_created"] == 2
    assert result["fuel_created"] == 1
    assert result["machines_created"] == 1
    assert result["errors"] == []

    crane = Machine.objects.get(name="New Crane")
    assert crane.needs_review is True
    assert crane.source == MachineSource.HO
    assert MachineUsage.objects.get(machine=crane).hire_amount == Decimal(
        "6000.00"
    )
    # Hire blank -> worked out from the registered machine's rate.
    jcb = Machine.objects.get(name="JCB 3DX")
    assert MachineUsage.objects.get(machine=jcb).hire_amount == Decimal(
        "9000.00"
    )
    assert FuelEntry.objects.get().machine_id == jcb.id


@pytest.mark.django_db
def test_reuploading_the_same_file_changes_nothing(api, site, mech_user):
    make_machine(site)
    day = days_ago(2)
    rows = [
        HEADER,
        [site.site_code, day, "JCB 3DX", "Market", 1, None, 40, 4000, 0, 0, ""],
    ]
    api.force_authenticate(user=mech_user)
    upload(api, rows)
    again = upload(api, rows).data["data"]

    assert again["usage_created"] == 0
    assert again["usage_updated"] == 0
    assert again["usage_unchanged"] == 1
    assert again["fuel_created"] == 0
    assert again["fuel_duplicate"] == 1
    assert again["machines_created"] == 0
    assert MachineUsage.objects.count() == 1
    assert FuelEntry.objects.count() == 1
    assert Machine.objects.count() == 1


@pytest.mark.django_db
def test_a_changed_row_updates_that_day(api, site, mech_user):
    make_machine(site)
    day = days_ago(2)
    api.force_authenticate(user=mech_user)
    upload(
        api,
        [HEADER, [site.site_code, day, "JCB 3DX", "", 1, None, None, None, 0, 0, ""]],
    )
    result = upload(
        api,
        [HEADER, [site.site_code, day, "JCB 3DX", "", 2, None, None, None, 0, 0, ""]],
    ).data["data"]
    assert result["usage_updated"] == 1
    assert MachineUsage.objects.get().qty == Decimal("2.00")


@pytest.mark.django_db
def test_rows_are_routed_by_site_code_to_every_site(
    api, site, other_site, mech_user
):
    day = days_ago(1)
    api.force_authenticate(user=mech_user)
    result = upload(
        api,
        [
            HEADER,
            [site.site_code, day, "Roller", "", 1, 5000, None, None, 0, 0, ""],
            [other_site.site_code, day, "Roller", "", 1, 5000, None, None, 0, 0, ""],
            ["NOPE", day, "Roller", "", 1, 5000, None, None, 0, 0, ""],
        ],
    ).data["data"]
    # The Machinery Department works on every site.
    assert result["usage_created"] == 2
    assert result["not_permitted"] == 0
    assert result["site_not_found"] == 1
    assert set(
        Machine.objects.values_list("site__site_code", flat=True)
    ) == {"CHK", "OTH"}


@pytest.mark.django_db
@pytest.mark.parametrize(
    "uploader_factory",
    [
        ProjectHoUserFactory,
        ProjectManagerUserFactory,
        HrDepartmentUserFactory,
    ],
)
def test_upload_rows_are_refused_for_anyone_who_cannot_enter_machinery(
    api, site, uploader_factory
):
    day = days_ago(1)
    api.force_authenticate(user=uploader_factory())
    response = upload(
        api,
        [
            HEADER,
            [site.site_code, day, "Roller", "", 1, 5000, None, None, 0, 0, ""],
        ],
    )
    if response.status_code == 200:
        assert response.data["data"]["not_permitted"] == 1
    else:
        assert response.status_code == FORBIDDEN
    assert Machine.objects.count() == 0


@pytest.mark.django_db
def test_bad_rows_are_reported_without_stopping(api, site, mech_user):
    make_machine(site, name="Idle", is_active=False)
    day = days_ago(1)
    api.force_authenticate(user=mech_user)
    result = upload(
        api,
        [
            HEADER,
            [site.site_code, today() + timedelta(days=3), "Roller", "", 1, 5000, None, None, 0, 0, ""],
            [site.site_code, day, "", "", 1, 5000, None, None, 0, 0, ""],
            [site.site_code, day, "Roller", "", 0, None, None, None, 0, 0, ""],
            [site.site_code, day, "Roller", "", 1, None, 30, None, 0, 0, ""],
            [site.site_code, day, "Idle", "", 1, 5000, None, None, 0, 0, ""],
            [site.site_code, day, "Roller", "", 1, 5000, None, None, 0, 0, ""],
        ],
    ).data["data"]
    assert result["invalid"] == 5
    assert result["usage_created"] == 1
    fuel_error = [e for e in result["errors"] if "Fuel cost" in e]
    assert len(fuel_error) == 1
    # The row with fuel but no cost recorded nothing at all.
    assert FuelEntry.objects.count() == 0


@pytest.mark.django_db
def test_upload_default_site_and_missing_headers(api, site, mech_user):
    api.force_authenticate(user=mech_user)
    filled = upload(
        api,
        [HEADER, [None, days_ago(1), "Roller", "", 1, 5000, None, None, 0, 0, ""]],
        site=str(site.id),
    ).data["data"]
    assert filled["usage_created"] == 1

    no_site = upload(
        api,
        [HEADER, [None, days_ago(1), "Roller", "", 1, 5000, None, None, 0, 0, ""]],
    ).data["data"]
    assert no_site["invalid"] == 1

    assert upload(api, [["a", "b"], [1, 2]]).status_code == BAD


@pytest.mark.django_db
def test_template_downloads(api, site, mech_user):
    api.force_authenticate(user=mech_user)
    response = api.get(
        url("machinery-template"), {"site": str(site.id)}
    )
    assert response.status_code == 200
    sheet = openpyxl.load_workbook(io.BytesIO(response.content)).active
    assert sheet["A2"].value == site.site_code
    assert sheet["C2"].value == "JCB 3DX"


# ---- assignment ---------------------------------------------------------


@pytest.mark.django_db
def test_machinery_cannot_be_granted_to_a_pm_per_site(api, site, pm):
    api.force_authenticate(user=AdminUserFactory())
    refused = api.post(
        url("site-access-list"),
        {
            "site": str(site.id),
            "user": str(pm.id),
            "role": "MACHINERY",
        },
        format="json",
    )
    assert refused.status_code == status.HTTP_400_BAD_REQUEST
    assert ProjectSiteAccess.objects.count() == 0
