"""Role groups shared by the modules that manage setup data."""

from apps.authentication.models import UserRole

# Administrators plus the Director. They manage user accounts and the
# organization (sites, departments, designations, mappings) and, in
# Project Monitor, have the same entry rights as an Admin on every
# site. Audit logs and system settings stay with the Super Admin, and
# so do Super Admin accounts themselves (see
# ``employees.services.accounts.ensure_actor_may_manage``).
SETUP_MANAGER_ROLES = frozenset(
    {
        UserRole.SUPER_ADMIN,
        UserRole.ADMIN,
        UserRole.DIRECTOR,
    }
)
