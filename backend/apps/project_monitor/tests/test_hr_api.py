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
    LabourEntry,
    ProjectSiteAccess,
    ProjectSiteAccessRole,
    StaffDayOverride,
    StaffMember,
)

FORBIDDEN = status.HTTP_403_FORBIDDEN


@pytest.fixture
def api():
    return APIClient()


@pytest.fixture
def hr_pm(site):
    user = ProjectManagerUserFactory()
    ProjectSiteAccess.objects.create(
        site=site, user=user, role=ProjectSiteAccessRole.HR
    )
    return user


def url(name, *args):
    return reverse(f"project-monitor-api:{name}", args=args)


def today():
    return timezone.localdate()


def days_ago(count):
    return today() - timedelta(days=count)


def workbook_file(rows, name="hr.xlsx"):
    workbook = openpyxl.Workbook()
    for row in rows:
        workbook.active.append(row)
    buffer = io.BytesIO()
    workbook.save(buffer)
    return SimpleUploadedFile(name, buffer.getvalue())


HEADER = [
    "Project",
    "Date",
    "Type",
    "Category or Staff name",
    "Nos",
    "Rate",
    "Amount",
    "Agency",
    "Note",
]


def make_staff(site, **overrides):
    values = {
        "name": "Ravi Kumar",
        "monthly_salary": Decimal("30000"),
        "from_date": days_ago(60),
    }
    values.update(overrides)
    return StaffMember.objects.create(site=site, **values)


# ---- permissions ---------------------------------------------------


@pytest.mark.django_db
def test_access_flags_per_role(api, site, hr_pm, assigned_pm, pm):
    def flags(user):
        api.force_authenticate(user=user)
        return api.get(
            url("hr-access"), {"site": str(site.id)}
        ).data["data"]

    assert flags(hr_pm) == {"can_view": True, "can_enter": True}
    # Holding the DPR role gives no HR rights (separate feed).
    assert flags(assigned_pm) == {
        "can_view": False,
        "can_enter": False,
    }
    assert flags(pm)["can_view"] is False
    assert flags(DirectorUserFactory()) == {
        "can_view": True,
        "can_enter": False,
    }
    assert flags(AdminUserFactory()) == {
        "can_view": True,
        "can_enter": True,
    }


@pytest.mark.django_db
def test_read_and_write_matrix(api, site, other_site, hr_pm, assigned_pm, pm):
    payload = {
        "site": str(site.id),
        "date": days_ago(1).isoformat(),
        "category": "Mason",
        "nos": "5",
        "rate": "800",
    }

    def attempt(user):
        api.force_authenticate(user=user)
        return (
            api.get(
                url("hr-labour-list"), {"site": str(site.id)}
            ).status_code,
            api.post(
                url("hr-labour-list"), payload, format="json"
            ).status_code,
        )

    assert attempt(hr_pm) == (200, 200)
    assert attempt(DirectorUserFactory()) == (200, FORBIDDEN)
    assert attempt(AdminUserFactory()) == (200, 200)
    assert attempt(assigned_pm) == (FORBIDDEN, FORBIDDEN)
    assert attempt(pm) == (FORBIDDEN, FORBIDDEN)
    assert attempt(UserFactory()) == (FORBIDDEN, FORBIDDEN)

    # HR on one site gives nothing on another.
    api.force_authenticate(user=hr_pm)
    assert (
        api.get(
            url("hr-summary"), {"site": str(other_site.id)}
        ).status_code
        == FORBIDDEN
    )


@pytest.mark.django_db
def test_salaries_are_never_shown_to_an_unassigned_pm(
    api, site, pm
):
    make_staff(site)
    api.force_authenticate(user=pm)
    response = api.get(
        url("hr-staff-list"), {"site": str(site.id)}
    )
    assert response.status_code == FORBIDDEN
    assert "30000" not in response.content.decode()


@pytest.mark.django_db
def test_bad_site_is_a_400(api, hr_pm):
    api.force_authenticate(user=hr_pm)
    assert (
        api.get(url("hr-summary")).status_code
        == status.HTTP_400_BAD_REQUEST
    )
    assert (
        api.get(
            url("hr-summary"), {"site": "nope"}
        ).status_code
        == status.HTTP_400_BAD_REQUEST
    )


# ---- labour --------------------------------------------------------


@pytest.mark.django_db
def test_add_list_and_delete_labour(api, site, hr_pm):
    api.force_authenticate(user=hr_pm)
    created = api.post(
        url("hr-labour-list"),
        {
            "site": str(site.id),
            "date": days_ago(1).isoformat(),
            "category": "Mason",
            "nos": "10",
            "rate": "900",
            "agency": "ABC",
        },
        format="json",
    )
    assert created.status_code == 200
    row = created.data["data"]
    assert Decimal(str(row["amount"])) == Decimal("9000.00")

    listing = api.get(
        url("hr-labour-list"),
        {"site": str(site.id), "month": days_ago(1).strftime("%Y-%m")},
    )
    assert [r["category"] for r in listing.data["data"]] == ["Mason"]

    assert (
        api.delete(url("hr-labour-detail", row["id"])).status_code
        == 200
    )
    assert LabourEntry.objects.count() == 0


@pytest.mark.django_db
def test_future_and_invalid_labour_are_rejected(api, site, hr_pm):
    api.force_authenticate(user=hr_pm)
    base = {
        "site": str(site.id),
        "category": "Mason",
        "nos": "3",
        "rate": "500",
    }
    future = api.post(
        url("hr-labour-list"),
        {**base, "date": (today() + timedelta(days=1)).isoformat()},
        format="json",
    )
    assert future.status_code == status.HTTP_400_BAD_REQUEST
    zero = api.post(
        url("hr-labour-list"),
        {**base, "nos": "0", "date": today().isoformat()},
        format="json",
    )
    assert zero.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
def test_only_the_owner_can_delete_labour(api, site, hr_pm, assigned_pm):
    entry = LabourEntry.objects.create(
        site=site,
        date=days_ago(1),
        category="Mason",
        nos=1,
        rate=1,
        amount=1,
    )
    api.force_authenticate(user=assigned_pm)
    assert (
        api.delete(url("hr-labour-detail", entry.id)).status_code
        == FORBIDDEN
    )
    assert LabourEntry.objects.count() == 1


# ---- staff and overrides ---------------------------------------------


@pytest.mark.django_db
def test_staff_crud_and_validation(api, site, hr_pm):
    api.force_authenticate(user=hr_pm)
    created = api.post(
        url("hr-staff-list"),
        {
            "site": str(site.id),
            "name": "Anita Rao",
            "designation": "Accountant",
            "monthly_salary": "24000",
            "from_date": days_ago(30).isoformat(),
        },
        format="json",
    )
    assert created.status_code == 200
    staff_id = created.data["data"]["id"]
    assert created.data["data"]["on_payroll_today"] is True

    backwards = api.patch(
        url("hr-staff-detail", staff_id),
        {"to_date": days_ago(31).isoformat()},
        format="json",
    )
    assert backwards.status_code == status.HTTP_400_BAD_REQUEST

    ended = api.patch(
        url("hr-staff-detail", staff_id),
        {"to_date": days_ago(5).isoformat()},
        format="json",
    )
    assert ended.status_code == 200
    assert ended.data["data"]["on_payroll_today"] is False

    assert (
        api.delete(url("hr-staff-detail", staff_id)).status_code
        == 200
    )
    assert StaffMember.objects.count() == 0


@pytest.mark.django_db
def test_override_flow_and_summary(api, site, hr_pm):
    member = make_staff(site, from_date=days_ago(3))
    api.force_authenticate(user=hr_pm)
    saved = api.post(
        url("hr-override-list"),
        {
            "staff": str(member.id),
            "date": days_ago(1).isoformat(),
            "amount": "0",
            "note": "Absent",
        },
        format="json",
    )
    assert saved.status_code == 200

    month = days_ago(1).strftime("%Y-%m")
    summary = api.get(
        url("hr-summary"),
        {"site": str(site.id), "month": month},
    ).data["data"]
    by_date = {str(row["date"]): row for row in summary["days"]}
    assert Decimal(str(by_date[days_ago(1).isoformat()]["staff_cost"])) == 0
    assert Decimal(str(by_date[days_ago(2).isoformat()]["staff_cost"])) > 0

    listed = api.get(
        url("hr-override-list"),
        {"site": str(site.id), "month": month},
    )
    assert listed.data["data"][0]["staff_name"] == "Ravi Kumar"

    override_id = saved.data["data"]["id"]
    assert (
        api.delete(
            url("hr-override-detail", override_id)
        ).status_code
        == 200
    )
    assert StaffDayOverride.objects.count() == 0


@pytest.mark.django_db
def test_override_outside_the_window_is_a_400(api, site, hr_pm):
    member = make_staff(site, from_date=days_ago(3))
    api.force_authenticate(user=hr_pm)
    response = api.post(
        url("hr-override-list"),
        {
            "staff": str(member.id),
            "date": days_ago(10).isoformat(),
            "amount": "0",
        },
        format="json",
    )
    assert response.status_code == status.HTTP_400_BAD_REQUEST


# ---- bulk upload --------------------------------------------------------


def upload(api, rows, **extra):
    return api.post(
        url("hr-upload"),
        {"file": workbook_file(rows), **extra},
        format="multipart",
    )


@pytest.mark.django_db
def test_upload_adds_labour_and_staff_overrides(api, site, hr_pm):
    make_staff(site, from_date=days_ago(20))
    day = days_ago(2)
    api.force_authenticate(user=hr_pm)

    response = upload(
        api,
        [
            HEADER,
            [site.site_code, day, "Labour", "Mason", 10, 900, None, "ABC", ""],
            [site.site_code, day, "Labour", "Helper", 4, None, 2500, "", ""],
            [site.site_code, day, "Staff", "ravi kumar", None, None, 0, "", "Absent"],
        ],
    )
    result = response.data["data"]
    assert response.status_code == 200, response.data
    assert result["labour_created"] == 2
    assert result["overrides_saved"] == 1
    assert result["errors"] == []

    amounts = {
        e.category: e.amount for e in LabourEntry.objects.all()
    }
    assert amounts == {
        "Mason": Decimal("9000.00"),
        "Helper": Decimal("2500.00"),
    }
    assert StaffDayOverride.objects.get().amount == 0


@pytest.mark.django_db
def test_reuploading_the_same_file_changes_nothing(api, site, hr_pm):
    make_staff(site, from_date=days_ago(20))
    day = days_ago(2)
    rows = [
        HEADER,
        [site.site_code, day, "Labour", "Mason", 10, 900, None, "ABC", ""],
        [site.site_code, day, "Staff", "Ravi Kumar", None, None, 0, "", ""],
    ]
    api.force_authenticate(user=hr_pm)
    upload(api, rows)
    again = upload(api, rows).data["data"]

    assert again["labour_created"] == 0
    assert again["labour_duplicate"] == 1
    assert again["overrides_saved"] == 0
    assert again["overrides_unchanged"] == 1
    assert LabourEntry.objects.count() == 1
    assert StaffDayOverride.objects.count() == 1


@pytest.mark.django_db
def test_rows_are_routed_by_site_code_and_checked_per_site(
    api, site, other_site, hr_pm
):
    day = days_ago(1)
    api.force_authenticate(user=hr_pm)
    result = upload(
        api,
        [
            HEADER,
            [site.site_code, day, "Labour", "Mason", 2, 100, None, "", ""],
            [other_site.site_code, day, "Labour", "Mason", 2, 100, None, "", ""],
            ["NOPE", day, "Labour", "Mason", 2, 100, None, "", ""],
        ],
    ).data["data"]

    assert result["labour_created"] == 1
    assert result["not_permitted"] == 1
    assert result["site_not_found"] == 1
    assert LabourEntry.objects.get().site_id == site.id


@pytest.mark.django_db
def test_admin_upload_can_cover_several_sites(
    api, site, other_site
):
    day = days_ago(1)
    api.force_authenticate(user=AdminUserFactory())
    result = upload(
        api,
        [
            HEADER,
            [site.site_code, day, "Labour", "Mason", 2, 100, None, "", ""],
            [other_site.site_code, day, "Labour", "Mason", 3, 100, None, "", ""],
        ],
    ).data["data"]
    assert result["labour_created"] == 2
    assert set(
        LabourEntry.objects.values_list("site__site_code", flat=True)
    ) == {"CHK", "OTH"}


@pytest.mark.django_db
def test_upload_reports_bad_rows_without_stopping(api, site, hr_pm):
    make_staff(site, from_date=days_ago(20))
    day = days_ago(1)
    future = today() + timedelta(days=2)
    api.force_authenticate(user=hr_pm)
    result = upload(
        api,
        [
            HEADER,
            [site.site_code, future, "Labour", "Mason", 2, 100, None, "", ""],
            [site.site_code, day, "Labour", "Mason", 0, 100, None, "", ""],
            [site.site_code, day, "Contractor", "Mason", 2, 100, None, "", ""],
            [site.site_code, day, "Staff", "Ghost", None, None, 0, "", ""],
            [site.site_code, day, "Staff", "Ravi Kumar", None, None, None, "", ""],
            [site.site_code, day, "Labour", "Mason", 2, 100, None, "", ""],
        ],
    ).data["data"]
    assert result["invalid"] == 4
    assert result["staff_not_found"] == 1
    assert result["labour_created"] == 1
    assert len(result["errors"]) == 5


@pytest.mark.django_db
def test_upload_default_site_fills_blank_project(api, site, hr_pm):
    api.force_authenticate(user=hr_pm)
    result = upload(
        api,
        [
            HEADER,
            [None, days_ago(1), "Labour", "Mason", 2, 100, None, "", ""],
        ],
        site=str(site.id),
    ).data["data"]
    assert result["labour_created"] == 1


@pytest.mark.django_db
def test_upload_without_a_site_or_project_is_rejected(api, hr_pm):
    api.force_authenticate(user=hr_pm)
    response = upload(
        api,
        [
            HEADER,
            [None, days_ago(1), "Labour", "Mason", 2, 100, None, "", ""],
        ],
    )
    assert response.data["data"]["invalid"] == 1


@pytest.mark.django_db
def test_upload_rejects_a_file_without_headers(api, hr_pm):
    api.force_authenticate(user=hr_pm)
    response = upload(api, [["a", "b"], [1, 2]])
    assert response.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
def test_template_downloads(api, site, hr_pm):
    api.force_authenticate(user=hr_pm)
    response = api.get(url("hr-template"), {"site": str(site.id)})
    assert response.status_code == 200
    sheet = openpyxl.load_workbook(
        io.BytesIO(response.content)
    ).active
    assert sheet["A2"].value == site.site_code
    assert sheet["C2"].value == "Labour"


# ---- assignment ---------------------------------------------------------


@pytest.mark.django_db
def test_admin_can_grant_the_hr_role_to_a_pm(api, site, pm):
    api.force_authenticate(user=AdminUserFactory())
    response = api.post(
        url("site-access-list"),
        {"site": str(site.id), "user": str(pm.id), "role": "HR"},
        format="json",
    )
    assert response.status_code == 200
    assert ProjectSiteAccess.objects.get(user=pm).role == "HR"

    # The same PM can also hold the DPR role - it is a separate row.
    both = api.post(
        url("site-access-list"),
        {
            "site": str(site.id),
            "user": str(pm.id),
            "role": "DPR_BILLS",
        },
        format="json",
    )
    assert both.status_code == 200
    duplicate = api.post(
        url("site-access-list"),
        {"site": str(site.id), "user": str(pm.id), "role": "HR"},
        format="json",
    )
    assert duplicate.status_code == status.HTTP_400_BAD_REQUEST
