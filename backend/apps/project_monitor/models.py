from django.conf import settings
from django.contrib.contenttypes.fields import (
    GenericForeignKey,
    GenericRelation,
)
from django.contrib.contenttypes.models import ContentType
from django.core.exceptions import ValidationError
from django.db import models

from apps.authentication.models import UserRole
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


class RdsoSpanLibraryEntry(
    BusinessModel,
    UserTrackingModel,
):
    """
    Admin-editable master of standard RDSO girder spans - seeded
    with the prototype's default library (span length + girder type
    only; drawing no/qty-per-span are left blank/zero for an Admin
    to fill in once per the project's actual loading standard).
    Picking one of these on a girder span pre-fills its drawing no/
    length/type/quantity; a span can also be entered non-standard
    with none of these values pre-filled.
    """

    span_length_m = models.DecimalField(
        max_digits=6,
        decimal_places=2,
    )
    girder_type = models.CharField(
        max_length=100,
    )
    drawing_no = models.CharField(
        max_length=100,
        blank=True,
    )
    qty_per_span_mt = models.DecimalField(
        max_digits=10,
        decimal_places=3,
        default=0,
    )
    display_order = models.PositiveIntegerField(
        default=0,
    )

    class Meta:
        db_table = (
            "project_monitor_rdso_span_library_entry"
        )
        ordering = [
            "display_order",
            "span_length_m",
        ]
        verbose_name = "RDSO Span Library Entry"
        verbose_name_plural = (
            "RDSO Span Library Entries"
        )

    def __str__(self) -> str:
        return (
            f"{self.span_length_m} m - "
            f"{self.girder_type}"
        )

    def clean(self):
        super().clean()

        if self.girder_type:
            self.girder_type = (
                normalize_whitespace(
                    self.girder_type
                )
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


class GirderStructureKind(models.TextChoices):
    """
    Independent of ``StructureTypeDefinition`` - the prototype's
    girder tracker uses these three literal kinds regardless of
    what structure-type masters an Admin has defined, and FOB may
    not even exist as a seeded/defined ``StructureTypeDefinition``
    row. A ``GirderJob`` may optionally link to a real ``Structure``
    (see ``GirderJob.structure``), but this field is what actually
    drives the FOB carries-girders-only rule.
    """

    MAJOR = "MAJOR", "Major Bridge"
    ROB = "ROB", "ROB"
    FOB = "FOB", "FOB"


class GirderScope(models.TextChoices):
    JNL = "JNL", "JNL (fabrication by vendor)"
    RAILWAY = (
        "RAILWAY",
        "Railway supply - follow-up only",
    )


class GirderJob(
    UUIDPrimaryKeyModel,
    TimeStampedModel,
    UserTrackingModel,
):
    """
    One bridge's girder/bearings/expansion-joints tracking - one
    bridge-level GAD-approval ``Activity`` (via the generic
    ``activities`` relation, same engine as everything else) plus a
    repeatable set of ``GirderSpan`` rows, each carrying its own
    girder-fabrication chain and (unless this is a FOB) a Bearings
    chain and an Expansion Joints chain. Optionally linked to an
    existing ``Structure`` (so a Major Bridge/ROB already tracked in
    Structures doesn't need its bridge name/chainage re-entered).
    """

    site = models.ForeignKey(
        Site,
        on_delete=models.CASCADE,
        related_name="girder_jobs",
    )
    structure = models.ForeignKey(
        Structure,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="girder_jobs",
    )
    structure_kind = models.CharField(
        max_length=10,
        choices=GirderStructureKind.choices,
    )
    bridge_name = models.CharField(
        max_length=150,
    )
    chainage_km = models.DecimalField(
        max_digits=8,
        decimal_places=3,
        null=True,
        blank=True,
    )
    girder_scope = models.CharField(
        max_length=10,
        choices=GirderScope.choices,
    )

    activities = GenericRelation(
        Activity,
        content_type_field="content_type",
        object_id_field="object_id",
    )

    class Meta:
        db_table = "project_monitor_girder_job"
        ordering = [
            models.F("chainage_km").asc(
                nulls_last=True,
            ),
            "created_at",
        ]
        verbose_name = "Girder Job"
        verbose_name_plural = "Girder Jobs"

    def __str__(self) -> str:
        return self.bridge_name

    def clean(self):
        super().clean()

        if self.bridge_name:
            self.bridge_name = (
                normalize_whitespace(
                    self.bridge_name
                )
            )

    def save(self, *args, **kwargs):
        self.full_clean()
        return super().save(*args, **kwargs)


class GirderSpan(
    UUIDPrimaryKeyModel,
    TimeStampedModel,
    UserTrackingModel,
):
    """
    One span on a ``GirderJob`` - either picked from the
    ``RdsoSpanLibraryEntry`` master (``is_standard=True``, pre-filled
    drawing no/length/type/quantity from the library entry at the
    time it was picked - display/audit only, never re-applied) or
    entered non-standard. Carries its own generated girder-
    fabrication ``Activity`` chain and, unless the parent job is a
    FOB, its own Bearings and Expansion Joints chains too - all via
    the same generic ``activities`` relation as every other section.
    """

    job = models.ForeignKey(
        GirderJob,
        on_delete=models.CASCADE,
        related_name="spans",
    )
    label = models.CharField(max_length=50)
    is_standard = models.BooleanField(
        default=False,
    )
    drawing_no = models.CharField(
        max_length=100,
        blank=True,
    )
    span_length_m = models.DecimalField(
        max_digits=6,
        decimal_places=2,
        null=True,
        blank=True,
    )
    girder_type = models.CharField(
        max_length=100,
        blank=True,
    )
    qty_mt = models.DecimalField(
        max_digits=10,
        decimal_places=3,
        default=0,
    )
    vendor = models.CharField(
        max_length=150,
        blank=True,
    )
    po_number = models.CharField(
        max_length=100,
        blank=True,
    )
    bearings_count = models.PositiveIntegerField(
        default=4,
    )
    expansion_joints_count = (
        models.PositiveIntegerField(
            default=2,
        )
    )
    row_order = models.PositiveIntegerField(
        default=0,
    )

    activities = GenericRelation(
        Activity,
        content_type_field="content_type",
        object_id_field="object_id",
    )

    class Meta:
        db_table = "project_monitor_girder_span"
        ordering = ["row_order"]
        verbose_name = "Girder Span"
        verbose_name_plural = "Girder Spans"

    def __str__(self) -> str:
        return f"{self.job.bridge_name} - {self.label}"

    def clean(self):
        super().clean()

        if self.label:
            self.label = normalize_whitespace(
                self.label
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


class ProjectExtension(
    UUIDPrimaryKeyModel,
    TimeStampedModel,
    UserTrackingModel,
):
    """
    One recorded extension of a project's completion date -
    ``new_end_date`` plus why, so the project's real completion
    schedule is an auditable history (E1, E2, E3...) rather than a
    silently-overwritten single date. Lives here rather than as a
    field on ``Site`` because it's project-tracking behaviour (a
    dated, reasoned record), not a core site attribute - same
    convention as ``Structure``/``Building``/``GirderJob`` FKing to
    ``Site`` from within this app.

    The "effective end date" a project is actually tracked against
    is computed, not stored: the latest ``new_end_date`` across a
    site's extensions if any exist, else ``Site.end_date`` - see
    ``ProjectSiteSerializer.get_effective_end_date``.
    """

    site = models.ForeignKey(
        Site,
        on_delete=models.CASCADE,
        related_name="extensions",
    )
    new_end_date = models.DateField()
    reason = models.TextField(blank=True)

    class Meta:
        db_table = (
            "project_monitor_project_extension"
        )
        ordering = ["created_at"]
        verbose_name = "Project Extension"
        verbose_name_plural = (
            "Project Extensions"
        )

    def __str__(self) -> str:
        return (
            f"{self.site.site_code} - extended "
            f"to {self.new_end_date}"
        )

    def clean(self):
        super().clean()

        if self.reason:
            self.reason = normalize_whitespace(
                self.reason
            )

    def save(self, *args, **kwargs):
        self.full_clean()
        return super().save(*args, **kwargs)


class ActionItem(
    UUIDPrimaryKeyModel,
    TimeStampedModel,
    UserTrackingModel,
):
    """
    The plainest use of the shared Activity engine - no qty/%, no
    material tag, no doc-type rendering, just a single generic
    ``Activity`` (via the same ``content_type``/``object_id``
    relation every other section uses) for status/target-date-
    history/comments, plus two fields the Activity itself doesn't
    have: ``responsibility`` (free text - who owns this) and a
    persistent ``remarks`` field that is edited directly, separate
    from the dated meeting-log comments every ``apply_update`` call
    appends.

    "Open"/"Completed" and the overdue flag are derived, not stored
    - see ``ActionItemSerializer.get_is_overdue`` - from the single
    linked Activity's own ``status``/current target date, so nothing
    here duplicates state the Activity already owns.
    """

    site = models.ForeignKey(
        Site,
        on_delete=models.CASCADE,
        related_name="action_items",
    )
    responsibility = models.CharField(
        max_length=150,
        blank=True,
    )
    remarks = models.TextField(blank=True)

    activities = GenericRelation(
        Activity,
        content_type_field="content_type",
        object_id_field="object_id",
    )

    class Meta:
        db_table = (
            "project_monitor_action_item"
        )
        ordering = ["-created_at"]
        verbose_name = "Action Item"
        verbose_name_plural = "Action Items"

    def __str__(self) -> str:
        activity = self.activities.first()
        return (
            activity.name
            if activity
            else str(self.id)
        )

    def clean(self):
        super().clean()

        if self.responsibility:
            self.responsibility = (
                normalize_whitespace(
                    self.responsibility
                )
            )

    def save(self, *args, **kwargs):
        self.full_clean()
        return super().save(*args, **kwargs)


class LinearUnit(models.TextChoices):
    M = "M", "Running metre (m)"
    CUM = "CUM", "Cubic metre (cum)"
    NOS = "NOS", "Numbers (nos)"


class LinearSide(models.TextChoices):
    BOTH = "BOTH", "Both"
    LHS = "LHS", "LHS"
    RHS = "RHS", "RHS"


class LinearItem(
    UUIDPrimaryKeyModel,
    TimeStampedModel,
    UserTrackingModel,
):
    """
    A chainage-tracked linear work (earthwork, P.Way linking, side
    drains, ...) - genuinely different from every other section in
    this module: progress is a continuous chainage interval, not a
    discrete ``Activity`` row, so this deliberately does NOT use the
    generic Activity engine. See ``services.interval_math`` and
    ``services.linear_stats`` for how ``scope_patches``/
    ``progress_entries`` turn into a Scope/Done/Ongoing/Pending
    figure for ``M``-unit items (a true chainage-interval
    computation); ``CUM``/``NOS`` items are a flat running-quantity
    total instead, with no chainage math at all.
    """

    site = models.ForeignKey(
        Site,
        on_delete=models.CASCADE,
        related_name="linear_items",
    )
    name = models.CharField(max_length=150)
    unit = models.CharField(
        max_length=10,
        choices=LinearUnit.choices,
        default=LinearUnit.M,
    )

    class Meta:
        db_table = (
            "project_monitor_linear_item"
        )
        ordering = ["name"]
        verbose_name = "Linear Item"
        verbose_name_plural = "Linear Items"

    def __str__(self) -> str:
        return f"{self.site.site_code} - {self.name}"

    def clean(self):
        super().clean()

        if self.name:
            self.name = normalize_whitespace(
                self.name
            )

    def save(self, *args, **kwargs):
        self.full_clean()
        return super().save(*args, **kwargs)


def _validate_chainage_range(
    unit, from_chainage_km, to_chainage_km, errors
):
    if (
        from_chainage_km is None
        or to_chainage_km is None
    ):
        return

    if unit == LinearUnit.M:
        if to_chainage_km <= from_chainage_km:
            errors["to_chainage_km"] = (
                "The 'to' chainage must be "
                "greater than the 'from' "
                "chainage for a running-metre "
                "item."
            )
    elif to_chainage_km < from_chainage_km:
        errors["to_chainage_km"] = (
            "The 'to' chainage cannot be "
            "before the 'from' chainage."
        )


class ScopePatch(
    UUIDPrimaryKeyModel,
    TimeStampedModel,
    UserTrackingModel,
):
    """
    One chainage stretch a linear item's scope covers - an item
    with no scope patches at all is treated as fully unrestricted
    (see ``services.linear_stats``), matching the prototype's own
    "no scope defined = unrestricted" rule exactly. ``qty`` is only
    meaningful for non-``M`` units (auto-derived from the chainage
    span for ``M`` items at creation time, display/audit only,
    never re-applied - same convention as ``GirderSpan`` copying
    RDSO library values in at pick-time).
    """

    linear_item = models.ForeignKey(
        LinearItem,
        on_delete=models.CASCADE,
        related_name="scope_patches",
    )
    from_chainage_km = models.DecimalField(
        max_digits=8,
        decimal_places=3,
    )
    to_chainage_km = models.DecimalField(
        max_digits=8,
        decimal_places=3,
    )
    side = models.CharField(
        max_length=10,
        choices=LinearSide.choices,
        default=LinearSide.BOTH,
    )
    qty = models.DecimalField(
        max_digits=12,
        decimal_places=3,
        null=True,
        blank=True,
    )
    remarks = models.TextField(blank=True)

    class Meta:
        db_table = (
            "project_monitor_scope_patch"
        )
        ordering = ["from_chainage_km"]
        verbose_name = "Scope Patch"
        verbose_name_plural = "Scope Patches"

    def __str__(self) -> str:
        return (
            f"{self.linear_item.name}: "
            f"{self.from_chainage_km}-"
            f"{self.to_chainage_km} km"
        )

    def clean(self):
        super().clean()

        errors = {}
        _validate_chainage_range(
            self.linear_item.unit,
            self.from_chainage_km,
            self.to_chainage_km,
            errors,
        )
        if errors:
            raise ValidationError(errors)

    def save(self, *args, **kwargs):
        self.full_clean()
        return super().save(*args, **kwargs)


class ProgressEntry(
    UUIDPrimaryKeyModel,
    TimeStampedModel,
    UserTrackingModel,
):
    """
    One day's logged progress on a linear item's chainage stretch.
    ``status`` deliberately only offers 3 of ``ActivityStatus``'s 5
    values - a linear entry is never "not started" (it wouldn't be
    logged) or "not applicable" (that's what an absent scope patch
    already means) - reusing ``ActivityStatus`` rather than a new
    enum keeps the frontend's existing status labels/colors working
    unchanged. ``meeting_date`` is which review meeting this was
    logged under, distinct from ``date`` (the actual day the work
    happened) - same "on vs date" distinction the prototype makes.
    """

    LINEAR_STATUS_CHOICES = [
        (
            ActivityStatus.IN_PROGRESS,
            ActivityStatus.IN_PROGRESS.label,
        ),
        (
            ActivityStatus.COMPLETE,
            ActivityStatus.COMPLETE.label,
        ),
        (
            ActivityStatus.HOLD,
            ActivityStatus.HOLD.label,
        ),
    ]

    linear_item = models.ForeignKey(
        LinearItem,
        on_delete=models.CASCADE,
        related_name="progress_entries",
    )
    date = models.DateField()
    from_chainage_km = models.DecimalField(
        max_digits=8,
        decimal_places=3,
    )
    to_chainage_km = models.DecimalField(
        max_digits=8,
        decimal_places=3,
    )
    qty = models.DecimalField(
        max_digits=12,
        decimal_places=3,
        null=True,
        blank=True,
    )
    side = models.CharField(
        max_length=10,
        choices=LinearSide.choices,
        default=LinearSide.BOTH,
    )
    contractor = models.CharField(
        max_length=150,
        blank=True,
    )
    status = models.CharField(
        max_length=20,
        choices=LINEAR_STATUS_CHOICES,
        default=ActivityStatus.IN_PROGRESS,
    )
    remarks = models.TextField(blank=True)
    meeting_date = models.DateField()

    class Meta:
        db_table = (
            "project_monitor_progress_entry"
        )
        ordering = [
            "-date",
            "from_chainage_km",
        ]
        verbose_name = "Progress Entry"
        verbose_name_plural = (
            "Progress Entries"
        )

    def __str__(self) -> str:
        return (
            f"{self.linear_item.name} - "
            f"{self.date}"
        )

    def clean(self):
        super().clean()

        errors = {}
        _validate_chainage_range(
            self.linear_item.unit,
            self.from_chainage_km,
            self.to_chainage_km,
            errors,
        )
        if errors:
            raise ValidationError(errors)

    def save(self, *args, **kwargs):
        self.full_clean()
        return super().save(*args, **kwargs)



# --------------------------------------------------------------------
# Finance tier (Phase 9+): per-site access, DPR and RA bills.
# --------------------------------------------------------------------


# People who can be granted tasks on a site.
GRANTABLE_USER_ROLES = (
    UserRole.PROJECT_MANAGER,
    UserRole.PROJECT_INCHARGE,
)


class ProjectSiteAccessRole(models.TextChoices):
    """
    A task in Project Monitor that an Admin can grant, per site, to a
    Project Incharge or Project Manager. (The model field is still
    called ``role``; its value is one of these task keys.) Declared in
    the order the Site Access page shows them.
    """

    OVERVIEW = "OVERVIEW", "Project details & extensions"
    STRUCTURES = "STRUCTURES", "Structures"
    BUILDINGS = "BUILDINGS", "Buildings"
    GIRDERS = "GIRDERS", "Girders, bearings & EJ"
    ACTION_ITEMS = "ACTION_ITEMS", "Action items"
    LINEAR_WORKS = "LINEAR_WORKS", "Linear works"
    DPR_BILLS = "DPR_BILLS", "DPR & Bills"
    HR = "HR", "HR (labour & staff)"
    MACHINERY = "MACHINERY", "Machinery & fuel"
    REPORTS = "REPORTS", "Reports"


class ProjectSiteAccess(
    UUIDPrimaryKeyModel,
    TimeStampedModel,
    UserTrackingModel,
):
    """
    "This person may use this task on this site" - one row per
    (site, person, task). Granted by an Admin on the Site Access
    page; only Project Incharge and Project Manager accounts can hold
    one. It is the single source of Project Monitor access for those
    roles (Director/Admin see everything without any row). A grant
    means view and enter.
    """

    site = models.ForeignKey(
        Site,
        on_delete=models.CASCADE,
        related_name="monitor_access",
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="project_monitor_site_access",
    )
    role = models.CharField(
        max_length=20,
        choices=ProjectSiteAccessRole.choices,
        default=ProjectSiteAccessRole.DPR_BILLS,
    )

    class Meta:
        db_table = "project_monitor_site_access"
        ordering = [
            "site__site_name",
            "user__employee_id",
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["site", "user", "role"],
                name="pm_site_access_uniq",
            ),
        ]
        verbose_name = "Project Monitor Site Access"
        verbose_name_plural = (
            "Project Monitor Site Access"
        )

    def __str__(self) -> str:
        return (
            f"{self.user_id} - {self.site_id} - "
            f"{self.role}"
        )

    def clean(self):
        super().clean()

        if (
            self.user_id
            and self.user.role not in GRANTABLE_USER_ROLES
        ):
            raise ValidationError(
                {
                    "user": (
                        "Only Project Incharge and Project "
                        "Manager accounts can be given site "
                        "access."
                    )
                }
            )

    def save(self, *args, **kwargs):
        self.full_clean()
        return super().save(*args, **kwargs)


class DprItem(
    UUIDPrimaryKeyModel,
    TimeStampedModel,
    UserTrackingModel,
):
    """
    One contract (BOQ) item monitored in the DPR - description,
    unit, scope quantity and contract rate. ``concrete_per_unit``
    and ``tmt_kg_per_unit`` are stored now and used by the costing
    phase. An item that has DPR entries or bill lines can be
    deactivated but never deleted (the prototype silently orphaned
    those entries).
    """

    site = models.ForeignKey(
        Site,
        on_delete=models.CASCADE,
        related_name="dpr_items",
    )
    item_no = models.CharField(
        max_length=50,
        blank=True,
    )
    description = models.CharField(max_length=300)
    unit = models.CharField(
        max_length=30,
        blank=True,
    )
    scope_qty = models.DecimalField(
        max_digits=14,
        decimal_places=3,
        default=0,
    )
    rate = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        default=0,
    )
    concrete_per_unit = models.DecimalField(
        max_digits=10,
        decimal_places=3,
        default=0,
    )
    tmt_kg_per_unit = models.DecimalField(
        max_digits=10,
        decimal_places=3,
        default=0,
    )
    is_active = models.BooleanField(default=True)
    row_order = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = "project_monitor_dpr_item"
        ordering = ["row_order", "item_no", "description"]
        constraints = [
            models.UniqueConstraint(
                fields=["site", "item_no"],
                condition=~models.Q(item_no=""),
                name="pm_dpr_item_no_uniq",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.item_no} {self.description}".strip()

    @property
    def amount(self):
        return self.scope_qty * self.rate

    def clean(self):
        super().clean()

        self.item_no = (self.item_no or "").strip()
        self.description = normalize_whitespace(
            self.description
        )
        errors = {}
        if not self.description:
            errors["description"] = (
                "Description is required."
            )
        if self.scope_qty < 0:
            errors["scope_qty"] = (
                "Scope quantity cannot be negative."
            )
        if self.rate < 0:
            errors["rate"] = "Rate cannot be negative."
        if errors:
            raise ValidationError(errors)

    def save(self, *args, **kwargs):
        self.full_clean()
        return super().save(*args, **kwargs)


class DprEntrySource(models.TextChoices):
    MANUAL_GRID = "MANUAL_GRID", "Daily grid"
    DETAILED = "DETAILED", "Detailed entry"
    EXCEL = "EXCEL", "Excel upload"


class DprEntry(
    UUIDPrimaryKeyModel,
    TimeStampedModel,
    UserTrackingModel,
):
    """
    Quantity executed on one item on one day. ``rate`` is a snapshot
    of the item's contract rate at entry time, so later rate edits
    never rewrite the value of work already recorded. Grid saves
    replace only ``MANUAL_GRID`` rows; detailed/Excel rows (which
    carry location/agency/remarks) are kept.
    """

    item = models.ForeignKey(
        DprItem,
        on_delete=models.PROTECT,
        related_name="entries",
    )
    date = models.DateField(db_index=True)
    qty = models.DecimalField(
        max_digits=14,
        decimal_places=3,
    )
    rate = models.DecimalField(
        max_digits=14,
        decimal_places=2,
    )
    location = models.CharField(
        max_length=200,
        blank=True,
    )
    agency = models.CharField(
        max_length=150,
        blank=True,
    )
    remarks = models.CharField(
        max_length=300,
        blank=True,
    )
    source = models.CharField(
        max_length=20,
        choices=DprEntrySource.choices,
        default=DprEntrySource.DETAILED,
    )

    class Meta:
        db_table = "project_monitor_dpr_entry"
        ordering = ["-date", "-created_at"]
        indexes = [
            models.Index(
                fields=["item", "date"],
                name="pm_dpr_entry_item_date_idx",
            ),
        ]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(qty__gt=0),
                name="pm_dpr_entry_qty_positive",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.item_id} - {self.date} - {self.qty}"

    @property
    def value(self):
        return self.qty * self.rate


class DprDayUnlock(
    UUIDPrimaryKeyModel,
    TimeStampedModel,
    UserTrackingModel,
):
    """
    An Admin's logged decision to reopen one past DPR day for one
    site after the normal edit window has closed.
    """

    site = models.ForeignKey(
        Site,
        on_delete=models.CASCADE,
        related_name="dpr_day_unlocks",
    )
    date = models.DateField()
    reason = models.CharField(max_length=300)

    class Meta:
        db_table = "project_monitor_dpr_day_unlock"
        ordering = ["-date"]
        constraints = [
            models.UniqueConstraint(
                fields=["site", "date"],
                name="pm_dpr_unlock_site_date_uniq",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.site_id} - {self.date}"


class RaBillKind(models.TextChoices):
    ITEMS = "ITEMS", "Item bill"
    AMOUNT = "AMOUNT", "Amount against project value"


class RaBill(
    UUIDPrimaryKeyModel,
    TimeStampedModel,
    UserTrackingModel,
):
    """
    One running-account bill, of one of two kinds:

    - ``ITEMS``: its gross value is computed from its lines (qty x
      the rate snapshotted on each line) - never stored - so a
      deleted or corrected bill can never leave a stale running
      total behind.
    - ``AMOUNT``: a lump sum received against the total project
      value, not tied to any item, quantity or progress. It has no
      lines; ``amount`` is its gross value.
    """

    site = models.ForeignKey(
        Site,
        on_delete=models.CASCADE,
        related_name="ra_bills",
    )
    bill_no = models.CharField(max_length=50)
    bill_date = models.DateField()
    kind = models.CharField(
        max_length=10,
        choices=RaBillKind.choices,
        default=RaBillKind.ITEMS,
    )
    amount = models.DecimalField(
        max_digits=16,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Gross value of an AMOUNT bill only.",
    )
    received_amount = models.DecimalField(
        max_digits=16,
        decimal_places=2,
        null=True,
        blank=True,
    )
    received_on = models.DateField(
        null=True,
        blank=True,
    )
    remarks = models.CharField(
        max_length=300,
        blank=True,
    )

    class Meta:
        db_table = "project_monitor_ra_bill"
        ordering = ["bill_date", "created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["site", "bill_no"],
                name="pm_ra_bill_no_uniq",
            ),
            models.CheckConstraint(
                condition=(
                    models.Q(kind="ITEMS", amount__isnull=True)
                    | models.Q(
                        kind="AMOUNT",
                        amount__isnull=False,
                        amount__gt=0,
                    )
                ),
                name="pm_ra_bill_kind_amount",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.site_id} - {self.bill_no}"


class RaBillLine(
    UUIDPrimaryKeyModel,
    TimeStampedModel,
):
    bill = models.ForeignKey(
        RaBill,
        on_delete=models.CASCADE,
        related_name="lines",
    )
    item = models.ForeignKey(
        DprItem,
        on_delete=models.PROTECT,
        related_name="bill_lines",
    )
    qty = models.DecimalField(
        max_digits=14,
        decimal_places=3,
    )
    rate = models.DecimalField(
        max_digits=14,
        decimal_places=2,
    )

    class Meta:
        db_table = "project_monitor_ra_bill_line"
        constraints = [
            models.UniqueConstraint(
                fields=["bill", "item"],
                name="pm_ra_bill_line_item_uniq",
            ),
            models.CheckConstraint(
                condition=models.Q(qty__gt=0),
                name="pm_ra_bill_line_qty_positive",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.bill_id} - {self.item_id}"

    @property
    def value(self):
        return self.qty * self.rate


class LabourEntrySource(models.TextChoices):
    MANUAL = "MANUAL", "Manual"
    EXCEL = "EXCEL", "Excel"


class LabourEntry(
    UUIDPrimaryKeyModel,
    TimeStampedModel,
    UserTrackingModel,
):
    """
    Contract labour on site for one day: a head-count of one category
    at one daily rate. ``amount`` is stored (nos x rate unless the
    entry overrides it, e.g. a lump-sum gang) so a later rate change
    can never rewrite what a past day cost.
    """

    site = models.ForeignKey(
        Site,
        on_delete=models.CASCADE,
        related_name="labour_entries",
    )
    date = models.DateField(db_index=True)
    category = models.CharField(max_length=100)
    nos = models.DecimalField(
        max_digits=10,
        decimal_places=2,
    )
    rate = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0,
    )
    amount = models.DecimalField(
        max_digits=14,
        decimal_places=2,
    )
    agency = models.CharField(max_length=150, blank=True)
    remarks = models.CharField(max_length=300, blank=True)
    source = models.CharField(
        max_length=20,
        choices=LabourEntrySource.choices,
        default=LabourEntrySource.MANUAL,
    )

    class Meta:
        db_table = "project_monitor_labour_entry"
        ordering = ["-date", "-created_at"]
        indexes = [
            models.Index(
                fields=["site", "date"],
                name="pm_labour_site_date_idx",
            ),
        ]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(nos__gt=0),
                name="pm_labour_nos_positive",
            ),
            models.CheckConstraint(
                condition=models.Q(amount__gte=0),
                name="pm_labour_amount_non_negative",
            ),
        ]

    def __str__(self) -> str:
        return (
            f"{self.site_id} - {self.date} - "
            f"{self.category} x {self.nos}"
        )


class StaffMember(
    UUIDPrimaryKeyModel,
    TimeStampedModel,
    UserTrackingModel,
):
    """
    Project staff on the payroll of one site. Their cost accrues per
    day from ``from_date`` to ``to_date`` (open-ended while still on
    the project): monthly salary divided by the days in that calendar
    month, unless a ``StaffDayOverride`` says otherwise.
    """

    site = models.ForeignKey(
        Site,
        on_delete=models.CASCADE,
        related_name="staff_members",
    )
    name = models.CharField(max_length=150)
    designation = models.CharField(max_length=100, blank=True)
    monthly_salary = models.DecimalField(
        max_digits=12,
        decimal_places=2,
    )
    from_date = models.DateField()
    to_date = models.DateField(null=True, blank=True)

    class Meta:
        db_table = "project_monitor_staff_member"
        ordering = ["name", "from_date"]
        indexes = [
            models.Index(
                fields=["site", "from_date"],
                name="pm_staff_site_from_idx",
            ),
        ]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(monthly_salary__gte=0),
                name="pm_staff_salary_non_negative",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.name} ({self.site_id})"

    def clean(self):
        super().clean()
        if self.to_date and self.to_date < self.from_date:
            raise ValidationError(
                {
                    "to_date": (
                        "The last day cannot be before the "
                        "joining date."
                    )
                }
            )


class StaffDayOverride(
    UUIDPrimaryKeyModel,
    TimeStampedModel,
    UserTrackingModel,
):
    """
    What one staff member actually cost on one day when it differs
    from the normal daily rate. ``amount`` of 0 means absent/unpaid.
    """

    staff = models.ForeignKey(
        StaffMember,
        on_delete=models.CASCADE,
        related_name="day_overrides",
    )
    date = models.DateField()
    amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
    )
    note = models.CharField(max_length=300, blank=True)

    class Meta:
        db_table = "project_monitor_staff_day_override"
        ordering = ["-date"]
        constraints = [
            models.UniqueConstraint(
                fields=["staff", "date"],
                name="pm_staff_override_uniq",
            ),
            models.CheckConstraint(
                condition=models.Q(amount__gte=0),
                name="pm_staff_override_non_negative",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.staff_id} - {self.date} - {self.amount}"


class MachineSource(models.TextChoices):
    MARKET = "MARKET", "Market hire"
    HO = "HO", "In-house (HO)"


class HireBasis(models.TextChoices):
    DAY = "DAY", "Per day"
    HOUR = "HOUR", "Per hour"
    MONTH = "MONTH", "Per month"


class Machine(
    UUIDPrimaryKeyModel,
    TimeStampedModel,
    UserTrackingModel,
):
    """
    A machine or vehicle working on one site. ``rate`` is what one
    unit of ``hire_basis`` costs (a day, an hour or a month); usage
    rows snapshot the resulting hire amount when they are entered, so
    a later rate edit never rewrites past days. Machines created by a
    bulk upload that named one nobody registered are ``needs_review``
    until someone fills in the rate and basis.
    """

    site = models.ForeignKey(
        Site,
        on_delete=models.CASCADE,
        related_name="machines",
    )
    name = models.CharField(max_length=150)
    reg_no = models.CharField(max_length=50, blank=True)
    source = models.CharField(
        max_length=10,
        choices=MachineSource.choices,
        default=MachineSource.MARKET,
    )
    agency = models.CharField(max_length=150, blank=True)
    hire_basis = models.CharField(
        max_length=10,
        choices=HireBasis.choices,
        default=HireBasis.DAY,
    )
    rate = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0,
    )
    is_active = models.BooleanField(default=True)
    needs_review = models.BooleanField(default=False)

    class Meta:
        db_table = "project_monitor_machine"
        ordering = ["name", "reg_no"]
        constraints = [
            models.UniqueConstraint(
                fields=["site", "name", "reg_no"],
                name="pm_machine_site_name_reg_uniq",
            ),
            models.CheckConstraint(
                condition=models.Q(rate__gte=0),
                name="pm_machine_rate_non_negative",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.name} ({self.site_id})"


class MachineUsageSource(models.TextChoices):
    MANUAL = "MANUAL", "Manual"
    EXCEL = "EXCEL", "Excel"


class MachineUsage(
    UUIDPrimaryKeyModel,
    TimeStampedModel,
    UserTrackingModel,
):
    """
    One machine's working day: how many units (days or hours) it
    worked, the hire that cost, and any maintenance/other spend. One
    row per machine per day - entering the day again replaces it.
    """

    machine = models.ForeignKey(
        Machine,
        on_delete=models.PROTECT,
        related_name="usages",
    )
    date = models.DateField(db_index=True)
    qty = models.DecimalField(
        max_digits=8,
        decimal_places=2,
        default=0,
    )
    hire_amount = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        default=0,
    )
    maintenance = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        default=0,
    )
    other = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        default=0,
    )
    remarks = models.CharField(max_length=300, blank=True)
    source = models.CharField(
        max_length=20,
        choices=MachineUsageSource.choices,
        default=MachineUsageSource.MANUAL,
    )

    class Meta:
        db_table = "project_monitor_machine_usage"
        ordering = ["-date", "machine__name"]
        constraints = [
            models.UniqueConstraint(
                fields=["machine", "date"],
                name="pm_machine_usage_day_uniq",
            ),
            models.CheckConstraint(
                condition=(
                    models.Q(qty__gte=0)
                    & models.Q(hire_amount__gte=0)
                    & models.Q(maintenance__gte=0)
                    & models.Q(other__gte=0)
                ),
                name="pm_machine_usage_non_negative",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.machine_id} - {self.date}"


class FuelEntry(
    UUIDPrimaryKeyModel,
    TimeStampedModel,
    UserTrackingModel,
):
    """
    Fuel bought or issued: litres and what it cost, optionally for
    one machine (blank = general site fuel). ``amount`` is stored, not
    derived, so a later price change never rewrites a past day.
    """

    site = models.ForeignKey(
        Site,
        on_delete=models.CASCADE,
        related_name="fuel_entries",
    )
    machine = models.ForeignKey(
        Machine,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="fuel_entries",
    )
    date = models.DateField(db_index=True)
    litres = models.DecimalField(
        max_digits=10,
        decimal_places=2,
    )
    rate = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0,
    )
    amount = models.DecimalField(
        max_digits=14,
        decimal_places=2,
    )
    remarks = models.CharField(max_length=300, blank=True)
    source = models.CharField(
        max_length=20,
        choices=MachineUsageSource.choices,
        default=MachineUsageSource.MANUAL,
    )

    class Meta:
        db_table = "project_monitor_fuel_entry"
        ordering = ["-date", "-created_at"]
        indexes = [
            models.Index(
                fields=["site", "date"],
                name="pm_fuel_site_date_idx",
            ),
        ]
        constraints = [
            models.CheckConstraint(
                condition=(
                    models.Q(litres__gt=0)
                    & models.Q(amount__gte=0)
                ),
                name="pm_fuel_positive",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.site_id} - {self.date} - {self.litres} L"
