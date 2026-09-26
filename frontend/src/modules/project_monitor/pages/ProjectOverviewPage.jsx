import { useState } from "react";
import {
  Building2,
  ClipboardList,
  Landmark,
  ListChecks,
  Ruler,
} from "lucide-react";
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
  useCreateChainageSegment,
  useCreateProjectExtension,
  useDeleteChainageSegment,
  useDeleteProjectExtension,
  useDprAccess,
  useFinancialSummary,
  useProjectOverview,
  useUpdateProjectSiteDetails,
} from "../../../hooks/useProjectMonitor";
import { KpiCard } from "../../admin/components/KpiCard";
import { ChainageSegmentsList } from "../components/ChainageSegmentsList";
import { DueTracker } from "../components/DueTracker";
import { FinancialTiles } from "../components/FinancialTiles";
import { ProjectCountdownBadge } from "../components/ProjectCountdownBadge";
import { ProjectExtensionsList } from "../components/ProjectExtensionsList";
import { ProjectMonitorTabs } from "../components/ProjectMonitorTabs";
import { formatDate } from "../utils/status";

const INR_FORMATTER = new Intl.NumberFormat(
  "en-IN",
  {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  },
);

function formatCurrency(value) {
  if (value === null || value === undefined) {
    return "Not set";
  }
  return `₹${INR_FORMATTER.format(Number(value))}`;
}

const BLANK_DETAILS_FORM = {
  project_name: "",
  start_date: "",
  end_date: "",
  project_value: "",
  chainage_start_km: "",
  chainage_end_km: "",
  client_or_section: "",
};

function ProjectDetailsCard({ site, canEdit, onSaved }) {
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState(BLANK_DETAILS_FORM);
  const updateSiteDetails =
    useUpdateProjectSiteDetails();

  const startEditing = () => {
    setForm({
      project_name: site.project_name ?? "",
      start_date: site.start_date ?? "",
      end_date: site.end_date ?? "",
      project_value:
        site.project_value ?? "",
      chainage_start_km:
        site.chainage_start_km ?? "",
      chainage_end_km:
        site.chainage_end_km ?? "",
      client_or_section:
        site.client_or_section ?? "",
    });
    setIsEditing(true);
  };

  const setField = (field, value) =>
    setForm((current) => ({
      ...current,
      [field]: value,
    }));

  const handleSave = async (event) => {
    event.preventDefault();
    await updateSiteDetails.mutateAsync({
      siteId: site.id,
      payload: {
        project_name: form.project_name || "",
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        project_value:
          form.project_value || null,
        chainage_start_km:
          form.chainage_start_km || null,
        chainage_end_km:
          form.chainage_end_km || null,
        client_or_section:
          form.client_or_section || "",
      },
    });
    setIsEditing(false);
    onSaved();
  };

  return (
    <SurfaceCard className="print-hidden">
      <div className="surface-card__header">
        <h2>Project Details</h2>
        {canEdit && !isEditing ? (
          <button
            type="button"
            className="button button--tertiary"
            onClick={startEditing}
          >
            Edit
          </button>
        ) : null}
      </div>

      {isEditing ? (
        <form
          className="site-toolbar"
          onSubmit={handleSave}
        >
          <label className="form-field">
            <span>Project name</span>
            <input
              type="text"
              placeholder="e.g. Chunar Doubling"
              value={form.project_name}
              onChange={(event) =>
                setField(
                  "project_name",
                  event.target.value,
                )
              }
            />
          </label>
          <label className="form-field">
            <span>Start date</span>
            <input
              type="date"
              value={form.start_date}
              onChange={(event) =>
                setField(
                  "start_date",
                  event.target.value,
                )
              }
            />
          </label>
          <label className="form-field">
            <span>End date</span>
            <input
              type="date"
              value={form.end_date}
              onChange={(event) =>
                setField(
                  "end_date",
                  event.target.value,
                )
              }
            />
          </label>
          <label className="form-field">
            <span>Project value (₹)</span>
            <input
              type="number"
              step="0.01"
              min="0"
              value={form.project_value}
              onChange={(event) =>
                setField(
                  "project_value",
                  event.target.value,
                )
              }
              placeholder="e.g. 125000000"
            />
          </label>
          <label className="form-field">
            <span>Chainage start (km)</span>
            <input
              type="number"
              step="0.001"
              min="0"
              value={
                form.chainage_start_km
              }
              onChange={(event) =>
                setField(
                  "chainage_start_km",
                  event.target.value,
                )
              }
            />
          </label>
          <label className="form-field">
            <span>Chainage end (km)</span>
            <input
              type="number"
              step="0.001"
              min="0"
              value={form.chainage_end_km}
              onChange={(event) =>
                setField(
                  "chainage_end_km",
                  event.target.value,
                )
              }
            />
          </label>
          <label className="form-field">
            <span>Client / Section</span>
            <input
              type="text"
              placeholder="e.g. NCR Prayagraj"
              value={
                form.client_or_section
              }
              onChange={(event) =>
                setField(
                  "client_or_section",
                  event.target.value,
                )
              }
            />
          </label>
          <div className="pm-inline-row">
            <button
              type="submit"
              className="button button--primary"
              disabled={
                updateSiteDetails.isPending
              }
            >
              Save
            </button>
            <button
              type="button"
              className="button button--tertiary"
              onClick={() =>
                setIsEditing(false)
              }
            >
              Cancel
            </button>
          </div>
          {updateSiteDetails.isError ? (
            <div className="inline-alert inline-alert--error">
              {updateSiteDetails.error?.message}
            </div>
          ) : null}
        </form>
      ) : (
        <dl className="pm-detail-cards">
          <div className="pm-detail-card">
            <dt>Project</dt>
            <dd>
              {site.project_name || "-"}
            </dd>
          </div>
          <div className="pm-detail-card">
            <dt>Project value</dt>
            <dd>
              {formatCurrency(
                site.project_value,
              )}
            </dd>
          </div>
          <div className="pm-detail-card">
            <dt>Start date</dt>
            <dd>
              {formatDate(site.start_date)}
            </dd>
          </div>
          <div className="pm-detail-card">
            <dt>End date</dt>
            <dd>
              {formatDate(site.end_date)}
            </dd>
          </div>
          <div className="pm-detail-card">
            <dt>Chainage</dt>
            <dd>
              {site.chainage_start_km != null &&
              site.chainage_end_km != null
                ? `${site.chainage_start_km} km – ${site.chainage_end_km} km`
                : "Not set"}
            </dd>
          </div>
          <div className="pm-detail-card">
            <dt>Client / Section</dt>
            <dd>
              {site.client_or_section ||
                "Not set"}
            </dd>
          </div>
          <div className="pm-detail-card">
            <dt>Director</dt>
            <dd>
              {site.site_director_name ||
                "Not assigned"}
            </dd>
          </div>
          <div className="pm-detail-card">
            <dt>Site PM</dt>
            <dd>
              {site.site_hod_name ||
                "Not assigned"}
            </dd>
          </div>
        </dl>
      )}

      <ProjectCountdownBadge
        daysRemaining={site.days_remaining}
        countdownStatus={site.countdown_status}
        effectiveEndDate={
          site.effective_end_date
        }
      />
    </SurfaceCard>
  );
}

export function ProjectOverviewPage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] =
    useSearchParams();
  const [selectedSite, setSelectedSite] = useState(
    () => searchParams.get("site") || "",
  );
  const sitesQuery = useProjectSites();
  const overviewQuery = useProjectOverview(
    selectedSite,
  );
  const siteTasks = useSiteTasks(selectedSite);
  const canEdit = siteTasks.canEnter("OVERVIEW");
  const financeAccess = useDprAccess(selectedSite);
  const financeSummary = useFinancialSummary(
    selectedSite,
    Boolean(financeAccess.data?.can_view),
  );
  const createExtension =
    useCreateProjectExtension(selectedSite);
  const deleteExtension =
    useDeleteProjectExtension(selectedSite);
  const createChainageSegment =
    useCreateChainageSegment(selectedSite);
  const deleteChainageSegment =
    useDeleteChainageSegment(selectedSite);

  const handleSiteChange = (value) => {
    setSelectedSite(value);
    setSearchParams(
      value ? { site: value } : {},
    );
  };

  useAutoSelectSite(
    sitesQuery.data,
    selectedSite,
    handleSiteChange,
  );

  return (
    <div className="organization-page">
      <div className="page-heading">
        <div>
          <span className="page-eyebrow">
            Project Monitor
          </span>
          <h1>Project Overview</h1>
          <p>
            Physical-progress tracking for
            Structures, Building works, Girders,
            Linear works and Action items - reviewed
            meeting over meeting.
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
        </div>
      </div>

      <ProjectMonitorTabs
        role={user?.role}
        active="overview"
      />

      {!selectedSite ? (
        <EmptyState
          title="Pick a project to get started"
          message="Choose a project/site above to see its overview."
        />
      ) : overviewQuery.isLoading ? (
        <AppLoader label="Loading project overview..." />
      ) : overviewQuery.isError ? (
        <ErrorState
          title="Project overview unavailable"
          message={
            overviewQuery.error?.message
          }
          onRetry={overviewQuery.refetch}
        />
      ) : (
        <>
          <ProjectDetailsCard
            site={overviewQuery.data.site}
            canEdit={canEdit}
            onSaved={overviewQuery.refetch}
          />

          {financeSummary.data ? (
            <SurfaceCard className="print-hidden">
              <div className="surface-card__header">
                <h2>Contract &amp; billing status</h2>
              </div>
              <FinancialTiles
                summary={financeSummary.data}
              />
            </SurfaceCard>
          ) : null}

          <SurfaceCard className="print-hidden">
            <ProjectExtensionsList
              extensions={
                overviewQuery.data.site
                  .extensions
              }
              canEdit={canEdit}
              onAddExtension={
                createExtension.mutate
              }
              addExtensionStatus={
                createExtension
              }
              onDeleteExtension={
                deleteExtension.mutate
              }
            />
          </SurfaceCard>

          <SurfaceCard className="print-hidden">
            <ChainageSegmentsList
              segments={
                overviewQuery.data.site
                  .chainage_segments
              }
              canEdit={canEdit}
              onAddSegment={
                createChainageSegment.mutate
              }
              addSegmentStatus={
                createChainageSegment
              }
              onDeleteSegment={
                deleteChainageSegment.mutate
              }
            />
          </SurfaceCard>

          <section className="kpi-grid kpi-grid--compact pm-dashboard-kpis">
            <KpiCard
              label="Structures"
              value={overviewQuery.data.counts.structures.by_type.reduce(
                (total, row) => total + row.count,
                0,
              )}
              icon={Landmark}
              helper={
                overviewQuery.data.counts.structures.by_type
                  .map((row) => `${row.name}: ${row.count}`)
                  .join(" · ") ||
                "Minor / Major bridges, RUBs, ROBs"
              }
            />
            <KpiCard
              label="Buildings"
              value={
                overviewQuery.data.counts
                  .buildings.count
              }
              icon={Building2}
              tone="information"
              helper="Stations, service buildings, quarters"
            />
            <KpiCard
              label="Girder spans tracked"
              value={
                overviewQuery.data.counts
                  .girders.spans_tracked
              }
              icon={Ruler}
              helper="Girders, bearings & expansion joints"
            />
            <KpiCard
              label="Linear works done (m)"
              value={
                overviewQuery.data.counts
                  .linear.done_m
              }
              tone="success"
              icon={ListChecks}
              helper="Earthwork, P.Way linking, drains..."
            />
            <KpiCard
              label="Open action items"
              value={
                overviewQuery.data.counts
                  .action_items.open
              }
              tone="warning"
              icon={ClipboardList}
              helper="Meeting-tracked responsibilities"
            />
          </section>

          <SurfaceCard>
            <div className="surface-card__header">
              <h2>
                Due tracker - what was to be
                completed on a date
              </h2>
            </div>
            <DueTracker site={selectedSite} />
          </SurfaceCard>
        </>
      )}
    </div>
  );
}
