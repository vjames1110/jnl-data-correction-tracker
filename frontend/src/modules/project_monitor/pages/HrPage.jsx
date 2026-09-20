import { CalendarDays, HardHat, Users } from "lucide-react";
import { useState } from "react";
import { useSearchParams } from "react-router-dom";

import { AppLoader } from "../../../components/common/AppLoader";
import { EmptyState } from "../../../components/common/EmptyState";
import { ErrorState } from "../../../components/common/ErrorState";
import { SurfaceCard } from "../../../components/common/SurfaceCard";
import { useAuth } from "../../../hooks/useAuth";
import { useSitesDropdown } from "../../../hooks/useOrganization";
import {
  useHrAccess,
  useHrSummary,
} from "../../../hooks/useProjectMonitor";
import { HrDayTable } from "../components/HrDayTable";
import { LabourPanel } from "../components/LabourPanel";
import { ProjectMonitorTabs } from "../components/ProjectMonitorTabs";
import { StaffPanel } from "../components/StaffPanel";
import { WorkspaceSwitch } from "../components/WorkspaceSwitch";
import {
  apiErrorMessage,
  todayIso,
} from "../utils/finance";

const SUB_TABS = [
  { key: "cost", label: "Day-wise cost", icon: CalendarDays },
  { key: "labour", label: "Labour", icon: HardHat },
  { key: "staff", label: "Staff", icon: Users },
];

/**
 * Section G: labour and staff cost for one site. Salaries are
 * sensitive, so this page is per-site permissioned: only the Project
 * Manager assigned the HR role for the site, the Director and Admins
 * see it (the backend enforces it; this page reflects ``hr/access``).
 */
export function HrPage() {
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

  const sitesQuery = useSitesDropdown();
  const accessQuery = useHrAccess(selectedSite);
  const canView = Boolean(accessQuery.data?.can_view);
  const canEnter = Boolean(accessQuery.data?.can_enter);
  const summaryQuery = useHrSummary(
    selectedSite,
    month,
    canView,
  );

  const handleSiteChange = (value) => {
    setSelectedSite(value);
    setSearchParams(value ? { site: value } : {});
  };

  return (
    <div className="organization-page">
      <div className="page-heading print-hidden">
        <div>
          <span className="page-eyebrow">
            Project Monitor
          </span>
          <h1>Human Resource</h1>
          <p>
            Contract labour and site staff, and what they cost
            each day of the month.
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
          active="hr"
        />
      </div>

      {!selectedSite ? (
        <EmptyState
          title="Pick a project to get started"
          message="Choose a project/site above to see its labour and staff cost."
        />
      ) : accessQuery.isLoading ? (
        <AppLoader label="Loading HR..." />
      ) : accessQuery.isError ? (
        <ErrorState
          title="HR unavailable"
          message={apiErrorMessage(accessQuery.error)}
          onRetry={() => accessQuery.refetch()}
        />
      ) : !canView ? (
        <EmptyState
          title="No access to this site's HR data"
          message="Labour and salary figures are visible only to the Project Manager assigned to HR for a site, the Director and Admins. Ask an Admin to assign you."
        />
      ) : (
        <>
          <WorkspaceSwitch
            label="HR view"
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
                <HrDayTable summary={summaryQuery.data} />
              ) : null}
            </SurfaceCard>
          ) : null}

          {subTab === "labour" ? (
            <SurfaceCard>
              <LabourPanel
                siteId={selectedSite}
                month={month}
                canEnter={canEnter}
              />
            </SurfaceCard>
          ) : null}

          {subTab === "staff" ? (
            <SurfaceCard>
              <StaffPanel
                siteId={selectedSite}
                month={month}
                canEnter={canEnter}
              />
            </SurfaceCard>
          ) : null}
        </>
      )}
    </div>
  );
}
