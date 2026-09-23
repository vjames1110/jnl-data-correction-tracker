from datetime import date, timedelta
from decimal import Decimal

import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from apps.authentication.tests.factories import (
    AdminUserFactory,
    DirectorUserFactory,
    ProjectInchargeUserFactory,
    ProjectManagerUserFactory,
    UserFactory,
)
from apps.project_monitor.models import (
    ConcreteProduction,
    MaterialRate,
    ProjectSiteAccess,
    ProjectSiteAccessRole,
)
from apps.project_monitor.services import dpr
from apps.project_monitor.tests.finance_helpers import (
    days_ago,
    make_item,
)

OK = status.HTTP_200_OK
FORBIDDEN = status.HTTP_403_FORBIDDEN


def url(name, *args):
    return reverse(f"project-monitor-api:{name}", args=args)


@pytest.fixture
def api():
    return APIClient()


def client_for(user):
    client = APIClient()
    client.force_authenticate(user=user)
    return client


@pytest.mark.django_db
class TestCostingAccess:
    """
    Costing is the one feed with no per-site grant at all: Director
    views every site read-only, Admin/Super Admin view and enter,
    and nobody else - not even a Project Manager or Incharge holding
    every other task on the site - gets in.
    """

    def test_director_can_view_but_not_enter(self, site):
        client = client_for(DirectorUserFactory())

        response = client.get(
            url("costing-glance"), {"site": str(site.id)}
        )
        assert response.status_code == OK

        response = client.post(
            url("costing-rate-list"),
            {
                "site": str(site.id),
                "kind": "CONCRETE",
                "effective_from": str(days_ago(0)),
                "rate": "6000",
            },
        )
        assert response.status_code == FORBIDDEN

    def test_admin_can_view_and_enter(self, site, admin_api):
        response = admin_api.get(
            url("costing-access"), {"site": str(site.id)}
        )
        assert response.status_code == OK
        assert response.data["data"]["can_enter"] is True

        response = admin_api.post(
            url("costing-rate-list"),
            {
                "site": str(site.id),
                "kind": "TMT",
                "effective_from": str(days_ago(0)),
                "rate": "60000",
            },
        )
        assert response.status_code == OK

    def test_a_project_manager_or_incharge_has_no_costing_access_at_all(
        self, site
    ):
        pm = ProjectManagerUserFactory()
        ProjectSiteAccess.objects.create(
            site=site,
            user=pm,
            role=ProjectSiteAccessRole.DPR_BILLS,
        )
        incharge = ProjectInchargeUserFactory()

        for user in (pm, incharge):
            response = client_for(user).get(
                url("costing-glance"), {"site": str(site.id)}
            )
            assert response.status_code == FORBIDDEN

    def test_a_plain_user_is_refused(self, site):
        response = client_for(UserFactory()).get(
            url("costing-glance"), {"site": str(site.id)}
        )
        assert response.status_code == FORBIDDEN


@pytest.fixture
def admin_api():
    return client_for(AdminUserFactory())


@pytest.mark.django_db
def test_glance_reflects_dpr_hr_and_machinery_together(
    site, admin_api
):
    today = date(2026, 9, 19)
    item = make_item(site, rate=Decimal("500"))
    dpr.add_detailed_entry(
        site=site,
        item=item,
        day=today,
        qty=Decimal("4"),
        actor=None,
        today=today,
    )

    response = admin_api.get(
        url("costing-glance"), {"site": str(site.id)}
    )

    assert response.status_code == OK
    assert "today" in response.data["data"]
    assert "yesterday" in response.data["data"]
    assert "month_to_date" in response.data["data"]


@pytest.mark.django_db
def test_material_rate_lifecycle(site, admin_api):
    created = admin_api.post(
        url("costing-rate-list"),
        {
            "site": str(site.id),
            "kind": "CONCRETE",
            "effective_from": str(days_ago(30)),
            "rate": "5800.50",
        },
    )
    assert created.status_code == OK
    rate_id = created.data["data"]["id"]

    listed = admin_api.get(
        url("costing-rate-list"), {"site": str(site.id)}
    )
    assert len(listed.data["data"]) == 1

    duplicate = admin_api.post(
        url("costing-rate-list"),
        {
            "site": str(site.id),
            "kind": "CONCRETE",
            "effective_from": str(days_ago(30)),
            "rate": "6000",
        },
    )
    assert duplicate.status_code == status.HTTP_400_BAD_REQUEST

    deleted = admin_api.delete(
        url("costing-rate-detail", rate_id)
    )
    assert deleted.status_code == OK
    assert not MaterialRate.objects.filter(pk=rate_id).exists()


@pytest.mark.django_db
def test_concrete_production_lifecycle(site, admin_api):
    created = admin_api.post(
        url("costing-production-list"),
        {
            "site": str(site.id),
            "date": str(days_ago(1)),
            "grade": "M25",
            "cum": "12.5",
            "cement_cost": "40000",
            "aggregate_cost": "8000",
        },
    )
    assert created.status_code == OK
    assert created.data["data"]["total_cost"] == Decimal(
        "48000.00"
    )
    row_id = created.data["data"]["id"]

    future = admin_api.post(
        url("costing-production-list"),
        {
            "site": str(site.id),
            "date": str(days_ago(-1)),
            "cum": "5",
        },
    )
    assert future.status_code == status.HTTP_400_BAD_REQUEST

    listed = admin_api.get(
        url("costing-production-list"),
        {
            "site": str(site.id),
            "from": str(days_ago(5)),
            "to": str(days_ago(0)),
        },
    )
    assert len(listed.data["data"]) == 1

    deleted = admin_api.delete(
        url("costing-production-detail", row_id)
    )
    assert deleted.status_code == OK
    assert not ConcreteProduction.objects.filter(
        pk=row_id
    ).exists()


@pytest.mark.django_db
def test_cost_table_defaults_to_the_last_thirty_days(
    site, admin_api
):
    response = admin_api.get(
        url("costing-table"), {"site": str(site.id)}
    )

    assert response.status_code == OK
    assert len(response.data["data"]["days"]) == 30


@pytest.mark.django_db
def test_cost_table_rejects_a_start_after_the_end(
    site, admin_api
):
    response = admin_api.get(
        url("costing-table"),
        {
            "site": str(site.id),
            "from": str(days_ago(0)),
            "to": str(days_ago(5)),
        },
    )

    assert response.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
def test_a_bad_uuid_site_is_a_400_not_a_500(admin_api):
    response = admin_api.get(
        url("costing-glance"), {"site": "not-a-uuid"}
    )

    assert response.status_code == status.HTTP_400_BAD_REQUEST
