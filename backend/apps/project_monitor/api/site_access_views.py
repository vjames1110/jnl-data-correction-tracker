from django.db import transaction
from rest_framework import serializers
from rest_framework.exceptions import (
    NotFound,
    ValidationError,
)
from rest_framework.views import APIView

from apps.authentication.models import (
    AccountStatus,
    User,
    UserRole,
)
from apps.core.api.responses import success_response
from apps.project_monitor.api.common import get_site_or_400
from apps.project_monitor.api.permissions import (
    IsProjectMonitorAdmin,
)
from apps.project_monitor.models import (
    GRANTABLE_USER_ROLES,
    ProjectSiteAccess,
    ProjectSiteAccessRole,
)
from apps.project_monitor.services import project_scope

TASK_ORDER = {
    task: index
    for index, task in enumerate(project_scope.ALL_TASKS)
}


def _check_grantable(user):
    if user.role not in GRANTABLE_USER_ROLES:
        raise serializers.ValidationError(
            {
                "user": (
                    "Only Project Incharge and Project Manager "
                    "accounts can be given site access."
                )
            }
        )
    if not user.is_active or (
        user.account_status != AccountStatus.ACTIVE
    ):
        raise serializers.ValidationError(
            {"user": "This account is not active."}
        )


def _person_row(user, tasks) -> dict:
    return {
        "user": str(user.id),
        "user_name": user.full_name,
        "user_employee_id": user.employee_id,
        "role": user.role,
        "role_label": UserRole(user.role).label,
        "tasks": sorted(tasks, key=TASK_ORDER.get),
    }


class ProjectSiteAccessSerializer(
    serializers.ModelSerializer
):
    """One grant: this person may use this task on this site."""

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
        # The (site, user, task) uniqueness is checked in
        # ``validate`` so the message is a friendly one.
        validators = []

    def validate(self, attrs):
        user = attrs["user"]
        _check_grantable(user)
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
                        "task for this site."
                    )
                }
            )
        return attrs


class SiteAccessSetSerializer(serializers.Serializer):
    site = serializers.UUIDField()
    user = serializers.UUIDField()
    tasks = serializers.ListField(
        child=serializers.ChoiceField(
            choices=ProjectSiteAccessRole.choices
        ),
        allow_empty=True,
    )


class SiteAccessListCreateAPIView(APIView):
    """
    Who may use which task on one site. Admin/Super Admin only.

    GET ``?site=`` -> the task list, every person holding a task on
    the site (with their tasks), and the Project Incharge / Project
    Manager accounts that could still be added. POST grants one task
    (the Site Access page uses the ``set`` endpoint instead).
    """

    permission_classes = [IsProjectMonitorAdmin]

    def get(self, request, *args, **kwargs):
        site = get_site_or_400(request.query_params.get("site"))

        grants: dict = {}
        for grant in ProjectSiteAccess.objects.filter(
            site=site
        ).select_related("user"):
            grants.setdefault(grant.user, set()).add(grant.role)
        people = sorted(
            (
                _person_row(user, tasks)
                for user, tasks in grants.items()
            ),
            key=lambda row: (
                row["role"],
                row["user_employee_id"],
            ),
        )

        holders = {user.id for user in grants}
        eligible = [
            {
                "id": str(user.id),
                "employee_id": user.employee_id,
                "name": user.full_name,
                "role": user.role,
                "role_label": UserRole(user.role).label,
            }
            for user in User.objects.filter(
                role__in=GRANTABLE_USER_ROLES,
                is_active=True,
                account_status=AccountStatus.ACTIVE,
            ).order_by("role", "employee_id")
            if user.id not in holders
        ]

        return success_response(
            message="Site access retrieved successfully.",
            data={
                "site": str(site.id),
                "tasks": project_scope.TASK_META,
                "people": people,
                "eligible": eligible,
            },
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
            data=ProjectSiteAccessSerializer(instance).data,
        )


class SiteAccessSetAPIView(APIView):
    """
    Replace one person's tasks on one site in a single step: tasks
    that are ticked are granted, the others removed; an empty list
    removes the person from the site altogether.
    """

    permission_classes = [IsProjectMonitorAdmin]

    def put(self, request, *args, **kwargs):
        serializer = SiteAccessSetSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        site = get_site_or_400(str(data["site"]))
        try:
            user = User.objects.get(pk=data["user"])
        except User.DoesNotExist as exc:
            raise ValidationError(
                {"user": "User not found."}
            ) from exc

        wanted = set(data["tasks"])
        if wanted:
            try:
                _check_grantable(user)
            except serializers.ValidationError as exc:
                raise ValidationError(exc.detail) from exc

        with transaction.atomic():
            existing = {
                grant.role: grant
                for grant in ProjectSiteAccess.objects.filter(
                    site=site, user=user
                )
            }
            for task, grant in existing.items():
                if task not in wanted:
                    grant.delete()
            for task in wanted - set(existing):
                ProjectSiteAccess.objects.create(
                    site=site,
                    user=user,
                    role=task,
                    created_by=request.user,
                    updated_by=request.user,
                )

        return success_response(
            message="Site access saved successfully.",
            data=_person_row(user, wanted),
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
