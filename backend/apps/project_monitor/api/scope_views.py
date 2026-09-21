from rest_framework.views import APIView

from apps.authentication.models import (
    AccountStatus,
    User,
    UserRole,
)
from apps.core.api.responses import success_response
from apps.organization.models import Site
from apps.project_monitor.api.permissions import (
    HasProjectMonitorReportingAccess,
    IsProjectMonitorAdmin,
)
from apps.project_monitor.models import (
    GRANTABLE_USER_ROLES,
    ProjectSiteAccess,
)
from apps.project_monitor.services import project_scope


class ProjectSitesAPIView(APIView):
    """
    The sites the caller may pick in Project Monitor, each with the
    tasks they may use there: every active site and task for Director
    and Admin (``read_only`` for the Director), only the granted
    sites and tasks for a Project Incharge or Project Manager.
    The shared organization dropdown lists every site to everyone, so
    Project Monitor pages use this instead.
    """

    permission_classes = [HasProjectMonitorReportingAccess]

    def get(self, request, *args, **kwargs):
        user = request.user
        sites = project_scope.project_sites_queryset(
            user
        ).order_by("site_code")
        all_tasks = list(project_scope.ALL_TASKS)
        task_map = (
            {}
            if user.role in project_scope.ALL_SITE_ROLES
            else project_scope.site_task_map(user)
        )
        read_only = user.role == UserRole.DIRECTOR

        return success_response(
            message="Project sites retrieved successfully.",
            data=[
                {
                    "id": str(site.id),
                    "code": site.site_code,
                    "label": site.site_name,
                    "is_active": site.is_active,
                    "tasks": (
                        all_tasks
                        if user.role
                        in project_scope.ALL_SITE_ROLES
                        else task_map.get(site.id, [])
                    ),
                    "read_only": read_only,
                }
                for site in sites
            ],
        )


class SiteScopeAPIView(APIView):
    """
    Admin overview of who holds what: every active Project Incharge
    and Project Manager with the sites they hold tasks on and how
    many. People with no grant at all cannot see or enter anything,
    so they are flagged.
    """

    permission_classes = [IsProjectMonitorAdmin]

    def get(self, request, *args, **kwargs):
        users = User.objects.filter(
            role__in=GRANTABLE_USER_ROLES,
            is_active=True,
            account_status=AccountStatus.ACTIVE,
        ).order_by("role", "employee_id")

        grants: dict = {}
        for grant in ProjectSiteAccess.objects.select_related(
            "site"
        ).filter(user__in=users):
            per_site = grants.setdefault(
                grant.user_id, {}
            ).setdefault(grant.site_id, {"site": grant.site, "tasks": []})
            per_site["tasks"].append(grant.role)

        rows = []
        for user in users:
            sites = [
                {
                    "id": str(entry["site"].id),
                    "code": entry["site"].site_code,
                    "name": entry["site"].site_name,
                    "task_count": len(entry["tasks"]),
                    "all_tasks": len(entry["tasks"])
                    == len(project_scope.ALL_TASKS),
                }
                for entry in grants.get(user.id, {}).values()
            ]
            sites.sort(key=lambda site: site["code"])
            rows.append(
                {
                    "id": str(user.id),
                    "employee_id": user.employee_id,
                    "name": user.full_name,
                    "role": user.role,
                    "role_label": UserRole(user.role).label,
                    "sites": sites,
                }
            )

        return success_response(
            message="Site assignments retrieved successfully.",
            data=rows,
        )
