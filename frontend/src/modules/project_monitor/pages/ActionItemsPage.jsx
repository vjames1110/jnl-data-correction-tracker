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
  useActionItems,
  useCreateActionItem,
  useDeleteActionItem,
  useReviewActivity,
  useUpdateActionItem,
  useUpdateActivity,
} from "../../../hooks/useProjectMonitor";
import { ActionItemTable } from "../components/ActionItemTable";
import { AddActionItemForm } from "../components/AddActionItemForm";
import { NoTaskAccess } from "../components/NoTaskAccess";
import { ProjectMonitorTabs } from "../components/ProjectMonitorTabs";
import { ManagementPanel } from "../../admin/components/OrganizationControls";

export function ActionItemsPage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] =
    useSearchParams();
  const [selectedSite, setSelectedSite] = useState(
    () => searchParams.get("site") || "",
  );
  const [activeActivityId, setActiveActivityId] =
    useState(null);
  const [isAddFormOpen, setIsAddFormOpen] =
    useState(false);

  const sitesQuery = useProjectSites();
  const actionItemsQuery = useActionItems(
    selectedSite,
  );
  const siteTasks = useSiteTasks(selectedSite);
  const lacksTask =
    Boolean(selectedSite) &&
    !siteTasks.isLoading &&
    !siteTasks.has("ACTION_ITEMS");
  const canEdit =
    !lacksTask && siteTasks.canEnter("ACTION_ITEMS");

  const createActionItem = useCreateActionItem(
    selectedSite,
  );
  const updateActionItem = useUpdateActionItem(
    selectedSite,
  );
  const deleteActionItem = useDeleteActionItem(
    selectedSite,
  );
  const updateActivity = useUpdateActivity(
    selectedSite,
  );
  const reviewActivity = useReviewActivity(
    selectedSite,
  );

  const handleSiteChange = (value) => {
    setSelectedSite(value);
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

  const handleCreateActionItem = (
    payload,
    options,
  ) => {
    createActionItem.mutate(payload, {
      ...options,
      onSuccess: (...args) => {
        options?.onSuccess?.(...args);
        setIsAddFormOpen(false);
      },
    });
  };

  const handleDelete = (itemId) => {
    if (
      !window.confirm(
        "Delete this action item?",
      )
    ) {
      return;
    }
    deleteActionItem.mutate(itemId);
  };

  const handleReopen = (activityId) => {
    updateActivity.mutate({
      activityId,
      payload: {
        meeting_date: new Date()
          .toISOString()
          .slice(0, 10),
        status: "IN_PROGRESS",
        comment: "Re-opened",
      },
    });
  };

  const { openItems, completedItems } =
    useMemo(() => {
      const open = [];
      const completed = [];
      (actionItemsQuery.data || []).forEach(
        (item) => {
          if (
            item.activity?.status ===
            "COMPLETE"
          ) {
            completed.push(item);
          } else {
            open.push(item);
          }
        },
      );
      return {
        openItems: open,
        completedItems: completed,
      };
    }, [actionItemsQuery.data]);

  return (
    <div className="organization-page">
      <div className="page-heading">
        <div>
          <span className="page-eyebrow">
            Project Monitor
          </span>
          <h1>Action Items</h1>
          <p>
            Meeting-tracked responsibilities -
            open items auto-flag overdue past
            their target date; completed items
            can be re-opened if needed.
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
              <Plus size={16} /> Add action
              item
            </button>
          ) : null}
        </div>
      </div>

      <ProjectMonitorTabs
        role={user?.role}
        active="action-items"
      />

      {isAddFormOpen ? (
        <ManagementPanel
          eyebrow="Action Items"
          title="Add an action item"
          onClose={() =>
            setIsAddFormOpen(false)
          }
          closeOnOutsideClick
        >
          <AddActionItemForm
            onCreate={handleCreateActionItem}
            onCancel={() =>
              setIsAddFormOpen(false)
            }
            isPending={
              createActionItem.isPending
            }
            error={
              createActionItem.isError
                ? createActionItem.error
                : null
            }
          />
        </ManagementPanel>
      ) : null}

      {!selectedSite ? (
        <EmptyState
          title="Pick a project to get started"
          message="Choose a project/site above to see its action items."
        />
      ) : lacksTask ? (
        <NoTaskAccess task="Action Items" />
      ) : actionItemsQuery.isLoading ? (
        <AppLoader label="Loading action items..." />
      ) : actionItemsQuery.isError ? (
        <ErrorState
          title="Action items unavailable"
          message={
            actionItemsQuery.error?.message
          }
          onRetry={actionItemsQuery.refetch}
        />
      ) : (
        <>
          <SurfaceCard>
            <div className="surface-card__header">
              <h2>
                Open ({openItems.length})
              </h2>
            </div>
            <ActionItemTable
              items={openItems}
              emptyMessage="No open action items."
              canEdit={canEdit}
              activeActivityId={
                activeActivityId
              }
              onSelectActivity={
                setActiveActivityId
              }
              onSubmitUpdate={(
                activityId,
                payload,
              ) =>
                updateActivity.mutate({
                  activityId,
                  payload,
                })
              }
              updateStatus={updateActivity}
              onReviewActivity={(
                activityId,
                remarks,
              ) =>
                reviewActivity.mutate({
                  activityId,
                  payload: { remarks },
                })
              }
              reviewActivityStatus={
                reviewActivity
              }
              onUpdateItem={(
                itemId,
                payload,
                options,
              ) =>
                updateActionItem.mutate(
                  { itemId, payload },
                  options,
                )
              }
              updateItemStatus={
                updateActionItem
              }
              onDeleteItem={handleDelete}
            />
          </SurfaceCard>

          <SurfaceCard>
            <div className="surface-card__header">
              <h2>
                Completed (
                {completedItems.length})
              </h2>
            </div>
            <ActionItemTable
              items={completedItems}
              emptyMessage="No completed action items yet."
              canEdit={canEdit}
              activeActivityId={
                activeActivityId
              }
              onSelectActivity={
                setActiveActivityId
              }
              onSubmitUpdate={(
                activityId,
                payload,
              ) =>
                updateActivity.mutate({
                  activityId,
                  payload,
                })
              }
              updateStatus={updateActivity}
              onReviewActivity={(
                activityId,
                remarks,
              ) =>
                reviewActivity.mutate({
                  activityId,
                  payload: { remarks },
                })
              }
              reviewActivityStatus={
                reviewActivity
              }
              onUpdateItem={(
                itemId,
                payload,
                options,
              ) =>
                updateActionItem.mutate(
                  { itemId, payload },
                  options,
                )
              }
              updateItemStatus={
                updateActionItem
              }
              onDeleteItem={handleDelete}
              onReopen={handleReopen}
              isCompletedTable
            />
          </SurfaceCard>
        </>
      )}
    </div>
  );
}
