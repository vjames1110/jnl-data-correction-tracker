import {
  BarChart3,
  Boxes,
  ClipboardCheck,
  DollarSign,
  MapPinned,
  Printer,
  SlidersHorizontal,
  Tags,
} from "lucide-react";
import { Link } from "react-router-dom";

import { AppLoader } from "../../../components/common/AppLoader";
import { ErrorState } from "../../../components/common/ErrorState";
import {
  useReconciliationItemCategories,
  useReconciliationItems,
  useReconciliationItemStandards,
  useReconciliationSiteItemConfigs,
} from "../../../hooks/useReconciliation";
import { KpiCard } from "../components/KpiCard";

export function StoreReconciliationDashboardPage() {
  const categoriesQuery =
    useReconciliationItemCategories({
      page_size: 1,
    });
  const itemsQuery = useReconciliationItems({
    page_size: 1,
  });
  const standardsQuery =
    useReconciliationItemStandards({
      page_size: 1,
      is_active: true,
    });
  const siteConfigsQuery =
    useReconciliationSiteItemConfigs({
      page_size: 1,
      is_active: true,
    });

  const isLoading =
    categoriesQuery.isLoading ||
    itemsQuery.isLoading ||
    standardsQuery.isLoading ||
    siteConfigsQuery.isLoading;
  const error =
    categoriesQuery.error ??
    itemsQuery.error ??
    standardsQuery.error ??
    siteConfigsQuery.error;

  if (isLoading) {
    return (
      <AppLoader label="Loading store reconciliation setup..." />
    );
  }

  if (error) {
    return (
      <ErrorState
        title="Store reconciliation setup unavailable"
        message={error?.message}
        onRetry={() => {
          categoriesQuery.refetch();
          itemsQuery.refetch();
          standardsQuery.refetch();
          siteConfigsQuery.refetch();
        }}
      />
    );
  }

  return (
    <div className="organization-page">
      <div className="page-heading">
        <div>
          <span className="page-eyebrow">
            Store Reconciliation
          </span>
          <h1>Store Reconciliation Setup</h1>
          <p>
            Configure item categories, the item
            master, and the three-tier rate/mix
            inheritance model. Store HO/User
            monthly entry and the approval
            workflow are both live.
          </p>
        </div>

        <Link
          className="button button--primary"
          to="/admin/reconciliation/categories"
        >
          <Tags size={18} />
          Manage Categories
        </Link>
      </div>

      <section className="kpi-grid kpi-grid--compact">
        <KpiCard
          label="Item Categories"
          value={
            categoriesQuery.data?.meta
              ?.pagination?.count ?? 0
          }
          icon={Tags}
          helper="Store item category master"
        />
        <KpiCard
          label="Items"
          value={
            itemsQuery.data?.meta?.pagination
              ?.count ?? 0
          }
          icon={Boxes}
          tone="information"
          helper="Norm-based and direct-count items"
        />
        <KpiCard
          label="Company Defaults"
          value={
            standardsQuery.data?.meta
              ?.pagination?.count ?? 0
          }
          icon={DollarSign}
          helper="Active company-wide rate/mix tier"
        />
        <KpiCard
          label="Site Overrides"
          value={
            siteConfigsQuery.data?.meta
              ?.pagination?.count ?? 0
          }
          icon={MapPinned}
          tone="success"
          helper="Sites locked to their own figures"
        />
      </section>

      <section className="organization-shortcuts">
        <Link to="/admin/reconciliation/categories">
          <Tags size={18} />
          <span>Item Categories</span>
        </Link>
        <Link to="/admin/reconciliation/items">
          <Boxes size={18} />
          <span>Items</span>
        </Link>
        <Link to="/admin/reconciliation/standards">
          <DollarSign size={18} />
          <span>Company Defaults</span>
        </Link>
        <Link to="/admin/reconciliation/site-configs">
          <MapPinned size={18} />
          <span>Site Overrides</span>
        </Link>
        <Link to="/admin/reconciliation/tolerance-settings">
          <SlidersHorizontal size={18} />
          <span>Tolerance Settings</span>
        </Link>
        <Link to="/admin/reconciliation/approvals">
          <ClipboardCheck size={18} />
          <span>Approval Inbox</span>
        </Link>
        <Link to="/admin/reconciliation/reports">
          <BarChart3 size={18} />
          <span>Variance Reports</span>
        </Link>
        <Link to="/admin/reconciliation/statement-pack">
          <Printer size={18} />
          <span>Multi-Site Statement Pack</span>
        </Link>
      </section>
    </div>
  );
}
