"""
Re-run the variance calculation on stored reconciliation entries.

An entry's actual/theoretical/variance figures and status are worked
out when the entry is saved. An entry saved under an older version of
the calculation, or before its standards were configured, keeps those
old figures until it is saved again - and an approved period is never
edited again, so its statement can show "-" where real figures belong.

Shows what would change by default; ``--apply`` writes. Approved
periods are only touched with ``--include-approved``, since that
changes figures on a statement someone has already signed off.
"""

from django.core.management.base import BaseCommand
from django.db import transaction

from apps.reconciliation.models import (
    ReconciliationEntry,
    ReconciliationPeriodStatus,
)
from apps.reconciliation.services.variance import (
    compute_entry_variance,
)

FIELDS = (
    "actual_quantity",
    "theoretical_or_book_quantity",
    "variance_quantity",
    "variance_value",
    "status",
)


class Command(BaseCommand):
    help = (
        "Recalculate stored reconciliation entries whose figures are "
        "out of date. Dry run unless --apply is given."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--apply",
            action="store_true",
            help="Write the recalculated figures.",
        )
        parser.add_argument(
            "--include-approved",
            action="store_true",
            help="Also recalculate entries in approved periods.",
        )
        parser.add_argument(
            "--site",
            help="Only this site code.",
        )
        parser.add_argument(
            "--month",
            help="Only this month, YYYY-MM.",
        )

    def handle(self, *args, **options):
        entries = ReconciliationEntry.objects.select_related(
            "item", "period__site"
        ).order_by("period__period_month", "period__site__site_code")
        if not options["include_approved"]:
            entries = entries.exclude(
                period__status=ReconciliationPeriodStatus.APPROVED
            )
        if options["site"]:
            entries = entries.filter(
                period__site__site_code__iexact=options["site"]
            )
        if options["month"]:
            year, month = options["month"].split("-")
            entries = entries.filter(
                period__period_month__year=int(year),
                period__period_month__month=int(month),
            )

        changed = 0
        checked = 0
        with transaction.atomic():
            for entry in entries:
                checked += 1
                before = [getattr(entry, f) for f in FIELDS]
                compute_entry_variance(entry)
                after = [getattr(entry, f) for f in FIELDS]
                if before == after:
                    continue
                changed += 1
                self.stdout.write(
                    f"{entry.period.site.site_code} "
                    f"{entry.period.period_month:%Y-%m} "
                    f"[{entry.period.status}] {entry.item.item_name}: "
                    f"{before[4]} -> {after[4]}, "
                    f"actual {before[0]} -> {after[0]}, "
                    f"value {before[3]} -> {after[3]}"
                )
                if options["apply"]:
                    # A full save also refreshes the entry's flags.
                    entry.save()

        verb = "Updated" if options["apply"] else "Would update"
        self.stdout.write(
            self.style.SUCCESS(
                f"{verb} {changed} of {checked} entries."
            )
        )
        if changed and not options["apply"]:
            self.stdout.write(
                "Dry run - nothing was written. Re-run with --apply."
            )
