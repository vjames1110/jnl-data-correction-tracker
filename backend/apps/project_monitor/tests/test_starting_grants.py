"""
Assigning someone through User Management (employee site) or
Organization Setup (a site's Project Manager) gives them a starting set
of tasks, so they are not left with no access at all.
"""

import importlib

import pytest
from django.apps import apps as django_apps

from apps.authentication.models import UserRole
from apps.authentication.tests.factories import (
    ProjectInchargeUserFactory,
    ProjectManagerUserFactory,
    UserFactory,
)
from apps.employees.models import EmployeeProfile
from apps.employees.services.accounts import create_account_for_employee
from apps.project_monitor.models import ProjectSiteAccess
from apps.project_monitor.services import grants, project_scope

pytestmark = [pytest.mark.real_scope, pytest.mark.django_db]

ALL = set(project_scope.GRANTABLE_TASKS)
PM_DEFAULT = set(project_scope.PROGRESS_TASKS) | set(project_scope.REPORT_TASKS)


def profile_for(user, **extra):
    return EmployeeProfile.objects.create(
        user=user,
        employee_id=user.employee_id,
        first_name=user.first_name,
        last_name=user.last_name,
        role=user.role,
        **extra,
    )


def tasks(user, site):
    return project_scope.granted_tasks(user, site)


# ---- what each assignment gives -----------------------------------------


def test_an_incharge_given_a_site_in_user_management_gets_every_task(site):
    incharge = ProjectInchargeUserFactory()
    profile_for(incharge, site=site)

    assert tasks(incharge, site) == ALL


def test_a_project_manager_given_a_site_gets_progress_tasks_and_reports(site):
    pm = ProjectManagerUserFactory()
    profile_for(pm, site=site)

    assert tasks(pm, site) == PM_DEFAULT
    # Finance stays something an Admin grants on purpose.
    assert not tasks(pm, site) & set(project_scope.FINANCE_TASKS)


def test_the_sites_project_manager_from_organization_setup_gets_access(site):
    pm = ProjectManagerUserFactory()
    profile = profile_for(pm)  # no site of their own
    assert tasks(pm, site) == set()

    site.site_hod = profile
    site.save()

    assert tasks(pm, site) == PM_DEFAULT


def test_creating_an_incharge_account_for_an_employee_with_a_site(site):
    profile = EmployeeProfile.objects.create(
        employee_id="EMP900",
        first_name="Kiran",
        last_name="Das",
        role=UserRole.EMPLOYEE,
        site=site,
    )
    result = create_account_for_employee(
        profile=profile, role=UserRole.PROJECT_INCHARGE
    )

    assert tasks(result["user"], site) == ALL


def test_giving_an_existing_employee_a_site_grants_it(site, other_site):
    incharge = ProjectInchargeUserFactory()
    profile = profile_for(incharge, site=site)
    assert tasks(incharge, other_site) == set()

    profile.site = other_site
    profile.save()

    assert tasks(incharge, other_site) == ALL
    # Their first site is left as it was.
    assert tasks(incharge, site) == ALL


def test_changing_a_sites_project_manager_grants_the_new_person(site):
    first = ProjectManagerUserFactory()
    second = ProjectManagerUserFactory()
    site.site_hod = profile_for(first)
    site.save()
    site.site_hod = profile_for(second)
    site.save()

    assert tasks(second, site) == PM_DEFAULT
    # Access is never taken away by this - the Admin does that in Site Access.
    assert tasks(first, site) == PM_DEFAULT


# ---- who does not get anything ------------------------------------------------


def test_people_who_cannot_be_granted_get_nothing(site):
    plain = UserFactory()
    profile_for(plain, site=site)
    account_less = EmployeeProfile.objects.create(
        employee_id="EMP901",
        first_name="No",
        last_name="Login",
        role=UserRole.EMPLOYEE,
        site=site,
    )
    site.site_hod = account_less
    site.save()

    assert ProjectSiteAccess.objects.count() == 0


def test_an_inactive_profile_gets_nothing(site):
    incharge = ProjectInchargeUserFactory()
    profile_for(incharge, site=site, is_active=False)

    assert tasks(incharge, site) == set()


# ---- Admin's choices are respected ---------------------------------------------------


def test_tasks_an_admin_removed_are_not_put_back_by_an_unrelated_edit(site):
    incharge = ProjectInchargeUserFactory()
    profile = profile_for(incharge, site=site)
    pm = ProjectManagerUserFactory()
    site.site_hod = profile_for(pm)
    site.save()

    ProjectSiteAccess.objects.filter(
        user=incharge, role="DPR_BILLS"
    ).delete()
    ProjectSiteAccess.objects.filter(user=pm, role="BUILDINGS").delete()

    # Re-saving the employee and the site for other reasons.
    profile.mobile = "9999999999"
    profile.save()
    site.site_name = "Renamed project"
    site.save()

    assert tasks(incharge, site) == ALL - {"DPR_BILLS"}
    assert tasks(pm, site) == PM_DEFAULT - {"BUILDINGS"}


def test_ensure_default_grants_only_adds_what_is_missing(site):
    incharge = ProjectInchargeUserFactory()
    ProjectSiteAccess.objects.create(site=site, user=incharge, role="STRUCTURES")

    added = grants.ensure_default_grants(incharge, site)

    assert added == len(ALL) - 1
    assert grants.ensure_default_grants(incharge, site) == 0


def test_an_incharge_is_never_given_hr_or_machinery():
    starting_tasks = set(grants.default_tasks_for(UserRole.PROJECT_INCHARGE))

    assert not starting_tasks & {"HR", "MACHINERY"}


def test_default_tasks_by_role():
    assert set(grants.default_tasks_for(UserRole.PROJECT_INCHARGE)) == ALL
    assert set(grants.default_tasks_for(UserRole.PROJECT_MANAGER)) == PM_DEFAULT
    assert grants.default_tasks_for(UserRole.DIRECTOR) == ()


# ---- the backfill for people assigned before this existed -------------------------------


def _backfill():
    module = importlib.import_module(
        "apps.project_monitor.migrations.0016_backfill_starting_task_grants"
    )
    module.backfill(django_apps, None)


def test_backfill_gives_already_assigned_people_their_starting_tasks(site, other_site):
    incharge = ProjectInchargeUserFactory()
    pm = ProjectManagerUserFactory()
    profile_for(incharge, site=site)
    site.site_hod = profile_for(pm)
    site.save()
    # Simulate the state before the signals existed: assigned, no grants.
    ProjectSiteAccess.objects.all().delete()

    _backfill()

    assert tasks(incharge, site) == ALL
    assert tasks(pm, site) == PM_DEFAULT
    assert tasks(pm, other_site) == set()


def test_backfill_leaves_people_who_already_have_grants_alone(site):
    incharge = ProjectInchargeUserFactory()
    profile_for(incharge, site=site)
    ProjectSiteAccess.objects.all().delete()
    ProjectSiteAccess.objects.create(site=site, user=incharge, role="STRUCTURES")

    _backfill()

    assert tasks(incharge, site) == {"STRUCTURES"}


def test_backfill_is_safe_to_run_twice(site):
    profile_for(ProjectInchargeUserFactory(), site=site)
    ProjectSiteAccess.objects.all().delete()

    _backfill()
    first = ProjectSiteAccess.objects.count()
    _backfill()

    # The historical backfill (migration 0016) still hands an Incharge
    # all ten tasks; migration 0019 then removes HR and Machinery.
    assert ProjectSiteAccess.objects.count() == first == len(
        project_scope.ALL_TASKS
    )
