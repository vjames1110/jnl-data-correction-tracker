from difflib import SequenceMatcher

from apps.corrections.models import (
    CorrectionRequest,
    CorrectionRequestStatus,
)


OPEN_REQUEST_STATUSES = {
    CorrectionRequestStatus.SUBMITTED,
    CorrectionRequestStatus.PENDING_APPROVAL,
    CorrectionRequestStatus.APPROVED,
    CorrectionRequestStatus.ASSIGNED,
    CorrectionRequestStatus.IN_PROGRESS,
    CorrectionRequestStatus.RESOLVED,
    CorrectionRequestStatus.REOPENED,
}

DESCRIPTION_SIMILARITY_THRESHOLD = 0.72


def find_duplicate_requests(
    *,
    request: CorrectionRequest,
) -> list[dict]:
    queryset = (
        CorrectionRequest.objects.filter(
            requester_id=request.requester_id,
            is_deleted=False,
            current_status__in=OPEN_REQUEST_STATUSES,
        )
        .exclude(pk=request.pk)
        .select_related(
            "voucher_type",
            "work_type",
            "requester",
        )
    )

    if request.voucher_type_id:
        queryset = queryset.filter(
            voucher_type_id=request.voucher_type_id
        )

    matches = []
    request_description = _normalize(
        request.description
    )

    for candidate in queryset:
        score = 0.0
        reasons = ["Same requester"]
        score += 0.20

        # The queryset above is only actually filtered by voucher
        # type when the request has one set - crediting every
        # candidate with "Same voucher type" regardless (e.g. while
        # previewing duplicates on a draft with no voucher type yet)
        # inflates scores and mislabels unrelated requests.
        if request.voucher_type_id:
            score += 0.20
            reasons.append("Same voucher type")

        if (
            request.voucher_number
            and candidate.voucher_number
            and _normalize(candidate.voucher_number)
            == _normalize(request.voucher_number)
        ):
            score += 0.45
            reasons.append("Same voucher number")

        if (
            request.work_type_id
            and candidate.work_type_id
            == request.work_type_id
        ):
            score += 0.20
            reasons.append("Same action/work type")

        if request_description:
            description_score = SequenceMatcher(
                None,
                request_description,
                _normalize(candidate.description),
            ).ratio()
            if (
                description_score
                >= DESCRIPTION_SIMILARITY_THRESHOLD
            ):
                score += 0.35
                reasons.append("Similar description")

        if score >= 0.65:
            matches.append(
                {
                    "id": str(candidate.id),
                    "reference": candidate.reference,
                    "current_status": (
                        candidate.current_status
                    ),
                    "voucher_number": (
                        candidate.voucher_number
                    ),
                    "score": round(score, 2),
                    "reasons": reasons,
                }
            )

    return sorted(
        matches,
        key=lambda item: item["score"],
        reverse=True,
    )


def _normalize(value: str) -> str:
    return " ".join(
        (value or "").strip().lower().split()
    )
