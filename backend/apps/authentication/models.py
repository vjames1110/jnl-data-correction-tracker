import uuid

from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin
from django.db import models
from django.utils import timezone

from apps.authentication.managers import UserManager


class UserRole(models.TextChoices):
    SUPER_ADMIN = "SUPER_ADMIN", "Super Admin"
    ADMIN = "ADMIN", "Admin"
    USER = "USER", "Request Creator"
    DIRECTOR = "DIRECTOR", "Director"
    RESPONSIBLE_PERSON = (
        "RESPONSIBLE_PERSON",
        "Work Assignee",
    )
    EMPLOYEE = "EMPLOYEE", "Employee"


class AccountStatus(models.TextChoices):
    ACTIVE = "ACTIVE", "Active"
    INACTIVE = "INACTIVE", "Inactive"
    LOCKED = "LOCKED", "Locked"
    SUSPENDED = "SUSPENDED", "Suspended"


class User(AbstractBaseUser, PermissionsMixin):
    """
    Central authentication identity for every system user.

    Employee ID is the login identifier. The employee profile and
    organization relationships will be expanded in later phases.
    """

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )

    employee_id = models.CharField(
        max_length=30,
        unique=True,
        db_index=True,
    )

    email = models.EmailField(
        unique=True,
        null=True,
        blank=True,
    )

    first_name = models.CharField(
        max_length=100,
    )

    last_name = models.CharField(
        max_length=100,
        blank=True,
    )

    role = models.CharField(
        max_length=30,
        choices=UserRole.choices,
        default=UserRole.USER,
        db_index=True,
    )

    account_status = models.CharField(
        max_length=20,
        choices=AccountStatus.choices,
        default=AccountStatus.ACTIVE,
        db_index=True,
    )

    is_active = models.BooleanField(
        default=True,
        db_index=True,
    )

    is_staff = models.BooleanField(
        default=False,
    )

    must_change_password = models.BooleanField(
        default=True,
    )

    password_changed_at = models.DateTimeField(
        null=True,
        blank=True,
    )

    failed_login_attempts = models.PositiveSmallIntegerField(
        default=0,
    )

    locked_until = models.DateTimeField(
        null=True,
        blank=True,
    )

    last_failed_login_at = models.DateTimeField(
        null=True,
        blank=True,
    )

    last_login_ip = models.GenericIPAddressField(
        null=True,
        blank=True,
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
        db_index=True,
    )

    updated_at = models.DateTimeField(
        auto_now=True,
    )

    created_by = models.ForeignKey(
        "self",
        on_delete=models.SET_NULL,
        related_name="created_users",
        null=True,
        blank=True,
    )

    updated_by = models.ForeignKey(
        "self",
        on_delete=models.SET_NULL,
        related_name="updated_users",
        null=True,
        blank=True,
    )

    objects = UserManager()

    USERNAME_FIELD = "employee_id"

    REQUIRED_FIELDS = [
        "first_name",
    ]

    class Meta:
        db_table = "authentication_user"
        ordering = ["employee_id"]
        indexes = [
            models.Index(
                fields=["role", "is_active"],
                name="auth_user_role_active_idx",
            ),
            models.Index(
                fields=["account_status"],
                name="auth_user_status_idx",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.employee_id} - {self.full_name}"

    @property
    def full_name(self) -> str:
        return " ".join(
            part
            for part in [
                self.first_name.strip(),
                self.last_name.strip(),
            ]
            if part
        )

    @property
    def is_account_locked(self) -> bool:
        if self.account_status == AccountStatus.LOCKED:
            if self.locked_until is None:
                return True

            return self.locked_until > timezone.now()

        return False

    @property
    def can_authenticate(self) -> bool:
        return (
            self.is_active
            and self.account_status == AccountStatus.ACTIVE
            and not self.is_account_locked
        )

    def mark_password_changed(self) -> None:
        self.must_change_password = False
        self.password_changed_at = timezone.now()
        self.failed_login_attempts = 0
        self.locked_until = None

    def has_role(self, *roles: str) -> bool:
        return self.role in roles
    
class LoginEventType(models.TextChoices):
    LOGIN_SUCCESS = "LOGIN_SUCCESS", "Login Success"
    LOGIN_FAILED = "LOGIN_FAILED", "Login Failed"
    LOGOUT = "LOGOUT", "Logout"
    TOKEN_REFRESH = "TOKEN_REFRESH", "Token Refresh"
    PASSWORD_CHANGED = (
        "PASSWORD_CHANGED",
        "Password Changed",
    )
    ACCOUNT_LOCKED = "ACCOUNT_LOCKED", "Account Locked"


class LoginHistory(models.Model):
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )

    user = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        related_name="login_history",
        null=True,
        blank=True,
    )

    employee_id_attempted = models.CharField(
        max_length=30,
        blank=True,
    )

    event_type = models.CharField(
        max_length=30,
        choices=LoginEventType.choices,
        db_index=True,
    )

    was_successful = models.BooleanField(
        default=False,
        db_index=True,
    )

    ip_address = models.GenericIPAddressField(
        null=True,
        blank=True,
    )

    user_agent = models.TextField(
        blank=True,
    )

    failure_reason = models.CharField(
        max_length=255,
        blank=True,
    )

    request_id = models.CharField(
        max_length=100,
        blank=True,
    )

    created_at = models.DateTimeField(
        auto_now_add=True,
        db_index=True,
    )

    class Meta:
        db_table = "authentication_login_history"
        ordering = ["-created_at"]
        verbose_name_plural = "Login history"
        indexes = [
            models.Index(
                fields=[
                    "employee_id_attempted",
                    "created_at",
                ],
                name="login_emp_date_idx",
            ),
            models.Index(
                fields=["event_type", "created_at"],
                name="login_event_date_idx",
            ),
        ]

    def __str__(self) -> str:
        return (
            f"{self.employee_id_attempted} - "
            f"{self.event_type} - "
            f"{self.created_at}"
        )