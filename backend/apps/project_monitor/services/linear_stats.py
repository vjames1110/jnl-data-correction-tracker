"""
Turns a ``LinearItem``'s scope patches + progress entries into a
``{scope, done, ongoing, pending}`` figure. Every unit - ``M``
included - is a flat sum of each record's own ``qty`` field, never a
chainage-derived length: the chainage a scope patch/progress entry
carries is for the rolling diagram's "where is this happening" view
only (see ``services.linear_diagram``), and is deliberately never
re-derived into the quantity figures shown here - a quantity once set
(explicitly, or auto-derived once at entry time by
``services.linear_generator``) stays exactly what was set regardless
of how the chainage segment is later viewed.

Kept separate from ``interval_math.py`` (which stays pure/Django-free
for easy unit testing, and is still used by ``linear_diagram.py`` for
the chainage visuals) since this module knows about the Django
models.
"""

from decimal import Decimal

from apps.project_monitor.models import (
    ActivityStatus,
)


def compute_item_stats(item):
    scope_patches = list(
        item.scope_patches.all()
    )
    entries = list(item.progress_entries.all())

    scope = sum(
        (patch.qty or Decimal("0"))
        for patch in scope_patches
    )
    done = sum(
        (entry.qty or Decimal("0"))
        for entry in entries
        if entry.status
        == ActivityStatus.COMPLETE
    )
    ongoing = sum(
        (entry.qty or Decimal("0"))
        for entry in entries
        if entry.status
        == ActivityStatus.IN_PROGRESS
    )
    return {
        "scope": scope,
        "done": done,
        "ongoing": ongoing,
        "pending": max(
            Decimal("0"), scope - done
        ),
    }
