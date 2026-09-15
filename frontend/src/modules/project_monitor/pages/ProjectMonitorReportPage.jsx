import { Printer } from "lucide-react";
import { useState } from "react";
import { useSearchParams } from "react-router-dom";

import { AppLoader } from "../../../components/common/AppLoader";
import { EmptyState } from "../../../components/common/EmptyState";
import { ErrorState } from "../../../components/common/ErrorState";
import { useAuth } from "../../../hooks/useAuth";
import { useSitesDropdown } from "../../../hooks/useOrganization";
import {
  useBuildings,
  useProjectOverview,
  useStructures,
} from "../../../hooks/useProjectMonitor";
import { ProjectMonitorReportSheet } from "../components/ProjectMonitorReportSheet";
import { ProjectMonitorTabs } from "../components/ProjectMonitorTabs";

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

  const handleSiteChange = (value) => {
    setSelectedSite(value);
    setSearchParams(
      value ? { site: value } : {},
    );
  };

  const isLoading =
    overviewQuery.isLoading ||
    structuresQuery.isLoading ||
    buildingsQuery.isLoading;
  const isError =
    overviewQuery.isError ||
    structuresQuery.isError ||
    buildingsQuery.isError;

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
            buildingsQuery.error?.message
          }
          onRetry={() => {
            overviewQuery.refetch();
            structuresQuery.refetch();
            buildingsQuery.refetch();
          }}
        />
      ) : (
        <ProjectMonitorReportSheet
          site={overviewQuery.data.site}
          structures={
            structuresQuery.data || []
          }
          buildings={buildingsQuery.data || []}
        />
      )}
    </div>
  );
}
