from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.erp.api.views import (
    ErpModuleViewSet,
    PriorityViewSet,
    ReasonCategoryViewSet,
    ResponsiblePersonMappingViewSet,
    RequestFieldConfigurationViewSet,
    VoucherTypeViewSet,
    WorkTypeViewSet,
)


app_name = "erp-api"

router = DefaultRouter()
router.register(
    "modules",
    ErpModuleViewSet,
    basename="modules",
)
router.register(
    "voucher-types",
    VoucherTypeViewSet,
    basename="voucher-types",
)
router.register(
    "work-types",
    WorkTypeViewSet,
    basename="work-types",
)
router.register(
    "reason-categories",
    ReasonCategoryViewSet,
    basename="reason-categories",
)
router.register(
    "priorities",
    PriorityViewSet,
    basename="priorities",
)
router.register(
    "responsible-person-mappings",
    ResponsiblePersonMappingViewSet,
    basename="responsible-person-mappings",
)
router.register(
    "request-field-configurations",
    RequestFieldConfigurationViewSet,
    basename="request-field-configurations",
)

urlpatterns = [
    path(
        "",
        include(router.urls),
    ),
]
