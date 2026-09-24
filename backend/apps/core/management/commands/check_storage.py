import uuid

from django.conf import settings
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.core.management.base import BaseCommand, CommandError

# Botocore error codes -> what to actually do about them. R2 answers
# with the same handful of codes whenever a key, bucket or account id
# is wrong, and the raw message rarely says which.
HINTS = {
    "InvalidAccessKeyId": (
        "R2_ACCESS_KEY_ID is not recognised. Re-create the API token "
        "and copy the Access Key ID again."
    ),
    "SignatureDoesNotMatch": (
        "R2_SECRET_ACCESS_KEY does not match the access key. Copy "
        "the Secret Access Key again (it is only shown once when the "
        "token is created) and check for stray spaces."
    ),
    "AccessDenied": (
        "The token is valid but not allowed to use this bucket. "
        "Give it 'Object Read & Write' and include this bucket."
    ),
    "NoSuchBucket": (
        "There is no bucket with this name in this account. Check "
        "R2_BUCKET_NAME and R2_ACCOUNT_ID."
    ),
    "EndpointConnectionError": (
        "Could not reach R2. Check R2_ACCOUNT_ID (or "
        "R2_ENDPOINT_URL) and the server's internet access."
    ),
}


class Command(BaseCommand):
    """
    Prove that uploaded files can actually be saved and read back.

    Writes a small throw-away file through the same storage the
    attachments use, reads it back, compares it and deletes it. Run
    it once after setting the R2_* variables - locally and on the
    server - instead of finding out from a user's failed upload.
    """

    help = (
        "Check that file uploads work: save, read back and delete a "
        "small test file in the configured storage."
    )

    def handle(self, *args, **options):
        storage_settings = settings.STORAGES["default"]
        backend = storage_settings["BACKEND"]
        storage_options = storage_settings.get("OPTIONS", {})
        is_local = backend.endswith("FileSystemStorage")

        if is_local:
            self.stdout.write(
                f"Storage : local disk ({settings.MEDIA_ROOT})"
            )
            if not settings.DEBUG:
                self.stdout.write(
                    self.style.WARNING(
                        "WARNING: this is not Cloudflare R2. On a "
                        "hosted server this disk is wiped on every "
                        "deploy and uploads will be lost. Set the "
                        "R2_* variables."
                    )
                )
        else:
            self.stdout.write("Storage : Cloudflare R2 (S3 API)")
            self.stdout.write(
                f"Bucket  : {storage_options.get('bucket_name')}"
            )
            self.stdout.write(
                f"Endpoint: {storage_options.get('endpoint_url')}"
            )
            prefix = storage_options.get("location") or "(bucket root)"
            self.stdout.write(f"Folder  : {prefix}")

        name = f"_healthcheck/{uuid.uuid4().hex}.txt"
        payload = b"jnlops storage check"
        saved_name = None
        try:
            saved_name = default_storage.save(
                name, ContentFile(payload)
            )
            with default_storage.open(saved_name, "rb") as handle:
                echoed = handle.read()
        except Exception as error:  # noqa: BLE001 - report any cause
            raise CommandError(self._explain(error)) from error
        finally:
            if saved_name:
                try:
                    default_storage.delete(saved_name)
                except Exception:  # noqa: BLE001
                    self.stdout.write(
                        self.style.WARNING(
                            f"Could not remove the test file "
                            f"'{saved_name}'; delete it by hand."
                        )
                    )

        if echoed != payload:
            raise CommandError(
                "The file was saved but what was read back is not "
                "what was written."
            )

        self.stdout.write(
            self.style.SUCCESS(
                "OK - saved, read back and deleted a test file."
            )
        )

    @staticmethod
    def _explain(error):
        code = (
            getattr(error, "response", {})
            .get("Error", {})
            .get("Code")
        )
        if code is None:
            code = type(error).__name__
        hint = HINTS.get(code)
        detail = f"{code}: {error}"
        return f"{detail}\n  -> {hint}" if hint else detail
