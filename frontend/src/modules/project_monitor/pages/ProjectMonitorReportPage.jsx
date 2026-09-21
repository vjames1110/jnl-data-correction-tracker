import { Printer } from "lucide-react";
import { useState } from "react";
import { useSearchParams } from "react-router-dom";

import { AppLoader } from "../../../components/common/AppLoader";
import { EmptyState } from "../../../components/common/EmptyState";
import { ErrorState } from "../../../components/common/ErrorState";
import { useAuth } from "../../../hooks/useAuth";
import {
  useAutoSelectSite,
  useProjectSites,
  useSiteTasks,
} from "../../../hooks/useProjectMonitor";
import {
  useActionItems,
  useBuildings,
  useDprAccess,
  useFinancialReport,
  useGirderJobs,
  useLinearItems,
  useProjectOverview,
  useStructures,
} from "../../../hooks/useProjectMonitor";
import { ProjectMonitorReportSheet } from "../components/ProjectMonitorReportSheet";
import { ProjectMonitorTabs } from "../components/ProjectMonitorTabs";
import { ReportCustomizationPanel } from "../components/ReportCustomizationPanel";

const DEFAULT_SECTIONS = {
  details: true,
  structures: true,
  buildings: true,
  girders: true,
  actionItems: true,
  linearWorks: true,
  financial: true,
};

/**
 * The whole-project, task-wise progress report - separate from the
 * KPI-tile "Overview" page on purpose, per the confirmed direction:
 * a proper report lists every task's current status, not a
 * dashboard summary. Printed/saved as PDF via the browser's own
 * print dialog; everything except ``ProjectMonitorReportSheet``
 * itself is hidden from the printed page.
 */
export function ProjectMonitorReportPage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] =
    useSearchParams();
  const [selectedSite, setSelectedSite] = useState(
    () => searchParams.get("site") || "",
  );
  const [sections, setSections] = useState(
    DEFAULT_SECTIONS,
  );

  const sitesQuery = useProjectSites();
  // A person granted only some tasks reports on those tasks only:
  // a query for a task they do not hold is never sent (an empty
  // site disables it) and its section is left out.
  const siteTasks = useSiteTasks(selectedSite);
  const canReport = siteTasks.has("REPORTS");
  const canSee = {
    structures: canReport && siteTasks.has("STRUCTURES"),
    buildings: canReport && siteTasks.has("BUILDINGS"),
    girders: canReport && siteTasks.has("GIRDERS"),
    actionItems: canReport && siteTasks.has("ACTION_ITEMS"),
    linearWorks: canReport && siteTasks.has("LINEAR_WORKS"),
  };
  const overviewQuery = useProjectOverview(
    canReport ? selectedSite : "",
  );
  const structuresQuery = useStructures(
    canSee.structures ? selectedSite : "",
  );
  const buildingsQuery = useBuildings(
    canSee.buildings ? selectedSite : "",
  );
  const girderJobsQuery = useGirderJobs(
    canSee.girders ? selectedSite : "",
  );
  const actionItemsQuery = useActionItems(
    canSee.actionItems ? selectedSite : "",
  );
  const linearItemsQuery = useLinearItems(
    canSee.linearWorks ? selectedSite : "",
  );
  const financeAccess = useDprAccess(selectedSite);
  const canViewFinance = Boolean(
    financeAccess.data?.can_view,
  );
  const financialQuery = useFinancialReport(
    selectedSite,
    undefined,
    canViewFinance,
  );

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

  const handleToggleSection = (key) => {
    setSections((current) => ({
      ...current,
      [key]: !current[key],
    }));
  };

  // Only the queries that actually run count towards loading/error.
  const active = [
    overviewQuery,
    canSee.structures && structuresQuery,
    canSee.buildings && buildingsQuery,
    canSee.girders && girderJobsQuery,
    canSee.actionItems && actionItemsQuery,
    canSee.linearWorks && linearItemsQuery,
  ].filter(Boolean);
  const isLoading =
    siteTasks.isLoading ||
    active.some((query) => query.isLoading);
  const isError = active.some((query) => query.isError);
  const heldSections = {
    ...sections,
    structures: sections.structures && canSee.structures,
    buildings: sections.buildings && canSee.buildings,
    girders: sections.girders && canSee.girders,
    actionItems: sections.actionItems && canSee.actionItems,
    linearWorks: sections.linearWorks && canSee.linearWorks,
    financial: sections.financial && canViewFinance,
  };
  const hiddenSections = [
    ...(canViewFinance ? [] : ["financial"]),
    ...Object.entries(canSee)
      .filter(([, allowed]) => !allowed)
      .map(([key]) => key),
  ];

  return (
    <div className="organization-page">
      <div className="page-heading print-hidden">
        <div>
          <span className="page-eyebrow">
            Project Monitor
          </span>
          <h1>Reports</h1>
          <p>
            A complete, task-wise progress report
            for this project - every Structure and
            Building's current status, ready to
            print or save as a PDF.
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
          {selectedSite &&
          !isLoading &&
          !isError ? (
            <button
              type="button"
              className="button button--primary"
              onClick={() => window.print()}
            >
              <Printer size={16} /> Print /
              Save as PDF
            </button>
          ) : null}
        </div>
      </div>

      <div className="print-hidden">
        <ProjectMonitorTabs
          role={user?.role}
          active="reports"
        />
      </div>

      {!selectedSite ? (
        <EmptyState
          title="Pick a project to get started"
          message="Choose a project/site above to generate its report."
        />
      ) : !siteTasks.isLoading && !canReport ? (
        <EmptyState
          title="No access to Reports on this project"
          message="Ask an Admin to grant you the Reports task for this site on the Site Access page."
        />
      ) : isLoading ? (
        <AppLoader label="Building report..." />
      ) : isError ? (
        <ErrorState
          title="Report unavailable"
          message={
            active.find((query) => query.isError)
              ?.error?.message
          }
          onRetry={() =>
            active.forEach((query) => query.refetch())
          }
        />
      ) : (
        <>
          <ReportCustomizationPanel
            sections={sections}
            counts={{
              structures:
                structuresQuery.data?.length || 0,
              buildings:
                buildingsQuery.data?.length || 0,
              girders:
                girderJobsQuery.data?.length || 0,
              actionItems:
                actionItemsQuery.data?.length ||
                0,
              linearWorks:
                linearItemsQuery.data?.length ||
                0,
            }}
            hiddenKeys={hiddenSections}
            onToggle={handleToggleSection}
            onSelectAll={() =>
              setSections(DEFAULT_SECTIONS)
            }
            onClearAll={() =>
              setSections({
                details: false,
                structures: false,
                buildings: false,
                girders: false,
                actionItems: false,
                linearWorks: false,
                financial: false,
              })
            }
          />
          <ProjectMonitorReportSheet
            site={overviewQuery.data.site}
            structures={
              structuresQuery.data || []
            }
            buildings={
              buildingsQuery.data || []
            }
            girderJobs={
              girderJobsQuery.data || []
            }
            actionItems={
              actionItemsQuery.data || []
            }
            linearItems={
              linearItemsQuery.data || []
            }
            financialReport={
              canViewFinance
                ? financialQuery.data
                : null
            }
            sections={heldSections}
          />
        </>
      )}
    </div>
  );
}
