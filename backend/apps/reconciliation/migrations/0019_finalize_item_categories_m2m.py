from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        (
            "reconciliation",
            "0018_backfill_item_categories_m2m",
        ),
    ]

    operations = [
        migrations.AlterModelOptions(
            name="item",
            options={
                "ordering": ["item_name"],
                "verbose_name": "Item",
                "verbose_name_plural": "Items",
            },
        ),
        migrations.RemoveConstraint(
            model_name="item",
            name="reco_item_category_code_uniq",
        ),
        migrations.RemoveIndex(
            model_name="item",
            name="reco_item_cat_active_idx",
        ),
        migrations.RemoveField(
            model_name="item",
            name="category",
        ),
        migrations.AlterField(
            model_name="item",
            name="item_code",
            field=models.CharField(
                blank=True,
                db_index=True,
                max_length=30,
                unique=True,
            ),
        ),
        migrations.RemoveConstraint(
            model_name="reconciliationentry",
            name="reco_entry_period_item_grade_uniq",
        ),
        migrations.AddConstraint(
            model_name="reconciliationentry",
            constraint=models.UniqueConstraint(
                condition=models.Q(
                    ("category__isnull", True)
                ),
                fields=(
                    "period",
                    "item",
                    "grade_label",
                ),
                name="reco_entry_period_item_grade_uniq",
            ),
        ),
        migrations.AddConstraint(
            model_name="reconciliationentry",
            constraint=models.UniqueConstraint(
                condition=models.Q(
                    ("category__isnull", False)
                ),
                fields=(
                    "period",
                    "item",
                    "category",
                    "grade_label",
                ),
                name="reco_entry_period_item_cat_grade_uniq",
            ),
        ),
    ]
