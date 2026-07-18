from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.utils.timezone import get_default_timezone_name

from apps.core.models import BusinessModel
from apps.core.utils.text import (
    normalize_code,
    normalize_whitespace,
)


class Company(BusinessModel):
    """
    Legal or operating company used as the root organization master.
    """

    company_code = models.CharField(
        max_length=30,
        unique=True,
        db_index=True,
    )
    company_name = models.CharField(
        max_length=150,
    )
    registered_name = models.CharField(
        max_length=200,
        blank=True,
    )
    address = models.TextField(
        blank=True,
    )
    contact_person = models.CharField(
        max_length=150,
        blank=True,
    )
    contact_email = models.EmailField(
        blank=True,
    )
    contact_phone = models.CharField(
        max_length=30,
        blank=True,
    )
    website = models.URLField(
        blank=True,
    )
    time_zone = models.CharField(
        max_length=64,
        default=get_default_timezone_name,
    )

    class Meta:
        db_table = "organization_company"
        ordering = ["company_name"]
        indexes = [
            models.Index(
                fields=["company_code", "is_active"],
                name="org_company_code_active_idx",
            ),
            models.Index(
                fields=["company_name"],
                name="org_company_name_idx",
            ),
        ]
        verbose_name = "Company"
        verbose_name_plural = "Companies"

    def __str__(self) -> str:
        return f"{self.company_code} - {self.company_name}"

    def clean(self):
        super().clean()

        self.company_code = normalize_code(
            self.company_code
        )
        self.company_name = normalize_whitespace(
            self.company_name
        )

        if self.registered_name:
            self.registered_name = normalize_whitespace(
                self.registered_name
            )

        if self.contact_person:
            self.contact_person = normalize_whitespace(
                self.contact_person
            )

        if self.contact_phone:
            self.contact_phone = normalize_whitespace(
                self.contact_phone
            )

        try:
            ZoneInfo(self.time_zone)
        except ZoneInfoNotFoundError as exc:
            raise ValidationError(
                {
                    "time_zone": (
                        "Enter a valid IANA time zone."
                    )
                }
            ) from exc

    def save(self, *args, **kwargs):
        self.full_clean()
        return super().save(*args, **kwargs)


class Site(BusinessModel):
    """
    Physical or project site where correction requests originate.
    """

    company = models.ForeignKey(
        Company,
        on_delete=models.PROTECT,
        related_name="sites",
    )
    site_code = models.CharField(
        max_length=30,
        db_index=True,
    )
    site_name = models.CharField(
        max_length=150,
    )
    project_name = models.CharField(
        max_length=150,
        blank=True,
    )
    state = models.CharField(
        max_length=100,
        blank=True,
    )
    district = models.CharField(
        max_length=100,
        blank=True,
    )
    address = models.TextField(
        blank=True,
    )
    start_date = models.DateField(
        null=True,
        blank=True,
    )
    end_date = models.DateField(
        null=True,
        blank=True,
    )
    site_director = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="director_sites",
        null=True,
        blank=True,
    )
    site_hod = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="hod_sites",
        null=True,
        blank=True,
    )
    cost_centre = models.CharField(
        max_length=50,
        blank=True,
    )
    erp_site_code = models.CharField(
        max_length=50,
        blank=True,
    )

    class Meta:
        db_table = "organization_site"
        ordering = ["site_name"]
        constraints = [
            models.UniqueConstraint(
                fields=["company", "site_code"],
                name="org_site_company_code_uniq",
            ),
        ]
        indexes = [
            models.Index(
                fields=["company", "is_active"],
                name="org_site_company_active_idx",
            ),
            models.Index(
                fields=["site_code", "is_active"],
                name="org_site_code_active_idx",
            ),
            models.Index(
                fields=["state", "district"],
                name="org_site_location_idx",
            ),
        ]
        verbose_name = "Site"
        verbose_name_plural = "Sites"

    def __str__(self) -> str:
        return f"{self.site_code} - {self.site_name}"

    def clean(self):
        super().clean()

        self.site_code = normalize_code(
            self.site_code
        )
        self.site_name = normalize_whitespace(
            self.site_name
        )

        if self.project_name:
            self.project_name = normalize_whitespace(
                self.project_name
            )

        if self.state:
            self.state = normalize_whitespace(
                self.state
            )

        if self.district:
            self.district = normalize_whitespace(
                self.district
            )

        if self.cost_centre:
            self.cost_centre = normalize_code(
                self.cost_centre
            )

        if self.erp_site_code:
            self.erp_site_code = normalize_code(
                self.erp_site_code
            )

        if (
            self.start_date
            and self.end_date
            and self.end_date < self.start_date
        ):
            raise ValidationError(
                {
                    "end_date": (
                        "End date cannot be before start date."
                    )
                }
            )

    def save(self, *args, **kwargs):
        self.full_clean()
        return super().save(*args, **kwargs)


class Department(BusinessModel):
    """
    Functional department used for ownership and approval routing.
    """

    company = models.ForeignKey(
        Company,
        on_delete=models.PROTECT,
        related_name="departments",
    )
    department_code = models.CharField(
        max_length=30,
        db_index=True,
    )
    department_name = models.CharField(
        max_length=150,
    )
    description = models.TextField(
        blank=True,
    )
    department_hod = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="hod_departments",
        null=True,
        blank=True,
    )
    display_order = models.PositiveIntegerField(
        default=0,
        db_index=True,
    )

    class Meta:
        db_table = "organization_department"
        ordering = [
            "display_order",
            "department_name",
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["company", "department_code"],
                name="org_dept_company_code_uniq",
            ),
        ]
        indexes = [
            models.Index(
                fields=["company", "is_active"],
                name="org_dept_company_active_idx",
            ),
            models.Index(
                fields=["department_code", "is_active"],
                name="org_dept_code_active_idx",
            ),
            models.Index(
                fields=["display_order", "department_name"],
                name="org_dept_display_name_idx",
            ),
        ]
        verbose_name = "Department"
        verbose_name_plural = "Departments"

    def __str__(self) -> str:
        return (
            f"{self.department_code} - "
            f"{self.department_name}"
        )

    def clean(self):
        super().clean()

        self.department_code = normalize_code(
            self.department_code
        )
        self.department_name = normalize_whitespace(
            self.department_name
        )

        if self.description:
            self.description = normalize_whitespace(
                self.description
            )

    def save(self, *args, **kwargs):
        self.full_clean()
        return super().save(*args, **kwargs)


class Designation(BusinessModel):
    """
    Role title assigned to employees within a department.
    """

    department = models.ForeignKey(
        Department,
        on_delete=models.PROTECT,
        related_name="designations",
    )
    designation_code = models.CharField(
        max_length=30,
        db_index=True,
    )
    designation_name = models.CharField(
        max_length=150,
    )
    level = models.PositiveSmallIntegerField(
        default=0,
        db_index=True,
    )

    class Meta:
        db_table = "organization_designation"
        ordering = [
            "level",
            "designation_name",
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["department", "designation_code"],
                name="org_desig_dept_code_uniq",
            ),
        ]
        indexes = [
            models.Index(
                fields=["department", "is_active"],
                name="org_desig_dept_active_idx",
            ),
            models.Index(
                fields=["designation_code", "is_active"],
                name="org_desig_code_active_idx",
            ),
            models.Index(
                fields=["level", "designation_name"],
                name="org_desig_level_name_idx",
            ),
        ]
        verbose_name = "Designation"
        verbose_name_plural = "Designations"

    def __str__(self) -> str:
        return (
            f"{self.designation_code} - "
            f"{self.designation_name}"
        )

    def clean(self):
        super().clean()

        self.designation_code = normalize_code(
            self.designation_code
        )
        self.designation_name = normalize_whitespace(
            self.designation_name
        )

    def save(self, *args, **kwargs):
        self.full_clean()
        return super().save(*args, **kwargs)
