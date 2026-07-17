from django.urls import path

from apps.administration.api.views import (
    AdminCapabilitiesAPIView,
    AdminDashboardAPIView,
    AdminLoginTrendAPIView,
    AdminProfileAPIView,
    AdminRecentActivityAPIView,
    ServerTimeAPIView,
)


app_name = "administration-api"

urlpatterns = [
    path(
        "dashboard/",
        AdminDashboardAPIView.as_view(),
        name="dashboard",
    ),
    path(
        "dashboard/login-trend/",
        AdminLoginTrendAPIView.as_view(),
        name="login-trend",
    ),
    path(
        "recent-activity/",
        AdminRecentActivityAPIView.as_view(),
        name="recent-activity",
    ),
    path(
        "profile/",
        AdminProfileAPIView.as_view(),
        name="profile",
    ),
    path(
        "capabilities/",
        AdminCapabilitiesAPIView.as_view(),
        name="capabilities",
    ),
    path(
        "server-time/",
        ServerTimeAPIView.as_view(),
        name="server-time",
    ),
]