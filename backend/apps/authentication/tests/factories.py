from apps.authentication.models import (
    AccountStatus,
    User,
    UserRole,
)


_user_sequence = 0


def UserFactory(**kwargs):
    global _user_sequence

    _user_sequence += 1

    password = kwargs.pop(
        "password",
        "StrongTestPassword@123",
    )

    defaults = {
        "employee_id": f"JNL{_user_sequence:05d}",
        "first_name": "Test",
        "last_name": "User",
        "role": UserRole.USER,
        "account_status": AccountStatus.ACTIVE,
        "is_active": True,
        "must_change_password": False,
    }
    defaults.update(kwargs)

    return User.objects.create_user(
        password=password,
        **defaults,
    )
