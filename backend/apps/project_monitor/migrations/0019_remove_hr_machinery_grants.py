"""
HR and Machinery are now entered only by the HR Department and the
Machinery Department (company-wide roles), not granted per site to a
Project Incharge or Project Manager. Remove the per-site grants of those
two tasks; without this they would sit in the table doing nothing (the
access rules already ignore them).

Only the *access* rows are removed - every HR and machinery entry
itself is untouched. Reversing this does not bring the grants back.
"""

from django.db import migrations

DEPARTMENT_TASKS = ["HR", "MACHINERY"]


def remove_department_task_grants(apps, schema_editor):
    ProjectSiteAccess = apps.get_model(
        "project_monitor", "ProjectSiteAccess"
    )
    ProjectSiteAccess.objects.filter(
        role__in=DEPARTMENT_TASKS
    ).delete()


class Migration(migrations.Migration):
    dependencies = [
        ("project_monitor", "0018_chainagesegment"),
    ]

    operations = [
        migrations.RunPython(
            remove_department_task_grants,
            migrations.RunPython.noop,
        ),
    ]
