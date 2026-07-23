from apps.corrections.models import (
    CorrectionRequest,
    CorrectionRequestTimeline,
)


def record_timeline(
    *,
    request: CorrectionRequest,
    event_type: str,
    actor=None,
    from_status: str = "",
    to_status: str = "",
    comment: str = "",
    metadata: dict | None = None,
) -> CorrectionRequestTimeline:
    return CorrectionRequestTimeline.objects.create(
        request=request,
        actor=actor,
        event_type=event_type,
        from_status=from_status,
        to_status=to_status,
        comment=comment,
        metadata=metadata or {},
    )
