from django.contrib.auth.password_validation import (
    validate_password,
)
from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone

from apps.authentication.models import (
    LoginEventType,
    User,
)
from apps.authentication.services.authentication import (
    record_login_event,
)


@transaction.atomic
def change_user_password(
    *,
    user: User,
    new_password: str,
    request,
) -> User:
    try:
        validate_password(
            password=new_password,
            user=user,
        )
    except ValidationError:
        raise

    user.set_password(new_password)
    user.mark_password_changed()

    user.save(
        update_fields=[
            "password",
            "must_change_password",
            "password_changed_at",
            "failed_login_attempts",
            "locked_until",
            "updated_at",
        ]
    )

    record_login_event(
        request=request,
        user=user,
        employee_id=user.employee_id,
        event_type=LoginEventType.PASSWORD_CHANGED,
        was_successful=True,
    )

    return user