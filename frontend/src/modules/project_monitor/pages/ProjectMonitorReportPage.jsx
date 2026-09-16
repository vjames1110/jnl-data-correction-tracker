import { Printer } from "lucide-react";
import { useState } from "react";
import { useSearchParams } from "react-router-dom";

import { AppLoader } from "../../../components/common/AppLoader";
import { EmptyState } from "../../../components/common/EmptyState";
import { ErrorState } from "../../../components/common/ErrorState";
import { useAuth } from "../../../hooks/useAuth";
import { useSitesDropdown } from "../../../hooks/useOrganization";
import {
  useActionItems,
  useBuildings,
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

  const sitesQuery = useSitesDropdown();
  const overviewQuery = useProjectOverview(
    selectedSite,
  );
  const structuresQuery = useStructures(
    selectedSite,
  );
  const buildingsQuery = useBuildings(
    selectedSite,
  );
  const girderJobsQuery = useGirderJobs(
    selectedSite,
  );
  const actionItemsQuery = useActionItems(
    selectedSite,
  );
  const linearItemsQuery = useLinearItems(
    selectedSite,
  );

  const handleSiteChange = (value) => {
    setSelectedSite(value);
    setSearchParams(
      value ? { site: value } : {},
    );
  };

  const handleToggleSection = (key) => {
    setSections((current) => ({
      ...current,
      [key]: !current[key],
    }));
  };

  const isLoading =
    overviewQuery.isLoading ||
    structuresQuery.isLoading ||
    buildingsQuery.isLoading ||
    girderJobsQuery.isLoading ||
    actionItemsQuery.isLoading ||
    linearItemsQuery.isLoading;
  const isError =
    overviewQuery.isError ||
    structuresQuery.isError ||
    buildingsQuery.isError ||
    girderJobsQuery.isError ||
    actionItemsQuery.isError ||
    linearItemsQuery.isError;

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
      ) : isLoading ? (
        <AppLoader label="Building report..." />
      ) : isError ? (
        <ErrorState
          title="Report unavailable"
          message={
            overviewQuery.error?.message ||
            structuresQuery.error?.message ||
            buildingsQuery.error?.message ||
            girderJobsQuery.error?.message ||
            actionItemsQuery.error?.message ||
            linearItemsQuery.error?.message
          }
          onRetry={() => {
            overviewQuery.refetch();
            structuresQuery.refetch();
            buildingsQuery.refetch();
            girderJobsQuery.refetch();
            actionItemsQuery.refetch();
            linearItemsQuery.refetch();
          }}
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
            sections={sections}
          />
        </>
      )}
    </div>
  );
}
