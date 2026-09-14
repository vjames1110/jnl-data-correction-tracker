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
  useCreateStructure,
  useDeleteStructure,
  useStructures,
  useStructureTypes,
  useUpdateActivity,
} from "../../../hooks/useProjectMonitor";
import { AddStructureForm } from "../components/AddStructureForm";
import { ProjectMonitorTabs } from "../components/ProjectMonitorTabs";
import { ActivitySheetDrawer } from "../components/ActivitySheetDrawer";
import { ItemGroupSection } from "../components/ItemGroupSection";
import { ManagementPanel } from "../../admin/components/OrganizationControls";

export function StructuresPage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] =
    useSearchParams();
  const [selectedSite, setSelectedSite] = useState(
    () => searchParams.get("site") || "",
  );
  const [selectedStructureId, setSelectedStructureId] =
    useState(null);
  const [activeActivityId, setActiveActivityId] =
    useState(null);
  const [isAddFormOpen, setIsAddFormOpen] =
    useState(false);

  const sitesQuery = useSitesDropdown();
  const structureTypesQuery =
    useStructureTypes();
  const structuresQuery = useStructures(
    selectedSite,
  );
  const canEdit = isProjectManagerRole(
    user?.role,
  );

  const createStructure = useCreateStructure(
    selectedSite,
  );
  const deleteStructure = useDeleteStructure(
    selectedSite,
  );
  const updateActivity = useUpdateActivity(
    selectedSite,
  );

  const handleSiteChange = (value) => {
    setSelectedSite(value);
    setSelectedStructureId(null);
    setActiveActivityId(null);
    setSearchParams(
      value ? { site: value } : {},
    );
  };

  const structuresByType = useMemo(() => {
    const map = new Map();
    (structuresQuery.data || []).forEach(
      (structure) => {
        const key = structure.structure_type;
        if (!map.has(key)) {
          map.set(key, []);
        }
        map.get(key).push(structure);
      },
    );
    return map;
  }, [structuresQuery.data]);

  const selectedStructure = useMemo(
    () =>
      (structuresQuery.data || []).find(
        (structure) =>
          structure.id === selectedStructureId,
      ) || null,
    [structuresQuery.data, selectedStructureId],
  );

  const handleDelete = (structureId) => {
    if (
      !window.confirm(
        "Delete this structure sheet and all its data?",
      )
    ) {
      return;
    }
    deleteStructure.mutate(structureId, {
      onSuccess: () => {
        if (selectedStructureId === structureId) {
          setSelectedStructureId(null);
          setActiveActivityId(null);
        }
      },
    });
  };

  const isLoading =
    structuresQuery.isLoading ||
    structureTypesQuery.isLoading;
  const isError =
    structuresQuery.isError ||
    structureTypesQuery.isError;

  return (
    <div className="organization-page">
      <div className="page-heading">
        <div>
          <span className="page-eyebrow">
            Project Monitor
          </span>
          <h1>Structures</h1>
          <p>
            Minor Bridges, Major Bridges, RUBs,
            ROBs and any other structure type
            defined in the master - each
            generates its own activity sheet
            from its inputs.
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
              <Plus size={16} /> Add
              structure
            </button>
          ) : null}
        </div>
      </div>

      <ProjectMonitorTabs
        role={user?.role}
        active="structures"
      />

      {isAddFormOpen ? (
        <ManagementPanel
          eyebrow="Structures"
          title="Add a structure"
          onClose={() =>
            setIsAddFormOpen(false)
          }
        >
          <AddStructureForm
            structureTypes={
              structureTypesQuery.data || []
            }
            onCreate={createStructure.mutate}
            onCancel={() =>
              setIsAddFormOpen(false)
            }
            isPending={
              createStructure.isPending
            }
            error={
              createStructure.isError
                ? createStructure.error
                : null
            }
          />
        </ManagementPanel>
      ) : null}

      {!selectedSite ? (
        <EmptyState
          title="Pick a project to get started"
          message="Choose a project/site above to see its structures."
        />
      ) : isLoading ? (
        <AppLoader label="Loading structures..." />
      ) : isError ? (
        <ErrorState
          title="Structures unavailable"
          message={
            structuresQuery.error?.message ||
            structureTypesQuery.error?.message
          }
          onRetry={() => {
            structuresQuery.refetch();
            structureTypesQuery.refetch();
          }}
        />
      ) : (
        <>
          <SurfaceCard>
            {(
              structureTypesQuery.data || []
            ).map((definition) => (
              <ItemGroupSection
                key={definition.id}
                label={definition.name}
                items={
                  structuresByType.get(
                    definition.id,
                  ) || []
                }
                onView={(id) => {
                  setSelectedStructureId(id);
                  setActiveActivityId(null);
                }}
                onDelete={handleDelete}
                canEdit={canEdit}
                deleteTitle="Delete this structure sheet and all its data"
              />
            ))}
          </SurfaceCard>
        </>
      )}

      <ActivitySheetDrawer
        item={selectedStructure}
        eyebrow={
          selectedStructure?.structure_type_name
        }
        metaLine={
          selectedStructure
            ? `${
                selectedStructure.chainage_km !=
                null
                  ? `Ch. ${selectedStructure.chainage_km} km`
                  : "Chainage not set"
              } · ${
                selectedStructure
                  .overall_progress.done
              }/${
                selectedStructure
                  .overall_progress.total
              } activities complete`
            : ""
        }
        backLabel="structure"
        activeActivityId={activeActivityId}
        onSelectActivity={setActiveActivityId}
        canEdit={canEdit}
        onClose={() => {
          setSelectedStructureId(null);
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
