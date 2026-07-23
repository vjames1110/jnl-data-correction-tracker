import {
  AlertCircle,
  ClipboardList,
  FileDown,
  FileText,
  GitBranch,
  Layers,
  ListChecks,
  Timer,
  Settings2,
  UserCheck,
} from "lucide-react";
import { Link } from "react-router-dom";

import { AppLoader } from "../../../components/common/AppLoader";
import { ErrorState } from "../../../components/common/ErrorState";
import { SurfaceCard } from "../../../components/common/SurfaceCard";
import { useErpDashboard } from "../../../hooks/useErp";
import { KpiCard } from "../components/KpiCard";

export function ErpDashboardPage() {
  const dashboardQuery = useErpDashboard();

  if (dashboardQuery.isLoading) {
    return (
      <AppLoader label="Loading ERP configuration..." />
    );
  }

  if (dashboardQuery.isError) {
    return (
      <ErrorState
        title="ERP configuration unavailable"
        message={dashboardQuery.error?.message}
        onRetry={dashboardQuery.refetch}
      />
    );
  }

  const summary =
    dashboardQuery.data?.summary ?? {};
  const modules =
    dashboardQuery.data?.modules ?? [];
  const voucherTypes =
    dashboardQuery.data?.voucher_types ?? [];
  const missingMappings =
    dashboardQuery.data?.missing_mappings ?? [];

  return (
    <div className="organization-page">
      <div className="page-heading">
        <div>
          <span className="page-eyebrow">
            ERP Masters
          </span>
          <h1>ERP Configuration</h1>
          <p>
            Review ERP modules, vouchers, work
            types and responsible-person coverage.
          </p>
        </div>

        <Link
          className="button button--primary"
          to="/admin/vouchers/modules"
        >
          <Layers size={18} />
          Manage Modules
        </Link>
      </div>

      <section className="kpi-grid">
        <KpiCard
          label="Modules"
          value={summary.modules ?? 0}
          icon={Layers}
          helper="ERP functional modules"
        />
        <KpiCard
          label="Voucher Types"
          value={summary.voucher_types ?? 0}
          icon={FileText}
          tone="information"
          helper="Configured ERP vouchers"
        />
        <KpiCard
          label="Work Types"
          value={summary.work_types ?? 0}
          icon={ListChecks}
          helper="Allowed correction actions"
        />
        <KpiCard
          label="Reason Categories"
          value={
            summary.reason_categories ?? 0
          }
          icon={ClipboardList}
          helper="Standard correction reasons"
        />
        <KpiCard
          label="Priorities"
          value={summary.priorities ?? 0}
          icon={Timer}
          helper="SLA and escalation levels"
        />
        <KpiCard
          label="Responsible Mappings"
          value={
            summary.responsible_mappings ?? 0
          }
          icon={UserCheck}
          tone="success"
          helper="Assignment routing rules"
        />
        <KpiCard
          label="Missing Mappings"
          value={summary.missing_mappings ?? 0}
          icon={AlertCircle}
          tone={
            summary.missing_mappings
              ? "warning"
              : "success"
          }
          helper="Active modules without routing"
        />
      </section>

      <section className="organization-shortcuts">
        <Link to="/admin/vouchers/modules">
          <Layers size={18} />
          <span>ERP Modules</span>
        </Link>
        <Link to="/admin/vouchers/voucher-types">
          <FileText size={18} />
          <span>Voucher Types</span>
        </Link>
        <Link to="/admin/vouchers/work-types">
          <ListChecks size={18} />
          <span>Work Types</span>
        </Link>
        <Link to="/admin/vouchers/reasons">
          <ClipboardList size={18} />
          <span>Reason Categories</span>
        </Link>
        <Link to="/admin/vouchers/priorities">
          <Timer size={18} />
          <span>Priority and SLA</span>
        </Link>
        <Link to="/admin/vouchers/mappings">
          <GitBranch size={18} />
          <span>Responsible Mappings</span>
        </Link>
        <Link to="/admin/vouchers/fields">
          <Settings2 size={18} />
          <span>Field Configuration</span>
        </Link>
        <Link to="/admin/vouchers/import-export">
          <FileDown size={18} />
          <span>Import and Export</span>
        </Link>
      </section>

      <section className="organization-grid">
        <SurfaceCard title="Active ERP Modules">
          <div className="data-table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Module</th>
                  <th>Order</th>
                </tr>
              </thead>
              <tbody>
                {modules
                  .filter((module) => module.is_active)
                  .slice(0, 8)
                  .map((module) => (
                    <tr key={module.id}>
                      <td>{module.module_code}</td>
                      <td>{module.module_name}</td>
                      <td>{module.display_order}</td>
                    </tr>
                  ))}
                {!modules.length ? (
                  <tr>
                    <td
                      colSpan={3}
                      className="table-empty-state"
                    >
                      No ERP modules configured.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </SurfaceCard>

        <SurfaceCard title="Missing Assignment Coverage">
          <div className="data-table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Module</th>
                  <th>Code</th>
                </tr>
              </thead>
              <tbody>
                {missingMappings.map((module) => (
                  <tr key={module.id}>
                    <td>{module.module_name}</td>
                    <td>{module.module_code}</td>
                  </tr>
                ))}
                {!missingMappings.length ? (
                  <tr>
                    <td
                      colSpan={2}
                      className="table-empty-state"
                    >
                      All active modules have mapping
                      coverage.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </SurfaceCard>

        <SurfaceCard title="Recent Voucher Types">
          <div className="data-table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Voucher</th>
                  <th>Module</th>
                </tr>
              </thead>
              <tbody>
                {voucherTypes
                  .slice(0, 8)
                  .map((voucher) => (
                    <tr key={voucher.id}>
                      <td>{voucher.voucher_code}</td>
                      <td>{voucher.voucher_name}</td>
                      <td>
                        {voucher.erp_module_code ||
                          "-"}
                      </td>
                    </tr>
                  ))}
                {!voucherTypes.length ? (
                  <tr>
                    <td
                      colSpan={3}
                      className="table-empty-state"
                    >
                      No voucher types configured.
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
