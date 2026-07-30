from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.corrections.api.views import (
    CorrectionApprovalStepViewSet,
    CorrectionRequestAttachmentViewSet,
    CorrectionRequestDraftViewSet,
    CorrectionRequestViewSet,
    CorrectionRequestTimelineViewSet,
)


app_name = "corrections-api"

router = DefaultRouter()
router.register(
    "requests",
    CorrectionRequestViewSet,
    basename="requests",
)
router.register(
    "drafts",
    CorrectionRequestDraftViewSet,
    basename="drafts",
)
router.register(
    "attachments",
    CorrectionRequestAttachmentViewSet,
    basename="attachments",
)
router.register(
    "timeline",
    CorrectionRequestTimelineViewSet,
    basename="timeline",
)
router.register(
    "approvals",
    CorrectionApprovalStepViewSet,
    basename="approvals",
)

urlpatterns = [
    path(
        "",
        include(router.urls),
    ),
]
