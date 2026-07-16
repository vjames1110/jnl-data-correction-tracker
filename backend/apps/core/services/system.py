import platform
import sys
from typing import Any

import django
from django.conf import settings
from django.db import connection
from django.utils import timezone

from apps.core.constants.common import (
    API_VERSION,
    APPLICATION_NAME,
    COMPANY_NAME,
)


def check_database_connection() -> bool:
    """
    Verify that the configured database accepts a simple query.
    """

    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
            result = cursor.fetchone()

        return result == (1,)
    except Exception:
        return False


def get_public_health_information() -> dict[str, Any]:
    """
    Return non-sensitive public health information.
    """

    database_connected = check_database_connection()

    return {
        "application": APPLICATION_NAME,
        "company": COMPANY_NAME,
        "api_version": API_VERSION,
        "status": (
            "operational"
            if database_connected
            else "degraded"
        ),
        "database": (
            "connected"
            if database_connected
            else "unavailable"
        ),
        "timestamp": timezone.now(),
    }


def get_internal_system_information() -> dict[str, Any]:
    """
    Return internal technical information for administrators.

    This endpoint must never be publicly accessible.
    """

    return {
        "application": APPLICATION_NAME,
        "api_version": API_VERSION,
        "environment": settings.ENVIRONMENT_NAME,
        "debug": settings.DEBUG,
        "python_version": sys.version.split()[0],
        "django_version": django.get_version(),
        "operating_system": platform.system(),
        "database_engine": (
            connection.vendor
        ),
        "timestamp": timezone.now(),
    }