import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        (
            "reconciliation",
            "0016_backfill_item_category_grades",
        ),
    ]

    operations = [
        # Additive only - the old `Item.category` FK and its
        # constraints/index are left untouched here so the next
        # migration's data backfill can still read them.
        migrations.AddField(
            model_name="item",
            name="categories",
            field=models.ManyToManyField(
                related_name="items",
                to="reconciliation.itemcategory",
            ),
        ),
        migrations.AddField(
            model_name="reconciliationentry",
            name="category",
            field=models.ForeignKey(
                blank=True,
                help_text=(
                    "Which of the item's (possibly "
                    "several) production-type "
                    "categories this entry's "
                    "theoretical consumption is "
                    "derived from - must be one of "
                    "the item's own categories. "
                    "Blank for a material not tied "
                    "to any specific product's "
                    "output batch."
                ),
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name="reconciliation_entries",
                to="reconciliation.itemcategory",
            ),
        ),
    ]
