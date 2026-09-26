"""
The task-grant rules themselves, run against the real rules (see the
``real_scope`` marker in ``conftest.py``).
"""

import importlib

import pytest
from django.apps import apps as django_apps
from rest_framework.exceptions import PermissionDenied

from apps.authentication.models import AccountStatus
from apps.authentication.tests.factories import (
    AdminUserFactory,
    DirectorUserFactory,
    HrDepartmentUserFactory,
    MachineryDepartmentUserFactory,
    ProjectHoUserFactory,
    ProjectInchargeUserFactory,
    ProjectManagerUserFactory,
    SuperAdminUserFactory,
    UserFactory,
)
from apps.employees.models import EmployeeProfile
from apps.project_monitor.models import (
    ProjectSiteAccess,
    ProjectSiteAccessRole as Task,
)
from apps.project_monitor.services import (
    project_scope,
    rollups,
    site_access,
)
from apps.project_monitor.tests.scope_helpers import grant

pytestmark = [pytest.mark.real_scope, pytest.mark.django_db]

ALL = project_scope.ALL_TASKS
GRANTABLE = project_scope.GRANTABLE_TASKS


# ---- the task list ---------------------------------------------------


def test_every_task_has_a_label_and_group():
    # What the Site Access grid offers: every task except the two
    # that belong to the HR and Machinery departments.
    keys = [meta["key"] for meta in project_scope.TASK_META]
    assert keys == list(GRANTABLE)
    assert set(keys) == {t.value for t in Task} - {"HR", "MACHINERY"}
    assert {m["group"] for m in project_scope.TASK_META} == {
        "progress",
        "finance",
        "reports",
    }


def test_hr_and_machinery_are_department_tasks_not_grantable():
    assert set(project_scope.DEPARTMENT_TASKS) == {"HR", "MACHINERY"}
    assert not set(project_scope.DEPARTMENT_TASKS) & set(GRANTABLE)


def test_task_keys_fit_the_role_column():
    assert max(len(task) for task in ALL) <= 20


def test_module_keys_match_the_rollups():
    assert set(project_scope.TASK_MODULES.values()) == set(
        rollups.MODULE_LABELS
    )


# ---- what a grant means ----------------------------------------------


def test_a_grant_is_view_and_enter_for_that_task_on_that_site(site, other_site):
    incharge = ProjectInchargeUserFactory()
    grant(incharge, site, Task.STRUCTURES.value)

    assert project_scope.granted_tasks(incharge, site) == {"STRUCTURES"}
    assert project_scope.can_view_task(incharge, site, "STRUCTURES")
    assert project_scope.can_enter_task(incharge, site, "STRUCTURES")
    # Any other task, and any other site, is closed.
    assert not project_scope.can_view_task(incharge, site, "BUILDINGS")
    assert not project_scope.can_enter_task(incharge, site, "HR")
    assert not project_scope.can_view_task(incharge, other_site, "STRUCTURES")


def test_holding_any_task_lets_you_see_the_site(site, other_site):
    pm = ProjectManagerUserFactory()
    grant(pm, site, Task.REPORTS.value)

    assert project_scope.can_view_site(pm, site)
    assert not project_scope.can_view_site(pm, other_site)
    assert project_scope.user_site_ids(pm) == {site.id}


def test_a_stray_hr_grant_is_inert(site):
    # Old HR/Machinery grants (before they became department tasks)
    # do nothing even if a row is still in the table.
    pm = ProjectManagerUserFactory()
    ProjectSiteAccess.objects.bulk_create(
        [
            ProjectSiteAccess(site=site, user=pm, role="HR"),
            ProjectSiteAccess(site=site, user=pm, role="MACHINERY"),
        ]
    )

    assert project_scope.granted_tasks(pm, site) == set()
    assert not project_scope.can_view_site(pm, site)
    assert project_scope.user_site_ids(pm) == set()
    assert not site_access.can_view_hr(pm, site)


def test_several_people_can_hold_tasks_on_one_site_independently(site):
    first = grant(ProjectInchargeUserFactory(), site)
    second = grant(ProjectInchargeUserFactory(), site, Task.DPR_BILLS.value)
    manager = grant(
        ProjectManagerUserFactory(), site, Task.STRUCTURES.value
    )

    assert project_scope.granted_tasks(first, site) == set(GRANTABLE)
    assert project_scope.granted_tasks(second, site) == {"DPR_BILLS"}
    assert project_scope.granted_tasks(manager, site) == {"STRUCTURES"}


def test_one_person_can_hold_different_tasks_on_different_sites(site, other_site):
    pm = ProjectManagerUserFactory()
    grant(pm, site, Task.STRUCTURES.value)
    grant(pm, other_site, Task.BUILDINGS.value, Task.GIRDERS.value)

    assert project_scope.granted_tasks(pm, site) == {"STRUCTURES"}
    assert project_scope.granted_tasks(pm, other_site) == {"BUILDINGS", "GIRDERS"}
    assert project_scope.user_site_ids(pm) == {site.id, other_site.id}


def test_no_grant_means_no_access(site):
    for user in (ProjectManagerUserFactory(), ProjectInchargeUserFactory()):
        assert project_scope.granted_tasks(user, site) == set()
        assert project_scope.user_site_ids(user) == set()
        assert not project_scope.can_view_site(user, site)


def test_an_inactive_account_loses_its_grants(site):
    incharge = grant(ProjectInchargeUserFactory(), site)
    incharge.account_status = AccountStatus.SUSPENDED
    incharge.save()

    assert project_scope.granted_tasks(incharge, site) == set()
    assert project_scope.user_site_ids(incharge) == set()


def test_grants_only_count_for_incharge_and_project_manager(site):
    # A stray row for another role (e.g. after a role change) is inert.
    user = UserFactory()
    ProjectSiteAccess.objects.bulk_create(
        [ProjectSiteAccess(site=site, user=user, role="STRUCTURES")]
    )
    assert project_scope.granted_tasks(user, site) == set()


# ---- Director / Admin ------------------------------------------------------


def test_director_sees_everything_but_never_enters(site, other_site):
    director = DirectorUserFactory()
    for s in (site, other_site):
        for task in ALL:
            assert project_scope.can_view_task(director, s, task)
            assert not project_scope.can_enter_task(director, s, task)
        assert project_scope.can_view_site(director, s)
    assert project_scope.scoped_site_ids(director) is None
    assert project_scope.tasks_for(director, site) == set(ALL)


def test_admin_and_super_admin_do_everything_everywhere(site, other_site):
    for admin in (AdminUserFactory(), SuperAdminUserFactory()):
        for s in (site, other_site):
            for task in ALL:
                assert project_scope.can_view_task(admin, s, task)
                assert project_scope.can_enter_task(admin, s, task)
        assert project_scope.scoped_site_ids(admin) is None


def test_plain_users_get_nothing(site):
    plain = UserFactory()
    assert not project_scope.can_view_site(plain, site)
    assert not project_scope.can_view_task(plain, site, "STRUCTURES")
    assert project_scope.scoped_site_ids(plain) == set()


def test_ensure_helpers_name_the_missing_task(site):
    incharge = grant(
        ProjectInchargeUserFactory(), site, Task.STRUCTURES.value
    )

    project_scope.ensure_can_enter_task(incharge, site, "STRUCTURES")
    with pytest.raises(PermissionDenied) as denied:
        project_scope.ensure_can_view_task(incharge, site, "GIRDERS")
    assert "Girders" in str(denied.value.detail)
    with pytest.raises(PermissionDenied):
        project_scope.ensure_can_enter_task(incharge, site, "GIRDERS")
    # A row with no site is an Admin matter.
    with pytest.raises(PermissionDenied):
        project_scope.ensure_can_view_site(incharge, None)
    project_scope.ensure_can_enter_task(
        AdminUserFactory(), None, "STRUCTURES"
    )


# ---- pickers, modules, sites ---------------------------------------------------


def test_project_sites_queryset(site, other_site):
    pm = grant(ProjectManagerUserFactory(), site, Task.REPORTS.value)

    assert set(project_scope.project_sites_queryset(pm)) == {site}
    assert set(
        project_scope.project_sites_queryset(DirectorUserFactory())
    ) == {site, other_site}
    assert not project_scope.project_sites_queryset(
        ProjectManagerUserFactory()
    ).exists()


def test_site_task_map_is_in_display_order(site):
    pm = ProjectManagerUserFactory()
    grant(
        pm,
        site,
        Task.REPORTS.value,
        Task.STRUCTURES.value,
        Task.DPR_BILLS.value,
    )

    assert project_scope.site_task_map(pm) == {
        site.id: ["STRUCTURES", "DPR_BILLS", "REPORTS"]
    }


def test_activity_modules_follow_the_tasks_held(site, other_site):
    pm = ProjectManagerUserFactory()
    grant(pm, site, Task.STRUCTURES.value, Task.ACTION_ITEMS.value, Task.DPR_BILLS.value)
    grant(pm, other_site, Task.DPR_BILLS.value)

    assert project_scope.granted_modules(pm, site) == {
        "structures",
        "action_items",
    }
    assert project_scope.granted_modules(pm, other_site) == set()
    assert project_scope.module_access(pm) == {
        site.id: {"structures", "action_items"},
        other_site.id: set(),
    }
    assert project_scope.granted_modules(DirectorUserFactory(), site) is None
    assert project_scope.module_access(AdminUserFactory()) is None


# ---- the finance tasks ---------------------------------------------------------


def test_dpr_and_bills_needs_its_own_grant(site, other_site):
    for factory in (ProjectInchargeUserFactory, ProjectManagerUserFactory):
        user = factory()
        assert not site_access.can_view_finance(user, site)

        grant(user, site, Task.DPR_BILLS.value)
        assert site_access.can_view_finance(user, site)
        assert site_access.can_enter_dpr_bills(user, site)
        assert not site_access.can_view_finance(user, other_site)

    director = DirectorUserFactory()
    assert site_access.can_view_finance(director, site)
    assert not site_access.can_enter_dpr_bills(director, site)


@pytest.mark.parametrize(
    "factory, can_view, can_enter",
    [
        (
            HrDepartmentUserFactory,
            site_access.can_view_hr,
            site_access.can_enter_hr,
        ),
        (
            MachineryDepartmentUserFactory,
            site_access.can_view_machinery,
            site_access.can_enter_machinery,
        ),
    ],
)
def test_hr_and_machinery_belong_to_their_department(
    site, other_site, factory, can_view, can_enter
):
    department = factory()
    # The department works on every site, nothing to grant.
    for s in (site, other_site):
        assert can_view(department, s)
        assert can_enter(department, s)

    # Nobody else enters it - granted roles cannot hold it, and the
    # Director only views.
    for other in (ProjectInchargeUserFactory(), ProjectManagerUserFactory()):
        grant(other, site)
        assert not can_view(other, site)
        assert not can_enter(other, site)
    assert can_view(DirectorUserFactory(), site)
    assert not can_enter(DirectorUserFactory(), site)
    assert can_enter(AdminUserFactory(), site)


def test_a_finance_grant_gives_nothing_on_the_other_finance_tasks(site):
    incharge = grant(ProjectInchargeUserFactory(), site, Task.DPR_BILLS.value)

    assert site_access.can_view_finance(incharge, site)
    assert not site_access.can_view_hr(incharge, site)
    assert not site_access.can_view_machinery(incharge, site)


def test_visible_site_ids_for_the_dashboard_money_slot(site, other_site):
    incharge = ProjectInchargeUserFactory()
    grant(incharge, site, Task.DPR_BILLS.value)
    grant(incharge, other_site, Task.STRUCTURES.value)

    # Money only where the DPR & Bills task is held.
    assert site_access.visible_site_ids(incharge) == {site.id}
    assert site_access.visible_site_ids(ProjectManagerUserFactory()) == set()
    assert site_access.visible_site_ids(DirectorUserFactory()) is None


# ---- the migration that carried the old access over -----------------------------


def _old_style_people(site, other_site):
    """One person in each old-scope shape, plus a grant that did nothing."""
    profile_pm = ProjectManagerUserFactory()
    EmployeeProfile.objects.create(
        user=profile_pm,
        employee_id=profile_pm.employee_id,
        first_name=profile_pm.first_name,
        last_name=profile_pm.last_name,
        role=profile_pm.role,
        site=site,
    )
    site_pm = ProjectManagerUserFactory()
    site_pm_profile = EmployeeProfile.objects.create(
        user=site_pm,
        employee_id=site_pm.employee_id,
        first_name=site_pm.first_name,
        last_name=site_pm.last_name,
        role=site_pm.role,
    )
    other_site.site_hod = site_pm_profile
    other_site.save()

    incharge = ProjectInchargeUserFactory()
    EmployeeProfile.objects.create(
        user=incharge,
        employee_id=incharge.employee_id,
        first_name=incharge.first_name,
        last_name=incharge.last_name,
        role=incharge.role,
        site=site,
    )
    return profile_pm, site_pm, incharge


def test_migration_carries_todays_access_into_grants(site, other_site):
    migration = importlib.import_module(
        "apps.project_monitor.migrations.0015_copy_scope_into_task_grants"
    )
    profile_pm, site_pm, incharge = _old_style_people(site, other_site)
    # Creating them above already gave starting grants; this test is
    # about data that pre-dates grants, so start from none.
    ProjectSiteAccess.objects.all().delete()
    # Old finance grants: one that worked (in scope), one that never did.
    ProjectSiteAccess.objects.create(
        site=site, user=profile_pm, role="HR"
    )
    stray = ProjectManagerUserFactory()
    ProjectSiteAccess.objects.create(
        site=site, user=stray, role="DPR_BILLS"
    )
    nobody = ProjectManagerUserFactory()

    migration.copy_scope_into_grants(django_apps, None)

    progress = set(migration.PROGRESS_AND_REPORTS)
    # A Project Manager in scope: every progress task + Reports, and
    # only the finance grant they already held.
    # (The HR grant it also held is inert now: HR is a department task.)
    assert project_scope.granted_tasks(profile_pm, site) == progress
    # The Site's Project Manager, via the HOD mapping.
    assert project_scope.granted_tasks(site_pm, other_site) == progress
    assert project_scope.granted_tasks(site_pm, site) == set()
    # An Incharge also got the finance tasks that used to come free
    # (of which DPR & Bills is still grantable).
    assert project_scope.granted_tasks(incharge, site) == set(GRANTABLE)
    # A grant outside anyone's scope never worked - it is not revived.
    assert project_scope.granted_tasks(stray, site) == set()
    assert project_scope.granted_tasks(nobody, site) == set()


def test_migration_is_safe_to_run_twice(site, other_site):
    migration = importlib.import_module(
        "apps.project_monitor.migrations.0015_copy_scope_into_task_grants"
    )
    _old_style_people(site, other_site)
    ProjectSiteAccess.objects.all().delete()

    migration.copy_scope_into_grants(django_apps, None)
    first = ProjectSiteAccess.objects.count()
    migration.copy_scope_into_grants(django_apps, None)

    assert ProjectSiteAccess.objects.count() == first


# ---- the company-wide roles --------------------------------------------------


def test_project_ho_sees_progress_and_billing_on_every_site_but_enters_only_overview(
    site, other_site
):
    ho = ProjectHoUserFactory()

    assert project_scope.scoped_site_ids(ho) is None
    for s in (site, other_site):
        assert project_scope.can_view_site(ho, s)
        for task in (*project_scope.PROGRESS_TASKS, "DPR_BILLS", "REPORTS"):
            assert project_scope.can_view_task(ho, s, task)
        # Payroll and machinery cost stay with their departments.
        assert not project_scope.can_view_task(ho, s, "HR")
        assert not project_scope.can_view_task(ho, s, "MACHINERY")
        assert project_scope.can_enter_task(ho, s, "OVERVIEW")
        for task in ALL:
            if task != "OVERVIEW":
                assert not project_scope.can_enter_task(ho, s, task)
    assert project_scope.granted_modules(ho, site) is None
    assert project_scope.module_access(ho) is None
    assert site_access.visible_site_ids(ho) is None


@pytest.mark.parametrize(
    "factory, task",
    [
        (HrDepartmentUserFactory, "HR"),
        (MachineryDepartmentUserFactory, "MACHINERY"),
    ],
)
def test_a_department_account_holds_only_its_own_task_on_every_site(
    site, other_site, factory, task
):
    dept = factory()

    assert project_scope.scoped_site_ids(dept) is None
    for s in (site, other_site):
        assert project_scope.view_tasks_for(dept, s) == {task}
        assert project_scope.enter_tasks_for(dept, s) == {task}
        # Not the site's Overview or progress, only its own feed.
        assert not project_scope.can_view_site(dept, s)
        assert not project_scope.can_view_task(dept, s, "STRUCTURES")
    # No activity modules, so no due tracker or overdue rows.
    assert project_scope.granted_modules(dept, site) == set()
    assert project_scope.module_access(dept) == {}
    assert site_access.visible_site_ids(dept) == set()


def test_director_stays_read_only_everywhere(site):
    director = DirectorUserFactory()

    assert project_scope.enter_tasks_for(director, site) == set()
    assert project_scope.view_tasks_for(director, site) == set(ALL)


# ---- the migration that removed HR / Machinery grants ----------------------


def test_migration_removes_only_the_hr_and_machinery_grants(site, other_site):
    migration = importlib.import_module(
        "apps.project_monitor.migrations.0019_remove_hr_machinery_grants"
    )
    pm = ProjectManagerUserFactory()
    ProjectSiteAccess.objects.bulk_create(
        [
            ProjectSiteAccess(site=site, user=pm, role="HR"),
            ProjectSiteAccess(site=other_site, user=pm, role="MACHINERY"),
            ProjectSiteAccess(site=site, user=pm, role="STRUCTURES"),
            ProjectSiteAccess(site=site, user=pm, role="DPR_BILLS"),
        ]
    )

    migration.remove_department_task_grants(django_apps, None)

    assert set(
        ProjectSiteAccess.objects.values_list("role", flat=True)
    ) == {"STRUCTURES", "DPR_BILLS"}
