"""
Two small structure-type schema refinements, requested together:

1. Major Bridge's and ROB's Abutment/Pier "repeat" groups gain a
   free-typed "name" per-index field (e.g. "Abutment near village X")
   - abutments and piers are usually known by a real name on site, not
   just their auto-generated "A1"/"P1" position label, which stays
   unchanged as the group's own title; the name shows in the
   subtitle line instead, right alongside the height/foundation
   detail already there.
2. FOB's description now includes the total pile count across every
   platform (``{sum:platforms.noOfPile}``, a new aggregate placeholder
   - see ``services.template_engine``), since that number was
   previously only visible by opening each platform's own edit form.

Existing structures are untouched (a generated sheet is never
retroactively rewritten) - the new name field defaults to blank and
the updated description only takes effect the next time a structure of
that type is created or edited (which already regenerates the
description from the current template).
"""

from django.db import migrations


def _add_item_field(group, key, label_template):
    item_fields = list(group.get("item_fields") or [])
    if any(
        field.get("key") == key for field in item_fields
    ):
        return
    item_fields.append(
        {
            "key": key,
            "label_template": label_template,
            "type": "text",
            "default": "",
        }
    )
    group["item_fields"] = item_fields


def add_names_and_pile_total(apps, schema_editor):
    StructureTypeDefinition = apps.get_model(
        "project_monitor", "StructureTypeDefinition"
    )

    try:
        major = StructureTypeDefinition.objects.get(
            code="MAJOR"
        )
    except StructureTypeDefinition.DoesNotExist:
        major = None
    if major:
        group_templates = major.group_templates or []
        for group in group_templates:
            if group.get("count_field") == "abuts":
                _add_item_field(
                    group, "abutName", "A{n} name"
                )
                group["subtitle_template"] = (
                    "{item:abutName} · Height "
                    "{item:abutH} m · "
                    "{foundation:abutFound:abutPiles}"
                )
            elif group.get("count_field") == "piers":
                _add_item_field(
                    group, "pierName", "P{n} name"
                )
                group["subtitle_template"] = (
                    "{item:pierName} · Height "
                    "{item:pierH} m · "
                    "{foundation:pierFound:pierPiles}"
                )
        major.group_templates = group_templates
        major.save(
            update_fields=["group_templates"]
        )

    try:
        rob = StructureTypeDefinition.objects.get(
            code="ROB"
        )
    except StructureTypeDefinition.DoesNotExist:
        rob = None
    if rob:
        group_templates = rob.group_templates or []
        for group in group_templates:
            if group.get("count_field") == "subs" and (
                group.get("kind") == "repeat"
            ):
                _add_item_field(
                    group, "subName", "{n} name"
                )
                group["subtitle_template"] = (
                    "{item:subName} · "
                    "{foundation:found}"
                )
        rob.group_templates = group_templates
        rob.save(update_fields=["group_templates"])

    try:
        fob = StructureTypeDefinition.objects.get(
            code="FOB"
        )
    except StructureTypeDefinition.DoesNotExist:
        fob = None
    if fob:
        fob.description_template = (
            "{stationName} · {spans} spans · "
            "girders: {choice_label:girderScope} · "
            "{sum:platforms.noOfPile} piles"
        )
        fob.save(
            update_fields=["description_template"]
        )


def remove_names_and_pile_total(apps, schema_editor):
    StructureTypeDefinition = apps.get_model(
        "project_monitor", "StructureTypeDefinition"
    )

    try:
        major = StructureTypeDefinition.objects.get(
            code="MAJOR"
        )
    except StructureTypeDefinition.DoesNotExist:
        major = None
    if major:
        group_templates = major.group_templates or []
        for group in group_templates:
            if group.get("count_field") == "abuts":
                group["item_fields"] = [
                    field
                    for field in (
                        group.get("item_fields") or []
                    )
                    if field.get("key") != "abutName"
                ]
                group["subtitle_template"] = (
                    "Height {item:abutH} m · "
                    "{foundation:abutFound:abutPiles}"
                )
            elif group.get("count_field") == "piers":
                group["item_fields"] = [
                    field
                    for field in (
                        group.get("item_fields") or []
                    )
                    if field.get("key") != "pierName"
                ]
                group["subtitle_template"] = (
                    "Height {item:pierH} m · "
                    "{foundation:pierFound:pierPiles}"
                )
        major.group_templates = group_templates
        major.save(
            update_fields=["group_templates"]
        )

    try:
        rob = StructureTypeDefinition.objects.get(
            code="ROB"
        )
    except StructureTypeDefinition.DoesNotExist:
        rob = None
    if rob:
        group_templates = rob.group_templates or []
        for group in group_templates:
            if group.get("count_field") == "subs" and (
                group.get("kind") == "repeat"
            ):
                group["item_fields"] = [
                    field
                    for field in (
                        group.get("item_fields") or []
                    )
                    if field.get("key") != "subName"
                ]
                group["subtitle_template"] = (
                    "{foundation:found}"
                )
        rob.group_templates = group_templates
        rob.save(update_fields=["group_templates"])

    try:
        fob = StructureTypeDefinition.objects.get(
            code="FOB"
        )
    except StructureTypeDefinition.DoesNotExist:
        fob = None
    if fob:
        fob.description_template = (
            "{stationName} · {spans} spans · "
            "girders: {choice_label:girderScope}"
        )
        fob.save(
            update_fields=["description_template"]
        )


class Migration(migrations.Migration):

    dependencies = [
        (
            "project_monitor",
            "0026_seed_fob_structure_type",
        ),
    ]

    operations = [
        migrations.RunPython(
            add_names_and_pile_total,
            remove_names_and_pile_total,
        ),
    ]
