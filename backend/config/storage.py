"""
Where uploaded files (correction attachments, reconciliation
attachments, profile photos) are kept.

Without Cloudflare R2 configured they go to ``MEDIA_ROOT`` on the
server's own disk - fine on a developer machine, but on a host such
as Render that disk is wiped on every deploy/restart and is not
served to browsers, so uploads vanish or cannot be opened. With the
five ``R2_*`` settings present, every upload is written to a private
R2 bucket instead and read back through the app's own authenticated
download endpoints (nothing is ever public).

This lives in its own module so the decision can be unit-tested
without reloading Django settings.
"""

from django.core.exceptions import ImproperlyConfigured

LOCAL_STORAGE = {
    "BACKEND": "django.core.files.storage.FileSystemStorage",
}

S3_BACKEND = "storages.backends.s3.S3Storage"

# The settings that together mean "use R2". Either all are given (or
# derivable) or none - a half-configured bucket silently falling back
# to the throw-away local disk is the failure this exists to prevent.
REQUIRED_SETTINGS = (
    "R2_ACCESS_KEY_ID",
    "R2_SECRET_ACCESS_KEY",
    "R2_BUCKET_NAME",
)


def r2_endpoint_url(*, account_id="", endpoint_url=""):
    """
    R2's S3 endpoint. An explicit ``R2_ENDPOINT_URL`` wins (needed
    for an EU-jurisdiction bucket, whose host is
    ``<account>.eu.r2.cloudflarestorage.com``); otherwise it is built
    from the account id.
    """
    endpoint_url = (endpoint_url or "").strip().rstrip("/")
    if endpoint_url:
        return endpoint_url
    account_id = (account_id or "").strip()
    if account_id:
        return f"https://{account_id}.r2.cloudflarestorage.com"
    return ""


def is_r2_configured(
    *,
    account_id="",
    endpoint_url="",
    access_key_id="",
    secret_access_key="",
    bucket_name="",
) -> bool:
    return bool(
        r2_endpoint_url(
            account_id=account_id,
            endpoint_url=endpoint_url,
        )
        and access_key_id
        and secret_access_key
        and bucket_name
    )


def _client_config():
    # Imported here so a machine that has not configured R2 does not
    # need boto3 just to start Django.
    from botocore.config import Config

    return Config(
        signature_version="s3v4",
        retries={"max_attempts": 3, "mode": "standard"},
        # boto3 >= 1.36 adds CRC32 checksums to every upload by
        # default, which R2 rejects. Only send them when an operation
        # requires one.
        request_checksum_calculation="when_required",
        response_checksum_validation="when_required",
    )


def resolve_default_storage(
    *,
    account_id="",
    endpoint_url="",
    access_key_id="",
    secret_access_key="",
    bucket_name="",
    key_prefix="",
    signed_url_seconds=3600,
) -> dict:
    """
    The ``STORAGES["default"]`` entry: R2 when it is configured,
    local disk when none of it is, and a loud error when it is only
    partly configured.
    """
    given = {
        "R2_ACCESS_KEY_ID": access_key_id,
        "R2_SECRET_ACCESS_KEY": secret_access_key,
        "R2_BUCKET_NAME": bucket_name,
    }
    endpoint = r2_endpoint_url(
        account_id=account_id, endpoint_url=endpoint_url
    )

    if not endpoint and not any(given.values()):
        return dict(LOCAL_STORAGE)

    missing = [
        name for name, value in given.items() if not value
    ]
    if not endpoint:
        missing.insert(0, "R2_ACCOUNT_ID (or R2_ENDPOINT_URL)")
    if missing:
        raise ImproperlyConfigured(
            "Cloudflare R2 is only partly configured - missing: "
            + ", ".join(missing)
            + ". Set all of them, or none to keep using the "
            "local disk."
        )

    return {
        "BACKEND": S3_BACKEND,
        "OPTIONS": {
            "access_key": access_key_id,
            "secret_key": secret_access_key,
            "bucket_name": bucket_name,
            "endpoint_url": endpoint,
            "region_name": "auto",
            "signature_version": "s3v4",
            "addressing_style": "path",
            # Two uploads called "scan.pdf" for the same request must
            # not overwrite each other: S3Storage overwrites by
            # default, unlike the local disk, which renames.
            "file_overwrite": False,
            "default_acl": None,
            # Private bucket: any URL handed out is signed and
            # expires.
            "querystring_auth": True,
            "querystring_expire": int(signed_url_seconds),
            "location": (key_prefix or "").strip("/"),
            "client_config": _client_config(),
        },
    }
