import { Beaker, Gauge, ListChecks } from "lucide-react";
import { useState } from "react";
import { useSearchParams } from "react-router-dom";

import { AppLoader } from "../../../components/common/AppLoader";
import { EmptyState } from "../../../components/common/EmptyState";
import { ErrorState } from "../../../components/common/ErrorState";
import { SurfaceCard } from "../../../components/common/SurfaceCard";
import { useAuth } from "../../../hooks/useAuth";
import {
  useAutoSelectSite,
  useCostingAccess,
  useCostingGlance,
  useProjectSites,
} from "../../../hooks/useProjectMonitor";
import { ConcreteProductionPanel } from "../components/ConcreteProductionPanel";
import { CostingGlancePanel } from "../components/CostingGlancePanel";
import { CostingTable } from "../components/CostingTable";
import { MaterialRatesPanel } from "../components/MaterialRatesPanel";
import { ProjectMonitorTabs } from "../components/ProjectMonitorTabs";
import { WorkspaceSwitch } from "../components/WorkspaceSwitch";
import { apiErrorMessage, todayIso } from "../utils/finance";

const SUB_TABS = [
  { key: "glance", label: "Today at a glance", icon: Gauge },
  { key: "table", label: "Cost table", icon: ListChecks },
  {
    key: "rates",
    label: "Rates & production",
    icon: Beaker,
  },
];

function daysAgoIso(count) {
  const date = new Date();
  date.setDate(date.getDate() - count);
  return date.toISOString().slice(0, 10);
}

/**
 * Section I: expense vs value of work done, and "Today at a glance".
 * Director/Admin only - there is no per-site grant for this feed at
 * all, since project margin is materially more sensitive than
 * progress or even billing figures (see ``hr/access`` for how the
 * other finance feeds are gated per person, by contrast).
 */
export function CostingPage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] =
    useSearchParams();
  const [selectedSite, setSelectedSite] = useState(
    () => searchParams.get("site") || "",
  );
  const [subTab, setSubTab] = useState("glance");

  const sitesQuery = useProjectSites();
  const accessQuery = useCostingAccess(selectedSite);
  const canEnter = Boolean(accessQuery.data?.can_enter);
  const glanceQuery = useCostingGlance(
    selectedSite,
    subTab === "glance",
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
          <h1>Costing</h1>
          <p>
            Expense vs value of work done, day by day, and a
            glance at today, yesterday and the project so far.
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
        </div>
      </div>

      <div className="print-hidden">
        <ProjectMonitorTabs
          role={user?.role}
          active="costing"
        />
      </div>

      {!selectedSite ? (
        <EmptyState
          title="Pick a project to get started"
          message="Choose a project/site above to see its cost table."
        />
      ) : (
        <>
          <WorkspaceSwitch
            label="Costing view"
            value={subTab}
            onChange={setSubTab}
            options={SUB_TABS}
          />

          {subTab === "glance" ? (
            <SurfaceCard>
              {glanceQuery.isLoading ? (
                <AppLoader label="Loading today at a glance..." />
              ) : glanceQuery.isError ? (
                <ErrorState
                  title="Costing unavailable"
                  message={apiErrorMessage(
                    glanceQuery.error,
                  )}
                  onRetry={() => glanceQuery.refetch()}
                />
              ) : (
                <CostingGlancePanel glance={glanceQuery.data} />
              )}
            </SurfaceCard>
          ) : null}

          {subTab === "table" ? (
            <SurfaceCard>
              <CostingTable siteId={selectedSite} />
            </SurfaceCard>
          ) : null}

          {subTab === "rates" ? (
            <div className="pm-stack">
              <SurfaceCard>
                <div className="surface-card__header">
                  <h2>Material rates</h2>
                </div>
                <MaterialRatesPanel
                  siteId={selectedSite}
                  canEnter={canEnter}
                />
              </SurfaceCard>
              <SurfaceCard>
                <div className="surface-card__header">
                  <h2>Concrete production (stores)</h2>
                </div>
                <ConcreteProductionPanel
                  siteId={selectedSite}
                  range={{
                    from: daysAgoIso(29),
                    to: todayIso(),
                  }}
                  canEnter={canEnter}
                />
              </SurfaceCard>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
