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
    AdminCapability.VIEW_RECONCILIATION,
    AdminCapability.MANAGE_RECONCILIATION,
    AdminCapability.VIEW_PROJECT_MONITOR,
    AdminCapability.MANAGE_PROJECT_MONITOR,
    AdminCapability.VIEW_CORRECTION_REQUESTS,
    AdminCapability.ASSIGN_CORRECTION_REQUESTS,
    AdminCapability.VIEW_REPORTS,
    AdminCapability.EXPORT_REPORTS,
}


# The Director's Administration rights: user accounts, the
# organization setup and Project Management setup. Everything else in
# the Administration portal (dashboard, vouchers, reports, audit logs,
# system settings) is not part of it.
DIRECTOR_CAPABILITIES = {
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
    AdminCapability.VIEW_PROJECT_MONITOR,
    AdminCapability.MANAGE_PROJECT_MONITOR,
}


SUPER_ADMIN_ADDITIONAL_CAPABILITIES = {
    AdminCapability.VIEW_AUDIT_LOGS,
    AdminCapability.MANAGE_SYSTEM_SETTINGS,
}


def get_user_capabilities(
    *,
    user: User,
) -> list[str]:
    if user.role == UserRole.DIRECTOR:
        return sorted(
            capability.value
            for capability in DIRECTOR_CAPABILITIES
        )

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

    # "group" places an item in a collapsible sidebar section
    # (Master / Transaction / Reports); omitted entirely for
    # Dashboard and System Settings, which stay top-level links.
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
            "group": "master",
            "required_capability": (
                AdminCapability.VIEW_USERS.value
            ),
        },
        {
            "key": "organization",
            "label": "Organization Setup",
            "path": "/admin/organization",
            "icon": "building-2",
            "group": "master",
            "required_capability": (
                AdminCapability.VIEW_SITES.value
            ),
        },
        {
            "key": "vouchers",
            "label": "Voucher Configuration",
            "path": "/admin/vouchers",
            "icon": "file-text",
            "group": "master",
            "required_capability": (
                AdminCapability.VIEW_VOUCHERS.value
            ),
        },
        {
            "key": "reconciliation",
            "label": "Production Reconciliation",
            "path": "/admin/reconciliation",
            "icon": "package",
            "group": "master",
            "required_capability": (
                AdminCapability
                .VIEW_RECONCILIATION
                .value
            ),
        },
        {
            "key": "project-monitor",
            "label": "Project Monitor",
            "path": "/admin/project-monitor",
            "icon": "milestone",
            "group": "master",
            "required_capability": (
                AdminCapability
                .VIEW_PROJECT_MONITOR
                .value
            ),
        },
        {
            "key": "structure-types",
            "label": "Structure Types",
            "path": "/admin/project-monitor/structure-types",
            "icon": "layers",
            "group": "master",
            "required_capability": (
                AdminCapability
                .MANAGE_PROJECT_MONITOR
                .value
            ),
        },
        {
            "key": "rdso-span-library",
            "label": "RDSO Span Library",
            "path": "/admin/project-monitor/rdso-span-library",
            "icon": "ruler",
            "group": "master",
            "required_capability": (
                AdminCapability
                .MANAGE_PROJECT_MONITOR
                .value
            ),
        },
        {
            "key": "site-access",
            "label": "Site Access",
            "path": "/admin/project-monitor/site-access",
            "icon": "key-round",
            "group": "master",
            "required_capability": (
                AdminCapability
                .MANAGE_PROJECT_MONITOR
                .value
            ),
        },
        {
            "key": "requests",
            "label": "Correction Requests",
            "path": "/admin/requests",
            "icon": "clipboard-list",
            "group": "transaction",
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
            "group": "reports",
            "required_capability": (
                AdminCapability.VIEW_REPORTS.value
            ),
        },
        {
            "key": "audit",
            "label": "Audit Logs",
            "path": "/admin/audit",
            "icon": "history",
            "group": "reports",
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