from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models

from apps.authentication.models import (
    AccountStatus,
    UserRole,
)
from apps.core.models import BusinessModel
from apps.core.utils.codes import (
    build_abbreviation,
    next_unique_code,
)
from apps.core.utils.text import (
    normalize_code,
    normalize_whitespace,
)
from apps.organization.models import (
    Department,
    Site,
)


class ErpModule(BusinessModel):
    """
    ERP functional module used during correction request creation.
    """

    module_code = models.CharField(
        max_length=30,
        blank=True,
        unique=True,
        db_index=True,
    )
    module_name = models.CharField(
        max_length=150,
        unique=True,
    )
    description = models.TextField(
        blank=True,
    )
    departments = models.ManyToManyField(
        Department,
        related_name="erp_modules",
        blank=True,
    )
    display_order = models.PositiveIntegerField(
        default=0,
        db_index=True,
    )

    class Meta:
        db_table = "erp_module"
        ordering = [
            "display_order",
            "module_name",
        ]
        indexes = [
            models.Index(
                fields=["module_code", "is_active"],
                name="erp_module_code_active_idx",
            ),
            models.Index(
                fields=["display_order", "module_name"],
                name="erp_module_order_name_idx",
            ),
        ]
        verbose_name = "ERP Module"
        verbose_name_plural = "ERP Modules"

    def __str__(self) -> str:
        return f"{self.module_code} - {self.module_name}"

    def clean(self):
        super().clean()

        self.module_name = normalize_whitespace(
            self.module_name
        )
        self.module_code = normalize_code(
            self.module_code
        )

        if not self.module_code:
            self.module_code = next_unique_code(
                ErpModule,
                "module_code",
                build_abbreviation(
                    self.module_name
                ),
                exclude_pk=self.pk,
            )

        if self.description:
            self.description = normalize_whitespace(
                self.description
            )

    def save(self, *args, **kwargs):
        self.full_clean()
        return super().save(*args, **kwargs)


class VoucherType(BusinessModel):
    """
    Voucher catalog scoped to an ERP module and optional department.
    """

    voucher_code = models.CharField(
        max_length=30,
        blank=True,
        db_index=True,
    )
    voucher_name = models.CharField(
        max_length=150,
    )
    erp_module = models.ForeignKey(
        ErpModule,
        on_delete=models.PROTECT,
        related_name="voucher_types",
    )
    department = models.ForeignKey(
        Department,
        on_delete=models.PROTECT,
        related_name="voucher_types",
        null=True,
        blank=True,
    )
    requires_voucher_number = models.BooleanField(
        default=True,
    )
    requires_voucher_date = models.BooleanField(
        default=True,
    )
    requires_amount = models.BooleanField(
        default=False,
    )
    requires_quantity = models.BooleanField(
        default=False,
    )

    class Meta:
        db_table = "erp_voucher_type"
        ordering = [
            "erp_module__module_name",
            "voucher_name",
        ]
        constraints = [
            models.UniqueConstraint(
                fields=[
                    "erp_module",
                    "voucher_code",
                ],
                name="erp_voucher_module_code_uniq",
            ),
        ]
        indexes = [
            models.Index(
                fields=["erp_module", "is_active"],
                name="erp_voucher_module_active_idx",
            ),
            models.Index(
                fields=["department", "is_active"],
                name="erp_voucher_dept_active_idx",
            ),
            models.Index(
                fields=["voucher_code", "is_active"],
                name="erp_voucher_code_active_idx",
            ),
        ]
        verbose_name = "Voucher Type"
        verbose_name_plural = "Voucher Types"

    def __str__(self) -> str:
        return f"{self.voucher_code} - {self.voucher_name}"

    def clean(self):
        super().clean()

        self.voucher_name = normalize_whitespace(
            self.voucher_name
        )
        self.voucher_code = normalize_code(
            self.voucher_code
        )

        if not self.voucher_code:
            self.voucher_code = next_unique_code(
                VoucherType,
                "voucher_code",
                build_abbreviation(
                    self.voucher_name
                ),
                exclude_pk=self.pk,
                scope={
                    "erp_module_id": self.erp_module_id,
                }
                if self.erp_module_id
                else None,
            )

    def save(self, *args, **kwargs):
        self.full_clean()
        return super().save(*args, **kwargs)


class WorkType(BusinessModel):
    """
    Type of correction work requested against an ERP voucher.
    """

    work_type_code = models.CharField(
        max_length=30,
        blank=True,
        unique=True,
        db_index=True,
    )
    work_type_name = models.CharField(
        max_length=100,
        unique=True,
    )
    description = models.TextField(
        blank=True,
    )
    requires_approval = models.BooleanField(
        default=True,
    )

    class Meta:
        db_table = "erp_work_type"
        ordering = [
            "work_type_name",
        ]
        indexes = [
            models.Index(
                fields=["work_type_code", "is_active"],
                name="erp_work_code_active_idx",
            ),
            models.Index(
                fields=["requires_approval", "is_active"],
                name="erp_work_approval_active_idx",
            ),
        ]
        verbose_name = "Work Type"
        verbose_name_plural = "Work Types"

    def __str__(self) -> str:
        return (
            f"{self.work_type_code} - "
            f"{self.work_type_name}"
        )

    def clean(self):
        super().clean()

        self.work_type_name = normalize_whitespace(
            self.work_type_name
        )
        self.work_type_code = normalize_code(
            self.work_type_code
        )

        if not self.work_type_code:
            self.work_type_code = next_unique_code(
                WorkType,
                "work_type_code",
                build_abbreviation(
                    self.work_type_name
                ),
                exclude_pk=self.pk,
            )

        if not self.requires_approval and (
            self.work_type_code
            in {
                "DELETE",
                "CANCEL",
                "REOPEN",
            }
        ):
            raise ValidationError(
                {
                    "requires_approval": (
                        "Sensitive work types require approval."
                    )
                }
            )

        if self.description:
            self.description = normalize_whitespace(
                self.description
            )

    def save(self, *args, **kwargs):
        self.full_clean()
        return super().save(*args, **kwargs)


class ReasonCategory(BusinessModel):
    """
    Standard reason category for ERP correction requests.
    """

    reason_code = models.CharField(
        max_length=30,
        blank=True,
        unique=True,
        db_index=True,
    )
    reason_name = models.CharField(
        max_length=150,
        unique=True,
    )
    description = models.TextField(
        blank=True,
    )
    display_order = models.PositiveIntegerField(
        default=0,
        db_index=True,
    )
    voucher_types = models.ManyToManyField(
        VoucherType,
        related_name="reason_categories",
        blank=True,
        help_text=(
            "Voucher types this reason applies to. "
            "Leave empty to make it available for "
            "every voucher type."
        ),
    )

    class Meta:
        db_table = "erp_reason_category"
        ordering = [
            "display_order",
            "reason_name",
        ]
        indexes = [
            models.Index(
                fields=["reason_code", "is_active"],
                name="erp_reason_code_active_idx",
            ),
            models.Index(
                fields=["display_order", "reason_name"],
                name="erp_reason_order_name_idx",
            ),
        ]
        verbose_name = "Reason Category"
        verbose_name_plural = "Reason Categories"

    def __str__(self) -> str:
        return f"{self.reason_code} - {self.reason_name}"

    def clean(self):
        super().clean()

        self.reason_name = normalize_whitespace(
            self.reason_name
        )
        self.reason_code = normalize_code(
            self.reason_code
        )

        if not self.reason_code:
            self.reason_code = next_unique_code(
                ReasonCategory,
                "reason_code",
                build_abbreviation(
                    self.reason_name
                ),
                exclude_pk=self.pk,
            )

        if self.description:
            self.description = normalize_whitespace(
                self.description
            )

    def save(self, *args, **kwargs):
        self.full_clean()
        return super().save(*args, **kwargs)


class Priority(BusinessModel):
    """
    Priority master with response SLA and escalation timings.
    """

    priority_code = models.CharField(
        max_length=30,
        blank=True,
        unique=True,
        db_index=True,
    )
    priority_name = models.CharField(
        max_length=100,
        unique=True,
    )
    sla_duration_hours = models.PositiveIntegerField(
        default=24,
    )
    escalation_duration_hours = models.PositiveIntegerField(
        default=12,
    )
    display_order = models.PositiveIntegerField(
        default=0,
        db_index=True,
    )

    class Meta:
        db_table = "erp_priority"
        ordering = [
            "display_order",
            "priority_name",
        ]
        indexes = [
            models.Index(
                fields=["priority_code", "is_active"],
                name="erp_priority_code_active_idx",
            ),
            models.Index(
                fields=["display_order", "priority_name"],
                name="erp_priority_order_name_idx",
            ),
        ]
        verbose_name = "Priority"
        verbose_name_plural = "Priorities"

    def __str__(self) -> str:
        return (
            f"{self.priority_code} - "
            f"{self.priority_name}"
        )

    def clean(self):
        super().clean()

        self.priority_name = normalize_whitespace(
            self.priority_name
        )
        self.priority_code = normalize_code(
            self.priority_code
        )

        if not self.priority_code:
            self.priority_code = next_unique_code(
                Priority,
                "priority_code",
                build_abbreviation(
                    self.priority_name
                ),
                exclude_pk=self.pk,
            )

        errors = {}
        if self.sla_duration_hours < 1:
            errors["sla_duration_hours"] = (
                "SLA duration must be at least 1 hour."
            )

        if self.escalation_duration_hours < 1:
            errors["escalation_duration_hours"] = (
                "Escalation duration must be at least 1 hour."
            )

        if (
            self.sla_duration_hours
            and self.escalation_duration_hours
            and self.escalation_duration_hours
            > self.sla_duration_hours
        ):
            errors["escalation_duration_hours"] = (
                "Escalation duration cannot exceed SLA duration."
            )

        if errors:
            raise ValidationError(errors)

    def save(self, *args, **kwargs):
        self.full_clean()
        return super().save(*args, **kwargs)


class ResponsiblePersonMapping(BusinessModel):
    """
    Route approved ERP correction work to a responsible person.
    """

    erp_module = models.ForeignKey(
        ErpModule,
        on_delete=models.PROTECT,
        related_name="responsible_person_mappings",
    )
    voucher_type = models.ForeignKey(
        VoucherType,
        on_delete=models.PROTECT,
        related_name="responsible_person_mappings",
        null=True,
        blank=True,
    )
    department = models.ForeignKey(
        Department,
        on_delete=models.PROTECT,
        related_name="erp_responsible_person_mappings",
        null=True,
        blank=True,
    )
    site = models.ForeignKey(
        Site,
        on_delete=models.PROTECT,
        related_name="erp_responsible_person_mappings",
        null=True,
        blank=True,
    )
    work_type = models.ForeignKey(
        WorkType,
        on_delete=models.PROTECT,
        related_name="responsible_person_mappings",
        null=True,
        blank=True,
    )
    priority = models.ForeignKey(
        Priority,
        on_delete=models.PROTECT,
        related_name="responsible_person_mappings",
        null=True,
        blank=True,
    )
    responsible_person = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="erp_responsible_person_mappings",
    )
    display_order = models.PositiveIntegerField(
        default=0,
        db_index=True,
    )

    class Meta:
        db_table = "erp_responsible_person_mapping"
        ordering = [
            "display_order",
            "erp_module__module_name",
            "responsible_person__employee_id",
        ]
        indexes = [
            models.Index(
                fields=["erp_module", "is_active"],
                name="erp_rpm_module_active_idx",
            ),
            models.Index(
                fields=["voucher_type", "is_active"],
                name="erp_rpm_voucher_active_idx",
            ),
            models.Index(
                fields=["department", "site", "is_active"],
                name="erp_rpm_org_active_idx",
            ),
            models.Index(
                fields=["work_type", "priority", "is_active"],
                name="erp_rpm_work_pri_active_idx",
            ),
            models.Index(
                fields=["responsible_person", "is_active"],
                name="erp_rpm_person_active_idx",
            ),
        ]
        verbose_name = "Responsible Person Mapping"
        verbose_name_plural = "Responsible Person Mappings"

    def __str__(self) -> str:
        return (
            f"{self.erp_module.module_code} - "
            f"{self.responsible_person.employee_id}"
        )

    def clean(self):
        super().clean()

        errors = {}

        if (
            self.voucher_type_id
            and self.erp_module_id
            and self.voucher_type.erp_module_id
            != self.erp_module_id
        ):
            errors["voucher_type"] = (
                "Voucher type must belong to the selected ERP module."
            )

        if (
            self.voucher_type_id
            and self.department_id
            and self.voucher_type.department_id
            and self.voucher_type.department_id
            != self.department_id
        ):
            errors["department"] = (
                "Department must match the selected voucher type."
            )

        if self.responsible_person_id:
            person = self.responsible_person
            if person.role != UserRole.RESPONSIBLE_PERSON:
                errors["responsible_person"] = (
                    "Selected user must have Responsible Person role."
                )
            elif not (
                person.is_active
                and person.account_status
                == AccountStatus.ACTIVE
            ):
                errors["responsible_person"] = (
                    "Selected responsible person must be active."
                )

        if self.is_active:
            duplicate_queryset = ResponsiblePersonMapping.objects.filter(
                is_active=True,
                erp_module_id=self.erp_module_id,
                voucher_type_id=self.voucher_type_id,
                department_id=self.department_id,
                site_id=self.site_id,
                work_type_id=self.work_type_id,
                priority_id=self.priority_id,
            )
            if self.pk:
                duplicate_queryset = duplicate_queryset.exclude(
                    pk=self.pk
                )

            if duplicate_queryset.exists():
                errors["erp_module"] = (
                    "An active responsible-person mapping already exists "
                    "for this routing combination."
                )

        if errors:
            raise ValidationError(errors)

    def save(self, *args, **kwargs):
        self.full_clean()
        return super().save(*args, **kwargs)


class RequestFieldState(models.TextChoices):
    REQUIRED = "REQUIRED", "Required"
    OPTIONAL = "OPTIONAL", "Optional"
    HIDDEN = "HIDDEN", "Hidden"


class RequestFieldConfiguration(BusinessModel):
    """
    Configure request-form fields for ERP correction creation.
    """

    field_key = models.CharField(
        max_length=60,
        blank=True,
        db_index=True,
    )
    field_label = models.CharField(
        max_length=150,
    )
    field_state = models.CharField(
        max_length=20,
        choices=RequestFieldState.choices,
        default=RequestFieldState.OPTIONAL,
        db_index=True,
    )
    erp_module = models.ForeignKey(
        ErpModule,
        on_delete=models.PROTECT,
        related_name="request_field_configurations",
        null=True,
        blank=True,
    )
    voucher_type = models.ForeignKey(
        VoucherType,
        on_delete=models.PROTECT,
        related_name="request_field_configurations",
        null=True,
        blank=True,
    )
    work_type = models.ForeignKey(
        WorkType,
        on_delete=models.PROTECT,
        related_name="request_field_configurations",
        null=True,
        blank=True,
    )
    priority = models.ForeignKey(
        Priority,
        on_delete=models.PROTECT,
        related_name="request_field_configurations",
        null=True,
        blank=True,
    )
    help_text = models.TextField(
        blank=True,
    )
    display_order = models.PositiveIntegerField(
        default=0,
        db_index=True,
    )

    class Meta:
        db_table = "erp_request_field_configuration"
        ordering = [
            "display_order",
            "field_label",
        ]
        indexes = [
            models.Index(
                fields=["field_key", "is_active"],
                name="erp_rfc_key_active_idx",
            ),
            models.Index(
                fields=["field_state", "is_active"],
                name="erp_rfc_state_active_idx",
            ),
            models.Index(
                fields=["erp_module", "voucher_type", "is_active"],
                name="erp_rfc_module_voucher_idx",
            ),
            models.Index(
                fields=["work_type", "priority", "is_active"],
                name="erp_rfc_work_priority_idx",
            ),
        ]
        verbose_name = "Request Field Configuration"
        verbose_name_plural = "Request Field Configurations"

    def __str__(self) -> str:
        return f"{self.field_key} - {self.field_state}"

    def clean(self):
        super().clean()

        self.field_label = normalize_whitespace(
            self.field_label
        )
        self.field_key = normalize_code(
            self.field_key
        )

        if not self.field_key:
            self.field_key = build_abbreviation(
                self.field_label
            )

        if self.help_text:
            self.help_text = normalize_whitespace(
                self.help_text
            )

        errors = {}

        if (
            self.voucher_type_id
            and self.erp_module_id
            and self.voucher_type.erp_module_id
            != self.erp_module_id
        ):
            errors["voucher_type"] = (
                "Voucher type must belong to the selected ERP module."
            )

        if self.voucher_type_id and not self.erp_module_id:
            errors["erp_module"] = (
                "Select ERP module for voucher-specific field configuration."
            )

        if self.is_active:
            duplicate_queryset = RequestFieldConfiguration.objects.filter(
                is_active=True,
                field_key=self.field_key,
                erp_module_id=self.erp_module_id,
                voucher_type_id=self.voucher_type_id,
                work_type_id=self.work_type_id,
                priority_id=self.priority_id,
            )
            if self.pk:
                duplicate_queryset = duplicate_queryset.exclude(
                    pk=self.pk
                )

            if duplicate_queryset.exists():
                errors["field_key"] = (
                    "An active field configuration already exists "
                    "for this scope."
                )

        if errors:
            raise ValidationError(errors)

    def save(self, *args, **kwargs):
        self.full_clean()
        return super().save(*args, **kwargs)
