import {
  AlertCircle,
  Building2,
  CheckCircle2,
  GitBranch,
  MapPin,
  Network,
  UserCheck,
} from "lucide-react";
import { Link } from "react-router-dom";

import { ErrorState } from "../../../components/common/ErrorState";
import { AppLoader } from "../../../components/common/AppLoader";
import { SurfaceCard } from "../../../components/common/SurfaceCard";
import {
  useOrganizationDashboard,
} from "../../../hooks/useOrganization";
import { KpiCard } from "../components/KpiCard";

export function OrganizationDashboardPage() {
  const dashboardQuery =
    useOrganizationDashboard();

  if (dashboardQuery.isLoading) {
    return (
      <AppLoader label="Loading organization dashboard..." />
    );
  }

  if (dashboardQuery.isError) {
    return (
      <ErrorState
        title="Organization dashboard unavailable"
        message={
          dashboardQuery.error?.message
        }
        onRetry={dashboardQuery.refetch}
      />
    );
  }

  const summary =
    dashboardQuery.data?.summary ?? {};
  const sites =
    dashboardQuery.data?.sites ?? [];
  const departments =
    dashboardQuery.data?.departments ?? [];

  const activeSites = sites
    .filter((site) => site.is_active)
    .slice(0, 6);

  const missingHodRows = [
    ...sites
      .filter((site) => !site.site_hod)
      .map((site) => ({
        id: `site-${site.id}`,
        scope: "Site",
        code: site.site_code,
        name: site.site_name,
      })),
    ...departments
      .filter(
        (department) =>
          !department.department_hod,
      )
      .map((department) => ({
        id: `department-${department.id}`,
        scope: "Department",
        code: department.department_code,
        name: department.department_name,
      })),
  ].slice(0, 8);

  return (
    <div className="organization-page">
      <div className="page-heading">
        <div>
          <span className="page-eyebrow">
            Organization Masters
          </span>
          <h1>Organization Setup</h1>
          <p>
            Review site, department,
            designation and approval mapping
            coverage.
          </p>
        </div>

        <Link
          className="button button--primary"
          to="/admin/organization/sites"
        >
          <MapPin size={18} />
          Manage Sites
        </Link>
      </div>

      <section className="kpi-grid">
        <KpiCard
          label="Total Sites"
          value={summary.total_sites ?? 0}
          icon={MapPin}
          helper="All configured project sites"
        />
        <KpiCard
          label="Active Sites"
          value={summary.active_sites ?? 0}
          icon={CheckCircle2}
          tone="success"
          helper="Sites available for work"
        />
        <KpiCard
          label="Departments"
          value={summary.departments ?? 0}
          icon={Building2}
          helper="Functional departments"
        />
        <KpiCard
          label="Designations"
          value={summary.designations ?? 0}
          icon={Network}
          tone="information"
          helper="Department role titles"
        />
        <KpiCard
          label="Director Mappings"
          value={
            summary.director_mappings ?? 0
          }
          icon={GitBranch}
          tone="success"
          helper="Approval authority records"
        />
        <KpiCard
          label="Missing HOD Mappings"
          value={
            summary.missing_hod_mappings ?? 0
          }
          icon={AlertCircle}
          tone={
            summary.missing_hod_mappings
              ? "warning"
              : "success"
          }
          helper="Site and department gaps"
        />
      </section>

      <section className="organization-shortcuts">
        <Link to="/admin/organization/sites">
          <MapPin size={18} />
          <span>Sites</span>
        </Link>
        <Link to="/admin/organization/departments">
          <Building2 size={18} />
          <span>Departments</span>
        </Link>
        <Link to="/admin/organization/designations">
          <Network size={18} />
          <span>Designations</span>
        </Link>
        <Link to="/admin/organization/director-mappings">
          <GitBranch size={18} />
          <span>Director Mappings</span>
        </Link>
        <Link to="/admin/organization/hod-mappings">
          <UserCheck size={18} />
          <span>HOD Mappings</span>
        </Link>
      </section>

      <section className="organization-grid">
        <SurfaceCard title="Active Sites">
          <div className="data-table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Site</th>
                  <th>State</th>
                  <th>District</th>
                </tr>
              </thead>
              <tbody>
                {activeSites.map((site) => (
                  <tr key={site.id}>
                    <td>{site.site_code}</td>
                    <td>{site.site_name}</td>
                    <td>{site.state || "-"}</td>
                    <td>{site.district || "-"}</td>
                  </tr>
                ))}
                {!activeSites.length ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="table-empty-state"
                    >
                      No active sites found.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </SurfaceCard>

        <SurfaceCard title="Missing HOD Coverage">
          <div className="data-table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Scope</th>
                  <th>Code</th>
                  <th>Name</th>
                </tr>
              </thead>
              <tbody>
                {missingHodRows.map((row) => (
                  <tr key={row.id}>
                    <td>{row.scope}</td>
                    <td>{row.code}</td>
                    <td>{row.name}</td>
                  </tr>
                ))}
                {!missingHodRows.length ? (
                  <tr>
                    <td
                      colSpan={3}
                      className="table-empty-state"
                    >
                      No HOD gaps found.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </SurfaceCard>
      </section>
    </div>
  );
}
