from datetime import date

import pytest
from django.contrib import admin
from django.core.exceptions import ValidationError
from django.db import IntegrityError

from apps.authentication.tests.factories import (
    DirectorUserFactory,
)
from apps.employees.models import EmployeeProfile
from apps.organization.models import (
    Company,
    Site,
)


@pytest.fixture
def company():
    return Company.objects.create(
        company_code="JNL",
        company_name="Jhajharia Nirman Limited",
    )


@pytest.mark.django_db
def test_site_normalizes_code_and_text_fields(company):
    site = Site.objects.create(
        company=company,
        site_code=" jnl site 01 ",
        site_name="  Bikaner   Solar  Site ",
        project_name=" Solar   Park ",
        state=" Rajasthan ",
        district="  Bikaner ",
        cost_centre=" cc 100 ",
        erp_site_code=" erp site 1 ",
    )

    assert site.site_code == "JNL_SITE_01"
    assert site.site_name == "Bikaner Solar Site"
    assert site.project_name == "Solar Park"
    assert site.state == "Rajasthan"
    assert site.district == "Bikaner"
    assert site.cost_centre == "CC_100"
    assert site.erp_site_code == "ERP_SITE_1"


@pytest.mark.django_db
def test_site_code_must_be_unique_per_company(company):
    Site.objects.create(
        company=company,
        site_code="BKN",
        site_name="Bikaner Site",
    )

    with pytest.raises(ValidationError):
        Site.objects.create(
            company=company,
            site_code=" bkn ",
            site_name="Duplicate Bikaner Site",
        )


@pytest.mark.django_db
def test_database_rejects_duplicate_site_code_per_company(company):
    Site.objects.create(
        company=company,
        site_code="BKN",
        site_name="Bikaner Site",
    )

    with pytest.raises(IntegrityError):
        Site.objects.bulk_create(
            [
                Site(
                    company=company,
                    site_code="BKN",
                    site_name="Duplicate Bikaner Site",
                )
            ]
        )


@pytest.mark.django_db
def test_same_site_code_can_exist_for_different_companies(company):
    other_company = Company.objects.create(
        company_code="JNL_INFRA",
        company_name="JNL Infra",
    )

    Site.objects.create(
        company=company,
        site_code="BKN",
        site_name="Bikaner Site",
    )
    site = Site.objects.create(
        company=other_company,
        site_code="BKN",
        site_name="Bikaner Infra Site",
    )

    assert site.site_code == "BKN"


@pytest.mark.django_db
def test_site_end_date_cannot_be_before_start_date(company):
    site = Site(
        company=company,
        site_code="BKN",
        site_name="Bikaner Site",
        start_date=date(2026, 7, 18),
        end_date=date(2026, 7, 17),
    )

    with pytest.raises(ValidationError) as exc_info:
        site.full_clean()

    assert "end_date" in exc_info.value.message_dict


@pytest.mark.django_db
def test_site_keeps_director_and_hod_references(company):
    director = DirectorUserFactory(
        employee_id="DIR001",
        first_name="Site",
        last_name="Director",
    )
    # Site PM (site_hod) is an EmployeeProfile, not a User — a Site
    # PM does not need a login account.
    hod = EmployeeProfile.objects.create(
        employee_id="HOD001",
        first_name="Site",
        last_name="HOD",
    )

    site = Site.objects.create(
        company=company,
        site_code="BKN",
        site_name="Bikaner Site",
        site_director=director,
        site_hod=hod,
    )

    assert site.site_director == director
    assert site.site_hod == hod
    assert site.site_hod.user_id is None


@pytest.mark.django_db
def test_site_can_be_deactivated(company):
    site = Site.objects.create(
        company=company,
        site_code="BKN",
        site_name="Bikaner Site",
        is_active=False,
    )

    assert site.is_active is False


def test_site_is_registered_in_django_admin():
    assert Site in admin.site._registry
