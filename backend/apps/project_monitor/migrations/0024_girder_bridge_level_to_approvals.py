"""
A Girder Job's bridge-level GAD row was created with
``group_title="Bridge-level"``, while every other "doc" row
(Structure/Building's own GAD/drawing-approval rows) is created with
``group_title="Approvals"`` - the value the serializer already
displays for any such row regardless of what is actually stored (see
``ActivityGroupedSerializerMixin.get_groups``). The mismatch meant the
"+ Add activity" endpoint could never find this section on an existing
Girder Job, since it matches against the real stored field, not the
serializer's display label.

Only the ``group_title`` on these already-existing rows is corrected
to match what generator code creates from now on; nothing else about
them changes.
"""

from django.db import migrations

OLD_TITLE = "Bridge-level"
NEW_TITLE = "Approvals"


def _girder_job_content_type(apps):
    # The historical ``ContentType`` model has no ``get_for_model`` -
    # that lives on the real manager, not the frozen migration state.
    ContentType = apps.get_model("contenttypes", "ContentType")
    return ContentType.objects.filter(
        app_label="project_monitor", model="girderjob"
    ).first()


def rename_forward(apps, schema_editor):
    Activity = apps.get_model("project_monitor", "Activity")
    content_type = _girder_job_content_type(apps)
    if content_type is None:
        return
    Activity.objects.filter(
        content_type=content_type, group_title=OLD_TITLE
    ).update(group_title=NEW_TITLE)


def rename_backward(apps, schema_editor):
    Activity = apps.get_model("project_monitor", "Activity")
    content_type = _girder_job_content_type(apps)
    if content_type is None:
        return
    Activity.objects.filter(
        content_type=content_type,
        group_title=NEW_TITLE,
        is_doc=True,
    ).update(group_title=OLD_TITLE)


class Migration(migrations.Migration):
    dependencies = [
        ("project_monitor", "0023_activity_is_custom"),
        ("contenttypes", "0002_remove_content_type_name"),
    ]

    operations = [
        migrations.RunPython(rename_forward, rename_backward),
    ]
