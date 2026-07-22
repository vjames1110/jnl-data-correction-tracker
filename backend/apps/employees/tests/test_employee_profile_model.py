from datetime import date

import pytest
from django.contrib import admin
from django.core.exceptions import ValidationError
from django.db import IntegrityError

from apps.authentication.models import UserRole
from apps.authentication.tests.factories import (
    UserFactory,
)
from apps.employees.models import (
    EmployeeProfile,
    EmploymentStatus,
    Gender,
)
from apps.organization.models import (
    Company,
    Department,
    Designation,
    Site,
)


@pytest.fixture
def organization_context():
    company = Company.objects.create(
        company_code="JNL",
        company_name="Jhajharia Nirman Limited",
    )
    site = Site.objects.create(
        company=company,
        site_code="BKN",
        site_name="Bikaner Site",
    )
    department = Department.objects.create(
        company=company,
        department_code="FIN",
        department_name="Finance",
    )
    designation = Designation.objects.create(
        designation_code="DGM",
        designation_name="Deputy General Manager",
        level=2,
    )

    return {
        "company": company,
        "site": site,
        "department": department,
        "designation": designation,
    }


@pytest.mark.django_db
def test_employee_profile_can_exist_without_user(
    organization_context,
):
    employee = EmployeeProfile.objects.create(
        employee_id=" emp 001 ",
        first_name="  Asha  ",
        last_name="  Sharma ",
        email=" ASHA.SHARMA@JNL.COM ",
        mobile=" 98765  43210 ",
        gender=Gender.FEMALE,
        date_of_joining=date(2026, 7, 21),
        employment_status=EmploymentStatus.CONFIRMED,
        site=organization_context["site"],
        department=organization_context["department"],
        designation=organization_context["designation"],
        role=UserRole.USER,
        erp_user_id=" erp 001 ",
    )

    assert employee.user is None
    assert employee.employee_id == "EMP_001"
    assert employee.first_name == "Asha"
    assert employee.last_name == "Sharma"
    assert employee.email == "asha.sharma@jnl.com"
    assert employee.mobile == "98765 43210"
    assert employee.erp_user_id == "ERP_001"
    assert employee.full_name == "Asha Sharma"


@pytest.mark.django_db
def test_employee_code_is_generated_by_role():
    employee = EmployeeProfile.objects.create(
        first_name="Asha",
        role=UserRole.USER,
    )
    director = EmployeeProfile.objects.create(
        first_name="Director",
        role=UserRole.DIRECTOR,
    )
    next_employee = EmployeeProfile.objects.create(
        first_name="Ravi",
        role=UserRole.USER,
    )

    assert employee.employee_id == "JNLEMP00001"
    assert director.employee_id == "JNLDIR00001"
    assert next_employee.employee_id == "JNLEMP00002"


@pytest.mark.django_db
def test_employee_profile_links_to_matching_user(
    organization_context,
):
    user = UserFactory(
        employee_id="EMP002",
        first_name="Ravi",
        last_name="Verma",
        email="ravi.verma@jnl.com",
        role=UserRole.RESPONSIBLE_PERSON,
    )

    profile = EmployeeProfile.objects.create(
        user=user,
        employee_id="EMP002",
        first_name="Ravi",
        last_name="Verma",
        email="ravi.verma@jnl.com",
        site=organization_context["site"],
        department=organization_context["department"],
        designation=organization_context["designation"],
        role=UserRole.RESPONSIBLE_PERSON,
    )

    assert profile.user == user
    assert user.employee_profile == profile


@pytest.mark.django_db
def test_employee_profile_rejects_user_identity_mismatch(
    organization_context,
):
    user = UserFactory(
        employee_id="EMP003",
        first_name="Neha",
        last_name="Singh",
        role=UserRole.USER,
    )

    with pytest.raises(ValidationError) as exc_info:
        EmployeeProfile.objects.create(
            user=user,
            employee_id="EMP999",
            first_name="Neha",
            last_name="Singh",
            role=UserRole.USER,
            site=organization_context["site"],
            department=organization_context["department"],
        )

    assert "user" in exc_info.value.message_dict


@pytest.mark.django_db
def test_employee_id_must_be_unique():
    EmployeeProfile.objects.create(
        employee_id="EMP004",
        first_name="First",
    )

    with pytest.raises(ValidationError):
        EmployeeProfile.objects.create(
            employee_id=" emp004 ",
            first_name="Duplicate",
        )


@pytest.mark.django_db
def test_employee_email_must_be_unique_when_present():
    EmployeeProfile.objects.create(
        employee_id="EMP_EMAIL_1",
        first_name="First",
        email="employee@jnl.com",
    )

    with pytest.raises(ValidationError):
        EmployeeProfile.objects.create(
            employee_id="EMP_EMAIL_2",
            first_name="Second",
            email=" EMPLOYEE@JNL.COM ",
        )


@pytest.mark.django_db
def test_blank_employee_email_can_repeat():
    EmployeeProfile.objects.create(
        employee_id="EMP_BLANK_EMAIL_1",
        first_name="First",
        email="",
    )
    second = EmployeeProfile.objects.create(
        employee_id="EMP_BLANK_EMAIL_2",
        first_name="Second",
        email="",
    )

    assert second.email == ""


@pytest.mark.django_db
def test_database_rejects_duplicate_employee_id():
    EmployeeProfile.objects.create(
        employee_id="EMP005",
        first_name="First",
    )

    with pytest.raises(IntegrityError):
        EmployeeProfile.objects.bulk_create(
            [
                EmployeeProfile(
                    employee_id="EMP005",
                    first_name="Duplicate",
                )
            ]
        )


@pytest.mark.django_db
def test_site_and_department_must_share_company(
    organization_context,
):
    other_company = Company.objects.create(
        company_code="OTHER",
        company_name="Other Company",
    )
    other_department = Department.objects.create(
        company=other_company,
        department_code="OPS",
        department_name="Operations",
    )

    with pytest.raises(ValidationError) as exc_info:
        EmployeeProfile.objects.create(
            employee_id="EMP006",
            first_name="Company",
            site=organization_context["site"],
            department=other_department,
        )

    assert "department" in exc_info.value.message_dict


@pytest.mark.django_db
def test_employee_cannot_report_to_self():
    employee = EmployeeProfile.objects.create(
        employee_id="EMP007",
        first_name="Self",
    )
    employee.reporting_manager = employee

    with pytest.raises(ValidationError) as exc_info:
        employee.save()

    assert (
        "reporting_manager"
        in exc_info.value.message_dict
    )


@pytest.mark.django_db
def test_last_working_date_cannot_precede_joining():
    employee = EmployeeProfile(
        employee_id="EMP008",
        first_name="Date",
        date_of_joining=date(2026, 7, 21),
        last_working_date=date(2026, 7, 20),
    )

    with pytest.raises(ValidationError) as exc_info:
        employee.full_clean()

    assert (
        "last_working_date"
        in exc_info.value.message_dict
    )


def test_employee_profile_is_registered_in_django_admin():
    assert EmployeeProfile in admin.site._registry
