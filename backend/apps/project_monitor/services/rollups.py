"""
Cross-project rollups for the multi-project dashboard and the
cross-module Due tracker. Everything here reads existing data - no
new models - and does its aggregation in a handful of grouped queries
rather than one query set per site, since the dashboard lists every
project at once.

An ``Activity`` carries only a generic ``parent``; the parent's
``site`` is resolved in bulk via ``parent_index()`` (one values-list
query per parent model) instead of per-row lookups.
"""

from collections import defaultdict

from django.contrib.contenttypes.models import ContentType
from django.db.models import Count, OuterRef, Q, Subquery
from django.utils import timezone

from apps.project_monitor.models import (
    ActionItem,
    Activity,
    ActivityDateEntry,
    ActivityStatus,
    Building,
    GirderJob,
    GirderSpan,
    LinearItem,
    LinearUnit,
    Structure,
)
from apps.project_monitor.services.linear_stats import (
    compute_item_stats,
)

MODULE_STRUCTURES = "structures"
MODULE_BUILDINGS = "buildings"
MODULE_GIRDERS = "girders"
MODULE_ACTION_ITEMS = "action_items"

MODULE_LABELS = {
    MODULE_STRUCTURES: "Structures",
    MODULE_BUILDINGS: "Buildings",
    MODULE_GIRDERS: "Girders",
    MODULE_ACTION_ITEMS: "Action Items",
}

CLOSED_STATUSES = (
    ActivityStatus.COMPLETE,
    ActivityStatus.NOT_APPLICABLE,
)


def _parent_models():
    """
    ``(model, module_key, site_lookup)`` for every model an Activity
    can hang off - ``GirderSpan`` reaches its site through its job.
    """
    return [
        (Structure, MODULE_STRUCTURES, "site_id"),
        (Building, MODULE_BUILDINGS, "site_id"),
        (GirderJob, MODULE_GIRDERS, "site_id"),
        (GirderSpan, MODULE_GIRDERS, "job__site_id"),
        (ActionItem, MODULE_ACTION_ITEMS, "site_id"),
    ]


def parent_index():
    """
    ``{(content_type_id, object_id): (module_key, site_id)}`` for
    every activity parent in the system.
    """
    index = {}
    for model, module, site_lookup in _parent_models():
        content_type_id = (
            ContentType.objects.get_for_model(
                model
            ).id
        )
        for object_id, site_id in model.objects.values_list(
            "id", site_lookup
        ):
            index[(content_type_id, object_id)] = (
                module,
                site_id,
            )
    return index


def site_parent_filter(site_id, modules=None):
    """
    A ``Q`` matching every Activity whose parent belongs to
    ``site_id`` - built from subqueries (not id lists) so it stays
    valid however many parents a site has. ``modules`` (a set of
    module keys) restricts it to those activity modules; ``None``
    means all of them.
    """
    query = Q(pk__in=[])
    for model, module, site_lookup in _parent_models():
        if modules is not None and module not in modules:
            continue
        content_type_id = (
            ContentType.objects.get_for_model(
                model
            ).id
        )
        query |= Q(
            content_type_id=content_type_id,
            object_id__in=model.objects.filter(
                **{site_lookup.removesuffix("_id"): site_id}
            ).values("id"),
        )
    return query


def _latest_due_subquery():
    return Subquery(
        ActivityDateEntry.objects.filter(
            activity=OuterRef("pk")
        )
        .order_by("-id")
        .values("target_date")[:1]
    )


def _percent(done, total):
    if not total:
        return None
    return round(float(done) / float(total) * 100, 1)


def _blank_activity_counts():
    return {
        "total": 0,
        "done": 0,
        "in_progress": 0,
        "hold": 0,
        "not_started": 0,
    }


def _add_status(bucket, status, count):
    bucket["total"] += count
    if status == ActivityStatus.COMPLETE:
        bucket["done"] += count
    elif status == ActivityStatus.IN_PROGRESS:
        bucket["in_progress"] += count
    elif status == ActivityStatus.HOLD:
        bucket["hold"] += count
    elif status == ActivityStatus.NOT_STARTED:
        bucket["not_started"] += count


def _finalise_counts(bucket):
    return {
        **bucket,
        "percent_complete": _percent(
            bucket["done"], bucket["total"]
        ),
    }


def site_activity_rollups():
    """
    ``{site_id: {"all": counts, "modules": {module: counts},
    "overdue": {"total": n, "action_items": n}}}`` for every site
    that has at least one activity. Not-applicable rows are excluded
    from every count, matching the existing per-site KPI counts.
    """
    index = parent_index()
    today = timezone.localdate()

    sites = defaultdict(
        lambda: {
            "all": _blank_activity_counts(),
            "modules": defaultdict(
                _blank_activity_counts
            ),
            "overdue": {
                "total": 0,
                "action_items": 0,
            },
        }
    )

    status_rows = (
        Activity.objects.exclude(
            status=ActivityStatus.NOT_APPLICABLE
        )
        .values(
            "content_type_id", "object_id", "status"
        )
        .annotate(n=Count("id"))
    )
    for row in status_rows:
        parent = index.get(
            (row["content_type_id"], row["object_id"])
        )
        if parent is None:
            continue
        module, site_id = parent
        entry = sites[site_id]
        _add_status(
            entry["all"], row["status"], row["n"]
        )
        _add_status(
            entry["modules"][module],
            row["status"],
            row["n"],
        )

    overdue_rows = (
        Activity.objects.exclude(
            status__in=CLOSED_STATUSES
        )
        .annotate(latest_due=_latest_due_subquery())
        .filter(latest_due__lt=today)
        .values("content_type_id", "object_id")
        .annotate(n=Count("id"))
    )
    for row in overdue_rows:
        parent = index.get(
            (row["content_type_id"], row["object_id"])
        )
        if parent is None:
            continue
        module, site_id = parent
        overdue = sites[site_id]["overdue"]
        overdue["total"] += row["n"]
        if module == MODULE_ACTION_ITEMS:
            overdue["action_items"] += row["n"]

    return sites


def site_linear_rollups():
    """
    ``{site_id: {"done_m": x, "scope_m": y}}`` across each site's
    running-metre items only - ``cum``/``nos`` are not metre-additive
    (same rule as the per-site overview).
    """
    totals = defaultdict(
        lambda: {"done_m": 0.0, "scope_m": 0.0}
    )
    items = LinearItem.objects.filter(
        unit=LinearUnit.M
    ).prefetch_related(
        "scope_patches", "progress_entries"
    )
    for item in items:
        stats = compute_item_stats(item)
        totals[item.site_id]["done_m"] += float(
            stats["done"]
        )
        totals[item.site_id]["scope_m"] += float(
            stats["scope"]
        )
    return totals


def overdue_counts_for_site(site_id, modules=None):
    """
    Overdue open activities for one site, split into the four
    activity-based modules - drives the per-tab overdue badges.
    ``modules`` limits the count to the modules the caller may see
    (the others stay 0).
    """
    index_by_ct = {
        ContentType.objects.get_for_model(model).id: (
            module
        )
        for model, module, _ in _parent_models()
    }
    rows = (
        Activity.objects.filter(
            site_parent_filter(site_id, modules)
        )
        .exclude(status__in=CLOSED_STATUSES)
        .annotate(latest_due=_latest_due_subquery())
        .filter(latest_due__lt=timezone.localdate())
        .values("content_type_id")
        .annotate(n=Count("id"))
    )
    counts = {
        MODULE_STRUCTURES: 0,
        MODULE_BUILDINGS: 0,
        MODULE_GIRDERS: 0,
        MODULE_ACTION_ITEMS: 0,
    }
    for row in rows:
        module = index_by_ct.get(row["content_type_id"])
        if module:
            counts[module] += row["n"]
    return counts


def build_site_rollup(site, activity_rollups, linear_rollups):
    activities = activity_rollups.get(site.id)
    all_counts = (
        _finalise_counts(activities["all"])
        if activities
        else _finalise_counts(_blank_activity_counts())
    )
    modules = {
        module: _finalise_counts(
            activities["modules"][module]
            if activities
            else _blank_activity_counts()
        )
        for module in MODULE_LABELS
    }
    linear = linear_rollups.get(site.id)
    linear_block = {
        "done_m": linear["done_m"] if linear else 0,
        "scope_m": linear["scope_m"] if linear else 0,
        "percent": _percent(
            linear["done_m"], linear["scope_m"]
        )
        if linear
        else None,
    }
    overdue = (
        activities["overdue"]
        if activities
        else {"total": 0, "action_items": 0}
    )
    has_data = bool(
        all_counts["total"] or linear_block["scope_m"]
    )

    return {
        "activities": all_counts,
        "modules": modules,
        "linear": linear_block,
        "overdue": overdue,
        "has_data": has_data,
        # Filled in by the finance phases; kept here so the
        # dashboard payload shape doesn't change when they land.
        "money": None,
    }
