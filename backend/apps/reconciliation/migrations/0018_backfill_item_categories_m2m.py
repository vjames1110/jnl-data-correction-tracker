from django.db import migrations


def backfill(apps, schema_editor):
    Item = apps.get_model("reconciliation", "Item")
    ReconciliationEntry = apps.get_model(
        "reconciliation", "ReconciliationEntry"
    )

    for item in Item.objects.all():
        if item.category_id:
            item.categories.add(item.category_id)

    # Every existing entry was implicitly "for" its item's one
    # category - make that explicit now that an item can have more
    # than one, so theoretical-consumption resolution (which now
    # keys off the entry's own `category`, not the item's) keeps
    # working exactly as before for all pre-existing data.
    for item in Item.objects.filter(
        category__isnull=False,
    ):
        ReconciliationEntry.objects.filter(
            item_id=item.id,
        ).update(category_id=item.category_id)


def noop_reverse(apps, schema_editor):
    # Deliberately not reversed - clearing the backfilled data on a
    # migrate-back would silently break theoretical-consumption
    # resolution for every existing entry.
    pass


class Migration(migrations.Migration):

    dependencies = [
        (
            "reconciliation",
            "0017_add_item_categories_m2m",
        ),
    ]

    operations = [
        migrations.RunPython(
            backfill, noop_reverse
        ),
    ]
