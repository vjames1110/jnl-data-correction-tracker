from datetime import timedelta

from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.corrections.models import (
    CorrectionRequest,
    CorrectionRequestStatus,
    CorrectionTimelineEventType,
)
from apps.corrections.services.drafts import (
    validate_draft_access,
)
from apps.corrections.services.duplicates import (
    find_duplicate_requests,
)
from apps.corrections.services.timeline import (
    record_timeline,
)
from apps.employees.models import EmployeeProfile
from apps.erp.models import ResponsiblePersonMapping
from apps.organization.models import (
    ApprovalAuthorityType,
    DirectorMapping,
)


BASE_REQUIRED_FIELDS = {
    "site": "Site is required.",
    "department": "Department is required.",
    "erp_module": "ERP module is required.",
    "voucher_type": "Voucher type is required.",
    "work_type": "Work type is required.",
    "voucher_number": "Voucher number is required.",
    "voucher_date": "Voucher date is required.",
    "erp_email_date": "ERP email date is required.",
    "description": "Description is required.",
    "reason_category": "Reason category is required.",
    "priority": "Priority is required.",
}


def submit_request(
    *,
    draft: CorrectionRequest,
    user,
    override_duplicates: bool = False,
    duplicate_override_reason: str = "",
) -> CorrectionRequest:
    validate_draft_access(
        draft=draft,
        user=user,
    )

    with transaction.atomic():
        locked_draft = (
            CorrectionRequest.objects.select_for_update()
            .select_related(
                "requester",
                "site",
                "site__site_director",
                "site__site_hod",
                "department",
                "department__department_hod",
                "erp_module",
                "voucher_type",
                "work_type",
                "reason_category",
                "priority",
            )
            .get(pk=draft.pk)
        )
        validate_draft_access(
            draft=locked_draft,
            user=user,
        )

        _validate_submission_fields(locked_draft)
        _validate_user_organization(
            request=locked_draft,
            user=user,
        )
        _validate_voucher(locked_draft)

        responsible_mapping = _find_responsible_mapping(
            locked_draft
        )
        if (
            not locked_draft.work_type.requires_approval
            and responsible_mapping is None
        ):
            raise ValidationError(
                {
                    "responsible_mapping": (
                        "No active responsible-person mapping "
                        "matches this request."
                    )
                }
            )

        approval_owner = _find_approval_owner(
            locked_draft
        )
        if (
            locked_draft.work_type.requires_approval
            and approval_owner is None
        ):
            raise ValidationError(
                {
                    "approval_configuration": (
                        "No active primary director mapping "
                        "matches this request."
                    )
                }
            )

        duplicate_matches = find_duplicate_requests(
            request=locked_draft
        )
        override_reason = (
            duplicate_override_reason or ""
        ).strip()
        if duplicate_matches and not override_duplicates:
            raise ValidationError(
                {
                    "duplicate_requests": duplicate_matches,
                    "override_duplicates": (
                        "Confirm duplicate override with "
                        "a reason to submit this request."
                    ),
                }
            )

        if duplicate_matches and len(override_reason) < 10:
            raise ValidationError(
                {
                    "duplicate_override_reason": (
                        "Enter at least 10 characters explaining "
                        "why the duplicate should be allowed."
                    )
                }
            )

        from_status = locked_draft.current_status
        if locked_draft.work_type.requires_approval:
            to_status = (
                CorrectionRequestStatus.PENDING_APPROVAL
            )
            current_owner = approval_owner
        else:
            to_status = CorrectionRequestStatus.ASSIGNED
            current_owner = (
                responsible_mapping.responsible_person
            )

        now = timezone.now()
        locked_draft.current_status = to_status
        locked_draft.current_owner = current_owner
        locked_draft.submitted_at = now
        locked_draft.duplicate_override_reason = (
            override_reason
        )
        locked_draft.sla_deadline = now + timedelta(
            hours=locked_draft.priority.sla_duration_hours
        )

        _save_or_raise(locked_draft)

        record_timeline(
            request=locked_draft,
            actor=user,
            event_type=CorrectionTimelineEventType.SUBMITTED,
            from_status=from_status,
            to_status=to_status,
            comment="Correction request submitted.",
            metadata={
                "duplicate_override": bool(
                    duplicate_matches
                ),
                "duplicate_references": [
                    item["reference"]
                    for item in duplicate_matches
                ],
                "responsible_mapping_id": str(
                    responsible_mapping.id
                )
                if responsible_mapping
                else "",
                "approval_owner_id": (
                    str(approval_owner.id)
                    if approval_owner
                    else ""
                ),
            },
        )

        if to_status == CorrectionRequestStatus.ASSIGNED:
            record_timeline(
                request=locked_draft,
                actor=user,
                event_type=(
                    CorrectionTimelineEventType.ASSIGNED
                ),
                from_status=from_status,
                to_status=to_status,
                comment="Request assigned after submission.",
                metadata={
                    "assigned_to": str(current_owner.id),
                    "responsible_mapping_id": str(
                        responsible_mapping.id
                    )
                    if responsible_mapping
                    else "",
                },
            )

        return locked_draft


def preview_duplicates(
    *,
    draft: CorrectionRequest,
    user,
) -> list[dict]:
    validate_draft_access(
        draft=draft,
        user=user,
    )
    return find_duplicate_requests(
        request=draft
    )


def _validate_submission_fields(
    request: CorrectionRequest,
) -> None:
    errors = {}

    for field, message in BASE_REQUIRED_FIELDS.items():
        value = getattr(request, f"{field}_id", None)
        if value is None:
            value = getattr(request, field, None)
        if value is None or value == "":
            errors[field] = message

    if (
        request.voucher_type_id
        and request.voucher_type.requires_amount
        and request.amount is None
    ):
        errors["amount"] = (
            "Amount is required for this voucher type."
        )

    if (
        request.voucher_type_id
        and request.voucher_type.requires_quantity
        and request.quantity is None
    ):
        errors["quantity"] = (
            "Quantity is required for this voucher type."
        )

    if errors:
        raise ValidationError(errors)


def _validate_user_organization(
    *,
    request: CorrectionRequest,
    user,
) -> None:
    try:
        profile = user.employee_profile
    except EmployeeProfile.DoesNotExist as exc:
        raise ValidationError(
            {
                "requester": (
                    "Requester employee profile is required."
                )
            }
        ) from exc

    errors = {}
    if not profile.is_active:
        errors["requester"] = (
            "Requester employee profile must be active."
        )

    if errors:
        raise ValidationError(errors)


def _validate_voucher(
    request: CorrectionRequest,
) -> None:
    errors = {}

    if (
        request.erp_module_id
        and not request.erp_module.is_active
    ):
        errors["erp_module"] = (
            "Selected ERP module is inactive."
        )

    if (
        request.voucher_type_id
        and not request.voucher_type.is_active
    ):
        errors["voucher_type"] = (
            "Selected voucher type is inactive."
        )

    if (
        request.voucher_type_id
        and request.erp_module_id
        and request.voucher_type.erp_module_id
        != request.erp_module_id
    ):
        errors["voucher_type"] = (
            "Voucher type must belong to the selected ERP module."
        )

    if (
        request.voucher_type_id
        and request.department_id
        and request.voucher_type.department_id
        and request.voucher_type.department_id
        != request.department_id
    ):
        errors["department"] = (
            "Department must match the selected voucher type."
        )

    if errors:
        raise ValidationError(errors)


def _find_approval_owner(
    request: CorrectionRequest,
):
    today = timezone.localdate()
    queryset = DirectorMapping.objects.filter(
        is_active=True,
        authority_type=ApprovalAuthorityType.PRIMARY,
    ).filter(
        Q(effective_from__isnull=True)
        | Q(effective_from__lte=today),
        Q(effective_to__isnull=True)
        | Q(effective_to__gte=today),
    )

    site_mapping = (
        queryset.filter(site_id=request.site_id)
        .order_by("-effective_from", "created_at")
        .first()
    )
    if site_mapping:
        return site_mapping.director

    department_mapping = (
        queryset.filter(department_id=request.department_id)
        .order_by("-effective_from", "created_at")
        .first()
    )
    if department_mapping:
        return department_mapping.director

    if request.site_id and request.site.site_director_id:
        return request.site.site_director

    if (
        request.department_id
        and request.department.department_hod_id
    ):
        return request.department.department_hod

    return None


def _find_responsible_mapping(
    request: CorrectionRequest,
):
    queryset = ResponsiblePersonMapping.objects.filter(
        is_active=True,
        erp_module_id=request.erp_module_id,
    ).filter(
        Q(voucher_type__isnull=True)
        | Q(voucher_type_id=request.voucher_type_id),
        Q(department__isnull=True)
        | Q(department_id=request.department_id),
        Q(site__isnull=True) | Q(site_id=request.site_id),
        Q(work_type__isnull=True)
        | Q(work_type_id=request.work_type_id),
        Q(priority__isnull=True)
        | Q(priority_id=request.priority_id),
    )

    candidates = list(queryset)
    if not candidates:
        return None

    return sorted(
        candidates,
        key=_mapping_specificity,
        reverse=True,
    )[0]


def _mapping_specificity(
    mapping: ResponsiblePersonMapping,
) -> tuple[int, int]:
    fields = [
        mapping.voucher_type_id,
        mapping.department_id,
        mapping.site_id,
        mapping.work_type_id,
        mapping.priority_id,
    ]
    return (
        sum(1 for value in fields if value),
        -mapping.display_order,
    )


def _save_or_raise(
    request: CorrectionRequest,
) -> None:
    try:
        request.save()
    except DjangoValidationError as exc:
        raise ValidationError(
            getattr(exc, "message_dict", None)
            or exc.messages
        ) from exc
