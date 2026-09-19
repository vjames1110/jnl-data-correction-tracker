from rest_framework import serializers
from rest_framework.exceptions import NotFound
from rest_framework.views import APIView

from apps.authentication.models import UserRole
from apps.core.api.responses import success_response
from apps.project_monitor.api.permissions import (
    IsProjectMonitorAdmin,
)
from apps.project_monitor.models import (
    ProjectSiteAccess,
    ProjectSiteAccessRole,
)


class ProjectSiteAccessSerializer(
    serializers.ModelSerializer
):
    user_name = serializers.CharField(
        source="user.full_name", read_only=True
    )
    user_employee_id = serializers.CharField(
        source="user.employee_id", read_only=True
    )
    site_code = serializers.CharField(
        source="site.site_code", read_only=True
    )
    site_name = serializers.CharField(
        source="site.site_name", read_only=True
    )

    class Meta:
        model = ProjectSiteAccess
        fields = [
            "id",
            "site",
            "site_code",
            "site_name",
            "user",
            "user_name",
            "user_employee_id",
            "role",
            "created_at",
        ]
        read_only_fields = [
            "id",
            "site_code",
            "site_name",
            "user_name",
            "user_employee_id",
            "created_at",
        ]
        # The (site, user, role) uniqueness is checked in
        # ``validate`` so the message is a friendly one.
        validators = []

    def validate(self, attrs):
        user = attrs["user"]
        if user.role != UserRole.PROJECT_MANAGER:
            raise serializers.ValidationError(
                {
                    "user": (
                        "Only Project Manager accounts can "
                        "be given site access."
                    )
                }
            )
        if not user.is_active:
            raise serializers.ValidationError(
                {"user": "This account is not active."}
            )
        role = attrs.get(
            "role", ProjectSiteAccessRole.DPR_BILLS
        )
        if ProjectSiteAccess.objects.filter(
            site=attrs["site"], user=user, role=role
        ).exists():
            raise serializers.ValidationError(
                {
                    "user": (
                        "This person already has that "
                        "access for this site."
                    )
                }
            )
        return attrs


class SiteAccessListCreateAPIView(APIView):
    """
    Who is assigned to which site's DPR & Bills feed. Admin/Super
    Admin only - both to read and to change.
    """

    permission_classes = [IsProjectMonitorAdmin]

    def get(self, request, *args, **kwargs):
        queryset = ProjectSiteAccess.objects.select_related(
            "site", "user"
        )
        site_id = request.query_params.get("site")
        if site_id:
            queryset = queryset.filter(site_id=site_id)

        return success_response(
            message="Site access retrieved successfully.",
            data=ProjectSiteAccessSerializer(
                queryset, many=True
            ).data,
        )

    def post(self, request, *args, **kwargs):
        serializer = ProjectSiteAccessSerializer(
            data=request.data
        )
        serializer.is_valid(raise_exception=True)
        instance = serializer.save(
            created_by=request.user,
            updated_by=request.user,
        )

        return success_response(
            message="Site access granted successfully.",
            data=ProjectSiteAccessSerializer(
                instance
            ).data,
        )


class SiteAccessDetailAPIView(APIView):
    permission_classes = [IsProjectMonitorAdmin]

    def delete(self, request, pk, *args, **kwargs):
        try:
            access = ProjectSiteAccess.objects.get(pk=pk)
        except (
            ProjectSiteAccess.DoesNotExist,
            ValueError,
        ) as exc:
            raise NotFound(
                "Site access not found."
            ) from exc
        access.delete()

        return success_response(
            message="Site access removed successfully.",
            data=None,
        )
