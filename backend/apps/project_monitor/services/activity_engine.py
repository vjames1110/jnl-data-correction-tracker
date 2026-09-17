"""
The one generic update engine shared by every Activity, regardless of
which module (Structures/Buildings/Girders/Action Items) generated
it - a direct port of the prototype's ``applyUpdate``/``histHTML``/
``logHTML`` trio. See ``apps.project_monitor.models.Activity`` for why
this reuse matters.
"""

from apps.project_monitor.models import (
    Activity,
    ActivityComment,
    ActivityDateEntry,
    ActivityKind,
    ActivityStatus,
)


def _fmt(value):
    return value.strftime("%d-%m-%Y") if value else "-"


def _fmt_qty(value):
    """
    ``done_qty`` is stored as a 3-decimal-place Decimal, but the
    prototype's log lines show plain numbers ("40% done", not
    "40.000% done") - strip trailing zeros the way a JS number
    would, without falling into Decimal's scientific notation for
    whole numbers (``Decimal("40").normalize()`` -> ``4E+1``).
    """
    text = format(value, "f")
    if "." in text:
        text = text.rstrip("0").rstrip(".")
    return text


def current_target_date(activity: Activity):
    """
    The most recently set target date for this activity, or ``None``
    if it's never had one - mirrors the prototype's
    ``row.dates[row.dates.length-1]``.
    """
    entry = (
        activity.date_entries.order_by(
            "-id"
        ).first()
    )
    return entry.target_date if entry else None


def apply_update(
    activity: Activity,
    *,
    meeting_date,
    new_target_date=None,
    status: str | None = None,
    done_qty=None,
    comment: str = "",
    is_hindrance: bool | None = None,
    hindrance_expected_removal_date=None,
    hindrance_actual_removal_date=None,
    hindrance_remarks: str | None = None,
    actor=None,
) -> Activity:
    """
    Apply everything that changed for ``activity`` in this one
    meeting-update action as ONE composed, dated log line - not
    separate uncorrelated edits. Revising the target date keeps the
    old one (visible struck through via ``date_entries`` history);
    status/done-qty changes and the free-text comment all fold into
    the same ``ActivityComment`` row.
    """
    notes = []
    current_date = current_target_date(activity)
    if actor is not None:
        activity.updated_by = actor

    if new_target_date and new_target_date != current_date:
        ActivityDateEntry.objects.create(
            activity=activity,
            target_date=new_target_date,
            meeting_date=meeting_date,
        )
        notes.append(
            f"Date revised {_fmt(current_date)} -> "
            f"{_fmt(new_target_date)}"
            if current_date
            else f"Target set {_fmt(new_target_date)}"
        )

    if status and status != activity.status:
        activity.status = status
        if status == ActivityStatus.COMPLETE:
            activity.completed_on = meeting_date
        notes.append(
            f"Status: {ActivityStatus(status).label}"
        )

    if (
        done_qty is not None
        and done_qty != activity.done_qty
    ):
        activity.done_qty = done_qty
        if activity.kind == ActivityKind.LENGTH:
            notes.append(
                f"Done {_fmt_qty(done_qty)} "
                f"{activity.unit}".strip()
            )
        else:
            notes.append(
                f"{_fmt_qty(done_qty)}% done"
            )

    if (
        is_hindrance is not None
        and is_hindrance != activity.is_hindrance
    ):
        activity.is_hindrance = is_hindrance
        notes.append(
            "Marked as hindrance (Railways/"
            "Authority)"
            if is_hindrance
            else "Hindrance cleared"
        )

    if (
        hindrance_expected_removal_date
        is not None
        and hindrance_expected_removal_date
        != activity.hindrance_expected_removal_date
    ):
        activity.hindrance_expected_removal_date = (
            hindrance_expected_removal_date
        )
        notes.append(
            "Hindrance expected removal: "
            f"{_fmt(hindrance_expected_removal_date)}"
        )

    if (
        hindrance_actual_removal_date
        is not None
        and hindrance_actual_removal_date
        != activity.hindrance_actual_removal_date
    ):
        activity.hindrance_actual_removal_date = (
            hindrance_actual_removal_date
        )
        notes.append(
            "Hindrance removed on: "
            f"{_fmt(hindrance_actual_removal_date)}"
        )

    if hindrance_remarks is not None:
        hindrance_remarks = (
            hindrance_remarks.strip()
        )
        if (
            hindrance_remarks
            and hindrance_remarks
            != activity.hindrance_remarks
        ):
            activity.hindrance_remarks = (
                hindrance_remarks
            )
            notes.append(
                f"Hindrance remark: {hindrance_remarks}"
            )

    comment = (comment or "").strip()
    if comment:
        notes.append(comment)

    activity.save()

    if notes:
        ActivityComment.objects.create(
            activity=activity,
            meeting_date=meeting_date,
            text=" · ".join(notes),
            created_by=actor,
            updated_by=actor,
        )

    return activity


def apply_material_status_update(
    activity: Activity,
    *,
    material_status: str,
    meeting_date,
    actor=None,
) -> Activity:
    """
    Material status is tracked and logged independently of the
    physical-progress update above - the prototype logs it as its
    own comment line when it changes, separately from a same-save
    date/status/qty change.
    """
    if (
        not activity.material_tracked
        or material_status == activity.material_status
    ):
        return activity

    from apps.project_monitor.models import (
        MaterialStatus,
    )

    activity.material_status = material_status
    activity.save()
    ActivityComment.objects.create(
        activity=activity,
        meeting_date=meeting_date,
        text=(
            "Material: "
            f"{MaterialStatus(material_status).label}"
        ),
        created_by=actor,
        updated_by=actor,
    )
    return activity
