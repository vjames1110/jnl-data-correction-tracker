from django.utils import timezone
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
        queryset = (
            Notification.objects.select_related(
                "recipient",
                "actor",
                "correction_request",
            )
            .filter(recipient=self.request.user)
            .order_by("-created_at")
        )

        read_state = (
            self.request.query_params.get(
                "read_state",
                "",
            )
            .strip()
            .lower()
        )
        is_read = (
            self.request.query_params.get(
                "is_read",
                "",
            )
            .strip()
            .lower()
        )

        if read_state == "unread" or is_read in {
            "false",
            "0",
            "no",
        }:
            return queryset.filter(read_at__isnull=True)

        if read_state == "read" or is_read in {
            "true",
            "1",
            "yes",
        }:
            return queryset.filter(read_at__isnull=False)

        return queryset

    @extend_schema(
        tags=["Notifications"],
        responses={200: NotificationSerializer},
        summary="Mark a notification as read",
    )
    @action(
        detail=True,
        methods=["post"],
        url_path="mark-read",
    )
    def mark_read(self, request, *args, **kwargs):
        notification = self.get_object()
        notification.mark_read()
        serializer = self.get_serializer(notification)
        return success_response(
            message="Notification marked as read.",
            data=serializer.data,
        )

    @extend_schema(
        tags=["Notifications"],
        responses={200: NotificationSerializer},
        summary="Mark a notification as unread",
    )
    @action(
        detail=True,
        methods=["post"],
        url_path="mark-unread",
    )
    def mark_unread(self, request, *args, **kwargs):
        notification = self.get_object()
        notification.mark_unread()
        serializer = self.get_serializer(notification)
        return success_response(
            message="Notification marked as unread.",
            data=serializer.data,
        )

    @extend_schema(
        tags=["Notifications"],
        responses={200: OpenApiResponse()},
        summary="Mark all notifications as read",
    )
    @action(
        detail=False,
        methods=["post"],
        url_path="mark-all-read",
    )
    def mark_all_read(self, request, *args, **kwargs):
        now = timezone.now()
        updated_count = self.get_queryset().filter(
            read_at__isnull=True
        ).update(
            read_at=now,
            updated_at=now,
        )

        return success_response(
            message="All notifications marked as read.",
            data={
                "updated_count": updated_count,
                "unread_count": 0,
            },
        )

    @extend_schema(
        tags=["Notifications"],
        responses={200: OpenApiResponse()},
        summary="Get unread notification count",
    )
    @action(
        detail=False,
        methods=["get"],
        url_path="unread-count",
    )
    def unread_count(self, request, *args, **kwargs):
        count = self.get_queryset().filter(
            read_at__isnull=True
        ).count()

        return success_response(
            message="Unread notification count retrieved successfully.",
            data={
                "unread_count": count,
            },
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
