from django.conf import settings
from django.contrib.contenttypes.fields import (
    GenericForeignKey,
    GenericRelation,
)
from django.contrib.contenttypes.models import ContentType
from django.core.exceptions import ValidationError
from django.db import models

from apps.core.models import (
    BusinessModel,
    TimeStampedModel,
    UserTrackingModel,
    UUIDPrimaryKeyModel,
)
from apps.core.utils.text import (
    normalize_code,
    normalize_whitespace,
)
from apps.organization.models import Site


class ActivityStatus(models.TextChoices):
    """
    Mirrors the prototype's ns/ip/done/hold/na status vocabulary,
    used identically across Structures, Buildings, Girders, and
    Action Items - one shared status language for the whole module.
    """

    NOT_STARTED = "NOT_STARTED", "Not Taken Up"
    IN_PROGRESS = "IN_PROGRESS", "In Progress"
    COMPLETE = "COMPLETE", "Complete"
    HOLD = "HOLD", "Hold / Issue"
    NOT_APPLICABLE = "NOT_APPLICABLE", "N/A"


class ActivityKind(models.TextChoices):
    """
    TASK activities track a plain 0-100% figure (most rows). LENGTH
    activities track a quantity against a total in a real unit (e.g.
    "Pile" tracked in nos, or an approach wall tracked in metres) -
    the prototype's `kind==='length'` distinction.
    """

    TASK = "TASK", "Task (% complete)"
    LENGTH = "LENGTH", "Length / quantity"


class MaterialStatus(models.TextChoices):
    """
    Layered on top of an activity's physical-progress status for
    MEP-type building items (flooring, electrical, plumbing, etc.) -
    independent of, and shown alongside, the status above.
    """

    NOT_ORDERED = "NOT_ORDERED", "Not Ordered"
    PO_PLACED = "PO_PLACED", "PO Placed"
    PARTLY_RECEIVED = (
        "PARTLY_RECEIVED",
        "Partly Received",
    )
    RECEIVED = "RECEIVED", "Received At Site"


class Activity(
    UUIDPrimaryKeyModel,
    TimeStampedModel,
    UserTrackingModel,
):
    """
    The one generic engine shared by every trackable thing in this
    module - a Structure's "Box raft", a Building floor's "Brickwork",
    a girder span's "Fabrication", or a standalone Action Item are all
    just an Activity, grouped and generated differently by their
    parent. This reuse (one engine, not five) is the core design
    decision behind the whole module - see
    ``services.activity_engine.apply_update``.

    The parent is a generic relation (``content_type``/``object_id``)
    rather than five separate nullable FKs, so the same update logic
    genuinely works for any parent without a wide sparse-FK row.
    """

    content_type = models.ForeignKey(
        ContentType,
        on_delete=models.CASCADE,
    )
    object_id = models.UUIDField()
    parent = GenericForeignKey(
        "content_type",
        "object_id",
    )

    name = models.CharField(
        max_length=200,
    )
    group_title = models.CharField(
        max_length=150,
        blank=True,
        help_text=(
            "Which generated group this activity "
            "belongs to on its parent (e.g. "
            "'Abutment A1', 'Ground floor', 'S1 - "
            "Girder') - purely a display label, "
            "not a relation."
        ),
    )
    group_subtitle = models.CharField(
        max_length=200,
        blank=True,
    )
    group_order = models.PositiveIntegerField(
        default=0,
    )
    row_order = models.PositiveIntegerField(
        default=0,
    )

    kind = models.CharField(
        max_length=10,
        choices=ActivityKind.choices,
        default=ActivityKind.TASK,
    )
    unit = models.CharField(
        max_length=20,
        blank=True,
        help_text=(
            "Only meaningful for LENGTH activities "
            "(e.g. 'nos', 'm')."
        ),
    )
    total_qty = models.DecimalField(
        max_digits=12,
        decimal_places=3,
        default=0,
    )
    done_qty = models.DecimalField(
        max_digits=12,
        decimal_places=3,
        default=0,
        help_text=(
            "For a LENGTH activity: quantity done. "
            "For a TASK activity: percent done "
            "(0-100)."
        ),
    )
    status = models.CharField(
        max_length=20,
        choices=ActivityStatus.choices,
        default=ActivityStatus.NOT_STARTED,
        db_index=True,
    )
    is_doc = models.BooleanField(
        default=False,
        help_text=(
            "GAD / structural-drawing approval "
            "rows render as Approved/Submitted/Not "
            "submitted instead of a %/quantity."
        ),
    )
    material_tracked = models.BooleanField(
        default=False,
    )
    material_status = models.CharField(
        max_length=20,
        choices=MaterialStatus.choices,
        null=True,
        blank=True,
    )
    completed_on = models.DateField(
        null=True,
        blank=True,
    )
    is_hindrance = models.BooleanField(
        default=False,
        help_text=(
            "This activity (or the structure/"
            "building it belongs to) is "
            "currently blocked by Railways/"
            "Authority."
        ),
    )
    hindrance_expected_removal_date = (
        models.DateField(
            null=True,
            blank=True,
        )
    )
    hindrance_actual_removal_date = (
        models.DateField(
            null=True,
            blank=True,
        )
    )
    hindrance_remarks = models.TextField(
        blank=True,
    )
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="+",
        null=True,
        blank=True,
        help_text=(
            "Director or Project Manager sign-off "
            "on this row - a lightweight review "
            "record, not an edit gate. Re-reviewing "
            "overwrites the previous sign-off."
        ),
    )
    reviewed_at = models.DateTimeField(
        null=True,
        blank=True,
    )
    review_remarks = models.TextField(
        blank=True,
    )

    class Meta:
        db_table = "project_monitor_activity"
        ordering = [
            "group_order",
            "row_order",
        ]
        indexes = [
            models.Index(
                fields=[
                    "content_type",
                    "object_id",
                ],
                name="pm_activity_parent_idx",
            ),
        ]
        verbose_name = "Activity"
        verbose_name_plural = "Activities"

    def __str__(self) -> str:
        return (
            f"{self.group_title + ' - ' if self.group_title else ''}"
            f"{self.name}"
        )

    def clean(self):
        super().clean()

        if self.name:
            self.name = normalize_whitespace(
                self.name
            )

        errors = {}

        if (
            self.material_status
            and not self.material_tracked
        ):
            errors["material_status"] = (
                "Only set on a material-tracked "
                "activity."
            )

        if self.kind == ActivityKind.TASK and (
            self.done_qty < 0
            or self.done_qty > 100
        ):
            errors["done_qty"] = (
                "Percent done must be between 0 "
                "and 100."
            )

        if (
            self.kind == ActivityKind.LENGTH
            and self.done_qty < 0
        ):
            errors["done_qty"] = (
                "Quantity done cannot be negative."
            )

        if errors:
            raise ValidationError(errors)

    def save(self, *args, **kwargs):
        self.full_clean()
        return super().save(*args, **kwargs)


class StructureTypeDefinition(
    BusinessModel,
    UserTrackingModel,
):
    """
    Admin-configurable master of the structure "types" a project can
    add (Minor Bridge/Major Bridge/RUB/ROB are seeded as built-ins;
    an Admin can define a brand-new one - e.g. FOB - later without a
    code deploy).

    ``config_schema`` declares the parametric input fields the "Add
    a structure" form renders (mirrors the prototype's per-type
    ``renderStructForm``); ``group_templates`` declares how those
    inputs turn into activity groups/rows (mirrors
    ``minorActivities``/``majorActivities``/``robActivities``/
    ``rubActivities``). See ``services.structure_generator`` for the
    exact schema this JSON must follow and the generic interpreter
    that reads it - that module's module docstring is the
    authoritative reference an Admin building a new type needs.
    """

    code = models.CharField(
        max_length=30,
        unique=True,
    )
    name = models.CharField(
        max_length=100,
    )
    description_template = models.CharField(
        max_length=500,
        blank=True,
        help_text=(
            "Auto-generated summary shown on every "
            "structure of this type - "
            "'{field_key}' placeholders are filled "
            "in from its config."
        ),
    )
    config_schema = models.JSONField(
        default=list,
        blank=True,
    )
    group_templates = models.JSONField(
        default=list,
        blank=True,
    )
    include_approval_docs = models.BooleanField(
        default=True,
        help_text=(
            "Every generated structure gets a "
            "GAD approval + Structural drawing "
            "approval row up front, unless "
            "unticked."
        ),
    )
    display_order = models.PositiveIntegerField(
        default=0,
    )

    class Meta:
        db_table = (
            "project_monitor_structure_type"
        )
        ordering = ["display_order", "name"]
        verbose_name = "Structure Type"
        verbose_name_plural = "Structure Types"

    def __str__(self) -> str:
        return self.name

    def clean(self):
        super().clean()

        if self.code:
            self.code = normalize_code(self.code)
        if self.name:
            self.name = normalize_whitespace(
                self.name
            )

    def save(self, *args, **kwargs):
        self.full_clean()
        return super().save(*args, **kwargs)


class Structure(
    UUIDPrimaryKeyModel,
    TimeStampedModel,
    UserTrackingModel,
):
    """
    One structure (a Minor/Major Bridge, RUB, ROB, or whatever other
    type an Admin has since defined) on a Site - the parametric
    inputs (``config``) that generated its Activity rows, kept for
    display/audit only. Activities are generated once at creation
    (mirroring the prototype's "Generate sheet" action) and then
    live and are edited independently - ``config`` is never
    re-applied later, so hand-added/removed rows persist exactly
    like the prototype allows.
    """

    site = models.ForeignKey(
        Site,
        on_delete=models.CASCADE,
        related_name="project_monitor_structures",
    )
    structure_type = models.ForeignKey(
        StructureTypeDefinition,
        on_delete=models.PROTECT,
        related_name="structures",
        help_text=(
            "PROTECTed, not cascaded: a structure "
            "type used by real structures can't be "
            "deleted out from under them."
        ),
    )
    name = models.CharField(
        max_length=150,
    )
    chainage_km = models.DecimalField(
        max_digits=8,
        decimal_places=3,
        null=True,
        blank=True,
    )
    config = models.JSONField(
        default=dict,
        blank=True,
        help_text=(
            "The parametric inputs used to generate "
            "this structure's activities - display/"
            "audit only, never re-applied."
        ),
    )
    description = models.CharField(
        max_length=500,
        blank=True,
    )

    activities = GenericRelation(
        Activity,
        content_type_field="content_type",
        object_id_field="object_id",
    )

    class Meta:
        db_table = "project_monitor_structure"
        ordering = [
            models.F("chainage_km").asc(
                nulls_last=True,
            ),
            "created_at",
        ]
        verbose_name = "Structure"
        verbose_name_plural = "Structures"

    def __str__(self) -> str:
        return f"{self.structure_type.name} - {self.name}"

    def clean(self):
        super().clean()

        if self.name:
            self.name = normalize_whitespace(
                self.name
            )

    def save(self, *args, **kwargs):
        self.full_clean()
        return super().save(*args, **kwargs)


class Building(
    UUIDPrimaryKeyModel,
    TimeStampedModel,
    UserTrackingModel,
):
    """
    One building (a station building, service building, quarters,
    ...) on a Site - the parametric inputs (``config``) that
    generated its Activity rows, kept for display/audit only, same
    convention as ``Structure``. Unlike Structures, there is one
    fixed building "shape" (see
    ``services.building_generator``) rather than an admin-defined
    master of types - the prototype's own Buildings section has no
    equivalent to Minor/Major Bridge/RUB/ROB type selection.
    """

    site = models.ForeignKey(
        Site,
        on_delete=models.CASCADE,
        related_name="project_monitor_buildings",
    )
    station_label = models.CharField(
        max_length=150,
        blank=True,
        help_text=(
            "Which site/station within the "
            "project this building is at (e.g. "
            "'Chunar station') - buildings are "
            "grouped by this label, purely a "
            "display grouping, not a relation."
        ),
    )
    name = models.CharField(
        max_length=150,
    )
    chainage_km = models.DecimalField(
        max_digits=8,
        decimal_places=3,
        null=True,
        blank=True,
    )
    config = models.JSONField(
        default=dict,
        blank=True,
    )
    description = models.CharField(
        max_length=500,
        blank=True,
    )

    activities = GenericRelation(
        Activity,
        content_type_field="content_type",
        object_id_field="object_id",
    )

    class Meta:
        db_table = "project_monitor_building"
        ordering = [
            "station_label",
            models.F("chainage_km").asc(
                nulls_last=True,
            ),
            "created_at",
        ]
        verbose_name = "Building"
        verbose_name_plural = "Buildings"

    def __str__(self) -> str:
        return self.name

    def clean(self):
        super().clean()

        if self.name:
            self.name = normalize_whitespace(
                self.name
            )
        if self.station_label:
            self.station_label = (
                normalize_whitespace(
                    self.station_label
                )
            )

    def save(self, *args, **kwargs):
        self.full_clean()
        return super().save(*args, **kwargs)


class ActivityDateEntry(TimeStampedModel):
    """
    Append-only target-date history. The prototype keeps every prior
    date, struck through, tagged with which review meeting revised
    it - this is that history, one row per revision.

    Deliberately NOT a ``UUIDPrimaryKeyModel`` like the rest of this
    codebase's models: a UUID primary key isn't chronologically
    sortable, and two rows created back-to-back in the same
    ``apply_update`` call can land on the exact same ``created_at``
    tick (seen for real, not just in theory - Windows' clock
    resolution is coarser than Python can create rows). This row is
    never addressed by id externally (it's only ever read as part of
    its Activity's nested history), so a plain auto-incrementing
    integer primary key is the simpler, correctly-monotonic choice -
    "which one is the current date" relies on it ordering true.
    """

    activity = models.ForeignKey(
        Activity,
        on_delete=models.CASCADE,
        related_name="date_entries",
    )
    target_date = models.DateField()
    meeting_date = models.DateField(
        help_text=(
            "Which review meeting set/revised this "
            "date."
        ),
    )

    class Meta:
        db_table = "project_monitor_activity_date_entry"
        ordering = ["id"]
        verbose_name = "Activity Date Entry"
        verbose_name_plural = (
            "Activity Date Entries"
        )

    def __str__(self) -> str:
        return f"{self.activity_id} - {self.target_date}"


class ActivityComment(
    TimeStampedModel,
    UserTrackingModel,
):
    """
    Append-only, meeting-dated comment log - the digitized MOM
    register. One composed entry per ``apply_update`` call, not a
    separate row per changed field. See ``ActivityDateEntry`` for why
    this uses a plain auto-incrementing primary key instead of this
    codebase's usual UUID one.
    """

    activity = models.ForeignKey(
        Activity,
        on_delete=models.CASCADE,
        related_name="comments",
    )
    meeting_date = models.DateField()
    text = models.TextField()

    class Meta:
        db_table = "project_monitor_activity_comment"
        ordering = ["id"]
        verbose_name = "Activity Comment"
        verbose_name_plural = "Activity Comments"

    def __str__(self) -> str:
        return f"{self.activity_id} - {self.meeting_date}"

    def clean(self):
        super().clean()

        if self.text:
            self.text = normalize_whitespace(
                self.text
            )

    def save(self, *args, **kwargs):
        self.full_clean()
        return super().save(*args, **kwargs)
