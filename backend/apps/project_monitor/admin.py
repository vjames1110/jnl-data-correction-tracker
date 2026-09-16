from django.contrib import admin

from apps.project_monitor.models import (
    Activity,
    ActivityComment,
    ActivityDateEntry,
    Building,
    GirderJob,
    GirderSpan,
    ProjectExtension,
    RdsoSpanLibraryEntry,
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
