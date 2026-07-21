from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models

from apps.authentication.models import UserRole
from apps.core.models import BusinessModel
from apps.core.utils.text import (
    normalize_code,
    normalize_whitespace,
)
from apps.organization.models import (
    Department,
    Designation,
    Site,
)


class Gender(models.TextChoices):
    MALE = "MALE", "Male"
    FEMALE = "FEMALE", "Female"
    OTHER = "OTHER", "Other"
    NOT_SPECIFIED = (
        "NOT_SPECIFIED",
        "Not Specified",
    )


class EmploymentStatus(models.TextChoices):
    PROBATION = "PROBATION", "Probation"
    CONFIRMED = "CONFIRMED", "Confirmed"
    CONTRACT = "CONTRACT", "Contract"
    NOTICE_PERIOD = (
        "NOTICE_PERIOD",
        "Notice Period",
    )
    RELIEVED = "RELIEVED", "Relieved"
    TERMINATED = "TERMINATED", "Terminated"


class EmployeeProfile(BusinessModel):
    """
    Organization and employment profile for an employee.

    User remains the authentication identity. EmployeeProfile stores
    employment metadata and can exist before a login account is created.
    """

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="employee_profile",
        null=True,
        blank=True,
    )
    employee_id = models.CharField(
        max_length=30,
        unique=True,
        db_index=True,
    )
    first_name = models.CharField(
        max_length=100,
    )
    last_name = models.CharField(
        max_length=100,
        blank=True,
    )
    email = models.EmailField(
        blank=True,
    )
    mobile = models.CharField(
        max_length=30,
        blank=True,
    )
    gender = models.CharField(
        max_length=20,
        choices=Gender.choices,
        default=Gender.NOT_SPECIFIED,
        db_index=True,
    )
    date_of_joining = models.DateField(
        null=True,
        blank=True,
    )
    employment_status = models.CharField(
        max_length=20,
        choices=EmploymentStatus.choices,
        default=EmploymentStatus.CONFIRMED,
        db_index=True,
    )
    site = models.ForeignKey(
        Site,
        on_delete=models.PROTECT,
        related_name="employee_profiles",
        null=True,
        blank=True,
    )
    department = models.ForeignKey(
        Department,
        on_delete=models.PROTECT,
        related_name="employee_profiles",
        null=True,
        blank=True,
    )
    designation = models.ForeignKey(
        Designation,
        on_delete=models.PROTECT,
        related_name="employee_profiles",
        null=True,
        blank=True,
    )
    reporting_manager = models.ForeignKey(
        "self",
        on_delete=models.SET_NULL,
        related_name="direct_reports",
        null=True,
        blank=True,
    )
    role = models.CharField(
        max_length=30,
        choices=UserRole.choices,
        default=UserRole.USER,
        db_index=True,
    )
    erp_user_id = models.CharField(
        max_length=50,
        blank=True,
        db_index=True,
    )
    profile_photo = models.FileField(
        upload_to="employees/profile_photos/",
        blank=True,
    )
    last_working_date = models.DateField(
        null=True,
        blank=True,
    )

    class Meta:
        db_table = "employees_employee_profile"
        ordering = [
            "employee_id",
        ]
        indexes = [
            models.Index(
                fields=["employment_status", "is_active"],
                name="emp_profile_status_active_idx",
            ),
            models.Index(
                fields=["site", "department", "is_active"],
                name="emp_profile_org_active_idx",
            ),
            models.Index(
                fields=["role", "is_active"],
                name="emp_profile_role_active_idx",
            ),
        ]
        verbose_name = "Employee Profile"
        verbose_name_plural = "Employee Profiles"

    def __str__(self) -> str:
        return f"{self.employee_id} - {self.full_name}"

    @property
    def full_name(self) -> str:
        return " ".join(
            part
            for part in [
                self.first_name.strip(),
                self.last_name.strip(),
            ]
            if part
        )

    def _normalize_fields(self):
        self.employee_id = normalize_code(
            self.employee_id
        )
        self.first_name = normalize_whitespace(
            self.first_name
        )

        if self.last_name:
            self.last_name = normalize_whitespace(
                self.last_name
            )

        if self.email:
            self.email = self.email.strip().lower()

        if self.mobile:
            self.mobile = normalize_whitespace(
                self.mobile
            )

        if self.erp_user_id:
            self.erp_user_id = normalize_code(
                self.erp_user_id
            )

    def clean_fields(self, exclude=None):
        self._normalize_fields()
        super().clean_fields(exclude=exclude)

    def clean(self):
        super().clean()
        self._normalize_fields()

        errors = {}

        if (
            self.date_of_joining
            and self.last_working_date
            and self.last_working_date
            < self.date_of_joining
        ):
            errors["last_working_date"] = (
                "Last working date cannot be before "
                "date of joining."
            )

        if (
            self.site_id
            and self.department_id
            and self.site.company_id
            != self.department.company_id
        ):
            errors["department"] = (
                "Department must belong to the same "
                "company as the site."
            )

        if (
            self.reporting_manager_id
            and self.pk
            and self.reporting_manager_id == self.pk
        ):
            errors["reporting_manager"] = (
                "Employee cannot report to themselves."
            )

        if self.user_id:
            if self.user.employee_id != self.employee_id:
                errors["user"] = (
                    "Linked user employee ID must match "
                    "the employee profile."
                )

            if (
                self.email
                and self.user.email
                and self.user.email.lower()
                != self.email
            ):
                errors["email"] = (
                    "Email must match the linked user."
                )

            if (
                self.user.first_name.strip()
                and self.user.first_name.strip()
                != self.first_name
            ):
                errors["first_name"] = (
                    "First name must match the linked user."
                )

            if (
                self.user.last_name.strip()
                and self.last_name
                and self.user.last_name.strip()
                != self.last_name
            ):
                errors["last_name"] = (
                    "Last name must match the linked user."
                )

            if self.user.role != self.role:
                errors["role"] = (
                    "Role must match the linked user."
                )

        if errors:
            raise ValidationError(errors)

    def save(self, *args, **kwargs):
        self.full_clean()
        return super().save(*args, **kwargs)
