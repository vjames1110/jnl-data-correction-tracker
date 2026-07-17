from django.db import transaction
from drf_spectacular.utils import (
    OpenApiResponse,
    extend_schema,
)
from rest_framework.permissions import (
    AllowAny,
    IsAuthenticated,
)
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import (
    TokenError,
)
from rest_framework_simplejwt.tokens import (
    RefreshToken,
)

from apps.authentication.api.serializers import (
    ChangePasswordSerializer,
    CurrentUserSerializer,
    CurrentUserResponseSerializer,
    EmptyDataResponseSerializer,
    LoginResponseSerializer,
    LoginSerializer,
    LogoutSerializer,
)
from apps.authentication.api.tokens import (
    ApplicationTokenSerializer,
)
from apps.authentication.models import (
    LoginEventType,
)
from apps.authentication.services.authentication import (
    record_login_event,
    register_successful_login,
)
from apps.authentication.services.passwords import (
    change_user_password,
)
from apps.core.api.responses import (
    error_response,
    success_response,
)


class LoginAPIView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]
    throttle_scope = "login"

    @extend_schema(
        tags=["Authentication"],
        request=LoginSerializer,
        responses={
            200: LoginResponseSerializer,
            400: OpenApiResponse(
                description="Invalid employee ID or password.",
            ),
        },
        summary="Sign in",
        description=(
            "Authenticate with an employee ID and password. "
            "Returns JWT access and refresh tokens."
        ),
    )
    @transaction.atomic
    def post(self, request):
        serializer = LoginSerializer(
            data=request.data,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)

        user = serializer.validated_data["user"]

        register_successful_login(
            user=user,
            request=request,
        )

        refresh = (
            ApplicationTokenSerializer
            .get_token(user)
        )

        return success_response(
            message="Login successful.",
            data={
                "access": str(refresh.access_token),
                "refresh": str(refresh),
                "token_type": "Bearer",
                "must_change_password": (
                    user.must_change_password
                ),
                "user": CurrentUserSerializer(
                    user
                ).data,
            },
        )


class CurrentUserAPIView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=["Authentication"],
        responses={
            200: CurrentUserResponseSerializer,
            401: OpenApiResponse(
                description="Authentication credentials were not provided.",
            ),
        },
        summary="Get current user",
    )
    def get(self, request):
        return success_response(
            message=(
                "Current user retrieved successfully."
            ),
            data=CurrentUserSerializer(
                request.user
            ).data,
        )


class ChangePasswordAPIView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=["Authentication"],
        request=ChangePasswordSerializer,
        responses={
            200: EmptyDataResponseSerializer,
            400: OpenApiResponse(
                description="Password validation failed.",
            ),
            401: OpenApiResponse(
                description="Authentication credentials were not provided.",
            ),
        },
        summary="Change password",
    )
    def post(self, request):
        serializer = ChangePasswordSerializer(
            data=request.data,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)

        change_user_password(
            user=request.user,
            new_password=(
                serializer.validated_data[
                    "new_password"
                ]
            ),
            request=request,
        )

        return success_response(
            message=(
                "Password changed successfully. "
                "Please sign in again."
            ),
            data=None,
        )


class LogoutAPIView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=["Authentication"],
        request=LogoutSerializer,
        responses={
            200: EmptyDataResponseSerializer,
            400: OpenApiResponse(
                description="The refresh token is invalid or revoked.",
            ),
            401: OpenApiResponse(
                description="Authentication credentials were not provided.",
            ),
        },
        summary="Sign out",
    )
    def post(self, request):
        serializer = LogoutSerializer(
            data=request.data,
        )
        serializer.is_valid(raise_exception=True)

        try:
            refresh_token = RefreshToken(
                serializer.validated_data[
                    "refresh"
                ]
            )
            refresh_token.blacklist()
        except TokenError:
            return error_response(
                message=(
                    "The refresh token is invalid "
                    "or has already been revoked."
                ),
                error_code="INVALID_REFRESH_TOKEN",
            )

        record_login_event(
            request=request,
            user=request.user,
            employee_id=request.user.employee_id,
            event_type=LoginEventType.LOGOUT,
            was_successful=True,
        )

        return success_response(
            message="Logout successful.",
            data=None,
        )
