import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from apps.authentication.tests.factories import (
    AdminUserFactory,
    ResponsiblePersonUserFactory,
    UserFactory,
)
from apps.erp.models import (
    ErpModule,
    Priority,
    ReasonCategory,
    RequestFieldState,
    VoucherType,
    WorkType,
)
from apps.organization.models import (
    Company,
    Department,
)


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def erp_master_data():
    company = Company.objects.create(
        company_code="JNL",
        company_name="Jhajharia Nirman Limited",
    )
    department = Department.objects.create(
        company=company,
        department_name="Accounts",
    )
    module = ErpModule.objects.create(
        module_name="Accounts",
        display_order=10,
    )
    module.departments.add(department)
    inactive_module = ErpModule.objects.create(
        module_name="Store",
        is_active=False,
    )
    voucher = VoucherType.objects.create(
        erp_module=module,
        department=department,
        voucher_name="Journal Voucher",
        requires_amount=True,
    )
    work_type = WorkType.objects.create(
        work_type_name="Edit",
    )
    reason = ReasonCategory.objects.create(
        reason_name="Wrong Amount",
    )
    priority = Priority.objects.create(
        priority_name="Normal",
        sla_duration_hours=24,
        escalation_duration_hours=12,
        display_order=20,
    )
    responsible_person = ResponsiblePersonUserFactory(
        employee_id="RESP001",
        first_name="ERP",
        last_name="Owner",
    )

    return {
        "company": company,
        "department": department,
        "module": module,
        "inactive_module": inactive_module,
        "voucher": voucher,
        "work_type": work_type,
        "reason": reason,
        "priority": priority,
        "responsible_person": responsible_person,
    }


@pytest.mark.django_db
def test_normal_user_can_list_only_active_erp_modules(
    api_client,
    erp_master_data,
):
    user = UserFactory()
    api_client.force_authenticate(user=user)

    response = api_client.get(
        reverse("erp-api:modules-list")
    )

    assert response.status_code == status.HTTP_200_OK
    module_codes = {
        item["module_code"]
        for item in response.data["data"]
    }
    assert erp_master_data[
        "module"
    ].module_code in module_codes
    assert erp_master_data[
        "inactive_module"
    ].module_code not in module_codes


@pytest.mark.django_db
def test_normal_user_cannot_manage_erp_masters(
    api_client,
):
    user = UserFactory()
    api_client.force_authenticate(user=user)

    response = api_client.post(
        reverse("erp-api:modules-list"),
        {
            "module_name": "Purchase",
        },
        format="json",
    )

    assert (
        response.status_code
        == status.HTTP_403_FORBIDDEN
    )


@pytest.mark.django_db
def test_admin_can_create_erp_module_with_department_mapping(
    api_client,
    erp_master_data,
):
    admin_user = AdminUserFactory()
    api_client.force_authenticate(user=admin_user)

    response = api_client.post(
        reverse("erp-api:modules-list"),
        {
            "module_name": "Purchase",
            "description": " Purchase module ",
            "departments": [
                str(
                    erp_master_data[
                        "department"
                    ].id
                )
            ],
            "display_order": 20,
        },
        format="json",
    )

    assert (
        response.status_code
        == status.HTTP_201_CREATED
    )
    assert response.data["data"]["module_code"] == "PUR"
    assert (
        response.data["data"]["description"]
        == "Purchase module"
    )
    assert (
        response.data["data"]["department_details"][0][
            "code"
        ]
        == "ACC"
    )


@pytest.mark.django_db
def test_admin_can_create_voucher_type(
    api_client,
    erp_master_data,
):
    admin_user = AdminUserFactory()
    api_client.force_authenticate(user=admin_user)

    response = api_client.post(
        reverse("erp-api:voucher-types-list"),
        {
            "voucher_name": "Purchase Order",
            "erp_module": str(
                erp_master_data["module"].id
            ),
            "department": str(
                erp_master_data[
                    "department"
                ].id
            ),
            "requires_voucher_number": True,
            "requires_voucher_date": True,
            "requires_amount": True,
            "requires_quantity": False,
        },
        format="json",
    )

    assert (
        response.status_code
        == status.HTTP_201_CREATED
    )
    assert response.data["data"]["voucher_code"] == "PO"
    assert (
        response.data["data"]["erp_module_code"]
        == erp_master_data["module"].module_code
    )
    assert (
        response.data["data"]["department_code"]
        == "ACC"
    )


@pytest.mark.django_db
def test_admin_can_create_work_type_and_toggle_active_state(
    api_client,
):
    admin_user = AdminUserFactory()
    api_client.force_authenticate(user=admin_user)

    create_response = api_client.post(
        reverse("erp-api:work-types-list"),
        {
            "work_type_name": "Cancel",
            "requires_approval": True,
        },
        format="json",
    )
    work_type_id = create_response.data["data"]["id"]
    deactivate_response = api_client.post(
        reverse(
            "erp-api:work-types-deactivate",
            args=[work_type_id],
        )
    )
    activate_response = api_client.post(
        reverse(
            "erp-api:work-types-activate",
            args=[work_type_id],
        )
    )

    assert (
        create_response.status_code
        == status.HTTP_201_CREATED
    )
    assert (
        create_response.data["data"]["work_type_code"]
        == "CAN"
    )
    assert (
        deactivate_response.data["data"]["is_active"]
        is False
    )
    assert (
        activate_response.data["data"]["is_active"]
        is True
    )


@pytest.mark.django_db
def test_erp_dropdown_and_export_endpoints_return_master_data(
    api_client,
    erp_master_data,
):
    admin_user = AdminUserFactory()
    api_client.force_authenticate(user=admin_user)

    dropdown_response = api_client.get(
        reverse("erp-api:modules-dropdown")
    )
    export_response = api_client.get(
        reverse("erp-api:voucher-types-export"),
        {
            "erp_module": str(
                erp_master_data["module"].id
            ),
        },
    )

    assert (
        dropdown_response.status_code
        == status.HTTP_200_OK
    )
    assert (
        dropdown_response.data["data"][0]["code"]
        == "ACC"
    )
    assert (
        export_response.status_code
        == status.HTTP_200_OK
    )
    assert (
        export_response.data["data"][0][
            "voucher_code"
        ]
        == "JV"
    )


@pytest.mark.django_db
def test_admin_can_create_reason_category(
    api_client,
):
    admin_user = AdminUserFactory()
    api_client.force_authenticate(user=admin_user)

    response = api_client.post(
        reverse("erp-api:reason-categories-list"),
        {
            "reason_name": "Wrong Site",
            "description": "Site selected incorrectly",
            "display_order": 30,
        },
        format="json",
    )

    assert (
        response.status_code
        == status.HTTP_201_CREATED
    )
    assert response.data["data"]["reason_code"] == "WS"
    assert (
        response.data["data"]["reason_name"]
        == "Wrong Site"
    )


@pytest.mark.django_db
def test_admin_can_scope_reason_category_to_voucher_types(
    api_client,
    erp_master_data,
):
    admin_user = AdminUserFactory()
    api_client.force_authenticate(user=admin_user)
    voucher_id = str(
        erp_master_data["voucher"].id
    )

    response = api_client.post(
        reverse("erp-api:reason-categories-list"),
        {
            "reason_name": "Wrong Ledger",
            "voucher_types": [voucher_id],
        },
        format="json",
    )

    assert (
        response.status_code
        == status.HTTP_201_CREATED
    )
    assert [
        str(item)
        for item in response.data["data"][
            "voucher_types"
        ]
    ] == [voucher_id]
    assert (
        response.data["data"][
            "voucher_type_details"
        ][0]["id"]
        == voucher_id
    )


@pytest.mark.django_db
def test_admin_can_create_priority(
    api_client,
):
    admin_user = AdminUserFactory()
    api_client.force_authenticate(user=admin_user)

    response = api_client.post(
        reverse("erp-api:priorities-list"),
        {
            "priority_name": "Critical",
            "sla_duration_hours": 8,
            "escalation_duration_hours": 4,
            "display_order": 1,
        },
        format="json",
    )

    assert (
        response.status_code
        == status.HTTP_201_CREATED
    )
    assert response.data["data"]["priority_code"] == "CRI"
    assert (
        response.data["data"]["sla_duration_hours"]
        == 8
    )


@pytest.mark.django_db
def test_priority_api_rejects_invalid_escalation_duration(
    api_client,
):
    admin_user = AdminUserFactory()
    api_client.force_authenticate(user=admin_user)

    response = api_client.post(
        reverse("erp-api:priorities-list"),
        {
            "priority_name": "Invalid",
            "sla_duration_hours": 4,
            "escalation_duration_hours": 8,
        },
        format="json",
    )

    assert (
        response.status_code
        == status.HTTP_400_BAD_REQUEST
    )
    assert response.data["error_code"] == "VALIDATION_ERROR"


@pytest.mark.django_db
def test_admin_can_create_responsible_person_mapping(
    api_client,
    erp_master_data,
):
    admin_user = AdminUserFactory()
    api_client.force_authenticate(user=admin_user)

    response = api_client.post(
        reverse(
            "erp-api:responsible-person-mappings-list"
        ),
        {
            "erp_module": str(
                erp_master_data["module"].id
            ),
            "voucher_type": str(
                erp_master_data["voucher"].id
            ),
            "department": str(
                erp_master_data[
                    "department"
                ].id
            ),
            "work_type": str(
                erp_master_data["work_type"].id
            ),
            "priority": str(
                erp_master_data["priority"].id
            ),
            "responsible_person": str(
                erp_master_data[
                    "responsible_person"
                ].id
            ),
            "display_order": 10,
        },
        format="json",
    )

    assert (
        response.status_code
        == status.HTTP_201_CREATED
    )
    assert (
        response.data["data"]["erp_module_code"]
        == erp_master_data["module"].module_code
    )
    assert (
        response.data["data"][
            "responsible_person_detail"
        ]["employee_id"]
        == "RESP001"
    )


@pytest.mark.django_db
def test_responsible_person_mapping_api_rejects_non_responsible_user(
    api_client,
    erp_master_data,
):
    admin_user = AdminUserFactory()
    api_client.force_authenticate(user=admin_user)

    response = api_client.post(
        reverse(
            "erp-api:responsible-person-mappings-list"
        ),
        {
            "erp_module": str(
                erp_master_data["module"].id
            ),
            "responsible_person": str(admin_user.id),
        },
        format="json",
    )

    assert (
        response.status_code
        == status.HTTP_400_BAD_REQUEST
    )
    assert response.data["error_code"] == "VALIDATION_ERROR"


@pytest.mark.django_db
def test_admin_can_create_request_field_configuration(
    api_client,
    erp_master_data,
):
    admin_user = AdminUserFactory()
    api_client.force_authenticate(user=admin_user)

    response = api_client.post(
        reverse(
            "erp-api:request-field-configurations-list"
        ),
        {
            "field_label": "Voucher Number",
            "field_state": RequestFieldState.REQUIRED,
            "erp_module": str(
                erp_master_data["module"].id
            ),
            "voucher_type": str(
                erp_master_data["voucher"].id
            ),
            "work_type": str(
                erp_master_data["work_type"].id
            ),
            "priority": str(
                erp_master_data["priority"].id
            ),
            "help_text": "Enter ERP voucher number",
            "display_order": 10,
        },
        format="json",
    )

    assert (
        response.status_code
        == status.HTTP_201_CREATED
    )
    assert response.data["data"]["field_key"] == "VN"
    assert (
        response.data["data"]["field_state"]
        == RequestFieldState.REQUIRED
    )
    assert (
        response.data["data"]["erp_module_code"]
        == erp_master_data["module"].module_code
    )


@pytest.mark.django_db
def test_request_field_configuration_api_rejects_duplicate_scope(
    api_client,
    erp_master_data,
):
    admin_user = AdminUserFactory()
    api_client.force_authenticate(user=admin_user)

    payload = {
        "field_key": "VOUCHER_NUMBER",
        "field_label": "Voucher Number",
        "field_state": RequestFieldState.REQUIRED,
        "erp_module": str(
            erp_master_data["module"].id
        ),
    }
    first_response = api_client.post(
        reverse(
            "erp-api:request-field-configurations-list"
        ),
        payload,
        format="json",
    )
    second_response = api_client.post(
        reverse(
            "erp-api:request-field-configurations-list"
        ),
        {
            **payload,
            "field_state": RequestFieldState.OPTIONAL,
        },
        format="json",
    )

    assert (
        first_response.status_code
        == status.HTTP_201_CREATED
    )
    assert (
        second_response.status_code
        == status.HTTP_400_BAD_REQUEST
    )
