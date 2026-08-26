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

def AdminUserFactory(**kwargs):
    kwargs.setdefault("role", UserRole.ADMIN)
    kwargs.setdefault("is_staff", True)
    kwargs.setdefault("must_change_password", False)

    return UserFactory(**kwargs)


def SuperAdminUserFactory(**kwargs):
    kwargs.setdefault("role", UserRole.SUPER_ADMIN)
    kwargs.setdefault("is_staff", True)
    kwargs.setdefault("is_superuser", True)
    kwargs.setdefault("must_change_password", False)

    return UserFactory(**kwargs)


def DirectorUserFactory(**kwargs):
    kwargs.setdefault("role", UserRole.DIRECTOR)
    kwargs.setdefault("must_change_password", False)

    return UserFactory(**kwargs)


def ResponsiblePersonUserFactory(**kwargs):
    kwargs.setdefault("role", UserRole.RESPONSIBLE_PERSON)
    kwargs.setdefault("must_change_password", False)

    return UserFactory(**kwargs)


def StoreHoUserFactory(**kwargs):
    kwargs.setdefault("role", UserRole.STORE_HO)
    kwargs.setdefault("must_change_password", False)

    return UserFactory(**kwargs)
