from django.db import migrations


def merge(apps, schema_editor):
    """
    Raw-material stock is now one reconciliation entry per material
    per month, not one per production grade. Collapse any existing
    grade-split rows for the same (period, item): keep the first
    (ordered by grade_label then created_at), blank its grade_label
    and category, delete the siblings.

    The keep row's computed columns are nulled so nothing shows a
    stale per-grade figure until it's recomputed under the summed
    logic - editing the entry or touching a production output entry
    re-runs services.variance; a one-off resave sweep covers the
    rest.
    """
    ReconciliationEntry = apps.get_model(
        "reconciliation", "ReconciliationEntry"
    )
    ReconciliationFlag = apps.get_model(
        "reconciliation", "ReconciliationFlag"
    )

    seen = {}
    to_delete = []

    for entry in ReconciliationEntry.objects.order_by(
        "period_id",
        "item_id",
        "grade_label",
        "created_at",
    ):
        key = (entry.period_id, entry.item_id)
        if key not in seen:
            seen[key] = entry
            entry.grade_label = ""
            entry.category_id = None
            entry.actual_quantity = None
            entry.theoretical_or_book_quantity = None
            entry.variance_quantity = None
            entry.variance_value = None
            entry.resolved_rate = None
            entry.status = "NOT_CALCULATED"
            entry.save(
                update_fields=[
                    "grade_label",
                    "category",
                    "actual_quantity",
                    "theoretical_or_book_quantity",
                    "variance_quantity",
                    "variance_value",
                    "resolved_rate",
                    "status",
                    "updated_at",
                ]
            )
        else:
            to_delete.append(entry.id)

    if to_delete:
        ReconciliationFlag.objects.filter(
            entry_id__in=to_delete
        ).delete()
        ReconciliationEntry.objects.filter(
            id__in=to_delete
        ).delete()


def noop_reverse(apps, schema_editor):
    # Not reversible - the grade-split rows carried duplicate
    # physical figures and merging is lossy by design.
    pass


class Migration(migrations.Migration):

    dependencies = [
        (
            "reconciliation",
            "0019_finalize_item_categories_m2m",
        ),
    ]

    operations = [
        migrations.RunPython(merge, noop_reverse),
    ]
