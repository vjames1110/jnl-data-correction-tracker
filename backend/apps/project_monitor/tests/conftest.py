"""Fixtures shared by the Project Monitor tests."""

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
from apps.project_monitor.services import project_scope


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


@pytest.fixture(autouse=True)
def _progress_tasks_on_every_site(request, monkeypatch):
    """
    Project Incharge and Project Manager only hold the tasks an Admin
    granted them per site (``services.project_scope``). Most tests
    here are about other features and build their Project Managers
    without any grant, so by default every progress task and Reports
    counts as granted on every site for them. Finance tasks (DPR &
    Bills, HR, Machinery) stay real - the tests grant those on
    purpose. Tests of the access rules themselves are marked
    ``@pytest.mark.real_scope`` and run against the real rules.
    """
    if request.node.get_closest_marker("real_scope"):
        return

    from apps.organization.models import Site

    real = project_scope._grants_by_site
    default_tasks = set(project_scope.PROGRESS_TASKS) | set(
        project_scope.REPORT_TASKS
    )

    def with_progress_everywhere(user):
        grants = {
            site_id: set(tasks)
            for site_id, tasks in real(user).items()
        }
        for site_id in Site.objects.values_list("id", flat=True):
            grants.setdefault(site_id, set()).update(default_tasks)
        return grants

    monkeypatch.setattr(
        project_scope, "_grants_by_site", with_progress_everywhere
    )
