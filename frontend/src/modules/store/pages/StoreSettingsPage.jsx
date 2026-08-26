import {
  Boxes,
  DollarSign,
  MapPinned,
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
import { KpiCard } from "../../admin/components/KpiCard";

export function StoreSettingsPage() {
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
      <AppLoader label="Loading reconciliation setup..." />
    );
  }

  if (error) {
    return (
      <ErrorState
        title="Reconciliation setup unavailable"
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
          <h1>Reconciliation Settings</h1>
          <p>
            Add items, categories, and set the
            rate/mix ratios your sites use every
            month - the same masters an
            administrator manages, now available
            from the Store HO portal.
          </p>
        </div>

        <Link
          className="button button--primary"
          to="/store/settings/categories"
        >
          <Tags size={18} />
          Manage Categories
        </Link>
      </div>

      <section className="kpi-grid">
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
        <Link to="/store/settings/categories">
          <Tags size={18} />
          <span>Item Categories</span>
        </Link>
        <Link to="/store/settings/items">
          <Boxes size={18} />
          <span>Items</span>
        </Link>
        <Link to="/store/settings/standards">
          <DollarSign size={18} />
          <span>Company Defaults</span>
        </Link>
        <Link to="/store/settings/site-configs">
          <MapPinned size={18} />
          <span>Site Overrides</span>
        </Link>
        <Link to="/store/settings/tolerance-settings">
          <SlidersHorizontal size={18} />
          <span>Tolerance Settings</span>
        </Link>
      </section>
    </div>
  );
}
