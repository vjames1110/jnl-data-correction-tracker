import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Building2,
  Check,
  Download,
  History,
  MapPin,
} from "lucide-react";
import { Link } from "react-router-dom";

import { AppLoader } from "../../../components/common/AppLoader";
import { EmptyState } from "../../../components/common/EmptyState";
import { ErrorState } from "../../../components/common/ErrorState";
import { SurfaceCard } from "../../../components/common/SurfaceCard";
import {
  useHodMappings,
  useUpdateDepartmentHod,
  useUpdateSiteHod,
} from "../../../hooks/useOrganization";
import {
  StatusChip,
} from "../components/OrganizationControls";
import {
  downloadCsv,
} from "../utils/organizationUtils";

function userName(userDetail) {
  if (!userDetail) {
    return "-";
  }

  return (
    userDetail.full_name ||
    userDetail.employee_id ||
    "-"
  );
}

function selectedHodValue(
  draftValues,
  recordId,
  currentValue,
) {
  return (
    draftValues[recordId] ??
    currentValue ??
    ""
  );
}

function isChanged(
  draftValues,
  recordId,
  currentValue,
) {
  if (!(recordId in draftValues)) {
    return false;
  }

  return (
    String(draftValues[recordId] ?? "") !==
    String(currentValue ?? "")
  );
}

function HodSelect({
  label,
  users,
  value,
  onChange,
}) {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(event) =>
        onChange(event.target.value)
      }
    >
      <option value="" disabled hidden>
        Select person
      </option>
      {users.map((user) => (
        <option key={user.id} value={user.id}>
          {user.label}
        </option>
      ))}
    </select>
  );
}

function HodCoverageChip({ assigned }) {
  return (
    <span
      className={
        assigned
          ? "status-chip status-chip--success"
          : "status-chip status-chip--error"
      }
    >
      {assigned ? "Assigned" : "Missing"}
    </span>
  );
}

function CoverageAlert({ summary }) {
  const missing =
    summary.total_missing ?? 0;

  if (!missing) {
    return (
      <div className="inline-alert inline-alert--success">
          <strong>PM/HOD coverage is complete.</strong>
          <p>
          Site PM, department HOD and mapping
          history records have assigned owners.
        </p>
      </div>
    );
  }

  return (
    <div className="inline-alert inline-alert--info hod-warning">
      <AlertTriangle size={18} />
      <div>
        <strong>
          {missing} PM/HOD mapping gap
          {missing === 1 ? "" : "s"} found.
        </strong>
        <p>
          Assign missing site PMs and department HODs
          before closing organization setup.
        </p>
      </div>
    </div>
  );
}

export function HodMappingPage() {
  const mappingsQuery = useHodMappings();
  const updateSiteHod = useUpdateSiteHod();
  const updateDepartmentHod =
    useUpdateDepartmentHod();
  const [siteDrafts, setSiteDrafts] =
    useState({});
  const [departmentDrafts, setDepartmentDrafts] =
    useState({});

  const data = mappingsQuery.data ?? {};
  const sites = data.sites ?? [];
  const departments = data.departments ?? [];
  const users = data.users ?? [];
  const mappingHistory =
    data.site_department_mappings ?? [];
  const summary = data.summary ?? {};

  const missingRows = useMemo(
    () => [
      ...(data.missing?.site_hods ?? []).map(
        (site) => ({
          id: `site-${site.id}`,
          scope: "Site",
          code: site.site_code,
          name: site.site_name,
        }),
      ),
      ...(
        data.missing?.department_hods ?? []
      ).map((department) => ({
        id: `department-${department.id}`,
        scope: "Department",
        code: department.department_code,
        name: department.department_name,
      })),
    ],
    [data.missing],
  );

  const handleExportMissing = () => {
    downloadCsv(
      "organization-hod-mapping-gaps.csv",
      missingRows,
      [
        { key: "scope", label: "Scope" },
        { key: "code", label: "Code" },
        { key: "name", label: "Name" },
      ],
    );
  };

  if (mappingsQuery.isLoading) {
    return (
      <AppLoader label="Loading HOD mappings..." />
    );
  }

  if (mappingsQuery.isError) {
    return (
      <ErrorState
        title="HOD mappings unavailable"
        message={
          mappingsQuery.error?.message
        }
        onRetry={mappingsQuery.refetch}
      />
    );
  }

  return (
    <div className="organization-page hod-mapping-page">
      <div className="page-heading">
        <div>
          <span className="page-eyebrow">
            Organization Masters
          </span>
          <h1>PM & HOD Mapping</h1>
          <p>
            Assign site project managers and
            department HODs,
            review missing coverage and inspect
            mapping history.
          </p>
        </div>

        <div className="page-actions">
          <Link
            className="button button--tertiary"
            to="/admin/organization"
          >
            Overview
          </Link>
          <button
            type="button"
            className="button button--secondary"
            onClick={handleExportMissing}
            disabled={!missingRows.length}
          >
            <Download size={17} />
            Export Gaps
          </button>
        </div>
      </div>

      <CoverageAlert summary={summary} />

      <section className="hod-summary-grid">
        <SurfaceCard>
          <div className="hod-summary-item">
            <MapPin size={20} />
            <div>
              <span>Site PM Gaps</span>
              <strong>
                {summary.missing_site_hods ?? 0}
              </strong>
            </div>
          </div>
        </SurfaceCard>
        <SurfaceCard>
          <div className="hod-summary-item">
            <Building2 size={20} />
            <div>
              <span>Department HOD Gaps</span>
              <strong>
                {summary.missing_department_hods ??
                  0}
              </strong>
            </div>
          </div>
        </SurfaceCard>
        <SurfaceCard>
          <div className="hod-summary-item">
            <History size={20} />
            <div>
              <span>History Gaps</span>
              <strong>
                {summary
                  .incomplete_mapping_history ?? 0}
              </strong>
            </div>
          </div>
        </SurfaceCard>
      </section>

      <section className="organization-grid">
        <SurfaceCard title="Site PM">
          {!sites.length ? (
            <EmptyState
              title="No sites found"
              message="Add sites before assigning project managers."
            />
          ) : (
            <div className="data-table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Site</th>
                    <th>Current PM</th>
                    <th>Assign PM</th>
                    <th>Status</th>
                    <th>Save</th>
                  </tr>
                </thead>
                <tbody>
                  {sites.map((site) => {
                    const value =
                      selectedHodValue(
                        siteDrafts,
                        site.id,
                        site.site_hod,
                      );
                    const changed = isChanged(
                      siteDrafts,
                      site.id,
                      site.site_hod,
                    );

                    return (
                      <tr key={site.id}>
                        <td>{site.site_code}</td>
                        <td>
                          <strong>
                            {site.site_name}
                          </strong>
                          <span className="table-subtext">
                            {site.company_code ||
                              "-"}
                          </span>
                        </td>
                        <td>
                          {userName(
                            site.site_hod_detail,
                          )}
                        </td>
                        <td className="mapping-select-cell">
                          <HodSelect
                            label={`Site PM for ${site.site_name}`}
                            users={users}
                            value={value}
                            onChange={(nextValue) =>
                              setSiteDrafts(
                                (current) => ({
                                  ...current,
                                  [site.id]:
                                    nextValue,
                                }),
                              )
                            }
                          />
                        </td>
                        <td>
                          <HodCoverageChip
                            assigned={
                              Boolean(
                                site.site_hod,
                              )
                            }
                          />
                        </td>
                        <td>
                          <button
                            type="button"
                            className="icon-button"
                            aria-label={`Save site PM for ${site.site_name}`}
                            title="Save PM"
                            disabled={
                              !changed ||
                              updateSiteHod
                                .isPending
                            }
                            onClick={async () => {
                              await updateSiteHod.mutateAsync(
                                {
                                  id: site.id,
                                  siteHod:
                                    value,
                                },
                              );
                              setSiteDrafts(
                                (current) => {
                                  const next = {
                                    ...current,
                                  };
                                  delete next[
                                    site.id
                                  ];
                                  return next;
                                },
                              );
                            }}
                          >
                            <Check size={17} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </SurfaceCard>

        <SurfaceCard title="Department HOD">
          {!departments.length ? (
            <EmptyState
              title="No departments found"
              message="Add departments before assigning HODs."
            />
          ) : (
            <div className="data-table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Department</th>
                    <th>Current HOD</th>
                    <th>Assign HOD</th>
                    <th>Status</th>
                    <th>Save</th>
                  </tr>
                </thead>
                <tbody>
                  {departments.map(
                    (department) => {
                      const value =
                        selectedHodValue(
                          departmentDrafts,
                          department.id,
                          department.department_hod,
                        );
                      const changed = isChanged(
                        departmentDrafts,
                        department.id,
                        department.department_hod,
                      );

                      return (
                        <tr key={department.id}>
                          <td>
                            {
                              department.department_code
                            }
                          </td>
                          <td>
                            <strong>
                              {
                                department.department_name
                              }
                            </strong>
                            <span className="table-subtext">
                              {department.company_code ||
                                "-"}
                            </span>
                          </td>
                          <td>
                            {userName(
                              department
                                .department_hod_detail,
                            )}
                          </td>
                          <td className="mapping-select-cell">
                            <HodSelect
                              label={`Department HOD for ${department.department_name}`}
                              users={users}
                              value={value}
                              onChange={(
                                nextValue,
                              ) =>
                                setDepartmentDrafts(
                                  (current) => ({
                                    ...current,
                                    [department.id]:
                                      nextValue,
                                  }),
                                )
                              }
                            />
                          </td>
                          <td>
                            <HodCoverageChip
                              assigned={Boolean(
                                department.department_hod,
                              )}
                            />
                          </td>
                          <td>
                            <button
                              type="button"
                              className="icon-button"
                              aria-label={`Save department HOD for ${department.department_name}`}
                              title="Save HOD"
                              disabled={
                                !changed ||
                                updateDepartmentHod
                                  .isPending
                              }
                              onClick={async () => {
                                await updateDepartmentHod.mutateAsync(
                                  {
                                    id: department.id,
                                    departmentHod:
                                      value,
                                  },
                                );
                                setDepartmentDrafts(
                                  (current) => {
                                    const next = {
                                      ...current,
                                    };
                                    delete next[
                                      department.id
                                    ];
                                    return next;
                                  },
                                );
                              }}
                            >
                              <Check size={17} />
                            </button>
                          </td>
                        </tr>
                      );
                    },
                  )}
                </tbody>
              </table>
            </div>
          )}
        </SurfaceCard>
      </section>

      <SurfaceCard title="Mapping History">
        {!mappingHistory.length ? (
          <EmptyState
            title="No mapping history found"
            message="Existing site-department HOD snapshots will appear here."
          />
        ) : (
          <div className="data-table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Site</th>
                  <th>Department</th>
                  <th>Site PM</th>
                  <th>Department HOD</th>
                  <th>Effective Date</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {mappingHistory.map((mapping) => (
                  <tr key={mapping.id}>
                    <td>
                      <strong>
                        {mapping.site_code}
                      </strong>
                      <span className="table-subtext">
                        {mapping.site_name}
                      </span>
                    </td>
                    <td>
                      <strong>
                        {
                          mapping.department_code
                        }
                      </strong>
                      <span className="table-subtext">
                        {
                          mapping.department_name
                        }
                      </span>
                    </td>
                    <td>
                      {userName(
                        mapping.site_hod_detail,
                      )}
                    </td>
                    <td>
                      {userName(
                        mapping.department_hod_detail,
                      )}
                    </td>
                    <td>
                      {mapping.effective_date ||
                        "-"}
                    </td>
                    <td>
                      <StatusChip
                        active={
                          mapping.is_active
                        }
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SurfaceCard>
    </div>
  );
}
