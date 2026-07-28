import { useMemo, useState } from "react";
import { Download } from "lucide-react";

import { AppLoader } from "../../../components/common/AppLoader";
import { EmptyState } from "../../../components/common/EmptyState";
import { ErrorState } from "../../../components/common/ErrorState";
import { SurfaceCard } from "../../../components/common/SurfaceCard";
import {
  useApprovalSteps,
} from "../../../hooks/useCorrectionRequests";
import {
  approvalStatusTone,
  formatApprovalStatus,
  formatDateTime,
} from "../utils/approvalDisplay";
import {
  approvalExportRows,
  downloadApprovalCsv,
  downloadApprovalExcel,
} from "../utils/approvalMetrics";

export function DirectorExportPage() {
  const [status, setStatus] = useState("");
  const approvalsQuery = useApprovalSteps({
    page_size: 1000,
    ordering: "-updated_at",
  });
  const steps = useMemo(
    () => approvalsQuery.data?.items ?? [],
    [approvalsQuery.data],
  );
  const filteredSteps = useMemo(
    () =>
      status
        ? steps.filter(
            (step) => step.status === status,
          )
        : steps,
    [status, steps],
  );
  const rows = approvalExportRows(filteredSteps);

  function exportCsv() {
    if (!rows.length) {
      return;
    }
    downloadApprovalCsv(rows);
  }

  function exportExcel() {
    if (!rows.length) {
      return;
    }
    downloadApprovalExcel(rows);
  }

  return (
    <div className="director-approval-page">
      <div className="page-heading">
        <div>
          <span className="page-eyebrow">
            Director Export
          </span>
          <h1>Approval Export</h1>
          <p>
            Export director approval records in CSV
            or Excel format.
          </p>
        </div>
      </div>

      {approvalsQuery.isLoading ? (
        <AppLoader label="Loading export data..." />
      ) : approvalsQuery.isError ? (
        <ErrorState
          title="Export data unavailable"
          message={approvalsQuery.error?.message}
          onRetry={approvalsQuery.refetch}
        />
      ) : (
        <>
          <SurfaceCard title="Export Controls">
            <div className="director-export-toolbar">
              <label className="form-field">
                <span>Status</span>
                <select
                  value={status}
                  onChange={(event) =>
                    setStatus(event.target.value)
                  }
                >
                  <option value="">All statuses</option>
                  <option value="PENDING">Pending</option>
                  <option value="APPROVED">
                    Approved
                  </option>
                  <option value="REJECTED">
                    Rejected
                  </option>
                  <option value="RETURNED">
                    Returned
                  </option>
                  <option value="SKIPPED">
                    Skipped
                  </option>
                </select>
              </label>

              <button
                type="button"
                className="button button--secondary"
                disabled={!rows.length}
                onClick={exportCsv}
              >
                <Download size={16} />
                CSV
              </button>

              <button
                type="button"
                className="button button--primary"
                disabled={!rows.length}
                onClick={exportExcel}
              >
                <Download size={16} />
                Excel
              </button>
            </div>
          </SurfaceCard>

          <SurfaceCard title="Export Preview">
            {!filteredSteps.length ? (
              <EmptyState
                title="No records found"
                message="No approval records match the selected export filter."
              />
            ) : (
              <div className="data-table-wrapper">
                <table className="data-table director-approval-table">
                  <thead>
                    <tr>
                      <th>Request</th>
                      <th>Requester</th>
                      <th>Voucher</th>
                      <th>Status</th>
                      <th>Submitted</th>
                      <th>Decided</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSteps
                      .slice(0, 25)
                      .map((step) => (
                        <tr key={step.id}>
                          <td>
                            {step.request_reference}
                          </td>
                          <td>
                            {step.requester_name}
                          </td>
                          <td>
                            {step.voucher_name}
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
                            {formatDateTime(
                              step.request_submitted_at,
                            )}
                          </td>
                          <td>
                            {formatDateTime(
                              step.decided_at,
                            )}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </SurfaceCard>
        </>
      )}
    </div>
  );
}
