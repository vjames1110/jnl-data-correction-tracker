from rest_framework.permissions import (
    BasePermission,
)

from apps.authentication.models import (
    UserRole,
)


class HasRole(BasePermission):
    allowed_roles: tuple[str, ...] = ()

    def has_permission(
        self,
        request,
        view,
    ) -> bool:
        user = request.user

        return bool(
            user
            and user.is_authenticated
            and user.is_active
            and user.role in self.allowed_roles
        )


class IsSuperAdmin(HasRole):
    allowed_roles = (
        UserRole.SUPER_ADMIN,
    )


class IsAdminUser(HasRole):
    allowed_roles = (
        UserRole.SUPER_ADMIN,
        UserRole.ADMIN,
    )


class IsDirector(HasRole):
    allowed_roles = (
        UserRole.DIRECTOR,
    )


class IsRequester(HasRole):
    allowed_roles = (
        UserRole.USER,
    )


class IsResponsiblePerson(HasRole):
    allowed_roles = (
        UserRole.RESPONSIBLE_PERSON,
    )


class IsManagementUser(HasRole):
    allowed_roles = (
        UserRole.SUPER_ADMIN,
        UserRole.ADMIN,
        UserRole.DIRECTOR,
    )