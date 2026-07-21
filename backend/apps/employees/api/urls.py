from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.employees.api.views import (
    EmployeeProfileViewSet,
)


app_name = "employees-api"

router = DefaultRouter()
router.register(
    "profiles",
    EmployeeProfileViewSet,
    basename="profiles",
)

urlpatterns = [
    path(
        "",
        include(router.urls),
    ),
]
