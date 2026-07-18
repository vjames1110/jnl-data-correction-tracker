from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.organization.api.views import (
    CompanyViewSet,
    DepartmentViewSet,
    DesignationViewSet,
    DirectorMappingViewSet,
    OrganizationHierarchyAPIView,
    ReportingManagerMappingViewSet,
    SiteDepartmentMappingViewSet,
    SiteViewSet,
)


app_name = "organization-api"

router = DefaultRouter()
router.register(
    "companies",
    CompanyViewSet,
    basename="companies",
)
router.register(
    "sites",
    SiteViewSet,
    basename="sites",
)
router.register(
    "departments",
    DepartmentViewSet,
    basename="departments",
)
router.register(
    "designations",
    DesignationViewSet,
    basename="designations",
)
router.register(
    "site-department-mappings",
    SiteDepartmentMappingViewSet,
    basename="site-department-mappings",
)
router.register(
    "director-mappings",
    DirectorMappingViewSet,
    basename="director-mappings",
)
router.register(
    "reporting-manager-mappings",
    ReportingManagerMappingViewSet,
    basename="reporting-manager-mappings",
)

urlpatterns = [
    path(
        "hierarchy/",
        OrganizationHierarchyAPIView.as_view(),
        name="hierarchy",
    ),
    path(
        "",
        include(router.urls),
    ),
]
