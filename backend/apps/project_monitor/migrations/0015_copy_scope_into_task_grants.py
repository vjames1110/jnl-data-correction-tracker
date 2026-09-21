"""
Move Project Monitor access from "site scope" (the employee's site plus
being the Site's Project Manager) to explicit task-wise grants, without
changing what anyone can do today.

Before this change:
- a Project Incharge or Project Manager in scope for a site could use
  every non-finance task there;
- a Project Incharge also had DPR & Bills, HR and Machinery there;
- a Project Manager had a finance task only where an Admin had granted
  it AND the person was in scope (a grant outside their scope did
  nothing).

So for each such person and each site in their old scope this creates
the progress tasks and Reports (plus the three finance tasks for an
Incharge), keeps the finance grants a Project Manager already held on
those sites, and removes grants that never took effect. Safe to run
again; reversing it changes nothing.
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


def old_scope_site_ids(apps, user):
    """Sites the user was in scope for: profile site + Site PM."""
    EmployeeProfile = apps.get_model("employees", "EmployeeProfile")
    Site = apps.get_model("organization", "Site")

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
    return site_ids


def copy_scope_into_grants(apps, schema_editor):
    User = apps.get_model("authentication", "User")
    ProjectSiteAccess = apps.get_model(
        "project_monitor", "ProjectSiteAccess"
    )

    users = User.objects.filter(
        role__in=["PROJECT_MANAGER", "PROJECT_INCHARGE"],
        is_active=True,
        account_status="ACTIVE",
    )
    for user in users:
        site_ids = old_scope_site_ids(apps, user)

        # A grant on a site the person was not in scope for never took
        # effect - drop it rather than let it start working now.
        ProjectSiteAccess.objects.filter(user_id=user.id).exclude(
            site_id__in=site_ids
        ).delete()

        tasks = list(PROGRESS_AND_REPORTS)
        if user.role == "PROJECT_INCHARGE":
            tasks += FINANCE
        for site_id in site_ids:
            for task in tasks:
                ProjectSiteAccess.objects.get_or_create(
                    site_id=site_id, user_id=user.id, role=task
                )


class Migration(migrations.Migration):

    dependencies = [
        ("authentication", "0007_alter_user_role"),
        ("employees", "0009_alter_employeeprofile_role"),
        ("organization", "0012_site_contract_no_site_opening_bill_date_and_more"),
        ("project_monitor", "0014_task_wise_site_access"),
    ]

    operations = [
        migrations.RunPython(
            copy_scope_into_grants, migrations.RunPython.noop
        ),
    ]
