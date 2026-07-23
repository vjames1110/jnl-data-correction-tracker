import pytest
from django.contrib import admin
from django.core.exceptions import ValidationError

from apps.authentication.tests.factories import (
    AdminUserFactory,
    ResponsiblePersonUserFactory,
)
from apps.erp.models import (
    ErpModule,
    Priority,
    ReasonCategory,
    ResponsiblePersonMapping,
    RequestFieldConfiguration,
    RequestFieldState,
    VoucherType,
    WorkType,
)
from apps.organization.models import (
    Company,
    Department,
)


@pytest.fixture
def department():
    company = Company.objects.create(
        company_code="JNL",
        company_name="Jhajharia Nirman Limited",
    )
    return Department.objects.create(
        company=company,
        department_name="Accounts",
    )


@pytest.mark.django_db
def test_erp_module_normalizes_and_generates_code(
    department,
):
    module = ErpModule.objects.create(
        module_name=" Accounts   Payable ",
        description="  voucher  module  ",
        display_order=10,
    )
    module.departments.add(department)

    assert module.module_code == "AP"
    assert module.module_name == "Accounts Payable"
    assert module.description == "voucher module"
    assert list(module.departments.all()) == [
        department
    ]


@pytest.mark.django_db
def test_voucher_type_generates_unique_code_per_module(
    department,
):
    module = ErpModule.objects.create(
        module_name="Accounts"
    )
    first = VoucherType.objects.create(
        erp_module=module,
        department=department,
        voucher_name="Journal Voucher",
        requires_amount=True,
    )
    second = VoucherType.objects.create(
        erp_module=module,
        voucher_name="Journal Voucher",
    )

    assert first.voucher_code == "JV"
    assert second.voucher_code == "JV2"
    assert first.requires_amount is True


@pytest.mark.django_db
def test_voucher_code_must_be_unique_per_module(
):
    module = ErpModule.objects.create(
        module_name="Store"
    )
    VoucherType.objects.create(
        erp_module=module,
        voucher_code="GRN",
        voucher_name="Goods Receipt Note",
    )

    with pytest.raises(ValidationError):
        VoucherType.objects.create(
            erp_module=module,
            voucher_code="GRN",
            voucher_name="Duplicate GRN",
        )


@pytest.mark.django_db
def test_work_type_normalizes_code_and_requires_sensitive_approval(
):
    work_type = WorkType.objects.create(
        work_type_name=" Edit ",
        description="  modify existing record  ",
    )

    assert work_type.work_type_code == "EDI"
    assert work_type.work_type_name == "Edit"
    assert work_type.description == "modify existing record"

    with pytest.raises(ValidationError):
        WorkType.objects.create(
            work_type_code="DELETE",
            work_type_name="Delete",
            requires_approval=False,
        )


@pytest.mark.django_db
def test_reason_category_normalizes_and_generates_code():
    reason = ReasonCategory.objects.create(
        reason_name=" Wrong   Amount ",
        description="  amount mismatch  ",
        display_order=20,
    )

    assert reason.reason_code == "WA"
    assert reason.reason_name == "Wrong Amount"
    assert reason.description == "amount mismatch"


@pytest.mark.django_db
def test_priority_validates_sla_and_escalation_duration():
    priority = Priority.objects.create(
        priority_name=" Critical ",
        sla_duration_hours=8,
        escalation_duration_hours=4,
        display_order=1,
    )

    assert priority.priority_code == "CRI"
    assert priority.priority_name == "Critical"

    with pytest.raises(ValidationError):
        Priority.objects.create(
            priority_name="Invalid",
            sla_duration_hours=4,
            escalation_duration_hours=8,
        )


@pytest.mark.django_db
def test_responsible_person_mapping_requires_responsible_role(
    department,
):
    module = ErpModule.objects.create(
        module_name="Accounts"
    )
    priority = Priority.objects.create(
        priority_name="Normal",
        sla_duration_hours=24,
        escalation_duration_hours=12,
    )
    work_type = WorkType.objects.create(
        work_type_name="Edit"
    )
    responsible_person = ResponsiblePersonUserFactory()
    mapping = ResponsiblePersonMapping.objects.create(
        erp_module=module,
        department=department,
        work_type=work_type,
        priority=priority,
        responsible_person=responsible_person,
    )

    assert mapping.responsible_person == responsible_person

    with pytest.raises(ValidationError):
        ResponsiblePersonMapping.objects.create(
            erp_module=module,
            responsible_person=AdminUserFactory(),
        )


@pytest.mark.django_db
def test_responsible_person_mapping_rejects_mismatched_voucher_module(
):
    accounts = ErpModule.objects.create(
        module_name="Accounts"
    )
    store = ErpModule.objects.create(
        module_name="Store"
    )
    voucher = VoucherType.objects.create(
        erp_module=accounts,
        voucher_name="Journal Voucher",
    )

    with pytest.raises(ValidationError):
        ResponsiblePersonMapping.objects.create(
            erp_module=store,
            voucher_type=voucher,
            responsible_person=ResponsiblePersonUserFactory(),
        )


@pytest.mark.django_db
def test_active_responsible_person_mapping_route_is_unique(
):
    module = ErpModule.objects.create(
        module_name="Accounts"
    )
    responsible_person = ResponsiblePersonUserFactory()
    ResponsiblePersonMapping.objects.create(
        erp_module=module,
        responsible_person=responsible_person,
    )

    with pytest.raises(ValidationError):
        ResponsiblePersonMapping.objects.create(
            erp_module=module,
            responsible_person=ResponsiblePersonUserFactory(),
        )


@pytest.mark.django_db
def test_request_field_configuration_normalizes_and_scopes_field(
):
    module = ErpModule.objects.create(
        module_name="Accounts"
    )
    config = RequestFieldConfiguration.objects.create(
        field_label=" Voucher   Number ",
        field_state=RequestFieldState.REQUIRED,
        erp_module=module,
        help_text="  Enter voucher number  ",
        display_order=5,
    )

    assert config.field_key == "VN"
    assert config.field_label == "Voucher Number"
    assert config.help_text == "Enter voucher number"
    assert config.field_state == RequestFieldState.REQUIRED


@pytest.mark.django_db
def test_request_field_configuration_rejects_duplicate_active_scope(
):
    module = ErpModule.objects.create(
        module_name="Accounts"
    )
    RequestFieldConfiguration.objects.create(
        field_key="VOUCHER_NUMBER",
        field_label="Voucher Number",
        field_state=RequestFieldState.REQUIRED,
        erp_module=module,
    )

    with pytest.raises(ValidationError):
        RequestFieldConfiguration.objects.create(
            field_key="VOUCHER_NUMBER",
            field_label="Voucher Number",
            field_state=RequestFieldState.OPTIONAL,
            erp_module=module,
        )


@pytest.mark.django_db
def test_request_field_configuration_validates_voucher_module_scope(
):
    accounts = ErpModule.objects.create(
        module_name="Accounts"
    )
    store = ErpModule.objects.create(
        module_name="Store"
    )
    voucher = VoucherType.objects.create(
        erp_module=accounts,
        voucher_name="Journal Voucher",
    )

    with pytest.raises(ValidationError):
        RequestFieldConfiguration.objects.create(
            field_label="Voucher Number",
            field_state=RequestFieldState.REQUIRED,
            erp_module=store,
            voucher_type=voucher,
        )


def test_erp_models_are_registered_in_django_admin():
    assert ErpModule in admin.site._registry
    assert VoucherType in admin.site._registry
    assert WorkType in admin.site._registry
    assert ReasonCategory in admin.site._registry
    assert Priority in admin.site._registry
    assert ResponsiblePersonMapping in admin.site._registry
    assert RequestFieldConfiguration in admin.site._registry
