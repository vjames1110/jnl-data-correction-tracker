"""Moving groups around the BOQ tree must never break its shape."""

import pytest
from django.core.exceptions import ValidationError as DjangoValidationError

from apps.project_monitor.services import dpr
from apps.project_monitor.tests.finance_helpers import make_item


def group(site, item_no, parent=None):
    return dpr.create_item(
        site=site,
        item_no=item_no,
        description=f"Group {item_no}",
        is_heading=True,
        parent=parent,
    )


@pytest.mark.django_db
def test_a_group_cannot_be_moved_under_its_own_item(site):
    top = group(site, "4")
    middle = group(site, "4.1", parent=top)

    top.parent = middle

    with pytest.raises(DjangoValidationError) as error:
        top.save()
    assert "parent" in error.value.message_dict


@pytest.mark.django_db
def test_a_group_cannot_be_its_own_parent(site):
    top = group(site, "4")

    top.parent = top

    with pytest.raises(DjangoValidationError):
        top.save()


@pytest.mark.django_db
def test_moving_a_group_with_items_must_leave_room_for_them(site):
    top = group(site, "4")
    sibling = group(site, "5")
    branch = group(site, "5.1", parent=sibling)
    holder = group(site, "6")
    make_item(site, item_no="6.1", parent=holder)

    # holder (with an item under it) would sit at level 3 and push
    # its item to level 4.
    holder.parent = branch
    with pytest.raises(DjangoValidationError):
        holder.save()

    # Under a top-level group there is room for both levels.
    holder.parent = top
    holder.save()
    holder.refresh_from_db()
    assert holder.level() == 2
