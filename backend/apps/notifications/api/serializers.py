from rest_framework import serializers

from apps.notifications.models import (
    Notification,
    NotificationEventType,
    NotificationPreference,
)


class NotificationSerializer(serializers.ModelSerializer):
    recipient_employee_id = serializers.CharField(
        source="recipient.employee_id",
        read_only=True,
    )
    actor_employee_id = serializers.CharField(
        source="actor.employee_id",
        read_only=True,
    )
    request_reference = serializers.CharField(
        source="correction_request.reference",
        read_only=True,
    )
    is_read = serializers.BooleanField(read_only=True)

    class Meta:
        model = Notification
        fields = [
            "id",
            "recipient",
            "recipient_employee_id",
            "actor",
            "actor_employee_id",
            "correction_request",
            "request_reference",
            "event_type",
            "severity",
            "title",
            "message",
            "deep_link",
            "payload",
            "delivered_at",
            "read_at",
            "is_read",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields


class NotificationPreferenceSerializer(
    serializers.ModelSerializer
):
    available_event_types = serializers.SerializerMethodField()

    class Meta:
        model = NotificationPreference
        fields = [
            "id",
            "user",
            "in_app_enabled",
            "email_enabled",
            "muted_event_types",
            "quiet_hours_start",
            "quiet_hours_end",
            "available_event_types",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "user",
            "available_event_types",
            "created_at",
            "updated_at",
        ]

    def get_available_event_types(self, obj):
        return [
            {
                "value": value,
                "label": label,
            }
            for value, label in NotificationEventType.choices
        ]

    def validate_muted_event_types(self, value):
        valid_events = {
            choice
            for choice, _ in NotificationEventType.choices
        }
        invalid_events = [
            event
            for event in value
            if event not in valid_events
        ]

        if invalid_events:
            raise serializers.ValidationError(
                f"Unknown notification event(s): {', '.join(invalid_events)}"
            )

        return list(dict.fromkeys(value))
