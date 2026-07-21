import pytest
from django.contrib import admin
from django.core.exceptions import ValidationError
from django.db import IntegrityError

from apps.organization.models import Designation


@pytest.mark.django_db
def test_designation_normalizes_code_and_name():
    designation = Designation.objects.create(
        designation_code=" hod ",
        designation_name="  Head   of  Department ",
        level=3,
    )

    assert designation.designation_code == "HOD"
    assert (
        designation.designation_name
        == "Head of Department"
    )
    assert designation.level == 3


@pytest.mark.django_db
def test_designation_code_must_be_unique_globally():
    Designation.objects.create(
        designation_code="HOD",
        designation_name="Head of Department",
    )

    with pytest.raises(ValidationError):
        Designation.objects.create(
            designation_code=" hod ",
            designation_name="Duplicate HOD",
        )


@pytest.mark.django_db
def test_database_rejects_duplicate_designation_code():
    Designation.objects.create(
        designation_code="DGM",
        designation_name="Deputy General Manager",
    )

    with pytest.raises(IntegrityError):
        Designation.objects.bulk_create(
            [
                Designation(
                    designation_code="DGM",
                    designation_name=(
                        "Duplicate Deputy General Manager"
                    ),
                )
            ]
        )


@pytest.mark.django_db
def test_designation_can_be_deactivated():
    designation = Designation.objects.create(
        designation_code="AGM",
        designation_name=(
            "Assistant General Manager"
        ),
        is_active=False,
    )

    assert designation.is_active is False


@pytest.mark.django_db
def test_designation_orders_by_level_then_name():
    Designation.objects.create(
        designation_code="MGR",
        designation_name="Manager",
        level=20,
    )
    executive = Designation.objects.create(
        designation_code="EXEC",
        designation_name="Executive",
        level=10,
    )

    assert Designation.objects.first() == executive


def test_designation_is_registered_in_django_admin():
    assert Designation in admin.site._registry
