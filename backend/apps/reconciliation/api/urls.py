from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.reconciliation.api.views import (
    ItemCategoryViewSet,
    ItemStandardViewSet,
    ItemViewSet,
    ReconciliationDashboardView,
    ReconciliationEntryViewSet,
    ReconciliationOutputEntryViewSet,
    ReconciliationPeriodAttachmentViewSet,
    ReconciliationPeriodViewSet,
    ReconciliationStatementPackView,
    ReconciliationToleranceSettingsView,
    SiteItemConfigViewSet,
)


app_name = "reconciliation-api"

router = DefaultRouter()
router.register(
    "item-categories",
    ItemCategoryViewSet,
    basename="item-categories",
)
router.register(
    "items",
    ItemViewSet,
    basename="items",
)
router.register(
    "item-standards",
    ItemStandardViewSet,
    basename="item-standards",
)
router.register(
    "site-item-configs",
    SiteItemConfigViewSet,
    basename="site-item-configs",
)
router.register(
    "periods",
    ReconciliationPeriodViewSet,
    basename="periods",
)
router.register(
    "entries",
    ReconciliationEntryViewSet,
    basename="entries",
)
router.register(
    "output-entries",
    ReconciliationOutputEntryViewSet,
    basename="output-entries",
)
router.register(
    "attachments",
    ReconciliationPeriodAttachmentViewSet,
    basename="attachments",
)

urlpatterns = [
    path(
        "tolerance-settings/",
        ReconciliationToleranceSettingsView.as_view(),
        name="tolerance-settings",
    ),
    path(
        "dashboard/",
        ReconciliationDashboardView.as_view(),
        name="dashboard",
    ),
    path(
        "statement-pack/",
        ReconciliationStatementPackView.as_view(),
        name="statement-pack",
    ),
    path(
        "",
        include(router.urls),
    ),
]
