import os
from types import SimpleNamespace

import django
import pytest


os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.testing")
os.environ.setdefault("DJANGO_SECRET_KEY", "test-secret-key")
os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")

# moto only recognises a non-AWS S3 host (such as Cloudflare R2's) if it
# is told about it before it is first imported; the r2_storage fixture
# below imports it lazily, so this is set here, up front.
R2_TEST_ACCOUNT_ID = "testaccount"
R2_TEST_BUCKET = "jnlops-test-bucket"
R2_TEST_KEY_PREFIX = "tests"
os.environ.setdefault(
    "MOTO_S3_CUSTOM_ENDPOINTS",
    f"https://{R2_TEST_ACCOUNT_ID}.r2.cloudflarestorage.com",
)

django.setup()


@pytest.fixture
def r2_storage(settings):
    """
    Point the default file storage at an in-memory, S3-compatible
    bucket configured exactly the way production configures R2 (same
    ``config.storage`` builder, R2-shaped endpoint). Yields a handle
    for looking inside that bucket: ``.client`` (boto3), ``.bucket``,
    ``.prefix`` and ``.keys()`` (every object key, sorted). No
    network, no real keys.
    """
    import boto3
    from moto import mock_aws

    from config.storage import resolve_default_storage

    with mock_aws():
        client = boto3.client(
            "s3",
            region_name="us-east-1",
            aws_access_key_id="test",
            aws_secret_access_key="test",
        )
        client.create_bucket(Bucket=R2_TEST_BUCKET)
        settings.STORAGES = {
            **settings.STORAGES,
            "default": resolve_default_storage(
                account_id=R2_TEST_ACCOUNT_ID,
                access_key_id="test",
                secret_access_key="test",
                bucket_name=R2_TEST_BUCKET,
                key_prefix=R2_TEST_KEY_PREFIX,
            ),
        }

        def keys():
            listing = client.list_objects_v2(Bucket=R2_TEST_BUCKET)
            return sorted(
                item["Key"] for item in listing.get("Contents", [])
            )

        yield SimpleNamespace(
            client=client,
            bucket=R2_TEST_BUCKET,
            prefix=R2_TEST_KEY_PREFIX,
            keys=keys,
        )
