from django.apps import AppConfig


class ProjectMonitorConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.project_monitor"
    verbose_name = "Project Monitor"

    def ready(self):
        # Registers the receivers that give people their starting
        # tasks when they are assigned in User Management or as a
        # Site's Project Manager.
        from apps.project_monitor import signals  # noqa: F401
