from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.notifications.api.views import (
    NotificationViewSet,
)


app_name = "notifications-api"

router = DefaultRouter()
router.register(
    "notifications",
    NotificationViewSet,
    basename="notifications",
)

urlpatterns = [
    path(
        "",
        include(router.urls),
    ),
]
