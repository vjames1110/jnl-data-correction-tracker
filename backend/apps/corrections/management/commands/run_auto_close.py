from django.core.management.base import BaseCommand

from apps.corrections.services.closure import (
    get_auto_close_settings,
    run_auto_close_reminder_sweep,
    run_auto_close_sweep,
)


class Command(BaseCommand):
    """
    Close resolved requests the requester never confirmed or
    reopened within the configured auto-close window, and send
    reminders for the ones approaching it.

    Intended to be scheduled outside of Django (OS cron / Windows
    Task Scheduler) until Celery Beat is introduced. Policy is
    configured through `CorrectionAutoCloseSettings` (Django Admin).
    """

    help = (
        "Auto-close resolved correction requests past the "
        "configured window and send reminders for upcoming ones."
    )

    def handle(self, *args, **options):
        settings = get_auto_close_settings()
        if not settings.is_enabled:
            self.stdout.write(
                "Auto-close is disabled; nothing to do."
            )
            return

        reminder_summary = (
            run_auto_close_reminder_sweep()
        )
        closed_summary = run_auto_close_sweep()

        self.stdout.write(
            self.style.SUCCESS(
                "Reminded "
                f"{len(reminder_summary['reminded'])} "
                "request(s): "
                f"{', '.join(reminder_summary['reminded']) or '-'}"
            )
        )
        self.stdout.write(
            self.style.SUCCESS(
                "Auto-closed "
                f"{len(closed_summary['closed'])} "
                "request(s): "
                f"{', '.join(closed_summary['closed']) or '-'}"
            )
        )
