import { CalendarDays, Fuel, Truck, Upload } from "lucide-react";
import { useState } from "react";
import { useSearchParams } from "react-router-dom";

import { AppLoader } from "../../../components/common/AppLoader";
import { EmptyState } from "../../../components/common/EmptyState";
import { ErrorState } from "../../../components/common/ErrorState";
import { SurfaceCard } from "../../../components/common/SurfaceCard";
import { canManageSetup, USER_ROLES } from "../../../constants/roles";
import { useAuth } from "../../../hooks/useAuth";
import {
  useAutoSelectSite,
  useProjectSites,
} from "../../../hooks/useProjectMonitor";
import {
  useMachineryAccess,
  useMachinerySummary,
} from "../../../hooks/useProjectMonitor";
import { MachineUsagePanel } from "../components/MachineUsagePanel";
import { MachineryBulkUploadPanel } from "../components/MachineryBulkUploadPanel";
import { MachineryDayTable } from "../components/MachineryDayTable";
import { MachinesPanel } from "../components/MachinesPanel";
import { ProjectMonitorTabs } from "../components/ProjectMonitorTabs";
import { WorkspaceSwitch } from "../components/WorkspaceSwitch";
import {
  apiErrorMessage,
  todayIso,
} from "../utils/finance";

// One page, two scopes: a single site, or an all-sites bulk upload.
const SCOPES = [
  { key: "site", label: "One site", icon: Truck },
  { key: "bulk", label: "Bulk upload - all sites", icon: Upload },
];

const SUB_TABS = [
  { key: "cost", label: "Day-wise cost", icon: CalendarDays },
  { key: "usage", label: "Usage & fuel", icon: Fuel },
  { key: "machines", label: "Machines", icon: Truck },
];

/**
 * Section H: machinery, fuel and maintenance for one site. Like HR it
 * is per-site permissioned - only the Project Manager assigned the
 * Machinery role for the site, the Director and Admins see it (the
 * backend enforces it; this page reflects ``machinery/access``).
 */
export function MachineryPage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] =
    useSearchParams();
  const [selectedSite, setSelectedSite] = useState(
    () => searchParams.get("site") || "",
  );
  const [month, setMonth] = useState(() =>
    todayIso().slice(0, 7),
  );
  const [subTab, setSubTab] = useState("cost");
  // The Machinery Department (and Admins) can upload for every site
  // at once; for the department that is the main job.
  const canBulk =
    user?.role === USER_ROLES.MACHINERY_DEPARTMENT ||
    canManageSetup(user?.role);
  const [scope, setScope] = useState(() =>
    user?.role === USER_ROLES.MACHINERY_DEPARTMENT
      ? "bulk"
      : "site",
  );
  const bulkMode = canBulk && scope === "bulk";

  const sitesQuery = useProjectSites();
  const accessQuery = useMachineryAccess(selectedSite);
  const canView = Boolean(accessQuery.data?.can_view);
  const canEnter = Boolean(accessQuery.data?.can_enter);
  const summaryQuery = useMachinerySummary(
    selectedSite,
    month,
    canView,
  );

  const handleSiteChange = (value) => {
    setSelectedSite(value);
    setSearchParams(value ? { site: value } : {});
  };

  useAutoSelectSite(
    sitesQuery.data,
    selectedSite,
    handleSiteChange,
  );

  return (
    <div className="organization-page">
      <div className="page-heading print-hidden">
        <div>
          <span className="page-eyebrow">
            Project Monitor
          </span>
          <h1>Machinery</h1>
          <p>
            Machines and vehicles on site, the fuel they burn
            and what they cost each day of the month.
          </p>
        </div>

        <div className="page-actions">
          <label className="filter-control">
            <span>Project / Site</span>
            <select
              value={selectedSite}
              onChange={(event) =>
                handleSiteChange(event.target.value)
              }
            >
              <option value="">Select project</option>
              {(sitesQuery.data ?? []).map((site) => (
                <option key={site.id} value={site.id}>
                  {site.code} - {site.label}
                </option>
              ))}
            </select>
          </label>
          <label className="filter-control">
            <span>Month</span>
            <input
              type="month"
              value={month}
              max={todayIso().slice(0, 7)}
              onChange={(event) =>
                event.target.value &&
                setMonth(event.target.value)
              }
            />
          </label>
        </div>
      </div>

      <div className="print-hidden">
        <ProjectMonitorTabs
          role={user?.role}
          active="machinery"
        />
      </div>

      {canBulk ? (
        <WorkspaceSwitch
          label="Machinery scope"
          value={scope}
          onChange={setScope}
          options={SCOPES}
        />
      ) : null}

      {bulkMode ? (
        <SurfaceCard>
          <MachineryBulkUploadPanel siteId={selectedSite} />
        </SurfaceCard>
      ) : !selectedSite ? (
        <EmptyState
          title="Pick a project to get started"
          message="Choose a project/site above to see its machinery and fuel cost."
        />
      ) : accessQuery.isLoading ? (
        <AppLoader label="Loading machinery..." />
      ) : accessQuery.isError ? (
        <ErrorState
          title="Machinery unavailable"
          message={apiErrorMessage(accessQuery.error)}
          onRetry={() => accessQuery.refetch()}
        />
      ) : !canView ? (
        <EmptyState
          title="No access to this site's machinery data"
          message="Machinery figures are visible only to the Project Manager assigned to machinery for a site, the Director and Admins. Ask an Admin to assign you."
        />
      ) : (
        <>
          <WorkspaceSwitch
            label="Machinery view"
            value={subTab}
            onChange={setSubTab}
            options={SUB_TABS}
          />

          {subTab === "cost" ? (
            <SurfaceCard>
              {summaryQuery.isLoading ? (
                <AppLoader label="Loading cost..." />
              ) : summaryQuery.isError ? (
                <ErrorState
                  title="Cost unavailable"
                  message={apiErrorMessage(
                    summaryQuery.error,
                  )}
                  onRetry={() => summaryQuery.refetch()}
                />
              ) : summaryQuery.data ? (
                <MachineryDayTable
                  summary={summaryQuery.data}
                />
              ) : null}
            </SurfaceCard>
          ) : null}

          {subTab === "usage" ? (
            <SurfaceCard>
              <MachineUsagePanel
                siteId={selectedSite}
                month={month}
                canEnter={canEnter}
              />
            </SurfaceCard>
          ) : null}

          {subTab === "machines" ? (
            <SurfaceCard>
              <MachinesPanel
                siteId={selectedSite}
                canEnter={canEnter}
              />
            </SurfaceCard>
          ) : null}
        </>
      )}
    </div>
  );
}
