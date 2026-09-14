from django.urls import path

from apps.project_monitor.api.views import (
    ActivityUpdateAPIView,
    BuildingDetailAPIView,
    BuildingListCreateAPIView,
    ProjectOverviewAPIView,
    StructureDetailAPIView,
    StructureListCreateAPIView,
    StructureTypeDetailAPIView,
    StructureTypeListCreateAPIView,
)


app_name = "project-monitor-api"

urlpatterns = [
    path(
        "overview/",
        ProjectOverviewAPIView.as_view(),
        name="overview",
    ),
    path(
        "structure-types/",
        StructureTypeListCreateAPIView.as_view(),
        name="structure-type-list",
    ),
    path(
        "structure-types/<uuid:pk>/",
        StructureTypeDetailAPIView.as_view(),
        name="structure-type-detail",
    ),
    path(
        "structures/",
        StructureListCreateAPIView.as_view(),
        name="structure-list",
    ),
    path(
        "structures/<uuid:pk>/",
        StructureDetailAPIView.as_view(),
        name="structure-detail",
    ),
    path(
        "buildings/",
        BuildingListCreateAPIView.as_view(),
        name="building-list",
    ),
    path(
        "buildings/<uuid:pk>/",
        BuildingDetailAPIView.as_view(),
        name="building-detail",
    ),
    path(
        "activities/<uuid:pk>/",
        ActivityUpdateAPIView.as_view(),
        name="activity-update",
    ),
]
