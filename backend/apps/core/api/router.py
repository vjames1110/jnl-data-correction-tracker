from django.urls import include, path


urlpatterns = [
    path(
        "",
        include("apps.core.api.urls"),
    ),
    path(
        "auth/",
        include(
            "apps.authentication.api.urls"
        ),
    ),
    path(
        "admin-portal/",
        include(
            "apps.administration.api.urls"
        ),
    ),
    path(
        "organization/",
        include(
            "apps.organization.api.urls"
        ),
    ),
    path(
        "employees/",
        include("apps.employees.api.urls"),
    ),
]
