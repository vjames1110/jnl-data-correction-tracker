from django.db import migrations


def backfill_grades(apps, schema_editor):
    ItemCategory = apps.get_model(
        "reconciliation", "ItemCategory"
    )
    ItemCategoryGrade = apps.get_model(
        "reconciliation", "ItemCategoryGrade"
    )
    ReconciliationOutputEntry = apps.get_model(
        "reconciliation",
        "ReconciliationOutputEntry",
    )
    ItemStandard = apps.get_model(
        "reconciliation", "ItemStandard"
    )
    SiteItemConfig = apps.get_model(
        "reconciliation", "SiteItemConfig"
    )

    for category in ItemCategory.objects.filter(
        is_production_output=True
    ):
        grades = set(
            ReconciliationOutputEntry.objects.filter(
                category=category,
            )
            .exclude(grade_label="")
            .values_list(
                "grade_label", flat=True
            )
        )
        grades.update(
            ItemStandard.objects.filter(
                item__category=category,
            )
            .exclude(grade_label="")
            .values_list(
                "grade_label", flat=True
            )
        )
        grades.update(
            SiteItemConfig.objects.filter(
                item__category=category,
            )
            .exclude(grade_label="")
            .values_list(
                "grade_label", flat=True
            )
        )

        for order, grade_label in enumerate(
            sorted(grades)
        ):
            ItemCategoryGrade.objects.get_or_create(
                category=category,
                grade_label=grade_label,
                defaults={
                    "display_order": order,
                },
            )


def noop_reverse(apps, schema_editor):
    # Deliberately not reversed - dropping the backfilled grades on
    # a migrate-back would silently invalidate any production
    # output/rate rows created against them in the meantime.
    pass


class Migration(migrations.Migration):

    dependencies = [
        (
            "reconciliation",
            "0015_itemcategorygrade",
        ),
    ]

    operations = [
        migrations.RunPython(
            backfill_grades, noop_reverse
        ),
    ]
