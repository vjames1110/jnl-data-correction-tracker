from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import (
    NotFound,
    PermissionDenied,
    ValidationError,
)

from apps.corrections.models import (
    CorrectionRequest,
    CorrectionRequestStatus,
    CorrectionTimelineEventType,
)
from apps.corrections.services.timeline import (
    record_timeline,
)


DRAFT_MUTABLE_FIELDS = {
    "site",
    "department",
    "voucher_type",
    "erp_module",
    "work_type",
    "voucher_number",
    "voucher_date",
    "erp_email_date",
    "description",
    "reason_category",
    "priority",
    "requested_window_start",
    "requested_window_end",
    "amount",
    "quantity",
}


def create_draft(
    *,
    requester,
    data: dict,
) -> CorrectionRequest:
    payload = _draft_payload(data)

    with transaction.atomic():
        draft = CorrectionRequest(
            requester=requester,
            current_owner=requester,
            current_status=CorrectionRequestStatus.DRAFT,
            **payload,
        )
        _save_or_raise(draft)
        record_timeline(
            request=draft,
            actor=requester,
            event_type=(
                CorrectionTimelineEventType.DRAFT_CREATED
            ),
            to_status=CorrectionRequestStatus.DRAFT,
            comment="Draft correction request created.",
        )
        return draft


def update_draft(
    *,
    draft: CorrectionRequest,
    user,
    data: dict,
) -> CorrectionRequest:
    validate_draft_access(
        draft=draft,
        user=user,
    )

    payload = _draft_payload(data)

    with transaction.atomic():
        locked_draft = (
            CorrectionRequest.objects.select_for_update(
                of=("self",)
            )
            .select_related("requester")
            .get(pk=draft.pk)
        )
        validate_draft_access(
            draft=locked_draft,
            user=user,
        )

        for field, value in payload.items():
            setattr(locked_draft, field, value)

        _save_or_raise(locked_draft)
        return locked_draft


def delete_draft(
    *,
    draft: CorrectionRequest,
    user,
) -> CorrectionRequest:
    validate_draft_access(
        draft=draft,
        user=user,
    )

    with transaction.atomic():
        locked_draft = (
            CorrectionRequest.objects.select_for_update(
                of=("self",)
            )
            .select_related("requester")
            .get(pk=draft.pk)
        )
        validate_draft_access(
            draft=locked_draft,
            user=user,
        )
        locked_draft.is_deleted = True
        locked_draft.deleted_at = timezone.now()
        locked_draft.deleted_by = user
        locked_draft.save(
            update_fields=[
                "is_deleted",
                "deleted_at",
                "deleted_by",
                "updated_at",
            ]
        )
        return locked_draft


def get_owned_draft_or_404(
    *,
    draft_id,
    user,
) -> CorrectionRequest:
    try:
        draft = CorrectionRequest.objects.select_related(
            "requester",
            "current_owner",
            "site",
            "department",
            "voucher_type",
            "erp_module",
            "work_type",
            "reason_category",
            "priority",
        ).get(
            id=draft_id,
            is_deleted=False,
        )
    except CorrectionRequest.DoesNotExist as exc:
        raise NotFound(
            "Draft correction request was not found."
        ) from exc

    validate_draft_access(
        draft=draft,
        user=user,
    )
    return draft


def validate_draft_access(
    *,
    draft: CorrectionRequest,
    user,
) -> None:
    if draft.requester_id != user.id:
        raise PermissionDenied(
            "Only the draft requester can modify this draft."
        )

    if draft.is_deleted:
        raise ValidationError(
            "Deleted drafts cannot be modified."
        )

    if not draft.is_draft:
        raise ValidationError(
            "Only draft correction requests are editable."
        )


def _draft_payload(data: dict) -> dict:
    return {
        key: value
        for key, value in data.items()
        if key in DRAFT_MUTABLE_FIELDS
    }


def _save_or_raise(
    draft: CorrectionRequest,
) -> None:
    try:
        draft.save()
    except DjangoValidationError as exc:
        raise ValidationError(
            getattr(exc, "message_dict", None)
            or exc.messages
        ) from exc
