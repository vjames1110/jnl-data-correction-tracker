from django.contrib import admin

from apps.project_monitor.models import (
    ActionItem,
    Activity,
    ActivityComment,
    ActivityDateEntry,
    Building,
    DprDayUnlock,
    DprEntry,
    DprItem,
    FuelEntry,
    LabourEntry,
    Machine,
    MachineUsage,
    GirderJob,
    GirderSpan,
    LinearItem,
    ProgressEntry,
    ProjectExtension,
    ProjectSiteAccess,
    RaBill,
    RaBillLine,
    StaffDayOverride,
    StaffMember,
    RdsoSpanLibraryEntry,
    ScopePatch,
    Structure,
    StructureTypeDefinition,
)


class ActivityDateEntryInline(admin.TabularInline):
    model = ActivityDateEntry
    extra = 0
    readonly_fields = [
        "target_date",
        "meeting_date",
        "created_at",
    ]
    can_delete = False


class ActivityCommentInline(admin.TabularInline):
    model = ActivityComment
    extra = 0
    readonly_fields = [
        "meeting_date",
        "text",
        "created_by",
        "created_at",
    ]
    can_delete = False


@admin.register(Activity)
class ActivityAdmin(admin.ModelAdmin):
    list_display = [
        "name",
        "group_title",
        "content_type",
        "status",
        "kind",
        "done_qty",
        "total_qty",
    ]
    list_filter = [
        "status",
        "kind",
        "content_type",
    ]
    search_fields = [
        "name",
        "group_title",
    ]
    inlines = [
        ActivityDateEntryInline,
        ActivityCommentInline,
    ]


@admin.register(Structure)
class StructureAdmin(admin.ModelAdmin):
    list_display = [
        "name",
        "structure_type",
        "site",
        "chainage_km",
        "created_at",
    ]
    list_filter = [
        "structure_type",
        "site",
    ]
    search_fields = [
        "name",
        "description",
    ]


@admin.register(StructureTypeDefinition)
class StructureTypeDefinitionAdmin(
    admin.ModelAdmin
):
    list_display = [
        "name",
        "code",
        "is_active",
        "display_order",
    ]
    list_filter = ["is_active"]
    search_fields = ["name", "code"]


@admin.register(Building)
class BuildingAdmin(admin.ModelAdmin):
    list_display = [
        "name",
        "station_label",
        "site",
        "chainage_km",
        "created_at",
    ]
    list_filter = ["site"]
    search_fields = [
        "name",
        "station_label",
        "description",
    ]


@admin.register(RdsoSpanLibraryEntry)
class RdsoSpanLibraryEntryAdmin(
    admin.ModelAdmin
):
    list_display = [
        "span_length_m",
        "girder_type",
        "drawing_no",
        "qty_per_span_mt",
        "is_active",
        "display_order",
    ]
    list_filter = ["is_active"]
    search_fields = ["girder_type", "drawing_no"]


class GirderSpanInline(admin.TabularInline):
    model = GirderSpan
    extra = 0
    fields = [
        "label",
        "is_standard",
        "span_length_m",
        "girder_type",
        "vendor",
        "po_number",
    ]


@admin.register(GirderJob)
class GirderJobAdmin(admin.ModelAdmin):
    list_display = [
        "bridge_name",
        "structure_kind",
        "girder_scope",
        "site",
        "chainage_km",
        "created_at",
    ]
    list_filter = [
        "structure_kind",
        "girder_scope",
        "site",
    ]
    search_fields = ["bridge_name"]
    inlines = [GirderSpanInline]


@admin.register(ProjectExtension)
class ProjectExtensionAdmin(admin.ModelAdmin):
    list_display = [
        "site",
        "new_end_date",
        "created_by",
        "created_at",
    ]
    list_filter = ["site"]
    search_fields = ["reason"]


@admin.register(ActionItem)
class ActionItemAdmin(admin.ModelAdmin):
    list_display = [
        "__str__",
        "site",
        "responsibility",
        "created_at",
    ]
    list_filter = ["site"]
    search_fields = ["responsibility", "remarks"]


class ScopePatchInline(admin.TabularInline):
    model = ScopePatch
    extra = 0
    fields = [
        "from_chainage_km",
        "to_chainage_km",
        "side",
        "qty",
        "remarks",
    ]


class ProgressEntryInline(admin.TabularInline):
    model = ProgressEntry
    extra = 0
    fields = [
        "date",
        "from_chainage_km",
        "to_chainage_km",
        "qty",
        "side",
        "contractor",
        "status",
    ]


@admin.register(LinearItem)
class LinearItemAdmin(admin.ModelAdmin):
    list_display = [
        "name",
        "unit",
        "site",
        "created_at",
    ]
    list_filter = ["unit", "site"]
    search_fields = ["name"]
    inlines = [
        ScopePatchInline,
        ProgressEntryInline,
    ]


@admin.register(ProjectSiteAccess)
class ProjectSiteAccessAdmin(admin.ModelAdmin):
    list_display = ["site", "user", "role", "created_at"]
    list_filter = ["role", "site"]
    search_fields = [
        "user__employee_id",
        "user__first_name",
        "site__site_code",
    ]


@admin.register(DprItem)
class DprItemAdmin(admin.ModelAdmin):
    list_display = [
        "item_no",
        "description",
        "site",
        "unit",
        "scope_qty",
        "rate",
        "is_active",
    ]
    list_filter = ["site", "is_active"]
    search_fields = ["item_no", "description"]


@admin.register(DprEntry)
class DprEntryAdmin(admin.ModelAdmin):
    list_display = ["date", "item", "qty", "rate", "source"]
    list_filter = ["source", "item__site"]
    date_hierarchy = "date"


@admin.register(DprDayUnlock)
class DprDayUnlockAdmin(admin.ModelAdmin):
    list_display = ["site", "date", "reason", "created_by"]
    list_filter = ["site"]


class RaBillLineInline(admin.TabularInline):
    model = RaBillLine
    extra = 0


@admin.register(RaBill)
class RaBillAdmin(admin.ModelAdmin):
    list_display = [
        "bill_no",
        "site",
        "bill_date",
        "received_amount",
    ]
    list_filter = ["site"]
    inlines = [RaBillLineInline]


@admin.register(LabourEntry)
class LabourEntryAdmin(admin.ModelAdmin):
    list_display = [
        "date",
        "site",
        "category",
        "nos",
        "rate",
        "amount",
        "source",
    ]
    list_filter = ["site", "source"]
    date_hierarchy = "date"


class StaffDayOverrideInline(admin.TabularInline):
    model = StaffDayOverride
    extra = 0


@admin.register(StaffMember)
class StaffMemberAdmin(admin.ModelAdmin):
    list_display = [
        "name",
        "site",
        "designation",
        "monthly_salary",
        "from_date",
        "to_date",
    ]
    list_filter = ["site"]
    inlines = [StaffDayOverrideInline]


@admin.register(Machine)
class MachineAdmin(admin.ModelAdmin):
    list_display = [
        "name",
        "site",
        "source",
        "hire_basis",
        "rate",
        "is_active",
        "needs_review",
    ]
    list_filter = ["site", "source", "needs_review"]


@admin.register(MachineUsage)
class MachineUsageAdmin(admin.ModelAdmin):
    list_display = [
        "date",
        "machine",
        "qty",
        "hire_amount",
        "maintenance",
        "other",
    ]
    list_filter = ["machine__site"]
    date_hierarchy = "date"


@admin.register(FuelEntry)
class FuelEntryAdmin(admin.ModelAdmin):
    list_display = ["date", "site", "machine", "litres", "amount"]
    list_filter = ["site"]
    date_hierarchy = "date"
