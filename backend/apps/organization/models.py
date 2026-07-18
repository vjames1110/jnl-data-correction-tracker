from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

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
