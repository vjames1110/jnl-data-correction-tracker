from rest_framework.views import APIView

from apps.authentication.models import (
    AccountStatus,
    User,
    UserRole,
)
from apps.core.api.responses import success_response
from apps.organization.models import Site
from apps.project_monitor.api.permissions import (
    HasProjectSitePickerAccess,
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
    tasks they may view (``tasks``) and enter (``enter_tasks``)
    there: every active site for the company-wide roles (Director,
    Admin, Project Management HO, HR and Machinery departments, each
    with the tasks that role has), only the granted sites and tasks
    for a Project Incharge or Project Manager. ``read_only`` means
    the person can enter nothing on that site (the Director).
    The shared organization dropdown lists every site to everyone, so
    Project Monitor pages use this instead.
    """

    permission_classes = [HasProjectSitePickerAccess]

    def get(self, request, *args, **kwargs):
        user = request.user
        sites = project_scope.project_sites_queryset(
            user
        ).order_by("site_code")

        company_wide = project_scope.is_company_wide(user)
        if company_wide:
            role_tasks = project_scope.COMPANY_WIDE[user.role]
            view_tasks = [
                task
                for task in project_scope.ALL_TASKS
                if task in role_tasks.view
            ]
            enter_tasks = [
                task
                for task in project_scope.ALL_TASKS
                if task in role_tasks.enter
            ]
            task_map = {}
        else:
            task_map = project_scope.site_task_map(user)

        def tasks_for_site(site):
            if company_wide:
                return view_tasks, enter_tasks
            granted = task_map.get(site.id, [])
            return granted, granted

        rows = []
        for site in sites:
            view, enter = tasks_for_site(site)
            rows.append(
                {
                    "id": str(site.id),
                    "code": site.site_code,
                    "label": site.site_name,
                    "is_active": site.is_active,
                    "tasks": view,
                    "enter_tasks": enter,
                    "read_only": not enter,
                }
            )

        return success_response(
            message="Project sites retrieved successfully.",
            data=rows,
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
                    == len(project_scope.GRANTABLE_TASKS),
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
