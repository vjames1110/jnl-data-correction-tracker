from django.urls import path

from apps.project_monitor.api.views import (
    ActivityReviewAPIView,
    ActivityUpdateAPIView,
    BuildingDetailAPIView,
    BuildingListCreateAPIView,
    BuildingReviewAPIView,
    ProjectOverviewAPIView,
    StructureDetailAPIView,
    StructureListCreateAPIView,
    StructureReviewAPIView,
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
        "structures/<uuid:pk>/review/",
        StructureReviewAPIView.as_view(),
        name="structure-review",
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
        "buildings/<uuid:pk>/review/",
        BuildingReviewAPIView.as_view(),
        name="building-review",
    ),
    path(
        "activities/<uuid:pk>/",
        ActivityUpdateAPIView.as_view(),
        name="activity-update",
    ),
    path(
        "activities/<uuid:pk>/review/",
        ActivityReviewAPIView.as_view(),
        name="activity-review",
    ),
]
