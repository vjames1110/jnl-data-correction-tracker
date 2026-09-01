from django.db import migrations


def backfill_category(apps, schema_editor):
    Item = apps.get_model("reconciliation", "Item")
    ItemCategory = apps.get_model(
        "reconciliation", "ItemCategory"
    )
    ReconciliationOutputEntry = apps.get_model(
        "reconciliation", "ReconciliationOutputEntry"
    )

    # Carry forward every existing production-output item's flag
    # onto its own category - the category is what "is a production
    # type" means from here on.
    production_category_ids = set(
        Item.objects.filter(
            is_production_output=True,
        ).values_list("category_id", flat=True)
    )
    ItemCategory.objects.filter(
        id__in=production_category_ids,
    ).update(is_production_output=True)

    # Every existing output entry was logged against one material
    # item - reassign it to that item's own category, the new home
    # for "what was produced".
    for output in ReconciliationOutputEntry.objects.select_related(
        "item",
    ):
        output.category_id = output.item.category_id
        output.save(update_fields=["category"])


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):
    dependencies = [
        (
            "reconciliation",
            "0010_add_category_production_output",
        ),
    ]

    operations = [
        migrations.RunPython(
            backfill_category, noop_reverse
        ),
    ]
