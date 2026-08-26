from enum import Enum


class StrEnum(str, Enum):
    pass


class DashboardPeriod(StrEnum):
    LAST_7_DAYS = "7d"
    LAST_30_DAYS = "30d"
    LAST_90_DAYS = "90d"


DEFAULT_DASHBOARD_PERIOD = DashboardPeriod.LAST_30_DAYS

DASHBOARD_PERIOD_DAYS = {
    DashboardPeriod.LAST_7_DAYS: 7,
    DashboardPeriod.LAST_30_DAYS: 30,
    DashboardPeriod.LAST_90_DAYS: 90,
}


class AdminCapability(StrEnum):
    VIEW_ADMIN_DASHBOARD = "view_admin_dashboard"
    VIEW_USERS = "view_users"
    CREATE_USERS = "create_users"
    UPDATE_USERS = "update_users"
    DEACTIVATE_USERS = "deactivate_users"
    RESET_USER_PASSWORD = "reset_user_password"
    UNLOCK_USERS = "unlock_users"

    VIEW_SITES = "view_sites"
    MANAGE_SITES = "manage_sites"

    VIEW_DEPARTMENTS = "view_departments"
    MANAGE_DEPARTMENTS = "manage_departments"

    VIEW_VOUCHERS = "view_vouchers"
    MANAGE_VOUCHERS = "manage_vouchers"

    VIEW_RECONCILIATION = "view_reconciliation"
    MANAGE_RECONCILIATION = "manage_reconciliation"

    VIEW_CORRECTION_REQUESTS = (
        "view_correction_requests"
    )
    ASSIGN_CORRECTION_REQUESTS = (
        "assign_correction_requests"
    )

    VIEW_REPORTS = "view_reports"
    EXPORT_REPORTS = "export_reports"

    VIEW_AUDIT_LOGS = "view_audit_logs"
    MANAGE_SYSTEM_SETTINGS = "manage_system_settings"
