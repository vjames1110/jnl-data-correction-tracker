import { Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { AppLoader } from "../../../components/common/AppLoader";
import { EmptyState } from "../../../components/common/EmptyState";
import { ErrorState } from "../../../components/common/ErrorState";
import { SurfaceCard } from "../../../components/common/SurfaceCard";
import { isProjectManagerRole } from "../../../constants/roles";
import { useAuth } from "../../../hooks/useAuth";
import { useSitesDropdown } from "../../../hooks/useOrganization";
import {
  useBuildings,
  useCreateBuilding,
  useDeleteBuilding,
  useUpdateActivity,
} from "../../../hooks/useProjectMonitor";
import { ActivitySheetDrawer } from "../components/ActivitySheetDrawer";
import { AddBuildingForm } from "../components/AddBuildingForm";
import { ItemGroupSection } from "../components/ItemGroupSection";
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

  const sitesQuery = useSitesDropdown();
  const buildingsQuery = useBuildings(
    selectedSite,
  );
  const canEdit = isProjectManagerRole(
    user?.role,
  );

  const createBuilding = useCreateBuilding(
    selectedSite,
  );
  const deleteBuilding = useDeleteBuilding(
    selectedSite,
  );
  const updateActivity = useUpdateActivity(
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

  const selectedBuilding = useMemo(
    () =>
      (buildingsQuery.data || []).find(
        (building) =>
          building.id === selectedBuildingId,
      ) || null,
    [buildingsQuery.data, selectedBuildingId],
  );

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
        >
          <AddBuildingForm
            onCreate={createBuilding.mutate}
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
                  setSelectedBuildingId(id);
                  setActiveActivityId(null);
                }}
                onDelete={handleDelete}
                canEdit={canEdit}
                deleteTitle="Delete this building sheet and all its data"
              />
            ))
          )}
        </SurfaceCard>
      )}

      <ActivitySheetDrawer
        item={selectedBuilding}
        eyebrow={
          selectedBuilding?.station_label ||
          "Building"
        }
        metaLine={
          selectedBuilding
            ? `${
                selectedBuilding.chainage_km !=
                null
                  ? `Ch. ${selectedBuilding.chainage_km} km`
                  : "Chainage not set"
              } · ${
                selectedBuilding
                  .overall_progress.done
              }/${
                selectedBuilding
                  .overall_progress.total
              } activities complete`
            : ""
        }
        backLabel="building"
        activeActivityId={activeActivityId}
        onSelectActivity={setActiveActivityId}
        canEdit={canEdit}
        onClose={() => {
          setSelectedBuildingId(null);
          setActiveActivityId(null);
        }}
        onSubmitUpdate={(activityId, payload) =>
          updateActivity.mutate({
            activityId,
            payload,
          })
        }
        updateStatus={updateActivity}
      />
    </div>
  );
}
