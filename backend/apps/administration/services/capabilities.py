from typing import Any

from apps.administration.constants.dashboard import (
    AdminCapability,
)
from apps.authentication.models import (
    User,
    UserRole,
)


ADMIN_CAPABILITIES = {
    AdminCapability.VIEW_ADMIN_DASHBOARD,
    AdminCapability.VIEW_USERS,
    AdminCapability.CREATE_USERS,
    AdminCapability.UPDATE_USERS,
    AdminCapability.DEACTIVATE_USERS,
    AdminCapability.RESET_USER_PASSWORD,
    AdminCapability.UNLOCK_USERS,
    AdminCapability.VIEW_SITES,
    AdminCapability.MANAGE_SITES,
    AdminCapability.VIEW_DEPARTMENTS,
    AdminCapability.MANAGE_DEPARTMENTS,
    AdminCapability.VIEW_VOUCHERS,
    AdminCapability.MANAGE_VOUCHERS,
    AdminCapability.VIEW_CORRECTION_REQUESTS,
    AdminCapability.ASSIGN_CORRECTION_REQUESTS,
    AdminCapability.VIEW_REPORTS,
    AdminCapability.EXPORT_REPORTS,
}


SUPER_ADMIN_ADDITIONAL_CAPABILITIES = {
    AdminCapability.VIEW_AUDIT_LOGS,
    AdminCapability.MANAGE_SYSTEM_SETTINGS,
}


def get_user_capabilities(
    *,
    user: User,
) -> list[str]:
    capabilities = set(ADMIN_CAPABILITIES)

    if user.role == UserRole.SUPER_ADMIN:
        capabilities.update(
            SUPER_ADMIN_ADDITIONAL_CAPABILITIES
        )

    return sorted(
        capability.value
        for capability in capabilities
    )


def build_admin_navigation(
    *,
    user: User,
) -> list[dict[str, Any]]:
    capabilities = set(
        get_user_capabilities(user=user)
    )

    navigation_items = [
        {
            "key": "dashboard",
            "label": "Dashboard",
            "path": "/admin/dashboard",
            "icon": "layout-dashboard",
            "required_capability": (
                AdminCapability
                .VIEW_ADMIN_DASHBOARD
                .value
            ),
        },
        {
            "key": "users",
            "label": "User Management",
            "path": "/admin/users",
            "icon": "users",
            "required_capability": (
                AdminCapability.VIEW_USERS.value
            ),
        },
        {
            "key": "organization",
            "label": "Organization Setup",
            "path": "/admin/organization",
            "icon": "building-2",
            "required_capability": (
                AdminCapability.VIEW_SITES.value
            ),
        },
        {
            "key": "vouchers",
            "label": "Voucher Configuration",
            "path": "/admin/vouchers",
            "icon": "file-text",
            "required_capability": (
                AdminCapability.VIEW_VOUCHERS.value
            ),
        },
        {
            "key": "requests",
            "label": "Correction Requests",
            "path": "/admin/requests",
            "icon": "clipboard-list",
            "required_capability": (
                AdminCapability
                .VIEW_CORRECTION_REQUESTS
                .value
            ),
        },
        {
            "key": "reports",
            "label": "Reports and Analytics",
            "path": "/admin/reports",
            "icon": "chart-no-axes-combined",
            "required_capability": (
                AdminCapability.VIEW_REPORTS.value
            ),
        },
        {
            "key": "audit",
            "label": "Audit Logs",
            "path": "/admin/audit",
            "icon": "history",
            "required_capability": (
                AdminCapability.VIEW_AUDIT_LOGS.value
            ),
        },
        {
            "key": "settings",
            "label": "System Settings",
            "path": "/admin/settings",
            "icon": "settings",
            "required_capability": (
                AdminCapability
                .MANAGE_SYSTEM_SETTINGS
                .value
            ),
        },
    ]

    return [
        item
        for item in navigation_items
        if item["required_capability"]
        in capabilities
    ]