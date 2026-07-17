from django.conf import settings
from django.utils import timezone
from rest_framework.views import APIView

from apps.administration.api.permissions import (
    HasAdminPortalAccess,
)
from apps.administration.api.serializers import (
    AdminProfileSerializer,
    DashboardPeriodQuerySerializer,
    LoginTrendQuerySerializer,
    RecentActivityQuerySerializer,
    RecentLoginActivitySerializer,
)
from apps.administration.selectors.activity import (
    get_recent_login_activity,
)
from apps.administration.services.capabilities import (
    build_admin_navigation,
    get_user_capabilities,
)
from apps.administration.services.dashboard import (
    build_admin_dashboard,
    build_login_trend,
    get_dashboard_start_datetime,
    resolve_dashboard_period,
)
from apps.core.api.responses import (
    success_response,
)
from drf_spectacular.utils import (
    OpenApiParameter,
    OpenApiResponse,
    extend_schema,
)


class AdminDashboardAPIView(APIView):
    permission_classes = [
        HasAdminPortalAccess,
    ]
    throttle_scope = "admin_dashboard"

    @extend_schema(
        tags=["Admin Portal"],
        summary="Retrieve admin dashboard",
        description=(
            "Returns user, authentication and "
            "account security metrics for the "
            "authenticated administrator."
        ),
        parameters=[
            OpenApiParameter(
                name="period",
                type=str,
                location=OpenApiParameter.QUERY,
                required=False,
                enum=["7d", "30d", "90d"],
                description=(
                    "Dashboard reporting period."
                ),
            ),
        ],
        responses={
            200: OpenApiResponse(
                description=(
                    "Admin dashboard retrieved."
                )
            ),
            401: OpenApiResponse(
                description="Authentication required."
            ),
            403: OpenApiResponse(
                description=(
                    "Administrator access required."
                )
            ),
        },
    )
    def get(self, request):
        query_serializer = (
            DashboardPeriodQuerySerializer(
                data=request.query_params
            )
        )
        query_serializer.is_valid(
            raise_exception=True
        )

        period = query_serializer.validated_data.get(
            "period",
            "30d",
        )

        dashboard_data = build_admin_dashboard(
            period=period,
        )

        return success_response(
            message=(
                "Admin dashboard retrieved successfully."
            ),
            data=dashboard_data,
        )


class AdminLoginTrendAPIView(APIView):
    permission_classes = [
        HasAdminPortalAccess,
    ]

    @extend_schema(
        tags=["Admin Portal"],
        summary="Retrieve login trend",
        parameters=[
            OpenApiParameter(
                name="period",
                type=str,
                location=OpenApiParameter.QUERY,
                required=False,
                enum=["7d", "30d", "90d"],
            ),
        ],
        responses={
            200: OpenApiResponse(
                description="Login trend retrieved."
            ),
            401: OpenApiResponse(
                description="Authentication required."
            ),
            403: OpenApiResponse(
                description="Administrator access required."
            ),
        },
    )
    def get(self, request):
        query_serializer = LoginTrendQuerySerializer(
            data=request.query_params
        )
        query_serializer.is_valid(
            raise_exception=True
        )

        resolved_period = resolve_dashboard_period(
            query_serializer.validated_data.get(
                "period",
                "30d",
            )
        )

        start_datetime = get_dashboard_start_datetime(
            resolved_period
        )

        return success_response(
            message=(
                "Login trend retrieved successfully."
            ),
            data={
                "period": resolved_period.value,
                "items": build_login_trend(
                    start_datetime=start_datetime,
                ),
                "generated_at": timezone.now(),
            },
        )


class AdminRecentActivityAPIView(APIView):
    permission_classes = [
        HasAdminPortalAccess,
    ]

    @extend_schema(
        tags=["Admin Portal"],
        summary="Retrieve recent activity",
        parameters=[
            OpenApiParameter(
                name="limit",
                type=int,
                location=OpenApiParameter.QUERY,
                required=False,
                description=(
                    "Number of records from 1 to 50."
                ),
            ),
        ],
        responses={
            200: OpenApiResponse(
                description="Recent activity retrieved."
            ),
            401: OpenApiResponse(
                description="Authentication required."
            ),
            403: OpenApiResponse(
                description="Administrator access required."
            ),
        },
    )
    def get(self, request):
        query_serializer = (
            RecentActivityQuerySerializer(
                data=request.query_params
            )
        )
        query_serializer.is_valid(
            raise_exception=True
        )

        limit = query_serializer.validated_data.get(
            "limit",
            10,
        )

        activity = get_recent_login_activity(
            limit=limit
        )

        serialized_activity = (
            RecentLoginActivitySerializer(
                activity,
                many=True,
            ).data
        )

        return success_response(
            message=(
                "Recent administrative activity "
                "retrieved successfully."
            ),
            data={
                "items": serialized_activity,
                "limit": limit,
                "generated_at": timezone.now(),
            },
        )


class AdminProfileAPIView(APIView):
    permission_classes = [
        HasAdminPortalAccess,
    ]

    @extend_schema(
        tags=["Admin Portal"],
        summary="Retrieve administrator profile",
        responses={
            200: OpenApiResponse(
                description="Administrator profile retrieved."
            ),
            401: OpenApiResponse(
                description="Authentication required."
            ),
            403: OpenApiResponse(
                description="Administrator access required."
            ),
        },
    )
    def get(self, request):
        return success_response(
            message=(
                "Administrator profile "
                "retrieved successfully."
            ),
            data=AdminProfileSerializer(
                request.user
            ).data,
        )


class AdminCapabilitiesAPIView(APIView):
    permission_classes = [
        HasAdminPortalAccess,
    ]

    @extend_schema(
        tags=["Admin Portal"],
        summary=(
            "Retrieve administrator capabilities "
            "and navigation"
        ),
        responses={
            200: OpenApiResponse(
                description=(
                    "Administrator capabilities retrieved."
                )
            ),
            401: OpenApiResponse(
                description="Authentication required."
            ),
            403: OpenApiResponse(
                description="Administrator access required."
            ),
        },
    )
    def get(self, request):
        return success_response(
            message=(
                "Administrator capabilities "
                "retrieved successfully."
            ),
            data={
                "role": request.user.role,
                "capabilities": (
                    get_user_capabilities(
                        user=request.user
                    )
                ),
                "navigation": (
                    build_admin_navigation(
                        user=request.user
                    )
                ),
            },
        )


class ServerTimeAPIView(APIView):
    permission_classes = [
        HasAdminPortalAccess,
    ]

    @extend_schema(
        tags=["Admin Portal"],
        summary="Retrieve authoritative server time",
        responses={
            200: OpenApiResponse(
                description="Server time retrieved."
            ),
            401: OpenApiResponse(
                description="Authentication required."
            ),
            403: OpenApiResponse(
                description="Administrator access required."
            ),
        },
    )
    def get(self, request):
        current_datetime = timezone.localtime(
            timezone.now()
        )

        return success_response(
            message=(
                "Server time retrieved successfully."
            ),
            data={
                "datetime": current_datetime,
                "date": current_datetime.date(),
                "time": current_datetime.time(),
                "timezone": settings.TIME_ZONE,
                "unix_timestamp": int(
                    current_datetime.timestamp()
                ),
            },
        )
