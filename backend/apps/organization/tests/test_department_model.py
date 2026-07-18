import pytest
from django.contrib import admin
from django.core.exceptions import ValidationError
from django.db import IntegrityError

from apps.authentication.tests.factories import UserFactory
from apps.organization.models import (
    Company,
    Department,
)


@pytest.fixture
def company():
    return Company.objects.create(
        company_code="JNL",
        company_name="Jhajharia Nirman Limited",
    )


@pytest.mark.django_db
def test_department_normalizes_code_name_and_description(company):
    department = Department.objects.create(
        company=company,
        department_code=" accounts payable ",
        department_name="  Accounts   Payable ",
        description=" Handles   vendor   invoices ",
    )

    assert department.department_code == "ACCOUNTS_PAYABLE"
    assert department.department_name == "Accounts Payable"
    assert department.description == "Handles vendor invoices"


@pytest.mark.django_db
def test_department_code_must_be_unique_per_company(company):
    Department.objects.create(
        company=company,
        department_code="FIN",
        department_name="Finance",
    )

    with pytest.raises(ValidationError):
        Department.objects.create(
            company=company,
            department_code=" fin ",
            department_name="Duplicate Finance",
        )


@pytest.mark.django_db
def test_database_rejects_duplicate_department_code(company):
    Department.objects.create(
        company=company,
        department_code="FIN",
        department_name="Finance",
    )

    with pytest.raises(IntegrityError):
        Department.objects.bulk_create(
            [
                Department(
                    company=company,
                    department_code="FIN",
                    department_name="Duplicate Finance",
                )
            ]
        )


@pytest.mark.django_db
def test_same_department_code_can_exist_for_different_companies(company):
    other_company = Company.objects.create(
        company_code="JNL_INFRA",
        company_name="JNL Infra",
    )

    Department.objects.create(
        company=company,
        department_code="FIN",
        department_name="Finance",
    )
    department = Department.objects.create(
        company=other_company,
        department_code="FIN",
        department_name="Finance",
    )

    assert department.department_code == "FIN"


@pytest.mark.django_db
def test_department_keeps_hod_reference(company):
    hod = UserFactory(
        employee_id="HODFIN001",
        first_name="Finance",
        last_name="HOD",
    )

    department = Department.objects.create(
        company=company,
        department_code="FIN",
        department_name="Finance",
        department_hod=hod,
    )

    assert department.department_hod == hod


@pytest.mark.django_db
def test_department_can_be_deactivated(company):
    department = Department.objects.create(
        company=company,
        department_code="FIN",
        department_name="Finance",
        is_active=False,
    )

    assert department.is_active is False


@pytest.mark.django_db
def test_department_orders_by_display_order_then_name(company):
    Department.objects.create(
        company=company,
        department_code="OPS",
        department_name="Operations",
        display_order=20,
    )
    finance = Department.objects.create(
        company=company,
        department_code="FIN",
        department_name="Finance",
        display_order=10,
    )

    assert Department.objects.first() == finance


def test_department_is_registered_in_django_admin():
    assert Department in admin.site._registry
