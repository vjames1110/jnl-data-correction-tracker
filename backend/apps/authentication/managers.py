from typing import Any

from django.contrib.auth.base_user import BaseUserManager

from apps.core.utils.text import normalize_whitespace


class UserManager(BaseUserManager):
    """
    Manager for users authenticated using Employee ID.
    """

    use_in_migrations = True

    def normalize_employee_id(
        self,
        employee_id: str,
    ) -> str:
        if not employee_id:
            raise ValueError("Employee ID is required.")

        return normalize_whitespace(
            employee_id
        ).upper()

    def get_by_natural_key(
        self,
        employee_id: str,
    ):
        return self.get(
            employee_id=self.normalize_employee_id(
                employee_id
            )
        )

    def create_user(
        self,
        employee_id: str,
        password: str | None = None,
        **extra_fields: Any,
    ):
        employee_id = self.normalize_employee_id(
            employee_id
        )

        first_name = extra_fields.get("first_name")

        if not first_name:
            raise ValueError("First name is required.")

        email = extra_fields.get("email")

        if email:
            extra_fields["email"] = self.normalize_email(
                email
            )

        user = self.model(
            employee_id=employee_id,
            **extra_fields,
        )

        if password:
            user.set_password(password)
        else:
            user.set_unusable_password()

        user.full_clean(
            exclude=["password"],
        )
        user.save(using=self._db)

        return user

    def create_superuser(
        self,
        employee_id: str,
        password: str,
        **extra_fields: Any,
    ):
        from apps.authentication.models import (
            AccountStatus,
            UserRole,
        )

        extra_fields.setdefault(
            "role",
            UserRole.SUPER_ADMIN,
        )
        extra_fields.setdefault(
            "account_status",
            AccountStatus.ACTIVE,
        )
        extra_fields.setdefault(
            "is_staff",
            True,
        )
        extra_fields.setdefault(
            "is_superuser",
            True,
        )
        extra_fields.setdefault(
            "is_active",
            True,
        )
        extra_fields.setdefault(
            "must_change_password",
            False,
        )

        if extra_fields.get("is_staff") is not True:
            raise ValueError(
                "Superuser must have is_staff=True."
            )

        if extra_fields.get("is_superuser") is not True:
            raise ValueError(
                "Superuser must have is_superuser=True."
            )

        return self.create_user(
            employee_id=employee_id,
            password=password,
            **extra_fields,
        )
