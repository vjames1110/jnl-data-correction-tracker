import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ClipboardCheck,
  Filter,
  Search,
  TimerReset,
} from "lucide-react";
import { Link } from "react-router-dom";

import { AppLoader } from "../../../components/common/AppLoader";
import { EmptyState } from "../../../components/common/EmptyState";
import { ErrorState } from "../../../components/common/ErrorState";
import { SurfaceCard } from "../../../components/common/SurfaceCard";
import {
  useApprovalInbox,
  useApprovalPendingCounts,
} from "../../../hooks/useCorrectionRequests";
import {
  useDepartmentsDropdown,
  useSitesDropdown,
} from "../../../hooks/useOrganization";
import {
  useErpPriorities,
  useErpVoucherTypes,
} from "../../../hooks/useErp";
import {
  approvalStatusTone,
  formatApprovalStatus,
  formatCodeName,
  formatDateTime,
  formatPerson,
  getAgeingBucket,
  getAgeingLabel,
  getSlaState,
} from "../utils/approvalDisplay";

const initialFilters = {
  site: "",
  department: "",
  voucher: "",
  priority: "",
  ageing: "",
  sla: "",
  requester: "",
};

function asArray(data) {
  if (Array.isArray(data)) {
    return data;
  }

  return data?.items ?? [];
}

function KpiCard({
  icon: Icon,
  label,
  value,
  warning,
}) {
  return (
    <div
      className={
        warning
          ? "user-kpi-card user-kpi-card--warning"
          : "user-kpi-card"
      }
    >
      <div className="user-kpi-card__header">
        <span>{label}</span>
        <Icon size={16} />
      </div>
      <strong>{value ?? 0}</strong>
    </div>
  );
}

function matchesText(value, search) {
  if (!search) {
    return true;
  }

  return String(value ?? "")
    .toLowerCase()
    .includes(search.toLowerCase());
}

function optionCode(item, codeKey, fallbackKey) {
  return (
    item?.[codeKey] ||
    item?.code ||
    item?.[fallbackKey] ||
    item?.id ||
    ""
  );
}

export function DirectorApprovalInboxPage() {
  const [filters, setFilters] =
    useState(initialFilters);

  const inboxQuery = useApprovalInbox({
    page_size: 500,
    ordering: "due_at,created_at",
  });
  const countsQuery =
    useApprovalPendingCounts();
  const sitesQuery = useSitesDropdown();
  const departmentsQuery =
    useDepartmentsDropdown();
  const vouchersQuery = useErpVoucherTypes({
    page_size: 500,
    is_active: true,
  });
  const prioritiesQuery = useErpPriorities({
    page_size: 500,
    is_active: true,
  });

  const steps = useMemo(
    () => inboxQuery.data?.items ?? [],
    [inboxQuery.data],
  );

  const filteredSteps = useMemo(
    () =>
      steps.filter((step) => {
        const slaState = getSlaState(step);
        const requesterText = [
          step.request_reference,
          step.requester_employee_id,
          step.requester_name,
        ].join(" ");

        return (
          (!filters.site ||
            step.site_code === filters.site) &&
          (!filters.department ||
            step.department_code ===
              filters.department) &&
          (!filters.voucher ||
            step.voucher_code === filters.voucher) &&
          (!filters.priority ||
            step.priority_name === filters.priority) &&
          (!filters.ageing ||
            getAgeingBucket(
              step.request_submitted_at ||
                step.created_at,
            ) === filters.ageing) &&
          (!filters.sla ||
            slaState.key === filters.sla) &&
          matchesText(
            requesterText,
            filters.requester,
          )
        );
      }),
    [filters, steps],
  );

  const clientOverdue = useMemo(
    () =>
      steps.filter(
        (step) => getSlaState(step).key === "overdue",
      ).length,
    [steps],
  );

  function updateFilter(name, value) {
    setFilters((current) => ({
      ...current,
      [name]: value,
    }));
  }

  if (inboxQuery.isLoading) {
    return (
      <AppLoader label="Loading approval inbox..." />
    );
  }

  if (inboxQuery.isError) {
    return (
      <ErrorState
        title="Approval inbox unavailable"
        message={inboxQuery.error?.message}
        onRetry={inboxQuery.refetch}
      />
    );
  }

  return (
    <div className="director-approval-page">
      <div className="page-heading">
        <div>
          <span className="page-eyebrow">
            Director Portal
          </span>
          <h1>Approval Inbox</h1>
          <p>
            Pending correction requests grouped for
            director review.
          </p>
        </div>
      </div>

      <div className="user-kpi-grid director-kpi-grid">
        <KpiCard
          icon={ClipboardCheck}
          label="Pending"
          value={
            countsQuery.data?.total_pending ??
            steps.length
          }
        />
        <KpiCard
          icon={AlertTriangle}
          label="Overdue"
          value={
            countsQuery.data?.overdue ??
            clientOverdue
          }
          warning
        />
        <KpiCard
          icon={TimerReset}
          label="Escalation Due"
          value={
            countsQuery.data?.due_for_escalation ??
            0
          }
          warning
        />
        <KpiCard
          icon={Filter}
          label="Filtered"
          value={filteredSteps.length}
        />
      </div>

      <SurfaceCard title="Search And Filters">
        <div className="director-inbox-toolbar">
          <label className="form-field">
            <span>Requester</span>
            <div className="input-with-icon">
              <Search size={15} />
              <input
                value={filters.requester}
                onChange={(event) =>
                  updateFilter(
                    "requester",
                    event.target.value,
                  )
                }
                placeholder="Name, employee ID or request"
              />
            </div>
          </label>

          <label className="form-field">
            <span>Site</span>
            <select
              value={filters.site}
              onChange={(event) =>
                updateFilter("site", event.target.value)
              }
            >
              <option value="">All sites</option>
              {asArray(sitesQuery.data).map((site) => {
                const value = optionCode(
                  site,
                  "site_code",
                  "value",
                );

                return (
                  <option key={site.id} value={value}>
                    {formatCodeName({
                      code: value,
                      name:
                        site.site_name ||
                        site.name ||
                        site.label,
                    })}
                  </option>
                );
              })}
            </select>
          </label>

          <label className="form-field">
            <span>Department</span>
            <select
              value={filters.department}
              onChange={(event) =>
                updateFilter(
                  "department",
                  event.target.value,
                )
              }
            >
              <option value="">All departments</option>
              {asArray(departmentsQuery.data).map(
                (department) => {
                  const value = optionCode(
                    department,
                    "department_code",
                    "value",
                  );

                  return (
                    <option
                      key={department.id}
                      value={value}
                    >
                      {formatCodeName({
                        code: value,
                        name:
                          department.department_name ||
                          department.name ||
                          department.label,
                      })}
                    </option>
                  );
                },
              )}
            </select>
          </label>

          <label className="form-field">
            <span>Voucher</span>
            <select
              value={filters.voucher}
              onChange={(event) =>
                updateFilter(
                  "voucher",
                  event.target.value,
                )
              }
            >
              <option value="">All vouchers</option>
              {asArray(vouchersQuery.data).map(
                (voucher) => {
                  const value =
                    voucher.voucher_code ||
                    voucher.code ||
                    voucher.id;

                  return (
                    <option
                      key={voucher.id}
                      value={value}
                    >
                      {formatCodeName({
                        code: value,
                        name:
                          voucher.voucher_name ||
                          voucher.name,
                      })}
                    </option>
                  );
                },
              )}
            </select>
          </label>

          <label className="form-field">
            <span>Priority</span>
            <select
              value={filters.priority}
              onChange={(event) =>
                updateFilter(
                  "priority",
                  event.target.value,
                )
              }
            >
              <option value="">All priorities</option>
              {asArray(prioritiesQuery.data).map(
                (priority) => (
                  <option
                    key={priority.id}
                    value={priority.priority_name}
                  >
                    {priority.priority_name ||
                      priority.name}
                  </option>
                ),
              )}
            </select>
          </label>

          <label className="form-field">
            <span>Ageing</span>
            <select
              value={filters.ageing}
              onChange={(event) =>
                updateFilter(
                  "ageing",
                  event.target.value,
                )
              }
            >
              <option value="">All ageing</option>
              <option value="0-24">0-24 hours</option>
              <option value="24-48">24-48 hours</option>
              <option value="48-plus">48+ hours</option>
              <option value="unknown">No date</option>
            </select>
          </label>

          <label className="form-field">
            <span>SLA</span>
            <select
              value={filters.sla}
              onChange={(event) =>
                updateFilter("sla", event.target.value)
              }
            >
              <option value="">All SLA</option>
              <option value="overdue">Overdue</option>
              <option value="due_today">
                Due within 24h
              </option>
              <option value="escalation">
                Escalation due
              </option>
              <option value="on_track">On track</option>
            </select>
          </label>

          <button
            type="button"
            className="button button--tertiary"
            onClick={() =>
              setFilters(initialFilters)
            }
          >
            Reset
          </button>
        </div>
      </SurfaceCard>

      <SurfaceCard title="Pending Approvals">
        {!filteredSteps.length ? (
          <EmptyState
            title="No approvals found"
            message="There are no pending approval records for the selected filters."
          />
        ) : (
          <div className="data-table-wrapper">
            <table className="data-table director-approval-table">
              <thead>
                <tr>
                  <th>Request</th>
                  <th>Requester</th>
                  <th>Site / Department</th>
                  <th>Voucher</th>
                  <th>Priority / SLA</th>
                  <th>Ageing</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredSteps.map((step) => {
                  const slaState = getSlaState(step);

                  return (
                    <tr key={step.id}>
                      <td>
                        <strong>
                          {step.request_reference}
                        </strong>
                        <small>
                          Submitted{" "}
                          {formatDateTime(
                            step.request_submitted_at,
                          )}
                        </small>
                      </td>
                      <td>
                        {formatPerson({
                          employeeId:
                            step.requester_employee_id,
                          name: step.requester_name,
                        })}
                      </td>
                      <td>
                        <strong>
                          {formatCodeName({
                            code: step.site_code,
                            name: step.site_name,
                          })}
                        </strong>
                        <small>
                          {formatCodeName({
                            code: step.department_code,
                            name: step.department_name,
                          })}
                        </small>
                      </td>
                      <td>
                        <strong>
                          {step.voucher_number || "-"}
                        </strong>
                        <small>
                          {formatCodeName({
                            code: step.voucher_code,
                            name: step.voucher_name,
                          })}
                        </small>
                      </td>
                      <td>
                        <strong>
                          {step.priority_name || "-"}
                        </strong>
                        <span
                          className={`request-status request-status--${slaState.tone}`}
                        >
                          {slaState.label}
                        </span>
                      </td>
                      <td>
                        {getAgeingLabel(
                          step.request_submitted_at ||
                            step.created_at,
                        )}
                      </td>
                      <td>
                        <span
                          className={`request-status request-status--${approvalStatusTone(
                            step.status,
                          )}`}
                        >
                          {formatApprovalStatus(
                            step.status,
                          )}
                        </span>
                      </td>
                      <td>
                        <Link
                          className="button button--secondary"
                          to={`/director/approvals/${step.id}`}
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </SurfaceCard>
    </div>
  );
}
