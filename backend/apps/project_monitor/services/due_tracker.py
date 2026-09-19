"""
The cross-module Due tracker: every open (not complete, not N/A)
activity whose *current* target date - the latest ``ActivityDateEntry``
- falls in the requested window, with earlier (revised-away) dates and
the last logged remark alongside. Covers Structures, Buildings,
Girders and Action Items, which all share the generic ``Activity``.
"""

from datetime import timedelta

from django.contrib.contenttypes.models import ContentType
from django.db.models import Prefetch
from django.utils import timezone

from apps.project_monitor.models import (
    Activity,
    ActivityDateEntry,
    Building,
    GirderJob,
    GirderSpan,
    Structure,
)
from apps.project_monitor.services.rollups import (
    CLOSED_STATUSES,
    MODULE_LABELS,
    _latest_due_subquery,
    _parent_models,
    site_parent_filter,
)

MODES = ("date", "week", "overdue", "upcoming")
DEFAULT_LIMIT = 500


def _window_filter(mode, on_date):
    if mode == "date":
        return {"latest_due": on_date}
    if mode == "week":
        return {
            "latest_due__gte": on_date,
            "latest_due__lte": on_date
            + timedelta(days=6),
        }
    if mode == "overdue":
        return {"latest_due__lt": on_date}
    return {
        "latest_due__gte": on_date,
        "latest_due__lte": on_date
        + timedelta(days=30),
    }


def _resolve_parents(activities):
    """
    ``{(content_type_id, object_id): (module_key, site, where)}`` for
    just the parents the given activities hang off.
    """
    wanted = {}
    for activity in activities:
        wanted.setdefault(
            activity.content_type_id, set()
        ).add(activity.object_id)

    resolved = {}
    for model, module, _ in _parent_models():
        content_type_id = (
            ContentType.objects.get_for_model(
                model
            ).id
        )
        ids = wanted.get(content_type_id)
        if not ids:
            continue

        if model is Structure:
            queryset = model.objects.select_related(
                "site", "structure_type"
            )
        elif model is GirderSpan:
            queryset = model.objects.select_related(
                "job", "job__site"
            )
        else:
            queryset = model.objects.select_related(
                "site"
            )

        for parent in queryset.filter(pk__in=ids):
            if model is Structure:
                site = parent.site
                where = (
                    f"{parent.structure_type.name}"
                    f" - {parent.name}"
                )
            elif model is Building:
                site = parent.site
                where = parent.name
                if parent.station_label:
                    where += f" - {parent.station_label}"
            elif model is GirderJob:
                site = parent.site
                where = parent.bridge_name
            elif model is GirderSpan:
                site = parent.job.site
                where = (
                    f"{parent.job.bridge_name}"
                    f" - {parent.label}"
                )
            else:
                site = parent.site
                where = (
                    parent.responsibility
                    or "Action item"
                )
            resolved[(content_type_id, parent.pk)] = (
                module,
                site,
                where,
            )
    return resolved


def due_rows(
    *,
    mode,
    on_date=None,
    site_id=None,
    limit=DEFAULT_LIMIT,
):
    if mode not in MODES:
        raise ValueError(f"Unknown mode: {mode}")

    today = timezone.localdate()
    on_date = on_date or today

    queryset = (
        Activity.objects.exclude(
            status__in=CLOSED_STATUSES
        )
        .annotate(latest_due=_latest_due_subquery())
        .filter(**_window_filter(mode, on_date))
    )
    if site_id:
        queryset = queryset.filter(
            site_parent_filter(site_id)
        )

    total = queryset.count()
    activities = list(
        queryset.order_by(
            "latest_due", "group_order", "row_order"
        )[:limit].prefetch_related(
            Prefetch(
                "date_entries",
                queryset=ActivityDateEntry.objects.order_by(
                    "id"
                ),
            ),
            "comments",
        )
    )

    parents = _resolve_parents(activities)

    rows = []
    for activity in activities:
        parent = parents.get(
            (activity.content_type_id, activity.object_id)
        )
        if parent is None:
            continue
        module, site, where = parent

        entries = list(activity.date_entries.all())
        comments = list(activity.comments.all())
        rows.append(
            {
                "activity_id": str(activity.id),
                "site_id": str(site.id),
                "site_code": site.site_code,
                "site_name": site.site_name,
                "module": module,
                "module_label": MODULE_LABELS[module],
                "where": where,
                "group": activity.group_title,
                "name": activity.name,
                "kind": activity.kind,
                "unit": activity.unit,
                "total_qty": activity.total_qty,
                "done_qty": activity.done_qty,
                "is_doc": activity.is_doc,
                "status": activity.status,
                "target_date": activity.latest_due,
                "earlier_dates": [
                    entry.target_date
                    for entry in entries[:-1]
                ],
                "last_remark": (
                    comments[-1].text
                    if comments
                    else ""
                ),
                "is_overdue": activity.latest_due
                < today,
            }
        )

    return {
        "mode": mode,
        "date": on_date,
        "total": total,
        "truncated": total > limit,
        "rows": rows,
    }
