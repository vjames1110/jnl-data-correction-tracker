from apps.notifications.models import (
    NotificationPreference,
)


def get_or_create_preferences(user):
    preference, _ = (
        NotificationPreference.objects.get_or_create(
            user=user
        )
    )

    return preference
