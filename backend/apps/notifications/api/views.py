from drf_spectacular.utils import (
    OpenApiResponse,
    extend_schema,
)
from rest_framework import mixins, viewsets
from rest_framework.decorators import action

from apps.core.api.responses import success_response
from apps.notifications.api.serializers import (
    NotificationPreferenceSerializer,
    NotificationSerializer,
)
from apps.notifications.models import Notification
from apps.notifications.services.preferences import (
    get_or_create_preferences,
)


class NotificationViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    serializer_class = NotificationSerializer
    lookup_field = "id"
    filterset_fields = [
        "event_type",
        "severity",
        "read_at",
        "correction_request",
    ]
    search_fields = [
        "title",
        "message",
        "correction_request__reference",
    ]
    ordering_fields = [
        "created_at",
        "delivered_at",
        "read_at",
    ]
    ordering = ["-created_at"]

    def get_queryset(self):
        return (
            Notification.objects.select_related(
                "recipient",
                "actor",
                "correction_request",
            )
            .filter(recipient=self.request.user)
            .order_by("-created_at")
        )

    @extend_schema(
        tags=["Notifications"],
        responses={
            200: OpenApiResponse(
                response=NotificationPreferenceSerializer,
                description=(
                    "Current user's notification preferences."
                ),
            ),
        },
        summary="Retrieve notification preferences",
    )
    @action(
        detail=False,
        methods=["get", "patch"],
        url_path="preferences",
    )
    def preferences(self, request, *args, **kwargs):
        preference = get_or_create_preferences(
            request.user
        )

        if request.method == "PATCH":
            serializer = NotificationPreferenceSerializer(
                preference,
                data=request.data,
                partial=True,
            )
            serializer.is_valid(raise_exception=True)
            serializer.save()
            return success_response(
                message=(
                    "Notification preferences updated successfully."
                ),
                data=serializer.data,
            )

        serializer = NotificationPreferenceSerializer(
            preference
        )
        return success_response(
            message=(
                "Notification preferences retrieved successfully."
            ),
            data=serializer.data,
        )
