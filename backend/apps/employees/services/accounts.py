import secrets
import string

from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.authentication.models import (
    AccountStatus,
    User,
    UserRole,
)
from apps.employees.models import EmployeeProfile

try:
    from rest_framework_simplejwt.token_blacklist.models import (
        BlacklistedToken,
        OutstandingToken,
    )
except ImportError:  # pragma: no cover
    BlacklistedToken = None
    OutstandingToken = None


TEMP_PASSWORD_CHARACTERS = (
    string.ascii_letters
    + string.digits
    + "!@#$%^&*"
)


def generate_temporary_password(length: int = 14) -> str:
    if length < 12:
        raise ValueError(
            "Temporary password length must be at least 12."
        )

    required_characters = [
        secrets.choice(string.ascii_lowercase),
        secrets.choice(string.ascii_uppercase),
        secrets.choice(string.digits),
        secrets.choice("!@#$%^&*"),
    ]
    remaining = [
        secrets.choice(TEMP_PASSWORD_CHARACTERS)
        for _ in range(length - len(required_characters))
    ]
    password_characters = (
        required_characters + remaining
    )
    secrets.SystemRandom().shuffle(
        password_characters
    )

    return "".join(password_characters)


@transaction.atomic
def create_account_for_employee(
    *,
    profile: EmployeeProfile,
    role: str,
    send_notification: bool = False,
):
    if profile.user_id:
        raise ValidationError(
            {
                "user": [
                    "Employee already has a user account."
                ]
            }
        )

    if User.objects.filter(
        employee_id=profile.employee_id
    ).exists():
        raise ValidationError(
            {
                "employee_id": [
                    "A user account already exists for this employee ID."
                ]
            }
        )

    temporary_password = generate_temporary_password()
    user = User.objects.create_user(
        employee_id=profile.employee_id,
        password=temporary_password,
        email=profile.email or None,
        first_name=profile.first_name,
        last_name=profile.last_name,
        role=role,
        account_status=AccountStatus.ACTIVE,
        is_active=True,
        is_staff=role
        in {
            UserRole.ADMIN,
            UserRole.SUPER_ADMIN,
        },
        is_superuser=role == UserRole.SUPER_ADMIN,
        must_change_password=True,
    )

    profile.user = user
    profile.role = role
    profile.is_active = True
    profile.save()

    return {
        "user": user,
        "temporary_password": temporary_password,
        "notification": {
            "sent": bool(send_notification),
            "channel": (
                "email" if send_notification else ""
            ),
        },
    }


@transaction.atomic
def reset_temporary_password(user: User) -> dict:
    temporary_password = generate_temporary_password()
    user.set_password(temporary_password)
    user.must_change_password = True
    user.password_changed_at = None
    user.failed_login_attempts = 0
    user.locked_until = None
    user.account_status = AccountStatus.ACTIVE
    user.is_active = True
    user.save(
        update_fields=[
            "password",
            "must_change_password",
            "password_changed_at",
            "failed_login_attempts",
            "locked_until",
            "account_status",
            "is_active",
            "updated_at",
        ]
    )

    return {
        "temporary_password": temporary_password,
    }


def unlock_account(user: User) -> User:
    user.failed_login_attempts = 0
    user.locked_until = None
    if user.account_status == AccountStatus.LOCKED:
        user.account_status = AccountStatus.ACTIVE
    user.save(
        update_fields=[
            "failed_login_attempts",
            "locked_until",
            "account_status",
            "updated_at",
        ]
    )

    return user


def suspend_account(user: User) -> User:
    user.account_status = AccountStatus.SUSPENDED
    user.is_active = False
    user.save(
        update_fields=[
            "account_status",
            "is_active",
            "updated_at",
        ]
    )

    return user


def reactivate_account(user: User) -> User:
    user.account_status = AccountStatus.ACTIVE
    user.is_active = True
    user.locked_until = None
    user.failed_login_attempts = 0
    user.save(
        update_fields=[
            "account_status",
            "is_active",
            "locked_until",
            "failed_login_attempts",
            "updated_at",
        ]
    )

    return user


@transaction.atomic
def change_account_role(
    *,
    profile: EmployeeProfile,
    role: str,
) -> User:
    user = _require_profile_user(profile)
    user.role = role
    user.is_staff = role in {
        UserRole.ADMIN,
        UserRole.SUPER_ADMIN,
    }
    user.is_superuser = role == UserRole.SUPER_ADMIN
    user.save(
        update_fields=[
            "role",
            "is_staff",
            "is_superuser",
            "updated_at",
        ]
    )

    profile.role = role
    profile.save(update_fields=["role", "updated_at"])

    return user


def revoke_user_sessions(user: User) -> int:
    if (
        OutstandingToken is None
        or BlacklistedToken is None
    ):
        return 0

    revoked_count = 0
    tokens = OutstandingToken.objects.filter(
        user=user,
        expires_at__gt=timezone.now(),
    )

    for token in tokens:
        _, created = BlacklistedToken.objects.get_or_create(
            token=token
        )
        if created:
            revoked_count += 1

    return revoked_count


def _require_profile_user(
    profile: EmployeeProfile,
) -> User:
    if not profile.user_id:
        raise ValidationError(
            {
                "user": [
                    "Employee does not have a user account."
                ]
            }
        )

    return profile.user
