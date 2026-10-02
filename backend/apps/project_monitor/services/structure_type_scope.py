"""
Who may see and edit which Structure Type master row.

A Structure Type is either **global** (``owner_site`` blank - the
built-ins, and anything an Admin/Director/Project HO adds directly,
usable on every site) or **site-owned** (a Project Manager/Incharge's
own type, visible and usable only on its ``owner_site`` - plus
whichever other sites an Admin/Director has added to
``distributed_sites``, which grants *use*, never *edit*, access).

Company-wide roles (Director/Admin/Super Admin/Project HO) keep their
existing unrestricted view of every type; only a granted role (Project
Manager/Incharge) is ever limited by site. Editing a site-owned type is
narrower still than viewing it: only the owning site's own granted
role, or an admin-tier role, may change it - a distributed site can
only pick it, never edit it.
"""

from django.db.models import Q
from rest_framework.exceptions import PermissionDenied

from apps.organization.models import Site
from apps.project_monitor.services import project_scope

Task = project_scope.Task


def visible_queryset(definition_model, user, site=None):
    """
    Every Structure Type ``user`` may see, optionally narrowed to one
    ``site``'s own usable set (global + owned by that site +
    distributed to it). With no ``site``: a company-wide role sees
    everything (the existing "manage everything" view); a granted
    role sees the union of every type usable on any site they hold
    the Structures task on.
    """
    queryset = definition_model.objects.all()

    if site is not None:
        return queryset.filter(
            Q(owner_site__isnull=True)
            | Q(owner_site=site)
            | Q(distributed_sites=site)
        ).distinct()

    if project_scope.is_company_wide(user):
        return queryset

    site_ids = _structures_site_ids(user)
    return queryset.filter(
        Q(owner_site__isnull=True)
        | Q(owner_site_id__in=site_ids)
        | Q(distributed_sites__id__in=site_ids)
    ).distinct()


def _structures_site_ids(user):
    """Sites a granted role holds the Structures task on (view)."""
    candidate_ids = project_scope.user_site_ids(user)
    if not candidate_ids:
        return set()
    sites = Site.objects.filter(id__in=candidate_ids)
    return {
        site.id
        for site in sites
        if project_scope.can_view_task(
            user, site, Task.STRUCTURES.value
        )
    }


def can_create_for_site(user, site) -> bool:
    """May create a NEW type owned by ``site`` (ignored for a
    company-wide role, which creates global types instead)."""
    return project_scope.can_enter_task(
        user, site, Task.STRUCTURES.value
    )


def can_edit(user, definition) -> bool:
    """
    May change or delete this exact type. An admin-tier role may edit
    anything (global or site-owned, same as before this feature); a
    granted role only their own site's own type - never a global one,
    and never one merely distributed to them.
    """
    if project_scope.is_company_wide(user):
        return True
    if definition.owner_site_id is None:
        return False
    return project_scope.can_enter_task(
        user, definition.owner_site, Task.STRUCTURES.value
    )


def ensure_can_create_for_site(user, site) -> None:
    if not can_create_for_site(user, site):
        raise PermissionDenied(
            "You cannot add a structure type for this "
            "project. Ask an Admin to grant the Structures "
            "task (Site Access)."
        )


def ensure_can_edit(user, definition) -> None:
    if not can_edit(user, definition):
        if definition.owner_site_id is None:
            raise PermissionDenied(
                "This is a global structure type - only an "
                "Admin, Director or the Project Management "
                "HO can change it."
            )
        raise PermissionDenied(
            "This structure type belongs to another "
            "project. Only its own Project Manager/Incharge, "
            "or an Admin/Director, can change it."
        )
