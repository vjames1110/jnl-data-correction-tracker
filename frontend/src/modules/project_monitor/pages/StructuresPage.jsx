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
  useCreateStructure,
  useDeleteStructure,
  useReviewActivity,
  useReviewStructure,
  useStructures,
  useStructureTypes,
  useUpdateActivity,
  useUpdateStructure,
} from "../../../hooks/useProjectMonitor";
import { AddStructureForm } from "../components/AddStructureForm";
import { NoTaskAccess } from "../components/NoTaskAccess";
import { ProjectMonitorTabs } from "../components/ProjectMonitorTabs";
import { ActivityWorkspace } from "../components/ActivityWorkspace";
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
  const [editingStructure, setEditingStructure] =
    useState(null);

  const sitesQuery = useProjectSites();
  const structureTypesQuery =
    useStructureTypes();
  const structuresQuery = useStructures(
    selectedSite,
  );
  const siteTasks = useSiteTasks(selectedSite);
  const lacksTask =
    Boolean(selectedSite) &&
    !siteTasks.isLoading &&
    !siteTasks.has("STRUCTURES");
  const canEdit =
    !lacksTask && siteTasks.canEnter("STRUCTURES");

  const createStructure = useCreateStructure(
    selectedSite,
  );
  const updateStructure = useUpdateStructure(
    selectedSite,
  );
  const deleteStructure = useDeleteStructure(
    selectedSite,
  );
  const updateActivity = useUpdateActivity(
    selectedSite,
  );
  const reviewActivity = useReviewActivity(
    selectedSite,
  );
  const reviewStructure = useReviewStructure(
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

  useAutoSelectSite(
    sitesQuery.data,
    selectedSite,
    handleSiteChange,
  );

  const handleCreateStructure = (
    payload,
    options,
  ) => {
    createStructure.mutate(payload, {
      ...options,
      onSuccess: (...args) => {
        options?.onSuccess?.(...args);
        setIsAddFormOpen(false);
      },
    });
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

  const handleSaveEdit = (payload) => {
    updateStructure.mutate(
      {
        structureId: editingStructure.id,
        payload,
      },
      {
        onSuccess: () =>
          setEditingStructure(null),
      },
    );
  };

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
          closeOnOutsideClick
        >
          <AddStructureForm
            structureTypes={
              structureTypesQuery.data || []
            }
            onCreate={handleCreateStructure}
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

      {editingStructure ? (
        <ManagementPanel
          eyebrow="Structures"
          title={`Edit ${editingStructure.name}`}
          onClose={() =>
            setEditingStructure(null)
          }
          closeOnOutsideClick
        >
          <AddStructureForm
            structureTypes={
              structureTypesQuery.data || []
            }
            initialStructure={editingStructure}
            onSave={handleSaveEdit}
            onCancel={() =>
              setEditingStructure(null)
            }
            isPending={
              updateStructure.isPending
            }
            error={
              updateStructure.isError
                ? updateStructure.error
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
      ) : lacksTask ? (
        <NoTaskAccess task="Structures" />
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
                  setSelectedStructureId((current) =>
                    current === id ? null : id,
                  );
                  setActiveActivityId(null);
                }}
                expandedId={selectedStructureId}
                renderExpanded={(structure) => (
                  <ActivityWorkspace
                    item={structure}
                    activeActivityId={activeActivityId}
                    onSelectActivity={setActiveActivityId}
                    canEdit={canEdit}
                    onSubmitUpdate={(activityId, payload, options) =>
                      updateActivity.mutate(
                        { activityId, payload },
                        options,
                      )
                    }
                    updateStatus={updateActivity}
                    onReviewActivity={(activityId, remarks, options) =>
                      reviewActivity.mutate(
                        { activityId, payload: { remarks } },
                        options,
                      )
                    }
                    reviewActivityStatus={reviewActivity}
                    onReviewAll={(remarks, options) =>
                      reviewStructure.mutate(
                        {
                          structureId: structure.id,
                          payload: { remarks },
                        },
                        options,
                      )
                    }
                    reviewAllStatus={reviewStructure}
                  />
                )}
                onEdit={setEditingStructure}
                onDelete={handleDelete}
                canEdit={canEdit}
                deleteTitle="Delete this structure sheet and all its data"
              />
            ))}
          </SurfaceCard>
        </>
      )}
    </div>
  );
}
