from django.db import connection
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView


class HealthCheckAPIView(APIView):
    """
    Public endpoint used to verify that the API and database are available.
    """

    authentication_classes = []
    permission_classes = [AllowAny]

    def get(self, request) -> Response:
        database_status = "connected"

        try:
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1")
                cursor.fetchone()
        except Exception:
            database_status = "unavailable"

        is_healthy = database_status == "connected"

        return Response(
            {
                "success": is_healthy,
                "message": (
                    "JNL Data Correction Tracker API is operational."
                    if is_healthy
                    else "The API is running, but the database is unavailable."
                ),
                "data": {
                    "service": "jnl-data-correction-tracker-api",
                    "api_version": "v1",
                    "database": database_status,
                    "timestamp": timezone.now(),
                },
            },
            status=(
                status.HTTP_200_OK
                if is_healthy
                else status.HTTP_503_SERVICE_UNAVAILABLE
            ),
        )