import pytest
from django.contrib import admin
from django.core.exceptions import ValidationError
from django.db import IntegrityError

from apps.organization.models import (
    Company,
    Department,
    Designation,
)


@pytest.fixture
def department():
    company = Company.objects.create(
        company_code="JNL",
        company_name="Jhajharia Nirman Limited",
    )

    return Department.objects.create(
        company=company,
        department_code="FIN",
        department_name="Finance",
    )


@pytest.mark.django_db
def test_designation_normalizes_code_and_name(department):
    designation = Designation.objects.create(
        department=department,
        designation_code=" senior accountant ",
        designation_name="  Senior   Accountant ",
        level=3,
    )

    assert designation.designation_code == "SENIOR_ACCOUNTANT"
    assert designation.designation_name == "Senior Accountant"
    assert designation.level == 3


@pytest.mark.django_db
def test_designation_code_must_be_unique_per_department(
    department,
):
    Designation.objects.create(
        department=department,
        designation_code="ACC",
        designation_name="Accountant",
    )

    with pytest.raises(ValidationError):
        Designation.objects.create(
            department=department,
            designation_code=" acc ",
            designation_name="Duplicate Accountant",
        )


@pytest.mark.django_db
def test_database_rejects_duplicate_designation_code(
    department,
):
    Designation.objects.create(
        department=department,
        designation_code="ACC",
        designation_name="Accountant",
    )

    with pytest.raises(IntegrityError):
        Designation.objects.bulk_create(
            [
                Designation(
                    department=department,
                    designation_code="ACC",
                    designation_name="Duplicate Accountant",
                )
            ]
        )


@pytest.mark.django_db
def test_same_designation_code_can_exist_in_different_departments(
    department,
):
    other_department = Department.objects.create(
        company=department.company,
        department_code="OPS",
        department_name="Operations",
    )

    Designation.objects.create(
        department=department,
        designation_code="EXEC",
        designation_name="Executive",
    )
    designation = Designation.objects.create(
        department=other_department,
        designation_code="EXEC",
        designation_name="Executive",
    )

    assert designation.designation_code == "EXEC"


@pytest.mark.django_db
def test_designation_can_be_deactivated(department):
    designation = Designation.objects.create(
        department=department,
        designation_code="ACC",
        designation_name="Accountant",
        is_active=False,
    )

    assert designation.is_active is False


@pytest.mark.django_db
def test_designation_orders_by_level_then_name(department):
    Designation.objects.create(
        department=department,
        designation_code="MGR",
        designation_name="Manager",
        level=20,
    )
    executive = Designation.objects.create(
        department=department,
        designation_code="EXEC",
        designation_name="Executive",
        level=10,
    )

    assert Designation.objects.first() == executive


def test_designation_is_registered_in_django_admin():
    assert Designation in admin.site._registry
