from datetime import date

from django.utils import timezone
from rest_framework.exceptions import ValidationError
from rest_framework.views import APIView

from apps.core.api.responses import success_response
from apps.organization.models import Site
from apps.project_monitor.api.common import get_site_or_400
from apps.project_monitor.api.permissions import (
    HasProjectMonitorReportingAccess,
)
from apps.project_monitor.api.serializers import (
    ProjectSiteSerializer,
)
from apps.project_monitor.models import DprItem, RaBill
from apps.project_monitor.services import (
    contract_finance,
    project_scope,
    site_access,
)
from apps.project_monitor.services.due_tracker import (
    MODES,
    due_rows,
)
from apps.project_monitor.services.rollups import (
    build_site_rollup,
    overdue_counts_for_site,
    site_activity_rollups,
    site_linear_rollups,
)

TRUTHY = {"1", "true", "yes"}


def _money_for(site, visible_ids, sites_with_finance):
    """
    Finance headline for one project, or ``None`` when the caller may
    not see this site's money or it has no DPR items or bills yet.
    """
    if site.id not in sites_with_finance:
        return None
    if visible_ids is not None and site.id not in visible_ids:
        return None
    summary = contract_finance.financial_summary(site)
    return {
        "valued": summary["valued"],
        "work_done_total": summary["work_done_total"],
        "balance_value": summary["balance_value"],
        "percent_done": summary["percent_done"],
        "per_day_required": summary["per_day_required"],
        "pace": summary["pace"],
    }


def _is_monitored(site, rollup) -> bool:
    return bool(
        rollup["has_data"]
        or site.project_name
        or site.end_date
        or site.project_value is not None
    )


def _sum_counts(projects, key):
    totals = {
        "total": 0,
        "done": 0,
        "in_progress": 0,
        "hold": 0,
        "not_started": 0,
    }
    for project in projects:
        for field in totals:
            totals[field] += project[key][field]
    done, total = totals["done"], totals["total"]
    totals["percent_complete"] = (
        round(done / total * 100, 1) if total else None
    )
    return totals


class ProjectDashboardAPIView(APIView):
    """
    The multi-project dashboard: one row per project (= Site) with
    its progress rollup, status breakdown, overdue/hold counts,
    chainage progress and contract countdown - the all-projects view
    the single-project prototype never had. Read-only, open to every
    role with Project Monitor reporting access.

    By default only sites that are actually being monitored are
    listed (they have Project Monitor data, or a project name/end
    date/value); ``?include_empty=1`` lists every active site.
    """

    permission_classes = [
        HasProjectMonitorReportingAccess,
    ]

    def get(self, request, *args, **kwargs):
        include_empty = (
            request.query_params.get(
                "include_empty", ""
            ).lower()
            in TRUTHY
        )

        sites = list(
            project_scope.project_sites_queryset(request.user)
            .select_related("site_director", "site_hod")
            .prefetch_related(
                "extensions", "chainage_segments"
            )
        )
        site_data = ProjectSiteSerializer(
            sites, many=True
        ).data

        activity_rollups = site_activity_rollups()
        linear_rollups = site_linear_rollups()

        visible_ids = site_access.visible_site_ids(
            request.user
        )
        sites_with_finance = set(
            DprItem.objects.values_list(
                "site_id", flat=True
            ).distinct()
        ) | set(
            RaBill.objects.values_list(
                "site_id", flat=True
            ).distinct()
        )

        projects = []
        hidden = 0
        for site, serialized in zip(sites, site_data):
            rollup = build_site_rollup(
                site, activity_rollups, linear_rollups
            )
            rollup["money"] = _money_for(
                site, visible_ids, sites_with_finance
            )
            if not include_empty and not _is_monitored(
                site, rollup
            ):
                hidden += 1
                continue
            projects.append(
                {"site": serialized, **rollup}
            )

        countdown = {
            "GREEN": 0,
            "ORANGE": 0,
            "RED": 0,
            "NONE": 0,
        }
        for project in projects:
            countdown[
                project["site"]["countdown_status"]
                or "NONE"
            ] += 1

        money_rows = [
            p["money"] for p in projects if p["money"]
        ]
        money_totals = (
            {
                "projects": len(money_rows),
                "valued": sum(
                    (m["valued"] for m in money_rows), 0
                ),
                "work_done_total": sum(
                    (m["work_done_total"] for m in money_rows),
                    0,
                ),
                "balance_value": sum(
                    (m["balance_value"] for m in money_rows),
                    0,
                ),
            }
            if money_rows
            else None
        )

        linear_done = sum(
            p["linear"]["done_m"] for p in projects
        )
        linear_scope = sum(
            p["linear"]["scope_m"] for p in projects
        )

        return success_response(
            message=(
                "Project dashboard retrieved "
                "successfully."
            ),
            data={
                "generated_on": timezone.localdate(),
                "totals": {
                    "projects": len(projects),
                    "hidden_empty_sites": hidden,
                    "activities": _sum_counts(
                        projects, "activities"
                    ),
                    "overdue": sum(
                        p["overdue"]["total"]
                        for p in projects
                    ),
                    "overdue_action_items": sum(
                        p["overdue"]["action_items"]
                        for p in projects
                    ),
                    "countdown": countdown,
                    "money": money_totals,
                    "linear": {
                        "done_m": linear_done,
                        "scope_m": linear_scope,
                    },
                },
                "projects": projects,
            },
        )


class DueTrackerAPIView(APIView):
    """
    Cross-module Due tracker - see ``services.due_tracker``. ``site``
    is optional: omit it for every project at once.
    """

    permission_classes = [
        HasProjectMonitorReportingAccess,
    ]

    def get(self, request, *args, **kwargs):
        mode = request.query_params.get(
            "mode", "upcoming"
        )
        if mode not in MODES:
            raise ValidationError(
                {
                    "mode": (
                        "Mode must be one of: "
                        + ", ".join(MODES)
                        + "."
                    )
                }
            )

        raw_date = request.query_params.get("date")
        try:
            on_date = (
                date.fromisoformat(raw_date)
                if raw_date
                else None
            )
        except ValueError as exc:
            raise ValidationError(
                {"date": "Date must be YYYY-MM-DD."}
            ) from exc

        site_id = request.query_params.get("site") or None
        if site_id:
            project_scope.ensure_can_view_site(
                request.user, get_site_or_400(site_id)
            )
        # Someone granted only some tasks sees due items of those
        # tasks' modules only (None = Director/Admin: everything).
        access = project_scope.module_access(request.user)

        return success_response(
            message="Due tracker retrieved successfully.",
            data=due_rows(
                mode=mode,
                on_date=on_date,
                site_id=site_id,
                access=access,
            ),
        )


class OverdueCountsAPIView(APIView):
    """
    Per-module overdue counts for one site - the badges on the
    Project Monitor tab strip.
    """

    permission_classes = [
        HasProjectMonitorReportingAccess,
    ]

    def get(self, request, *args, **kwargs):
        site_id = request.query_params.get("site")
        if not site_id:
            raise ValidationError(
                {"site": "Site is required."}
            )
        site = get_site_or_400(site_id)
        project_scope.ensure_can_view_site(request.user, site)

        return success_response(
            message=(
                "Overdue counts retrieved successfully."
            ),
            data=overdue_counts_for_site(
                site_id,
                project_scope.granted_modules(
                    request.user, site
                ),
            ),
        )
