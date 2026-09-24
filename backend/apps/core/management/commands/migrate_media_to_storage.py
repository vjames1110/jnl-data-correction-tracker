from pathlib import Path

from django.apps import apps
from django.conf import settings
from django.core.files import File
from django.core.files.storage import (
    FileSystemStorage,
    default_storage,
)
from django.core.management.base import BaseCommand, CommandError
from django.db import models


def file_fields():
    """Every (model, FileField) pair in the project."""
    for model in apps.get_models():
        for field in model._meta.get_fields():
            if isinstance(field, models.FileField):
                yield model, field


class Command(BaseCommand):
    """
    Copy files that were uploaded before R2 was switched on (still in
    the local ``media`` folder) into the configured storage, under the
    same names the database already points at.

    Safe to re-run: files that are already in the bucket are skipped,
    and nothing is ever deleted from the local folder. Use --dry-run
    first to see what would be copied.
    """

    help = (
        "Copy previously uploaded files from the local media folder "
        "into the configured storage (Cloudflare R2)."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--source",
            default=str(settings.MEDIA_ROOT),
            help="Folder holding the old files "
            "(default: MEDIA_ROOT).",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Only report what would be copied.",
        )

    def handle(self, *args, **options):
        if settings.STORAGES["default"]["BACKEND"].endswith(
            "FileSystemStorage"
        ):
            raise CommandError(
                "Cloudflare R2 is not configured, so there is "
                "nothing to copy to. Set the R2_* variables first."
            )

        source_root = Path(options["source"])
        if not source_root.is_dir():
            raise CommandError(
                f"Source folder not found: {source_root}"
            )
        source = FileSystemStorage(location=str(source_root))
        dry_run = options["dry_run"]

        copied = already_there = missing = 0
        for model, field in file_fields():
            names = model._base_manager.exclude(
                **{field.name: ""}
            ).values_list(field.name, flat=True)
            label = f"{model._meta.label}.{field.name}"
            for name in names.iterator():
                if not name:
                    continue
                if default_storage.exists(name):
                    already_there += 1
                    continue
                if not source.exists(name):
                    missing += 1
                    self.stdout.write(
                        self.style.WARNING(
                            f"missing locally: {name} ({label})"
                        )
                    )
                    continue
                if dry_run:
                    copied += 1
                    self.stdout.write(f"would copy: {name}")
                    continue
                with source.open(name, "rb") as handle:
                    saved = default_storage.save(
                        name, File(handle)
                    )
                if saved != name:
                    raise CommandError(
                        f"'{name}' was stored as '{saved}'; the "
                        "database would no longer find it. Stopping."
                    )
                copied += 1
                self.stdout.write(f"copied: {name}")

        verb = "would copy" if dry_run else "copied"
        self.stdout.write(
            self.style.SUCCESS(
                f"{verb} {copied}, already in storage "
                f"{already_there}, missing locally {missing}."
            )
        )
