"""
Cloudflare R2 file storage.

Two layers: the pure decision of *which* storage to use
(``config.storage.resolve_default_storage``), and the behaviour of
real uploads/downloads and the two management commands against an
in-memory S3-compatible bucket (the ``r2_storage`` fixture in the root
conftest - same builder and R2-shaped endpoint as production, no
network and no real keys).
"""

from datetime import date
from io import StringIO

import pytest
from django.core.exceptions import ImproperlyConfigured
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.management import CommandError, call_command
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from apps.authentication.tests.factories import StoreHoUserFactory
from apps.organization.models import Company, Site
from apps.reconciliation.models import (
    ReconciliationPeriodAttachment,
)
from apps.reconciliation.services.periods import (
    get_or_create_period,
)
from config.storage import (
    is_r2_configured,
    r2_endpoint_url,
    resolve_default_storage,
)

R2_KWARGS = {
    "account_id": "abc123",
    "access_key_id": "key-id",
    "secret_access_key": "key-secret",
    "bucket_name": "jnlops-files",
}


# --- which storage is chosen -------------------------------------------------


def test_nothing_configured_keeps_the_local_disk():
    storage = resolve_default_storage()

    assert storage == {
        "BACKEND": "django.core.files.storage.FileSystemStorage"
    }


def test_full_configuration_selects_r2_with_its_required_options():
    storage = resolve_default_storage(**R2_KWARGS)
    options = storage["OPTIONS"]

    assert storage["BACKEND"] == "storages.backends.s3.S3Storage"
    assert options["endpoint_url"] == (
        "https://abc123.r2.cloudflarestorage.com"
    )
    assert options["bucket_name"] == "jnlops-files"
    assert options["access_key"] == "key-id"
    assert options["secret_key"] == "key-secret"
    assert options["region_name"] == "auto"
    assert options["signature_version"] == "s3v4"
    assert options["addressing_style"] == "path"
    # Two uploads called scan.pdf must not overwrite each other, and
    # nothing may ever be publicly readable.
    assert options["file_overwrite"] is False
    assert options["querystring_auth"] is True
    assert options["default_acl"] is None


def test_client_only_computes_checksums_when_required():
    # boto3 >= 1.36 otherwise sends CRC32 checksums that R2 rejects.
    config = resolve_default_storage(**R2_KWARGS)["OPTIONS"][
        "client_config"
    ]

    assert config.request_checksum_calculation == "when_required"
    assert config.response_checksum_validation == "when_required"


def test_signed_url_lifetime_and_key_prefix_are_applied():
    options = resolve_default_storage(
        **R2_KWARGS,
        key_prefix="/prod/",
        signed_url_seconds="900",
    )["OPTIONS"]

    assert options["location"] == "prod"
    assert options["querystring_expire"] == 900


def test_explicit_endpoint_wins_over_the_account_id():
    # An EU-jurisdiction bucket has a different host.
    options = resolve_default_storage(
        **{**R2_KWARGS, "account_id": ""},
        endpoint_url="https://abc123.eu.r2.cloudflarestorage.com/",
    )["OPTIONS"]

    assert options["endpoint_url"] == (
        "https://abc123.eu.r2.cloudflarestorage.com"
    )


@pytest.mark.parametrize(
    "missing",
    ["access_key_id", "secret_access_key", "bucket_name"],
)
def test_a_half_configured_r2_is_an_error_not_a_silent_fallback(
    missing,
):
    with pytest.raises(ImproperlyConfigured) as error:
        resolve_default_storage(**{**R2_KWARGS, missing: ""})

    assert f"R2_{missing.upper()}" in str(error.value)


def test_keys_without_an_account_id_is_an_error():
    with pytest.raises(ImproperlyConfigured) as error:
        resolve_default_storage(
            **{**R2_KWARGS, "account_id": ""}
        )

    assert "R2_ACCOUNT_ID" in str(error.value)


def test_helpers_report_whether_r2_is_configured():
    assert is_r2_configured(**R2_KWARGS) is True
    assert is_r2_configured() is False
    assert (
        is_r2_configured(**{**R2_KWARGS, "bucket_name": ""})
        is False
    )
    assert r2_endpoint_url(account_id=" abc ") == (
        "https://abc.r2.cloudflarestorage.com"
    )


def test_the_test_settings_never_use_a_real_bucket(settings):
    assert settings.STORAGES["default"]["BACKEND"].endswith(
        "FileSystemStorage"
    )


# --- real uploads against a bucket ------------------------------------------


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
    return StoreHoUserFactory(employee_id="R2STOREHO001")


@pytest.fixture
def draft_period(site):
    return get_or_create_period(
        site=site, period_month=date(2026, 7, 1)
    )


@pytest.fixture
def api_client(store_ho):
    client = APIClient()
    client.force_authenticate(user=store_ho)
    return client


def _pdf(name="proof.pdf", body=b"%PDF-1.4 real bytes"):
    return SimpleUploadedFile(
        name, body, content_type="application/pdf"
    )


def _upload(api_client, period, **file_kwargs):
    return api_client.post(
        reverse("reconciliation-api:attachments-list"),
        {
            "period": str(period.id),
            "file": _pdf(**file_kwargs),
            "notes": "Stock sheet",
        },
        format="multipart",
    )


def _attachment_id(response):
    return response.data["data"]["id"]


def _download(api_client, attachment_id):
    return api_client.get(
        reverse(
            "reconciliation-api:attachments-download",
            kwargs={"id": attachment_id},
        )
    )


@pytest.mark.django_db
def test_an_uploaded_attachment_lands_in_the_bucket_and_downloads_back(
    api_client, draft_period, r2_storage
):
    response = _upload(api_client, draft_period)

    assert response.status_code == status.HTTP_201_CREATED, (
        response.data
    )
    keys = r2_storage.keys()
    assert len(keys) == 1
    assert keys[0].startswith(
        f"{r2_storage.prefix}/reconciliation/"
    )
    assert keys[0].endswith("proof.pdf")

    download = _download(api_client, _attachment_id(response))

    assert download.status_code == status.HTTP_200_OK
    assert b"".join(download.streaming_content) == (
        b"%PDF-1.4 real bytes"
    )
    assert "proof.pdf" in download["Content-Disposition"]
    assert download["Content-Type"] == "application/pdf"


@pytest.mark.django_db
def test_two_uploads_with_the_same_name_do_not_overwrite_each_other(
    api_client, draft_period, r2_storage
):
    first = _upload(api_client, draft_period, body=b"%PDF first")
    second = _upload(api_client, draft_period, body=b"%PDF second")

    assert first.status_code == second.status_code == 201
    assert len(r2_storage.keys()) == 2
    assert b"".join(
        _download(api_client, _attachment_id(first)).streaming_content
    ) == b"%PDF first"
    assert b"".join(
        _download(api_client, _attachment_id(second)).streaming_content
    ) == b"%PDF second"


@pytest.mark.django_db
def test_a_file_missing_from_the_bucket_is_a_404_not_a_crash(
    api_client, draft_period, r2_storage
):
    response = _upload(api_client, draft_period)
    r2_storage.client.delete_object(
        Bucket=r2_storage.bucket, Key=r2_storage.keys()[0]
    )

    download = _download(api_client, _attachment_id(response))

    assert download.status_code == status.HTTP_404_NOT_FOUND


@pytest.mark.django_db
def test_the_bucket_url_is_signed_so_nothing_is_public(
    api_client, draft_period, r2_storage
):
    response = _upload(api_client, draft_period)
    attachment = ReconciliationPeriodAttachment.objects.get(
        pk=_attachment_id(response)
    )

    url = attachment.file.url

    assert "X-Amz-Signature=" in url
    assert "X-Amz-Expires=3600" in url


# --- the management commands -------------------------------------------------


def _run(command, *args, **kwargs):
    out = StringIO()
    call_command(command, *args, stdout=out, **kwargs)
    return out.getvalue()


def test_check_storage_round_trips_a_file_through_r2(r2_storage):
    output = _run("check_storage")

    assert "Cloudflare R2" in output
    assert r2_storage.bucket in output
    assert "OK" in output
    # The probe file is removed again.
    assert r2_storage.keys() == []


def test_check_storage_names_the_problem_when_the_bucket_is_wrong(
    r2_storage,
):
    r2_storage.client.delete_bucket(Bucket=r2_storage.bucket)

    with pytest.raises(CommandError) as error:
        _run("check_storage")

    assert "NoSuchBucket" in str(error.value)
    assert "R2_BUCKET_NAME" in str(error.value)


def test_check_storage_on_the_local_disk_says_so(tmp_path, settings):
    settings.MEDIA_ROOT = tmp_path

    output = _run("check_storage")

    assert "local disk" in output
    assert "OK" in output


def test_migrate_media_refuses_to_run_without_r2(tmp_path):
    with pytest.raises(CommandError) as error:
        _run("migrate_media_to_storage", source=str(tmp_path))

    assert "not configured" in str(error.value)


@pytest.fixture
def old_local_attachment(draft_period, store_ho, tmp_path):
    """A row uploaded before R2: the file only exists on local disk."""
    name = "reconciliation/BKN-2026-07-01/old.pdf"
    local = tmp_path / name
    local.parent.mkdir(parents=True)
    local.write_bytes(b"%PDF-1.4 old")
    return ReconciliationPeriodAttachment.objects.create(
        period=draft_period,
        uploaded_by=store_ho,
        file=name,
        original_name="old.pdf",
        content_type="application/pdf",
        size_bytes=12,
    )


@pytest.mark.django_db
def test_migrate_media_copies_old_files_and_can_be_rerun(
    old_local_attachment, tmp_path, r2_storage
):
    dry = _run(
        "migrate_media_to_storage",
        source=str(tmp_path),
        dry_run=True,
    )
    assert "would copy 1" in dry
    assert r2_storage.keys() == []

    first = _run("migrate_media_to_storage", source=str(tmp_path))
    assert "copied 1" in first
    assert r2_storage.keys() == [
        f"{r2_storage.prefix}/{old_local_attachment.file.name}"
    ]
    # Same name the database already points at, so it now opens.
    with default_storage.open(old_local_attachment.file.name) as handle:
        assert handle.read() == b"%PDF-1.4 old"

    again = _run("migrate_media_to_storage", source=str(tmp_path))
    assert "copied 0" in again
    assert "already in storage 1" in again
    assert len(r2_storage.keys()) == 1


@pytest.mark.django_db
def test_migrate_media_reports_files_that_are_not_on_the_old_disk(
    old_local_attachment, tmp_path, r2_storage
):
    (tmp_path / old_local_attachment.file.name).unlink()

    output = _run("migrate_media_to_storage", source=str(tmp_path))

    assert "missing locally: " in output
    assert "missing locally 1" in output
    assert r2_storage.keys() == []


def test_probe_files_are_written_under_a_folder_not_at_the_root(
    r2_storage,
):
    saved = default_storage.save(
        "_healthcheck/x.txt", ContentFile(b"x")
    )

    assert r2_storage.keys() == [f"{r2_storage.prefix}/{saved}"]
