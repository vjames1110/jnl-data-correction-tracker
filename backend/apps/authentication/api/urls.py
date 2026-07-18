from django.urls import path

from apps.authentication.api.views import (
    ChangePasswordAPIView,
    CurrentUserAPIView,
    LoginAPIView,
    LogoutAPIView,
    TokenRefreshAPIView,
    TokenVerifyAPIView,
)


app_name = "authentication-api"

urlpatterns = [
    path(
        "login/",
        LoginAPIView.as_view(),
        name="login",
    ),
    path(
        "refresh/",
        TokenRefreshAPIView.as_view(),
        name="token-refresh",
    ),
    path(
        "verify/",
        TokenVerifyAPIView.as_view(),
        name="token-verify",
    ),
    path(
        "logout/",
        LogoutAPIView.as_view(),
        name="logout",
    ),
    path(
        "me/",
        CurrentUserAPIView.as_view(),
        name="current-user",
    ),
    path(
        "change-password/",
        ChangePasswordAPIView.as_view(),
        name="change-password",
    ),
]
