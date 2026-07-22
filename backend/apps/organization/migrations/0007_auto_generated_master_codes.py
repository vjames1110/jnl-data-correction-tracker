from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        (
            "organization",
            "0006_remove_designation_org_desig_dept_code_uniq_and_more",
        ),
    ]

    operations = [
        migrations.AlterField(
            model_name="department",
            name="department_code",
            field=models.CharField(
                blank=True,
                db_index=True,
                max_length=30,
            ),
        ),
        migrations.AlterField(
            model_name="designation",
            name="designation_code",
            field=models.CharField(
                blank=True,
                db_index=True,
                max_length=30,
                unique=True,
            ),
        ),
    ]
