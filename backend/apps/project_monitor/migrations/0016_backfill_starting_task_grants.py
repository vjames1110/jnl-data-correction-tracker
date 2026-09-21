"""
Give the people the Admin has already assigned - an employee's site in
User Management, or a site's Project Manager in Organization Setup -
their starting tasks, when they hold none on that site.

Needed because access became task-wise grants: anyone assigned
through those screens AFTER the previous data migration (0015) got no
access at all. Only people with no grant whatsoever on that site are
touched, so tasks an Admin deliberately trimmed are left alone.
Project Incharge: every task. Project Manager: the progress tasks and
Reports. Safe to run again; reversing it changes nothing.
"""

from django.db import migrations

PROGRESS_AND_REPORTS = [
    "OVERVIEW",
    "STRUCTURES",
    "BUILDINGS",
    "GIRDERS",
    "ACTION_ITEMS",
    "LINEAR_WORKS",
    "REPORTS",
]
FINANCE = ["DPR_BILLS", "HR", "MACHINERY"]


def backfill(apps, schema_editor):
    User = apps.get_model("authentication", "User")
    EmployeeProfile = apps.get_model("employees", "EmployeeProfile")
    Site = apps.get_model("organization", "Site")
    ProjectSiteAccess = apps.get_model(
        "project_monitor", "ProjectSiteAccess"
    )

    users = User.objects.filter(
        role__in=["PROJECT_MANAGER", "PROJECT_INCHARGE"],
        is_active=True,
        account_status="ACTIVE",
    )
    for user in users:
        site_ids = set(
            EmployeeProfile.objects.filter(
                user_id=user.id,
                is_active=True,
                site__isnull=False,
            ).values_list("site_id", flat=True)
        )
        site_ids |= set(
            Site.objects.filter(
                site_hod__user_id=user.id,
                site_hod__is_active=True,
            ).values_list("id", flat=True)
        )

        tasks = list(PROGRESS_AND_REPORTS)
        if user.role == "PROJECT_INCHARGE":
            tasks += FINANCE
        for site_id in site_ids:
            if ProjectSiteAccess.objects.filter(
                user_id=user.id, site_id=site_id
            ).exists():
                continue
            for task in tasks:
                ProjectSiteAccess.objects.get_or_create(
                    site_id=site_id, user_id=user.id, role=task
                )


class Migration(migrations.Migration):

    dependencies = [
        ("authentication", "0007_alter_user_role"),
        ("employees", "0009_alter_employeeprofile_role"),
        ("organization", "0012_site_contract_no_site_opening_bill_date_and_more"),
        ("project_monitor", "0015_copy_scope_into_task_grants"),
    ]

    operations = [
        migrations.RunPython(backfill, migrations.RunPython.noop),
    ]
