import { useMemo, useState } from "react";
import { Download, Printer } from "lucide-react";

import { AppLoader } from "../../../components/common/AppLoader";
import { EmptyState } from "../../../components/common/EmptyState";
import { ErrorState } from "../../../components/common/ErrorState";
import { useSitesDropdown } from "../../../hooks/useOrganization";
import { useReconciliationStatementPack } from "../../../hooks/useReconciliation";
import { ReconciliationStatementSheet } from "../components/ReconciliationStatementSheet";
import {
  buildStatementPackCsvRows,
  downloadCsvRows,
} from "../components/statementCsv";

function SiteStatement({ statement }) {
  const { period, entries, output_entries: outputEntries } =
    statement;

  return (
    <div className="statement-pack__site">
      <ReconciliationStatementSheet
        period={period}
        entries={entries}
        outputEntries={outputEntries}
      />
    </div>
  );
}

export function StoreStatementPackPage() {
  const [monthOverride, setMonthOverride] =
    useState("");
  const [selectedSite, setSelectedSite] =
    useState("");
  const sitesQuery = useSitesDropdown();
  const params = useMemo(
    () => ({
      ...(monthOverride
        ? { month: `${monthOverride}-01` }
        : {}),
      ...(selectedSite
        ? { site: selectedSite }
        : {}),
    }),
    [monthOverride, selectedSite],
  );
  const packQuery =
    useReconciliationStatementPack(params);
  const data = packQuery.data;
  const displayMonth =
    monthOverride ||
    (data?.period_month
      ? data.period_month.slice(0, 7)
      : "");
  const statements = data?.statements ?? [];

  return (
    <div className="organization-page">
      <div className="page-heading print-hidden">
        <div>
          <span className="page-eyebrow">
            Store Reconciliation
          </span>
          <h1>Multi-Site Statement Pack</h1>
          <p>
            Full entry-level statements for every
            site that reported this month,
            concatenated into one print-ready
            document - or narrow it down to a
            single site below.
          </p>
        </div>

        <div className="page-actions">
          <label className="filter-control">
            <span>Month</span>
            <input
              type="month"
              value={displayMonth}
              onChange={(event) =>
                setMonthOverride(
                  event.target.value,
                )
              }
            />
          </label>
          <label className="filter-control">
            <span>Site</span>
            <select
              value={selectedSite}
              onChange={(event) =>
                setSelectedSite(
                  event.target.value,
                )
              }
            >
              <option value="">
                All sites
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
          <button
            type="button"
            className="button button--primary"
            onClick={() => window.print()}
            disabled={!statements.length}
          >
            <Printer size={15} />
            Print Pack
          </button>
          <button
            type="button"
            className="button button--tertiary"
            disabled={!statements.length}
            onClick={() =>
              downloadCsvRows(
                `statement-pack-${displayMonth || "current"}.csv`,
                buildStatementPackCsvRows(statements),
              )
            }
          >
            <Download size={15} />
            Export CSV
          </button>
        </div>
      </div>

      {packQuery.isLoading ? (
        <AppLoader label="Loading statement pack..." />
      ) : packQuery.isError ? (
        <ErrorState
          title="Statement pack unavailable"
          message={packQuery.error?.message}
          onRetry={packQuery.refetch}
        />
      ) : !statements.length ? (
        <EmptyState
          title="Nothing to pack"
          message="No site recorded any reconciliation entries for this month yet."
        />
      ) : (
        <>
          <p className="print-only print-title">
            Store Reconciliation - Multi-Site
            Statement Pack - {displayMonth}
          </p>
          {statements.map((statement) => (
            <SiteStatement
              key={statement.period.id}
              statement={statement}
            />
          ))}
        </>
      )}
    </div>
  );
}
