import {
  CalendarDays,
  ChartGantt,
  ClipboardList,
  ListChecks,
  Plus,
} from "lucide-react";
import { useState } from "react";
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
  useCreateLinearItem,
  useCreateProgressEntry,
  useCreateScopePatch,
  useDeleteLinearItem,
  useDeleteProgressEntry,
  useDeleteScopePatch,
  useLinearItems,
  useProjectOverview,
  useUpdateProgressEntry,
} from "../../../hooks/useProjectMonitor";
import { AddLinearItemForm } from "../components/AddLinearItemForm";
import { DayWisePivot } from "../components/DayWisePivot";
import { LinearItemPanel } from "../components/LinearItemPanel";
import {
  ProgressRegisterTable,
  ScopeRegisterTable,
} from "../components/LinearRegisters";
import { NoTaskAccess } from "../components/NoTaskAccess";
import { ProjectMonitorTabs } from "../components/ProjectMonitorTabs";
import { SlideDownForm } from "../components/SlideDownForm";
import { WorkspaceSwitch } from "../components/WorkspaceSwitch";

export function LinearWorksPage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] =
    useSearchParams();
  const [selectedSite, setSelectedSite] = useState(
    () => searchParams.get("site") || "",
  );
  const [subTab, setSubTab] = useState("diagram");
  const [expandedItemId, setExpandedItemId] =
    useState(null);
  const [isAddFormOpen, setIsAddFormOpen] =
    useState(false);

  const sitesQuery = useProjectSites();
  const overviewQuery = useProjectOverview(
    selectedSite,
  );
  const linearItemsQuery = useLinearItems(
    selectedSite,
  );
  const siteTasks = useSiteTasks(selectedSite);
  const lacksTask =
    Boolean(selectedSite) &&
    !siteTasks.isLoading &&
    !siteTasks.has("LINEAR_WORKS");
  const canEdit =
    !lacksTask && siteTasks.canEnter("LINEAR_WORKS");

  const createLinearItem = useCreateLinearItem(
    selectedSite,
  );
  const deleteLinearItem = useDeleteLinearItem(
    selectedSite,
  );
  const createScopePatch = useCreateScopePatch(
    selectedSite,
  );
  const deleteScopePatch = useDeleteScopePatch(
    selectedSite,
  );
  const createProgressEntry =
    useCreateProgressEntry(selectedSite);
  const updateProgressEntry =
    useUpdateProgressEntry(selectedSite);
  const deleteProgressEntry =
    useDeleteProgressEntry(selectedSite);

  const handleSiteChange = (value) => {
    setSelectedSite(value);
    setExpandedItemId(null);
    setSearchParams(
      value ? { site: value } : {},
    );
  };

  useAutoSelectSite(
    sitesQuery.data,
    selectedSite,
    handleSiteChange,
  );

  const handleCreateLinearItem = (
    payload,
    options,
  ) => {
    createLinearItem.mutate(payload, {
      ...options,
      onSuccess: (...args) => {
        options?.onSuccess?.(...args);
        setIsAddFormOpen(false);
      },
    });
  };

  const handleDeleteItem = (itemId) => {
    if (
      !window.confirm(
        "Delete this linear item and all its scope/progress data?",
      )
    ) {
      return;
    }
    deleteLinearItem.mutate(itemId, {
      onSuccess: () => {
        if (expandedItemId === itemId) {
          setExpandedItemId(null);
        }
      },
    });
  };

  const isLoading =
    overviewQuery.isLoading ||
    linearItemsQuery.isLoading;
  const isError =
    overviewQuery.isError ||
    linearItemsQuery.isError;

  const items = linearItemsQuery.data || [];

  return (
    <div className="organization-page">
      <div className="page-heading">
        <div>
          <span className="page-eyebrow">
            Project Monitor
          </span>
          <h1>Linear Works</h1>
          <p>
            Chainage-based continuous works -
            earthwork, P.Way linking, drains,
            and similar - tracked as scope
            patches and daily progress against
            the project's own chainage range.
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
              <Plus size={16} /> Add linear
              item
            </button>
          ) : null}
        </div>
      </div>

      <ProjectMonitorTabs
        role={user?.role}
        active="linear-works"
      />

      {isAddFormOpen ? (
        <SlideDownForm
          eyebrow="Linear Works"
          title="Add a linear item"
          onClose={() =>
            setIsAddFormOpen(false)
          }
        >
          <AddLinearItemForm
            onCreate={handleCreateLinearItem}
            onCancel={() =>
              setIsAddFormOpen(false)
            }
            isPending={
              createLinearItem.isPending
            }
            error={
              createLinearItem.isError
                ? createLinearItem.error
                : null
            }
          />
        </SlideDownForm>
      ) : null}

      {!selectedSite ? (
        <EmptyState
          title="Pick a project to get started"
          message="Choose a project/site above to see its linear works."
        />
      ) : lacksTask ? (
        <NoTaskAccess task="Linear Works" />
      ) : isLoading ? (
        <AppLoader label="Loading linear works..." />
      ) : isError ? (
        <ErrorState
          title="Linear works unavailable"
          message={
            overviewQuery.error?.message ||
            linearItemsQuery.error?.message
          }
          onRetry={() => {
            overviewQuery.refetch();
            linearItemsQuery.refetch();
          }}
        />
      ) : (
        <>
          <WorkspaceSwitch
            label="Linear works view"
            value={subTab}
            onChange={setSubTab}
            options={[
              {
                key: "diagram",
                label: "Rolling Diagram",
                icon: ChartGantt,
              },
              {
                key: "day-wise",
                label: "Day-wise",
                icon: CalendarDays,
              },
              {
                key: "scope-register",
                label: "Scope register",
                icon: ListChecks,
              },
              {
                key: "progress-register",
                label: "Progress register",
                icon: ClipboardList,
              },
            ]}
          />

          {subTab === "diagram" ? (
            <SurfaceCard>
              {items.length === 0 ? (
                <p className="pm-timeline-empty">
                  No linear items added yet.
                </p>
              ) : (
                items.map((item) => (
                  <LinearItemPanel
                    key={item.id}
                    item={item}
                    isExpanded={
                      expandedItemId ===
                      item.id
                    }
                    onToggle={() =>
                      setExpandedItemId(
                        (current) =>
                          current === item.id
                            ? null
                            : item.id,
                      )
                    }
                    canEdit={canEdit}
                    onAddScopePatch={(
                      itemId,
                      payload,
                      options,
                    ) =>
                      createScopePatch.mutate(
                        {
                          linearItemId: itemId,
                          payload,
                        },
                        options,
                      )
                    }
                    addScopePatchStatus={
                      createScopePatch
                    }
                    onAddProgressEntry={(
                      itemId,
                      payload,
                      options,
                    ) =>
                      createProgressEntry.mutate(
                        {
                          linearItemId: itemId,
                          payload,
                        },
                        options,
                      )
                    }
                    addProgressEntryStatus={
                      createProgressEntry
                    }
                    onDeleteItem={
                      handleDeleteItem
                    }
                  />
                ))
              )}
            </SurfaceCard>
          ) : subTab === "day-wise" ? (
            <SurfaceCard>
              <DayWisePivot items={items} />
            </SurfaceCard>
          ) : subTab === "scope-register" ? (
            <SurfaceCard>
              <ScopeRegisterTable
                items={items}
                canEdit={canEdit}
                onDeleteScopePatch={
                  deleteScopePatch.mutate
                }
              />
            </SurfaceCard>
          ) : (
            <SurfaceCard>
              <ProgressRegisterTable
                items={items}
                canEdit={canEdit}
                onUpdateProgressEntry={(
                  entryId,
                  payload,
                  options,
                ) =>
                  updateProgressEntry.mutate(
                    { entryId, payload },
                    options,
                  )
                }
                updateProgressEntryStatus={
                  updateProgressEntry
                }
                onDeleteProgressEntry={
                  deleteProgressEntry.mutate
                }
              />
            </SurfaceCard>
          )}
        </>
      )}
    </div>
  );
}
