from datetime import date
from decimal import Decimal

import pytest
from django.contrib.contenttypes.models import ContentType

from apps.authentication.tests.factories import (
    ProjectManagerUserFactory,
)
from apps.organization.models import Company, Site
from apps.project_monitor.models import (
    Activity,
    ActivityKind,
    ActivityStatus,
    MaterialStatus,
)
from apps.project_monitor.services.activity_engine import (
    apply_material_status_update,
    apply_update,
    current_target_date,
)


@pytest.fixture
def site():
    company = Company.objects.create(
        company_code="JNL",
        company_name="Jhajharia Nirman Limited",
    )
    return Site.objects.create(
        company=company,
        site_code="BKN",
        site_name="Bikaner Site",
    )


@pytest.fixture
def activity(site):
    return Activity.objects.create(
        content_type=(
            ContentType.objects.get_for_model(
                Site
            )
        ),
        object_id=site.id,
        name="Box raft",
        group_title="Box structure",
    )


@pytest.mark.django_db
def test_apply_update_sets_a_fresh_target_date(
    activity,
):
    apply_update(
        activity,
        meeting_date=date(2026, 1, 5),
        new_target_date=date(2026, 2, 1),
    )

    assert current_target_date(
        activity
    ) == date(2026, 2, 1)
    assert activity.date_entries.count() == 1
    comment = activity.comments.get()
    assert comment.text == (
        "Target set 01-02-2026"
    )


@pytest.mark.django_db
def test_apply_update_revises_a_target_date_keeping_history(
    activity,
):
    apply_update(
        activity,
        meeting_date=date(2026, 1, 5),
        new_target_date=date(2026, 2, 1),
    )
    apply_update(
        activity,
        meeting_date=date(2026, 2, 5),
        new_target_date=date(2026, 3, 1),
    )

    assert activity.date_entries.count() == 2
    assert current_target_date(
        activity
    ) == date(2026, 3, 1)
    # The first entry is untouched - it's the "struck through" history.
    first_entry = (
        activity.date_entries.order_by(
            "id"
        ).first()
    )
    assert first_entry.target_date == date(
        2026, 2, 1
    )
    latest_comment = (
        activity.comments.order_by(
            "-id"
        ).first()
    )
    assert latest_comment.text == (
        "Date revised 01-02-2026 -> 01-03-2026"
    )


@pytest.mark.django_db
def test_apply_update_composes_status_and_qty_into_one_comment(
    activity,
):
    apply_update(
        activity,
        meeting_date=date(2026, 1, 5),
        status=ActivityStatus.IN_PROGRESS,
        done_qty=Decimal("40"),
        comment="Shuttering in progress",
    )

    activity.refresh_from_db()
    assert (
        activity.status
        == ActivityStatus.IN_PROGRESS
    )
    assert activity.done_qty == Decimal("40")
    # One composed log line, not three separate ones.
    assert activity.comments.count() == 1
    text = activity.comments.get().text
    assert "Status: In Progress" in text
    assert "40% done" in text
    assert "Shuttering in progress" in text


@pytest.mark.django_db
def test_apply_update_sets_completed_on_when_marked_complete(
    activity,
):
    apply_update(
        activity,
        meeting_date=date(2026, 3, 10),
        status=ActivityStatus.COMPLETE,
    )

    activity.refresh_from_db()
    assert activity.completed_on == date(
        2026, 3, 10
    )


@pytest.mark.django_db
def test_apply_update_is_a_noop_when_nothing_changed(
    activity,
):
    apply_update(
        activity,
        meeting_date=date(2026, 1, 5),
        status=activity.status,
    )

    assert activity.comments.count() == 0
    assert activity.date_entries.count() == 0


@pytest.mark.django_db
def test_length_activity_logs_quantity_with_unit(
    site,
):
    pile = Activity.objects.create(
        content_type=(
            ContentType.objects.get_for_model(
                Site
            )
        ),
        object_id=site.id,
        name="Pile",
        kind=ActivityKind.LENGTH,
        unit="nos",
        total_qty=Decimal("40"),
    )

    apply_update(
        pile,
        meeting_date=date(2026, 1, 5),
        done_qty=Decimal("12"),
    )

    assert (
        "Done 12 nos"
        in pile.comments.get().text
    )


@pytest.mark.django_db
def test_material_status_update_logs_its_own_comment(
    site,
):
    flooring = Activity.objects.create(
        content_type=(
            ContentType.objects.get_for_model(
                Site
            )
        ),
        object_id=site.id,
        name="Flooring",
        material_tracked=True,
        material_status=(
            MaterialStatus.NOT_ORDERED
        ),
    )
    actor = ProjectManagerUserFactory()

    apply_material_status_update(
        flooring,
        material_status=(
            MaterialStatus.PO_PLACED
        ),
        meeting_date=date(2026, 1, 5),
        actor=actor,
    )

    flooring.refresh_from_db()
    assert (
        flooring.material_status
        == MaterialStatus.PO_PLACED
    )
    comment = flooring.comments.get()
    assert comment.text == "Material: PO Placed"
    assert comment.created_by == actor


@pytest.mark.django_db
def test_apply_update_marks_and_clears_hindrance(
    activity,
):
    apply_update(
        activity,
        meeting_date=date(2026, 1, 5),
        is_hindrance=True,
        hindrance_expected_removal_date=date(
            2026, 2, 1
        ),
        hindrance_remarks=(
            "Awaiting Railway block clearance"
        ),
    )

    activity.refresh_from_db()
    assert activity.is_hindrance
    assert (
        activity.hindrance_expected_removal_date
        == date(2026, 2, 1)
    )
    assert (
        activity.hindrance_remarks
        == "Awaiting Railway block clearance"
    )
    text = activity.comments.get().text
    assert (
        "Marked as hindrance (Railways/Authority)"
        in text
    )
    assert (
        "Hindrance expected removal: 01-02-2026"
        in text
    )
    assert (
        "Hindrance remark: Awaiting Railway "
        "block clearance"
        in text
    )

    apply_update(
        activity,
        meeting_date=date(2026, 3, 1),
        is_hindrance=False,
        hindrance_actual_removal_date=date(
            2026, 2, 28
        ),
    )

    activity.refresh_from_db()
    assert not activity.is_hindrance
    assert (
        activity.hindrance_actual_removal_date
        == date(2026, 2, 28)
    )
    latest = activity.comments.order_by(
        "-id"
    ).first()
    assert "Hindrance cleared" in latest.text
    assert (
        "Hindrance removed on: 28-02-2026"
        in latest.text
    )
