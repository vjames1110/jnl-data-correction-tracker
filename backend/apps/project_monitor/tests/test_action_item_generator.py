from datetime import date

import pytest

from apps.authentication.tests.factories import (
    ProjectManagerUserFactory,
)
from apps.organization.models import Company, Site
from apps.project_monitor.models import (
    ActivityKind,
    ActivityStatus,
)
from apps.project_monitor.services.action_item_generator import (
    create_action_item,
)


@pytest.fixture
def site():
    company = Company.objects.create(
        company_code="JNL",
        company_name="Jhajharia Nirman Limited",
    )
    return Site.objects.create(
        company=company,
        site_code="CHK",
        site_name="Chunar-Khairahi Doubling Pkg-I",
    )


@pytest.fixture
def actor():
    return ProjectManagerUserFactory()


@pytest.mark.django_db
def test_create_action_item_generates_one_bare_activity(
    site, actor
):
    item = create_action_item(
        site=site,
        name="Follow up with Railway on land handover",
        responsibility="Site Engineer - Rahul",
        remarks="Escalated to DRM office.",
        target_date=date(2026, 3, 1),
        actor=actor,
    )

    assert item.responsibility == (
        "Site Engineer - Rahul"
    )
    assert item.remarks == (
        "Escalated to DRM office."
    )

    activities = list(item.activities.all())
    assert len(activities) == 1
    activity = activities[0]
    assert (
        activity.name
        == "Follow up with Railway on land handover"
    )
    assert activity.kind == ActivityKind.TASK
    assert (
        activity.status
        == ActivityStatus.NOT_STARTED
    )
    assert not activity.is_doc
    assert not activity.material_tracked

    date_entries = list(
        activity.date_entries.all()
    )
    assert len(date_entries) == 1
    assert date_entries[0].target_date == date(
        2026, 3, 1
    )

    comments = list(activity.comments.all())
    assert len(comments) == 1
    assert "Target set" in comments[0].text


@pytest.mark.django_db
def test_create_action_item_without_a_target_date(
    site, actor
):
    item = create_action_item(
        site=site,
        name="Coordinate with forest department",
        actor=actor,
    )

    activity = item.activities.first()
    assert (
        list(activity.date_entries.all()) == []
    )
    assert list(activity.comments.all()) == []
