from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        (
            "employees",
            "0002_employeeprofile_emp_profile_email_uniq",
        ),
    ]

    operations = [
        migrations.AlterField(
            model_name="employeeprofile",
            name="employee_id",
            field=models.CharField(
                blank=True,
                db_index=True,
                max_length=30,
                unique=True,
            ),
        ),
    ]
