"""
Action Items are the plainest use of the shared Activity engine - a
single bare ``Activity`` row (no groups, no material tag, no doc-
type rendering) per item. Creation just needs to make that one row
and, if a target date was given up front, log it through the same
``apply_update`` every meeting-update action already goes through -
no separate "initial date" code path.
"""

from decimal import Decimal

from django.contrib.contenttypes.models import ContentType
from django.utils import timezone

from apps.project_monitor.models import (
    Activity,
    ActivityKind,
    ActivityStatus,
    ActionItem,
)
from apps.project_monitor.services.activity_engine import (
    apply_update,
)


def create_action_item(
    *,
    site,
    name,
    responsibility="",
    remarks="",
    target_date=None,
    actor,
):
    item = ActionItem.objects.create(
        site=site,
        responsibility=responsibility or "",
        remarks=remarks or "",
        created_by=actor,
        updated_by=actor,
    )

    content_type = ContentType.objects.get_for_model(
        ActionItem
    )
    activity = Activity.objects.create(
        content_type=content_type,
        object_id=item.id,
        name=name,
        kind=ActivityKind.TASK,
        unit="",
        total_qty=Decimal("0"),
        status=ActivityStatus.NOT_STARTED,
        created_by=actor,
        updated_by=actor,
    )

    if target_date:
        apply_update(
            activity,
            meeting_date=timezone.localdate(),
            new_target_date=target_date,
            actor=actor,
        )

    return item
