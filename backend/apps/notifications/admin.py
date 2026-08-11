from django.contrib import admin

from apps.notifications.models import (
    Notification,
    NotificationEmailDelivery,
    NotificationPreference,
)


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = [
        "recipient",
        "event_type",
        "severity",
        "correction_request",
        "read_at",
        "created_at",
    ]
    list_filter = [
        "event_type",
        "severity",
        "read_at",
        "created_at",
    ]
    search_fields = [
        "recipient__employee_id",
        "recipient__first_name",
        "recipient__last_name",
        "title",
        "message",
        "correction_request__reference",
    ]
    readonly_fields = [
        "id",
        "created_at",
        "updated_at",
    ]
    autocomplete_fields = [
        "recipient",
        "actor",
        "correction_request",
    ]


@admin.register(NotificationPreference)
class NotificationPreferenceAdmin(admin.ModelAdmin):
    list_display = [
        "user",
        "in_app_enabled",
        "email_enabled",
        "updated_at",
    ]
    search_fields = [
        "user__employee_id",
        "user__first_name",
        "user__last_name",
    ]
    readonly_fields = [
        "id",
        "created_at",
        "updated_at",
    ]
    autocomplete_fields = ["user"]


@admin.register(NotificationEmailDelivery)
class NotificationEmailDeliveryAdmin(admin.ModelAdmin):
    list_display = [
        "recipient_email",
        "status",
        "notification",
        "provider_message_id",
        "attempted_at",
        "created_at",
    ]
    list_filter = [
        "status",
        "attempted_at",
        "created_at",
    ]
    search_fields = [
        "recipient_email",
        "provider_message_id",
        "notification__title",
        "notification__recipient__employee_id",
    ]
    readonly_fields = [
        "id",
        "created_at",
        "updated_at",
    ]
    autocomplete_fields = ["notification"]
