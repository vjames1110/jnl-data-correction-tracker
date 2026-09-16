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
  useCreateGirderJob,
  useDeleteGirderJob,
  useGirderJobs,
  useRdsoSpanLibrary,
  useReviewActivity,
  useReviewGirderJob,
  useStructures,
  useUpdateActivity,
  useUpdateGirderSpan,
} from "../../../hooks/useProjectMonitor";
import { AddGirderJobForm } from "../components/AddGirderJobForm";
import { GirderJobDrawer } from "../components/GirderJobDrawer";
import { ItemGroupSection } from "../components/ItemGroupSection";
import { ProjectMonitorTabs } from "../components/ProjectMonitorTabs";
import { ManagementPanel } from "../../admin/components/OrganizationControls";

const STRUCTURE_KIND_LABELS = {
  MAJOR: "Major Bridge",
  ROB: "ROB",
  FOB: "FOB",
};

export function GirdersPage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] =
    useSearchParams();
  const [selectedSite, setSelectedSite] = useState(
    () => searchParams.get("site") || "",
  );
  const [selectedJobId, setSelectedJobId] =
    useState(null);
  const [activeActivityId, setActiveActivityId] =
    useState(null);
  const [isAddFormOpen, setIsAddFormOpen] =
    useState(false);

  const sitesQuery = useSitesDropdown();
  const girderJobsQuery = useGirderJobs(
    selectedSite,
  );
  const structuresQuery = useStructures(
    selectedSite,
  );
  const spanLibraryQuery = useRdsoSpanLibrary();
  const canEdit = isProjectManagerRole(
    user?.role,
  );

  const createGirderJob = useCreateGirderJob(
    selectedSite,
  );
  const deleteGirderJob = useDeleteGirderJob(
    selectedSite,
  );
  const updateActivity = useUpdateActivity(
    selectedSite,
  );
  const reviewActivity = useReviewActivity(
    selectedSite,
  );
  const reviewGirderJob = useReviewGirderJob(
    selectedSite,
  );
  const updateGirderSpan = useUpdateGirderSpan(
    selectedSite,
  );

  const handleSiteChange = (value) => {
    setSelectedSite(value);
    setSelectedJobId(null);
    setActiveActivityId(null);
    setSearchParams(
      value ? { site: value } : {},
    );
  };

  const handleCreateGirderJob = (
    payload,
    options,
  ) => {
    createGirderJob.mutate(payload, {
      ...options,
      onSuccess: (...args) => {
        options?.onSuccess?.(...args);
        setIsAddFormOpen(false);
      },
    });
  };

  const jobsByKind = useMemo(() => {
    const map = new Map();
    (girderJobsQuery.data || []).forEach(
      (job) => {
        const key = job.structure_kind;
        if (!map.has(key)) {
          map.set(key, []);
        }
        map.get(key).push(job);
      },
    );
    return map;
  }, [girderJobsQuery.data]);

  const existingStructureIds = useMemo(
    () =>
      new Set(
        (girderJobsQuery.data || [])
          .map((job) => job.structure)
          .filter(Boolean),
      ),
    [girderJobsQuery.data],
  );

  const selectedJob = useMemo(
    () =>
      (girderJobsQuery.data || []).find(
        (job) => job.id === selectedJobId,
      ) || null,
    [girderJobsQuery.data, selectedJobId],
  );

  const handleDelete = (jobId) => {
    if (
      !window.confirm(
        "Delete this girder job and all its data?",
      )
    ) {
      return;
    }
    deleteGirderJob.mutate(jobId, {
      onSuccess: () => {
        if (selectedJobId === jobId) {
          setSelectedJobId(null);
          setActiveActivityId(null);
        }
      },
    });
  };

  const isLoading =
    girderJobsQuery.isLoading ||
    structuresQuery.isLoading ||
    spanLibraryQuery.isLoading;
  const isError =
    girderJobsQuery.isError ||
    structuresQuery.isError ||
    spanLibraryQuery.isError;

  return (
    <div className="organization-page">
      <div className="page-heading">
        <div>
          <span className="page-eyebrow">
            Project Monitor
          </span>
          <h1>Girders, Bearings & Expansion Joints</h1>
          <p>
            Span-by-span girder fabrication-to-
            launching tracking for Major Bridges,
            ROBs and FOBs, plus each span's
            Bearings and Expansion Joints chains.
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
              <Plus size={16} /> Add girder job
            </button>
          ) : null}
        </div>
      </div>

      <ProjectMonitorTabs
        role={user?.role}
        active="girders"
      />

      {isAddFormOpen ? (
        <ManagementPanel
          eyebrow="Girders"
          title="Add a girder job"
          onClose={() =>
            setIsAddFormOpen(false)
          }
          closeOnOutsideClick
        >
          <AddGirderJobForm
            structures={
              structuresQuery.data || []
            }
            existingStructureIds={
              existingStructureIds
            }
            spanLibrary={
              spanLibraryQuery.data || []
            }
            onCreate={handleCreateGirderJob}
            onCancel={() =>
              setIsAddFormOpen(false)
            }
            isPending={
              createGirderJob.isPending
            }
            error={
              createGirderJob.isError
                ? createGirderJob.error
                : null
            }
          />
        </ManagementPanel>
      ) : null}

      {!selectedSite ? (
        <EmptyState
          title="Pick a project to get started"
          message="Choose a project/site above to see its girder jobs."
        />
      ) : isLoading ? (
        <AppLoader label="Loading girder jobs..." />
      ) : isError ? (
        <ErrorState
          title="Girder jobs unavailable"
          message={
            girderJobsQuery.error?.message ||
            structuresQuery.error?.message ||
            spanLibraryQuery.error?.message
          }
          onRetry={() => {
            girderJobsQuery.refetch();
            structuresQuery.refetch();
            spanLibraryQuery.refetch();
          }}
        />
      ) : (
        <SurfaceCard>
          {Object.entries(
            STRUCTURE_KIND_LABELS,
          ).map(([kind, label]) => (
            <ItemGroupSection
              key={kind}
              label={label}
              items={(
                jobsByKind.get(kind) || []
              ).map((job) => ({
                id: job.id,
                name: job.bridge_name,
                chainage_km: job.chainage_km,
                description: `${job.girder_scope_display} · ${job.spans.length} span(s)`,
                overall_progress:
                  job.overall_progress,
              }))}
              onView={(id) => {
                setSelectedJobId(id);
                setActiveActivityId(null);
              }}
              onDelete={handleDelete}
              canEdit={canEdit}
              deleteTitle="Delete this girder job and all its data"
            />
          ))}
        </SurfaceCard>
      )}

      <GirderJobDrawer
        job={selectedJob}
        eyebrow={
          selectedJob
            ? STRUCTURE_KIND_LABELS[
                selectedJob.structure_kind
              ]
            : ""
        }
        metaLine={
          selectedJob
            ? `${
                selectedJob.chainage_km != null
                  ? `Ch. ${selectedJob.chainage_km} km`
                  : "Chainage not set"
              } · ${
                selectedJob.girder_scope_display
              } · ${
                selectedJob.overall_progress
                  .done
              }/${
                selectedJob.overall_progress
                  .total
              } activities complete`
            : ""
        }
        activeActivityId={activeActivityId}
        onSelectActivity={setActiveActivityId}
        canEdit={canEdit}
        onClose={() => {
          setSelectedJobId(null);
          setActiveActivityId(null);
        }}
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
          reviewGirderJob.mutate(
            {
              jobId: selectedJob?.id,
              payload: { remarks },
            },
            options,
          )
        }
        reviewAllStatus={reviewGirderJob}
        onUpdateSpan={(
          spanId,
          payload,
          options,
        ) =>
          updateGirderSpan.mutate(
            { spanId, payload },
            options,
          )
        }
        updateSpanStatus={updateGirderSpan}
      />
    </div>
  );
}
