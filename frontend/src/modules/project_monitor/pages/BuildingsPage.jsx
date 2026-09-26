import { Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { AppLoader } from "../../../components/common/AppLoader";
import { EmptyState } from "../../../components/common/EmptyState";
import { ErrorState } from "../../../components/common/ErrorState";
import { SurfaceCard } from "../../../components/common/SurfaceCard";
import { useAuth } from "../../../hooks/useAuth";
import {
  useAutoSelectSite,
  useProjectSites,
  useSiteTasks,
} from "../../../hooks/useProjectMonitor";
import {
  useBuildings,
  useCreateBuilding,
  useDeleteBuilding,
  useReviewActivity,
  useReviewBuilding,
  useUpdateActivity,
} from "../../../hooks/useProjectMonitor";
import { ActivityWorkspace } from "../components/ActivityWorkspace";
import { AddBuildingForm } from "../components/AddBuildingForm";
import { ItemGroupSection } from "../components/ItemGroupSection";
import { NoTaskAccess } from "../components/NoTaskAccess";
import { ProjectMonitorTabs } from "../components/ProjectMonitorTabs";
import { ManagementPanel } from "../../admin/components/OrganizationControls";

const UNGROUPED_LABEL = "Ungrouped";

export function BuildingsPage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] =
    useSearchParams();
  const [selectedSite, setSelectedSite] = useState(
    () => searchParams.get("site") || "",
  );
  const [selectedBuildingId, setSelectedBuildingId] =
    useState(null);
  const [activeActivityId, setActiveActivityId] =
    useState(null);
  const [isAddFormOpen, setIsAddFormOpen] =
    useState(false);

  const sitesQuery = useProjectSites();
  const buildingsQuery = useBuildings(
    selectedSite,
  );
  const siteTasks = useSiteTasks(selectedSite);
  const lacksTask =
    Boolean(selectedSite) &&
    !siteTasks.isLoading &&
    !siteTasks.has("BUILDINGS");
  const canEdit =
    !lacksTask && siteTasks.canEnter("BUILDINGS");

  const createBuilding = useCreateBuilding(
    selectedSite,
  );
  const deleteBuilding = useDeleteBuilding(
    selectedSite,
  );
  const updateActivity = useUpdateActivity(
    selectedSite,
  );
  const reviewActivity = useReviewActivity(
    selectedSite,
  );
  const reviewBuilding = useReviewBuilding(
    selectedSite,
  );

  const handleSiteChange = (value) => {
    setSelectedSite(value);
    setSelectedBuildingId(null);
    setActiveActivityId(null);
    setSearchParams(
      value ? { site: value } : {},
    );
  };

  useAutoSelectSite(
    sitesQuery.data,
    selectedSite,
    handleSiteChange,
  );

  const handleCreateBuilding = (
    payload,
    options,
  ) => {
    createBuilding.mutate(payload, {
      ...options,
      onSuccess: (...args) => {
        options?.onSuccess?.(...args);
        setIsAddFormOpen(false);
      },
    });
  };

  const buildingsByStation = useMemo(() => {
    const map = new Map();
    (buildingsQuery.data || []).forEach(
      (building) => {
        const key =
          building.station_label ||
          UNGROUPED_LABEL;
        if (!map.has(key)) {
          map.set(key, []);
        }
        map.get(key).push(building);
      },
    );
    return map;
  }, [buildingsQuery.data]);

  const handleDelete = (buildingId) => {
    if (
      !window.confirm(
        "Delete this building sheet and all its data?",
      )
    ) {
      return;
    }
    deleteBuilding.mutate(buildingId, {
      onSuccess: () => {
        if (selectedBuildingId === buildingId) {
          setSelectedBuildingId(null);
          setActiveActivityId(null);
        }
      },
    });
  };

  return (
    <div className="organization-page">
      <div className="page-heading">
        <div>
          <span className="page-eyebrow">
            Project Monitor
          </span>
          <h1>Buildings</h1>
          <p>
            Station buildings, service
            buildings and quarters - grouped by
            site/station, with a floor-wise
            checklist and material status on
            finishing items.
          </p>
        </div>

        <div className="page-actions">
          <label className="filter-control">
            <span>Project / Site</span>
            <select
              value={selectedSite}
              onChange={(event) =>
                handleSiteChange(
                  event.target.value,
                )
              }
            >
              <option value="">
                Select project
              </option>
              {(sitesQuery.data ?? []).map(
                (site) => (
                  <option
                    key={site.id}
                    value={site.id}
                  >
                    {site.code} -{" "}
                    {site.label}
                  </option>
                ),
              )}
            </select>
          </label>
          {canEdit && selectedSite ? (
            <button
              type="button"
              className="button button--primary"
              onClick={() =>
                setIsAddFormOpen(true)
              }
            >
              <Plus size={16} /> Add building
            </button>
          ) : null}
        </div>
      </div>

      <ProjectMonitorTabs
        role={user?.role}
        active="buildings"
      />

      {isAddFormOpen ? (
        <ManagementPanel
          eyebrow="Buildings"
          title="Add a building"
          onClose={() =>
            setIsAddFormOpen(false)
          }
          closeOnOutsideClick
        >
          <AddBuildingForm
            onCreate={handleCreateBuilding}
            onCancel={() =>
              setIsAddFormOpen(false)
            }
            isPending={
              createBuilding.isPending
            }
            error={
              createBuilding.isError
                ? createBuilding.error
                : null
            }
          />
        </ManagementPanel>
      ) : null}

      {!selectedSite ? (
        <EmptyState
          title="Pick a project to get started"
          message="Choose a project/site above to see its buildings."
        />
      ) : lacksTask ? (
        <NoTaskAccess task="Buildings" />
      ) : buildingsQuery.isLoading ? (
        <AppLoader label="Loading buildings..." />
      ) : buildingsQuery.isError ? (
        <ErrorState
          title="Buildings unavailable"
          message={
            buildingsQuery.error?.message
          }
          onRetry={buildingsQuery.refetch}
        />
      ) : (
        <SurfaceCard>
          {buildingsByStation.size === 0 ? (
            <p className="pm-timeline-empty">
              No buildings added yet.
            </p>
          ) : (
            Array.from(
              buildingsByStation.entries(),
            ).map(([station, items]) => (
              <ItemGroupSection
                key={station}
                label={station}
                items={items}
                onView={(id) => {
                  setSelectedBuildingId((current) =>
                    current === id ? null : id,
                  );
                  setActiveActivityId(null);
                }}
                expandedId={selectedBuildingId}
                renderExpanded={(building) => (
                  <ActivityWorkspace
                    item={building}
                    metaLine={`${
                      building.chainage_km != null
                        ? `Ch. ${building.chainage_km} km`
                        : "Chainage not set"
                    } · ${building.overall_progress.done}/${
                      building.overall_progress.total
                    } activities complete`}
                    activeActivityId={activeActivityId}
                    onSelectActivity={setActiveActivityId}
                    canEdit={canEdit}
                    onSubmitUpdate={(activityId, payload) =>
                      updateActivity.mutate({
                        activityId,
                        payload,
                      })
                    }
                    updateStatus={updateActivity}
                    onReviewActivity={(activityId, remarks) =>
                      reviewActivity.mutate({
                        activityId,
                        payload: { remarks },
                      })
                    }
                    reviewActivityStatus={reviewActivity}
                    onReviewAll={(remarks, options) =>
                      reviewBuilding.mutate(
                        {
                          buildingId: building.id,
                          payload: { remarks },
                        },
                        options,
                      )
                    }
                    reviewAllStatus={reviewBuilding}
                  />
                )}
                onDelete={handleDelete}
                canEdit={canEdit}
                deleteTitle="Delete this building sheet and all its data"
              />
            ))
          )}
        </SurfaceCard>
      )}
    </div>
  );
}
