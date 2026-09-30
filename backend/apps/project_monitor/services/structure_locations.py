"""
Structure Locations - a repeatable, named list of Chainage/Ramp
references attached to one Structure (see the model's own docstring
for why: some sites have no real chainage at all, only ramps, and a
single structure can genuinely touch more than one of either).

``Structure.chainage_km`` is kept in sync automatically so every
existing sort-order/display path (the default list ordering, the
Reports sheet, ``ItemGroupSection``'s own row) needs no changes at
all - it always reflects the smallest CHAINAGE-type location, or is
cleared when the structure has none.
"""

from apps.project_monitor.models import (
    StructureLocation,
    StructureLocationType,
)


def _sync_structure_chainage(structure):
    chainage_values = list(
        structure.locations.filter(
            location_type=StructureLocationType.CHAINAGE,
            chainage_km__isnull=False,
        ).values_list("chainage_km", flat=True)
    )
    next_value = (
        min(chainage_values) if chainage_values else None
    )
    if structure.chainage_km != next_value:
        structure.chainage_km = next_value
        structure.save(
            update_fields=["chainage_km", "updated_at"]
        )


def create_location(
    *,
    structure,
    location_type,
    name="",
    chainage_km=None,
    remarks="",
    actor,
):
    location = StructureLocation.objects.create(
        structure=structure,
        location_type=location_type,
        name=name or "",
        chainage_km=chainage_km,
        remarks=remarks or "",
        created_by=actor,
        updated_by=actor,
    )
    _sync_structure_chainage(structure)
    return location


def delete_location(location):
    structure = location.structure
    location.delete()
    _sync_structure_chainage(structure)
