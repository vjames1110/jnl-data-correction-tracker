from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.views import APIView

from apps.core.api.permissions import IsStaffUser
from apps.core.api.responses import success_response
from apps.core.services.system import (
    get_internal_system_information,
    get_public_health_information,
)


class HealthCheckAPIView(APIView):
    """
    Public health endpoint for load balancers, monitoring services,
    frontend environment checks, and deployment verification.
    """

    authentication_classes = []
    permission_classes = [AllowAny]

    def get(self, request):
        health_data = get_public_health_information()

        is_healthy = (
            health_data["database"] == "connected"
        )

        return success_response(
            message=(
                "JNL Data Correction Tracker API is operational."
                if is_healthy
                else "The API is running in a degraded state."
            ),
            data=health_data,
            status_code=(
                status.HTTP_200_OK
                if is_healthy
                else status.HTTP_503_SERVICE_UNAVAILABLE
            ),
        )


class SystemInformationAPIView(APIView):
    """
    Internal technical information for staff administrators.
    """

    permission_classes = [IsStaffUser]

    def get(self, request):
        return success_response(
            message="System information retrieved successfully.",
            data=get_internal_system_information(),
        )