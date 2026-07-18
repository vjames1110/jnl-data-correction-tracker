from datetime import date

import pytest
from django.contrib import admin
from django.core.exceptions import ValidationError
from django.db import IntegrityError

from apps.authentication.tests.factories import (
    DirectorUserFactory,
    UserFactory,
)
from apps.organization.models import (
    ApprovalAuthorityType,
    Company,
    Department,
    DirectorMapping,
    ReportingManagerMapping,
    Site,
    SiteDepartmentMapping,
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

    return {
        "company": company,
        "site": site,
        "department": department,
    }


@pytest.mark.django_db
def test_site_department_mapping_keeps_hod_context(
    organization_context,
):
    site_hod = UserFactory(
        employee_id="SITEHOD01",
    )
    department_hod = UserFactory(
        employee_id="DEPTHOD01",
    )

    mapping = SiteDepartmentMapping.objects.create(
        site=organization_context["site"],
        department=organization_context["department"],
        site_hod=site_hod,
        department_hod=department_hod,
        effective_date=date(2026, 7, 18),
    )

    assert mapping.site_hod == site_hod
    assert mapping.department_hod == department_hod
    assert mapping.is_active is True


@pytest.mark.django_db
def test_site_department_mapping_rejects_company_mismatch(
    organization_context,
):
    other_company = Company.objects.create(
        company_code="OTHER",
        company_name="Other Company",
    )
    other_department = Department.objects.create(
        company=other_company,
        department_code="FIN",
        department_name="Finance",
    )

    mapping = SiteDepartmentMapping(
        site=organization_context["site"],
        department=other_department,
        effective_date=date(2026, 7, 18),
    )

    with pytest.raises(ValidationError) as exc_info:
        mapping.full_clean()

    assert "department" in exc_info.value.message_dict


@pytest.mark.django_db
def test_site_department_mapping_rejects_duplicate_active_mapping(
    organization_context,
):
    SiteDepartmentMapping.objects.create(
        site=organization_context["site"],
        department=organization_context["department"],
        effective_date=date(2026, 7, 18),
    )

    with pytest.raises(ValidationError):
        SiteDepartmentMapping.objects.create(
            site=organization_context["site"],
            department=organization_context["department"],
            effective_date=date(2026, 7, 19),
        )


@pytest.mark.django_db
def test_database_rejects_duplicate_site_department_effective_date(
    organization_context,
):
    SiteDepartmentMapping.objects.create(
        site=organization_context["site"],
        department=organization_context["department"],
        effective_date=date(2026, 7, 18),
    )

    with pytest.raises(IntegrityError):
        SiteDepartmentMapping.objects.bulk_create(
            [
                SiteDepartmentMapping(
                    site=organization_context["site"],
                    department=organization_context[
                        "department"
                    ],
                    effective_date=date(2026, 7, 18),
                    is_active=False,
                )
            ]
        )


@pytest.mark.django_db
def test_director_mapping_requires_site_or_department():
    director = DirectorUserFactory(
        employee_id="DIRMAP01",
    )

    mapping = DirectorMapping(
        director=director,
        effective_from=date(2026, 7, 18),
    )

    with pytest.raises(ValidationError) as exc_info:
        mapping.full_clean()

    assert "site" in exc_info.value.message_dict


@pytest.mark.django_db
def test_director_mapping_validates_dates_and_context(
    organization_context,
):
    director = DirectorUserFactory(
        employee_id="DIRMAP02",
    )

    mapping = DirectorMapping(
        director=director,
        site=organization_context["site"],
        department=organization_context["department"],
        authority_type=ApprovalAuthorityType.BACKUP,
        effective_from=date(2026, 7, 18),
        effective_to=date(2026, 7, 17),
    )

    with pytest.raises(ValidationError) as exc_info:
        mapping.full_clean()

    assert "effective_to" in exc_info.value.message_dict


@pytest.mark.django_db
def test_reporting_manager_mapping_rejects_self_manager(
    organization_context,
):
    employee = UserFactory(
        employee_id="EMP001",
    )

    mapping = ReportingManagerMapping(
        employee=employee,
        reporting_manager=employee,
        site=organization_context["site"],
        department=organization_context["department"],
        effective_from=date(2026, 7, 18),
    )

    with pytest.raises(ValidationError) as exc_info:
        mapping.full_clean()

    assert (
        "reporting_manager"
        in exc_info.value.message_dict
    )


@pytest.mark.django_db
def test_reporting_manager_mapping_keeps_history(
    organization_context,
):
    employee = UserFactory(
        employee_id="EMP002",
    )
    old_manager = UserFactory(
        employee_id="MGR001",
    )
    new_manager = UserFactory(
        employee_id="MGR002",
    )

    ReportingManagerMapping.objects.create(
        employee=employee,
        reporting_manager=old_manager,
        site=organization_context["site"],
        department=organization_context["department"],
        effective_from=date(2026, 1, 1),
        effective_to=date(2026, 7, 17),
        is_active=False,
    )
    active_mapping = ReportingManagerMapping.objects.create(
        employee=employee,
        reporting_manager=new_manager,
        site=organization_context["site"],
        department=organization_context["department"],
        effective_from=date(2026, 7, 18),
    )

    assert active_mapping.is_active is True
    assert (
        ReportingManagerMapping.objects.filter(
            employee=employee
        ).count()
        == 2
    )


def test_mapping_models_are_registered_in_django_admin():
    assert SiteDepartmentMapping in admin.site._registry
    assert DirectorMapping in admin.site._registry
    assert ReportingManagerMapping in admin.site._registry
