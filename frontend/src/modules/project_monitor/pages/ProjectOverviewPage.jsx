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
import { isProjectManagerRole } from "../../../constants/roles";
import { useAuth } from "../../../hooks/useAuth";
import { useSitesDropdown } from "../../../hooks/useOrganization";
import {
  useProjectOverview,
  useUpdateProjectSiteDetails,
} from "../../../hooks/useProjectMonitor";
import { KpiCard } from "../../admin/components/KpiCard";
import { ProjectMonitorTabs } from "../components/ProjectMonitorTabs";

const BLANK_DETAILS_FORM = {
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
          <label className="filter-control">
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
          <label className="filter-control">
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
          <label className="filter-control">
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
        <dl className="details-list">
          <div>
            <dt>Chainage</dt>
            <dd>
              {site.chainage_start_km != null &&
              site.chainage_end_km != null
                ? `${site.chainage_start_km} km – ${site.chainage_end_km} km`
                : "Not set"}
            </dd>
          </div>
          <div>
            <dt>Client / Section</dt>
            <dd>
              {site.client_or_section ||
                "Not set"}
            </dd>
          </div>
          <div>
            <dt>Project</dt>
            <dd>
              {site.project_name || "-"}
            </dd>
          </div>
          <div>
            <dt>Director</dt>
            <dd>
              {site.site_director_name ||
                "Not assigned"}
            </dd>
          </div>
          <div>
            <dt>Site PM</dt>
            <dd>
              {site.site_hod_name ||
                "Not assigned"}
            </dd>
          </div>
        </dl>
      )}
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
  const sitesQuery = useSitesDropdown();
  const overviewQuery = useProjectOverview(
    selectedSite,
  );
  const canEdit = isProjectManagerRole(
    user?.role,
  );

  const handleSiteChange = (value) => {
    setSelectedSite(value);
    setSearchParams(
      value ? { site: value } : {},
    );
  };

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

          <section className="kpi-grid kpi-grid--compact">
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

          <SurfaceCard className="print-hidden">
            <div className="surface-card__header">
              <h2>Coming in the next phases</h2>
            </div>
            <p className="table-subtext">
              This overview will fill in as each
              section is built: Structures (Minor/
              Major Bridges, RUBs, ROBs), Building
              works, Girders/Bearings/Expansion
              Joints, Linear works (chainage rolling
              diagram), and Action items - all
              sharing one timeline-based progress
              view, updated meeting over meeting.
            </p>
          </SurfaceCard>
        </>
      )}
    </div>
  );
}
