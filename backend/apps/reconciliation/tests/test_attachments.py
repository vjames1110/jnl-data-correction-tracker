from datetime import date
from decimal import Decimal

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from apps.authentication.tests.factories import (
    DirectorUserFactory,
    StoreHoUserFactory,
)
from apps.organization.models import Company, Site
from apps.reconciliation.models import (
    Item,
    ItemCategory,
    ItemStandard,
    ReconciliationEntry,
    ReconciliationPeriodAttachment,
    ReconciliationType,
)
from apps.reconciliation.services.attachments import (
    create_attachment,
    delete_attachment,
)
from apps.reconciliation.services.periods import (
    get_or_create_period,
    submit_period,
)
from apps.reconciliation.services.variance import (
    compute_entry_variance,
    refresh_entry_flags,
)


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def company():
    return Company.objects.create(
        company_code="JNL",
        company_name="Jhajharia Nirman Limited",
    )


@pytest.fixture
def site(company):
    return Site.objects.create(
        company=company,
        site_code="BKN",
        site_name="Bikaner Site",
    )


@pytest.fixture
def store_ho():
    return StoreHoUserFactory(
        employee_id="ATTSTOREHO001",
    )


@pytest.fixture
def director():
    return DirectorUserFactory(
        employee_id="ATTDIR001",
    )


@pytest.fixture
def norm_based_item():
    category = ItemCategory.objects.create(
        category_name="Attachment Test Cement",
    )
    item = Item.objects.create(
        item_name="Attachment Test Cement",
        reconciliation_type=(
            ReconciliationType.NORM_BASED
        ),
        uom="MT",
    )
    item.categories.add(category)
    ItemStandard.objects.create(
        item=item,
        rate=Decimal("6500.00"),
        mix_ratio=Decimal("0.32"),
        effective_from=date(2026, 1, 1),
    )
    return item


@pytest.fixture
def draft_period(site):
    return get_or_create_period(
        site=site, period_month=date(2026, 7, 1)
    )


def _pdf_file(name="proof.pdf"):
    return SimpleUploadedFile(
        name,
        b"%PDF-1.4 test",
        content_type="application/pdf",
    )


@pytest.mark.django_db
def test_store_ho_can_upload_and_download_attachment(
    api_client,
    store_ho,
    draft_period,
):
    attachment = create_attachment(
        period=draft_period,
        user=store_ho,
        file=_pdf_file(),
        notes="Physical stock count sheet",
    )

    assert attachment.original_name == "proof.pdf"
    assert attachment.notes == (
        "Physical stock count sheet"
    )

    api_client.force_authenticate(user=store_ho)
    download_response = api_client.get(
        reverse(
            "reconciliation-api:attachments-download",
            kwargs={"id": attachment.id},
        ),
    )

    assert (
        download_response.status_code
        == status.HTTP_200_OK
    )


@pytest.mark.django_db
def test_attachment_rejects_disallowed_file_type(
    store_ho,
    draft_period,
):
    with pytest.raises(Exception):
        create_attachment(
            period=draft_period,
            user=store_ho,
            file=SimpleUploadedFile(
                "script.exe",
                b"bad",
                content_type="application/octet-stream",
            ),
        )


@pytest.mark.django_db
def test_attachment_cannot_be_added_once_submitted(
    api_client,
    store_ho,
    director,
    site,
    norm_based_item,
    draft_period,
):
    ReconciliationEntry.objects.create(
        period=draft_period,
        item=norm_based_item,
        opening_stock=Decimal("10"),
        receipts=Decimal("30"),
        closing_stock=Decimal("8"),
    )
    entry = ReconciliationEntry.objects.get(
        period=draft_period
    )
    compute_entry_variance(entry)
    entry.save()
    refresh_entry_flags(entry)

    submit_period(
        period=draft_period, user=store_ho
    )
    # create_attachment reads period.status off whatever instance
    # the caller passes in - in the real view flow that's always a
    # freshly-fetched instance (DRF's PrimaryKeyRelatedField), so the
    # test must refresh too rather than reuse the pre-submit object.
    draft_period.refresh_from_db()

    with pytest.raises(Exception):
        create_attachment(
            period=draft_period,
            user=store_ho,
            file=_pdf_file(),
        )


@pytest.mark.django_db
def test_attachment_can_be_deleted_while_draft(
    store_ho,
    draft_period,
):
    attachment = create_attachment(
        period=draft_period,
        user=store_ho,
        file=_pdf_file(),
    )

    delete_attachment(
        attachment=attachment,
        user=store_ho,
    )

    assert not (
        ReconciliationPeriodAttachment.objects.filter(
            id=attachment.id,
            is_deleted=False,
        ).exists()
    )


@pytest.mark.django_db
def test_director_can_read_but_not_upload_attachments(
    api_client,
    store_ho,
    director,
    draft_period,
):
    create_attachment(
        period=draft_period,
        user=store_ho,
        file=_pdf_file(),
    )

    api_client.force_authenticate(user=director)
    list_response = api_client.get(
        reverse(
            "reconciliation-api:attachments-list"
        ),
        {"period": str(draft_period.id)},
    )
    assert (
        list_response.status_code
        == status.HTTP_200_OK
    )
    assert (
        len(list_response.data["data"]) == 1
    )

    upload_response = api_client.post(
        reverse(
            "reconciliation-api:attachments-list"
        ),
        {
            "period": str(draft_period.id),
            "file": _pdf_file("second.pdf"),
        },
        format="multipart",
    )
    assert (
        upload_response.status_code
        == status.HTTP_403_FORBIDDEN
    )
