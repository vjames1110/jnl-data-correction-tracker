"""
Per-activity review sign-off: a lightweight "Director or Project
Manager looked at this row and confirmed it" record, entirely
separate from editing - entry-role users can add/edit at any time,
reviewing never gates that. A review is optional per activity and
can be applied to every activity on a Structure/Building at once via
``review_activities`` (the "review all" button on that sheet).
Re-reviewing simply overwrites the previous sign-off.
"""

from django.utils import timezone

from apps.project_monitor.models import (
    Activity,
    ActivityComment,
)


def apply_review(
    activity: Activity, *, remarks: str = "", actor
) -> Activity:
    remarks = (remarks or "").strip()
    now = timezone.now()

    activity.reviewed_by = actor
    activity.reviewed_at = now
    activity.review_remarks = remarks
    activity.save(
        update_fields=[
            "reviewed_by",
            "reviewed_at",
            "review_remarks",
            "updated_at",
        ]
    )

    comment_text = (
        f"Reviewed by {actor.full_name}"
    )
    if remarks:
        comment_text += f": {remarks}"

    ActivityComment.objects.create(
        activity=activity,
        meeting_date=now.date(),
        text=comment_text,
        created_by=actor,
    )
    return activity


def review_activities(
    activities, *, remarks: str = "", actor
) -> list[Activity]:
    return [
        apply_review(
            activity, remarks=remarks, actor=actor
        )
        for activity in activities
    ]
