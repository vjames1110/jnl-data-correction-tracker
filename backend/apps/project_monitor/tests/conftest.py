"""Fixtures shared by the finance-tier (DPR/billing) tests."""

from decimal import Decimal

import pytest

from apps.authentication.tests.factories import (
    ProjectManagerUserFactory,
)
from apps.organization.models import Company, Site
from apps.project_monitor.models import (
    ProjectSiteAccess,
    ProjectSiteAccessRole,
)


@pytest.fixture
def company():
    return Company.objects.create(
        company_code="JNL",
        company_name="Jhajharia Nirman Limited",
    )


@pytest.fixture
def site(company):
    return Site.objects.create(
        company=company,
        site_code="CHK",
        site_name="Chunar-Khairahi Doubling Pkg-I",
        project_value=Decimal("1000000"),
    )


@pytest.fixture
def other_site(company):
    return Site.objects.create(
        company=company,
        site_code="OTH",
        site_name="Other Project",
        project_value=Decimal("500000"),
    )


@pytest.fixture
def pm():
    return ProjectManagerUserFactory()


@pytest.fixture
def assigned_pm(site):
    user = ProjectManagerUserFactory()
    ProjectSiteAccess.objects.create(
        site=site,
        user=user,
        role=ProjectSiteAccessRole.DPR_BILLS,
    )
    return user
