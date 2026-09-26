from decimal import Decimal

import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from apps.authentication.tests.factories import (
    AdminUserFactory,
    DirectorUserFactory,
    ProjectHoUserFactory,
    ProjectManagerUserFactory,
    UserFactory,
)
from apps.organization.models import Company, Site
from apps.project_monitor.models import (
    LinearItem,
    ProgressEntry,
    ScopePatch,
)


@pytest.fixture
def api_client():
    return APIClient()


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
def linear_item(api_client, site):
    pm = ProjectManagerUserFactory()
    api_client.force_authenticate(user=pm)
    response = api_client.post(
        f"{reverse('project-monitor-api:linear-item-list')}?site={site.id}",
        {
            "name": "Earthwork (formation)",
            "unit": "M",
        },
        format="json",
    )
    return LinearItem.objects.get(
        pk=response.data["data"]["id"]
    )


@pytest.mark.django_db
def test_project_manager_can_create_a_linear_item(
    api_client, site
):
    pm = ProjectManagerUserFactory()
    api_client.force_authenticate(user=pm)

    response = api_client.post(
        f"{reverse('project-monitor-api:linear-item-list')}?site={site.id}",
        {
            "name": "Earthwork (formation)",
            "unit": "M",
        },
        format="json",
    )

    assert (
        response.status_code
        == status.HTTP_200_OK
    )
    data = response.data["data"]
    assert data["name"] == (
        "Earthwork (formation)"
    )
    assert data["unit"] == "M"
    assert data["scope_patches"] == []
    assert data["progress_entries"] == []
    assert data["stats"] == {
        "scope": 0,
        "done": 0,
        "ongoing": 0,
        "pending": 0,
    }
    assert LinearItem.objects.filter(
        site=site
    ).count() == 1


@pytest.mark.django_db
def test_name_is_required(api_client, site):
    pm = ProjectManagerUserFactory()
    api_client.force_authenticate(user=pm)

    response = api_client.post(
        f"{reverse('project-monitor-api:linear-item-list')}?site={site.id}",
        {"name": "   ", "unit": "M"},
        format="json",
    )

    assert (
        response.status_code
        == status.HTTP_400_BAD_REQUEST
    )


@pytest.mark.django_db
def test_view_only_cannot_create_a_linear_item(
    api_client, site
):
    view_only = ProjectHoUserFactory()
    api_client.force_authenticate(user=view_only)

    response = api_client.post(
        f"{reverse('project-monitor-api:linear-item-list')}?site={site.id}",
        {
            "name": "Earthwork (formation)",
            "unit": "M",
        },
        format="json",
    )

    assert (
        response.status_code
        == status.HTTP_403_FORBIDDEN
    )


@pytest.mark.django_db
def test_director_can_list_linear_items(
    api_client, site
):
    admin = AdminUserFactory()
    api_client.force_authenticate(user=admin)
    api_client.post(
        f"{reverse('project-monitor-api:linear-item-list')}?site={site.id}",
        {
            "name": "Earthwork (formation)",
            "unit": "M",
        },
        format="json",
    )

    director = DirectorUserFactory()
    api_client.force_authenticate(user=director)
    response = api_client.get(
        f"{reverse('project-monitor-api:linear-item-list')}?site={site.id}",
    )

    assert (
        response.status_code
        == status.HTTP_200_OK
    )
    assert len(response.data["data"]) == 1


@pytest.mark.django_db
def test_plain_user_cannot_list_linear_items(
    api_client, site
):
    user = UserFactory()
    api_client.force_authenticate(user=user)

    response = api_client.get(
        f"{reverse('project-monitor-api:linear-item-list')}?site={site.id}",
    )

    assert (
        response.status_code
        == status.HTTP_403_FORBIDDEN
    )


@pytest.mark.django_db
def test_linear_item_detail_and_delete(
    api_client, linear_item
):
    detail_response = api_client.get(
        reverse(
            "project-monitor-api:linear-item-detail",
            args=[linear_item.id],
        )
    )
    assert (
        detail_response.status_code
        == status.HTTP_200_OK
    )

    view_only = ProjectHoUserFactory()
    api_client.force_authenticate(user=view_only)
    forbidden_delete = api_client.delete(
        reverse(
            "project-monitor-api:linear-item-detail",
            args=[linear_item.id],
        )
    )
    assert (
        forbidden_delete.status_code
        == status.HTTP_403_FORBIDDEN
    )

    pm = ProjectManagerUserFactory()
    api_client.force_authenticate(user=pm)
    delete_response = api_client.delete(
        reverse(
            "project-monitor-api:linear-item-detail",
            args=[linear_item.id],
        )
    )
    assert (
        delete_response.status_code
        == status.HTTP_200_OK
    )
    assert not LinearItem.objects.filter(
        id=linear_item.id
    ).exists()


@pytest.mark.django_db
def test_adding_a_scope_patch_auto_derives_qty_for_m_unit(
    api_client, linear_item
):
    pm = ProjectManagerUserFactory()
    api_client.force_authenticate(user=pm)

    response = api_client.post(
        reverse(
            "project-monitor-api:scope-patch-list",
            args=[linear_item.id],
        ),
        {
            "from_chainage_km": "2.000",
            "to_chainage_km": "4.500",
            "side": "LHS",
            "remarks": "Between two culverts",
        },
        format="json",
    )

    assert (
        response.status_code
        == status.HTTP_200_OK
    )
    patch = response.data["data"][
        "scope_patches"
    ][0]
    assert patch["qty"] == "2500.000"
    assert patch["side"] == "LHS"
    assert ScopePatch.objects.filter(
        linear_item=linear_item
    ).count() == 1


@pytest.mark.django_db
def test_scope_patch_requires_valid_chainage_range(
    api_client, linear_item
):
    pm = ProjectManagerUserFactory()
    api_client.force_authenticate(user=pm)

    response = api_client.post(
        reverse(
            "project-monitor-api:scope-patch-list",
            args=[linear_item.id],
        ),
        {
            "from_chainage_km": "5.000",
            "to_chainage_km": "5.000",
        },
        format="json",
    )

    assert (
        response.status_code
        == status.HTTP_400_BAD_REQUEST
    )


@pytest.mark.django_db
def test_view_only_cannot_add_a_scope_patch(
    api_client, linear_item
):
    view_only = ProjectHoUserFactory()
    api_client.force_authenticate(user=view_only)

    response = api_client.post(
        reverse(
            "project-monitor-api:scope-patch-list",
            args=[linear_item.id],
        ),
        {
            "from_chainage_km": "0.000",
            "to_chainage_km": "1.000",
        },
        format="json",
    )

    assert (
        response.status_code
        == status.HTTP_403_FORBIDDEN
    )


@pytest.mark.django_db
def test_project_manager_can_delete_a_scope_patch(
    api_client, linear_item
):
    pm = ProjectManagerUserFactory()
    api_client.force_authenticate(user=pm)
    create_response = api_client.post(
        reverse(
            "project-monitor-api:scope-patch-list",
            args=[linear_item.id],
        ),
        {
            "from_chainage_km": "0.000",
            "to_chainage_km": "1.000",
        },
        format="json",
    )
    patch_id = create_response.data["data"][
        "scope_patches"
    ][0]["id"]

    response = api_client.delete(
        reverse(
            "project-monitor-api:scope-patch-detail",
            args=[patch_id],
        )
    )

    assert (
        response.status_code
        == status.HTTP_200_OK
    )
    assert not ScopePatch.objects.filter(
        id=patch_id
    ).exists()


@pytest.mark.django_db
def test_logging_a_progress_entry_updates_stats(
    api_client, linear_item
):
    pm = ProjectManagerUserFactory()
    api_client.force_authenticate(user=pm)
    api_client.post(
        reverse(
            "project-monitor-api:scope-patch-list",
            args=[linear_item.id],
        ),
        {
            "from_chainage_km": "0.000",
            "to_chainage_km": "5.000",
        },
        format="json",
    )

    response = api_client.post(
        reverse(
            "project-monitor-api:progress-entry-list",
            args=[linear_item.id],
        ),
        {
            "date": "2026-01-05",
            "meeting_date": "2026-01-05",
            "from_chainage_km": "0.000",
            "to_chainage_km": "2.000",
            "status": "COMPLETE",
            "contractor": "ABC Contractors",
        },
        format="json",
    )

    assert (
        response.status_code
        == status.HTTP_200_OK
    )
    data = response.data["data"]
    assert len(data["progress_entries"]) == 1
    entry = data["progress_entries"][0]
    assert entry["qty"] == "2000.000"
    assert entry["contractor"] == (
        "ABC Contractors"
    )
    assert data["stats"] == {
        "scope": Decimal("5000.000"),
        "done": Decimal("2000.000"),
        "ongoing": Decimal("0"),
        "pending": Decimal("3000.000"),
    }
    assert ProgressEntry.objects.filter(
        linear_item=linear_item
    ).count() == 1


@pytest.mark.django_db
def test_progress_entry_requires_valid_chainage_range(
    api_client, linear_item
):
    pm = ProjectManagerUserFactory()
    api_client.force_authenticate(user=pm)

    response = api_client.post(
        reverse(
            "project-monitor-api:progress-entry-list",
            args=[linear_item.id],
        ),
        {
            "date": "2026-01-05",
            "meeting_date": "2026-01-05",
            "from_chainage_km": "3.000",
            "to_chainage_km": "1.000",
        },
        format="json",
    )

    assert (
        response.status_code
        == status.HTTP_400_BAD_REQUEST
    )


@pytest.mark.django_db
def test_view_only_cannot_log_a_progress_entry(
    api_client, linear_item
):
    view_only = ProjectHoUserFactory()
    api_client.force_authenticate(user=view_only)

    response = api_client.post(
        reverse(
            "project-monitor-api:progress-entry-list",
            args=[linear_item.id],
        ),
        {
            "date": "2026-01-05",
            "meeting_date": "2026-01-05",
            "from_chainage_km": "0.000",
            "to_chainage_km": "1.000",
        },
        format="json",
    )

    assert (
        response.status_code
        == status.HTTP_403_FORBIDDEN
    )


@pytest.mark.django_db
def test_editing_a_progress_entry(
    api_client, linear_item
):
    pm = ProjectManagerUserFactory()
    api_client.force_authenticate(user=pm)
    create_response = api_client.post(
        reverse(
            "project-monitor-api:progress-entry-list",
            args=[linear_item.id],
        ),
        {
            "date": "2026-01-05",
            "meeting_date": "2026-01-05",
            "from_chainage_km": "0.000",
            "to_chainage_km": "2.000",
            "status": "IN_PROGRESS",
        },
        format="json",
    )
    entry_id = create_response.data["data"][
        "progress_entries"
    ][0]["id"]

    response = api_client.patch(
        reverse(
            "project-monitor-api:progress-entry-detail",
            args=[entry_id],
        ),
        {
            "status": "COMPLETE",
            "remarks": "Finished ahead of plan",
        },
        format="json",
    )

    assert (
        response.status_code
        == status.HTTP_200_OK
    )
    entry = response.data["data"][
        "progress_entries"
    ][0]
    assert entry["status"] == "COMPLETE"
    assert entry["remarks"] == (
        "Finished ahead of plan"
    )


@pytest.mark.django_db
def test_deleting_a_progress_entry(
    api_client, linear_item
):
    pm = ProjectManagerUserFactory()
    api_client.force_authenticate(user=pm)
    create_response = api_client.post(
        reverse(
            "project-monitor-api:progress-entry-list",
            args=[linear_item.id],
        ),
        {
            "date": "2026-01-05",
            "meeting_date": "2026-01-05",
            "from_chainage_km": "0.000",
            "to_chainage_km": "2.000",
        },
        format="json",
    )
    entry_id = create_response.data["data"][
        "progress_entries"
    ][0]["id"]

    response = api_client.delete(
        reverse(
            "project-monitor-api:progress-entry-detail",
            args=[entry_id],
        )
    )

    assert (
        response.status_code
        == status.HTTP_200_OK
    )
    assert not ProgressEntry.objects.filter(
        id=entry_id
    ).exists()


@pytest.mark.django_db
def test_cum_unit_item_accepts_manual_qty(
    api_client, site
):
    pm = ProjectManagerUserFactory()
    api_client.force_authenticate(user=pm)
    create_response = api_client.post(
        f"{reverse('project-monitor-api:linear-item-list')}?site={site.id}",
        {"name": "Blanketing", "unit": "CUM"},
        format="json",
    )
    item_id = create_response.data["data"][
        "id"
    ]

    response = api_client.post(
        reverse(
            "project-monitor-api:scope-patch-list",
            args=[item_id],
        ),
        {
            "from_chainage_km": "0.000",
            "to_chainage_km": "10.000",
            "qty": "500.000",
        },
        format="json",
    )

    assert (
        response.status_code
        == status.HTTP_200_OK
    )
    patch = response.data["data"][
        "scope_patches"
    ][0]
    assert patch["qty"] == "500.000"


@pytest.mark.django_db
def test_overview_reflects_real_linear_counts(
    api_client, linear_item
):
    pm = ProjectManagerUserFactory()
    api_client.force_authenticate(user=pm)
    api_client.post(
        reverse(
            "project-monitor-api:scope-patch-list",
            args=[linear_item.id],
        ),
        {
            "from_chainage_km": "0.000",
            "to_chainage_km": "5.000",
        },
        format="json",
    )
    api_client.post(
        reverse(
            "project-monitor-api:progress-entry-list",
            args=[linear_item.id],
        ),
        {
            "date": "2026-01-05",
            "meeting_date": "2026-01-05",
            "from_chainage_km": "0.000",
            "to_chainage_km": "2.000",
            "status": "COMPLETE",
        },
        format="json",
    )

    response = api_client.get(
        f"{reverse('project-monitor-api:overview')}?site={linear_item.site_id}",
    )
    counts = response.data["data"]["counts"][
        "linear"
    ]
    assert counts["scope_m"] == Decimal(
        "5000.000"
    )
    assert counts["done_m"] == Decimal(
        "2000.000"
    )
