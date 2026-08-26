from datetime import date
from decimal import Decimal

import pytest
from rest_framework.exceptions import (
    PermissionDenied,
    ValidationError,
)

from apps.authentication.tests.factories import (
    AdminUserFactory,
    DirectorUserFactory,
    StoreHoUserFactory,
)
from apps.corrections.models import ApprovalStepStatus
from apps.organization.models import Company, Site
from apps.reconciliation.models import (
    Item,
    ItemCategory,
    ItemStandard,
    ReconciliationPeriodStatus,
    ReconciliationType,
)
from apps.reconciliation.services.approvals import (
    approve_step,
    build_approval_route,
    reject_step,
    return_step,
)
from apps.reconciliation.services.periods import (
    get_or_create_period,
    submit_period,
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
def norm_based_item():
    category = ItemCategory.objects.create(
        category_name="Cement",
    )
    item = Item.objects.create(
        item_name="OPC 43 Grade Cement",
        category=category,
        reconciliation_type=(
            ReconciliationType.NORM_BASED
        ),
        uom="MT",
    )
    ItemStandard.objects.create(
        item=item,
        rate=Decimal("6500.00"),
        mix_ratio=Decimal("0.32"),
        effective_from=date(2026, 1, 1),
    )
    return item


@pytest.fixture
def submitted_period(site, norm_based_item):
    store_ho = StoreHoUserFactory(
        employee_id="STOREHO010",
    )

    period = get_or_create_period(
        site=site,
        period_month=date(2026, 4, 1),
    )
    period.entries.create(
        item=norm_based_item,
        opening_stock=Decimal("10.000"),
        receipts=Decimal("30.000"),
        closing_stock=Decimal("8.000"),
        created_by=store_ho,
        updated_by=store_ho,
    )
    return period, store_ho


@pytest.mark.django_db
def test_build_approval_route_is_director_only():
    AdminUserFactory(employee_id="ADMIN010")
    StoreHoUserFactory(employee_id="STOREHO099")
    director = DirectorUserFactory(
        employee_id="DIRECTOR010",
    )

    route = build_approval_route()

    assert [step.approver_type for step in route] == [
        "DIRECTOR",
    ]
    assert route[0].sequence == 1
    assert route[0].approver.id == director.id


@pytest.mark.django_db
def test_submit_period_with_no_approver_raises(
    submitted_period,
):
    period, store_ho = submitted_period

    with pytest.raises(ValidationError):
        submit_period(period=period, user=store_ho)


@pytest.mark.django_db
def test_submit_period_builds_route_and_locks_period(
    submitted_period,
):
    period, store_ho = submitted_period
    director = DirectorUserFactory(
        employee_id="DIRECTOR011",
    )

    submit_period(period=period, user=store_ho)
    period.refresh_from_db()

    assert (
        period.status
        == ReconciliationPeriodStatus.PENDING_APPROVAL
    )
    step = period.approval_steps.get(is_current=True)
    assert step.approver_id == director.id
    assert step.status == ApprovalStepStatus.PENDING


@pytest.mark.django_db
def test_approve_step_by_director_approves_period(
    submitted_period,
):
    period, store_ho = submitted_period
    director = DirectorUserFactory(
        employee_id="DIRECTOR013",
    )

    submit_period(period=period, user=store_ho)
    period.refresh_from_db()
    step = period.approval_steps.get(is_current=True)

    approve_step(step=step, user=director)
    period.refresh_from_db()

    assert (
        period.status
        == ReconciliationPeriodStatus.APPROVED
    )
    assert period.is_editable is False


@pytest.mark.django_db
def test_reject_step_requires_comment(
    submitted_period,
):
    period, store_ho = submitted_period
    director = DirectorUserFactory(
        employee_id="DIRECTOR014",
    )

    submit_period(period=period, user=store_ho)
    period.refresh_from_db()
    step = period.approval_steps.get(is_current=True)

    with pytest.raises(ValidationError):
        reject_step(step=step, user=director)


@pytest.mark.django_db
def test_reject_step_closes_period_permanently(
    submitted_period,
):
    period, store_ho = submitted_period
    director = DirectorUserFactory(
        employee_id="DIRECTOR015",
    )

    submit_period(period=period, user=store_ho)
    period.refresh_from_db()
    step = period.approval_steps.get(is_current=True)

    reject_step(
        step=step,
        user=director,
        comment="Numbers look implausible.",
    )
    period.refresh_from_db()

    assert (
        period.status
        == ReconciliationPeriodStatus.REJECTED
    )
    assert period.is_editable is False


@pytest.mark.django_db
def test_return_step_reopens_period_for_correction(
    submitted_period,
):
    period, store_ho = submitted_period
    director = DirectorUserFactory(
        employee_id="DIRECTOR016",
    )

    submit_period(period=period, user=store_ho)
    period.refresh_from_db()
    step = period.approval_steps.get(is_current=True)

    return_step(
        step=step,
        user=director,
        comment="Please recheck closing stock.",
    )
    period.refresh_from_db()

    assert (
        period.status
        == ReconciliationPeriodStatus.DRAFT
    )
    assert period.is_editable is True


@pytest.mark.django_db
def test_resubmission_after_return_creates_new_round(
    submitted_period,
):
    period, store_ho = submitted_period
    director = DirectorUserFactory(
        employee_id="DIRECTOR017",
    )

    submit_period(period=period, user=store_ho)
    period.refresh_from_db()
    first_round_step = period.approval_steps.get(
        is_current=True,
    )
    return_step(
        step=first_round_step,
        user=director,
        comment="Fix the numbers.",
    )
    period.refresh_from_db()

    submit_period(period=period, user=store_ho)
    period.refresh_from_db()

    assert period.approval_steps.count() == 2
    second_round_step = period.approval_steps.get(
        is_current=True,
    )
    assert second_round_step.round_number == 2
    assert (
        second_round_step.pk != first_round_step.pk
    )
    assert second_round_step.approver_id == director.id


@pytest.mark.django_db
def test_non_approver_cannot_act_on_step(
    submitted_period,
):
    period, store_ho = submitted_period
    DirectorUserFactory(employee_id="DIRECTOR018")
    other_store_ho = StoreHoUserFactory(
        employee_id="STOREHO018",
    )

    submit_period(period=period, user=store_ho)
    period.refresh_from_db()
    step = period.approval_steps.get(is_current=True)

    with pytest.raises(PermissionDenied):
        approve_step(step=step, user=other_store_ho)


@pytest.mark.django_db
def test_admin_override_can_approve_directors_step(
    submitted_period,
):
    period, store_ho = submitted_period
    DirectorUserFactory(employee_id="DIRECTOR019")
    admin = AdminUserFactory(
        employee_id="ADMIN019",
    )

    submit_period(period=period, user=store_ho)
    period.refresh_from_db()
    director_step = period.approval_steps.get(
        is_current=True,
    )
    assert (
        director_step.approver_type == "DIRECTOR"
    )

    approve_step(
        step=director_step,
        user=admin,
        allow_admin=True,
    )
    period.refresh_from_db()

    assert (
        period.status
        == ReconciliationPeriodStatus.APPROVED
    )
