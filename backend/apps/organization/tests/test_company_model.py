import pytest
from django.contrib import admin
from django.core.exceptions import ValidationError
from django.db import IntegrityError

from apps.organization.models import Company


@pytest.mark.django_db
def test_company_normalizes_code_and_text_fields():
    company = Company.objects.create(
        company_code=" jnl group ",
        company_name="  Jhajharia   Nirman  Limited ",
        registered_name=" Jhajharia  Nirman Limited ",
        contact_person="  Accounts  Team ",
        contact_phone="  +91  12345 ",
    )

    assert company.company_code == "JNL_GROUP"
    assert (
        company.company_name
        == "Jhajharia Nirman Limited"
    )
    assert (
        company.registered_name
        == "Jhajharia Nirman Limited"
    )
    assert company.contact_person == "Accounts Team"
    assert company.contact_phone == "+91 12345"


@pytest.mark.django_db
def test_company_code_must_be_unique_after_normalization():
    Company.objects.create(
        company_code="JNL",
        company_name="Jhajharia Nirman Limited",
    )

    with pytest.raises(ValidationError):
        Company.objects.create(
            company_code=" jnl ",
            company_name="JNL Duplicate",
        )


@pytest.mark.django_db
def test_database_rejects_duplicate_company_code():
    Company.objects.create(
        company_code="JNL",
        company_name="Jhajharia Nirman Limited",
    )

    with pytest.raises(IntegrityError):
        Company.objects.bulk_create(
            [
                Company(
                    company_code="JNL",
                    company_name="Duplicate JNL",
                )
            ]
        )


@pytest.mark.django_db
def test_company_rejects_invalid_time_zone():
    company = Company(
        company_code="JNL",
        company_name="Jhajharia Nirman Limited",
        time_zone="Not/A_Timezone",
    )

    with pytest.raises(ValidationError) as exc_info:
        company.full_clean()

    assert "time_zone" in exc_info.value.message_dict


@pytest.mark.django_db
def test_company_can_be_deactivated():
    company = Company.objects.create(
        company_code="JNL",
        company_name="Jhajharia Nirman Limited",
        is_active=False,
    )

    assert company.is_active is False


def test_company_is_registered_in_django_admin():
    assert Company in admin.site._registry
