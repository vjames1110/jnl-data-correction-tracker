from django.urls import path

from apps.core.api.views import (
    HealthCheckAPIView,
    SystemInformationAPIView,
)


app_name = "core-api"

urlpatterns = [
    path(
        "health/",
        HealthCheckAPIView.as_view(),
        name="health-check",
    ),
    path(
        "system/",
        SystemInformationAPIView.as_view(),
        name="system-information",
    ),
]