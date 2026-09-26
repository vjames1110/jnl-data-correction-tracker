import { X } from "lucide-react";
import { Link } from "react-router-dom";

import { AppLoader } from "../../../components/common/AppLoader";
import { EmptyState } from "../../../components/common/EmptyState";
import { ErrorState } from "../../../components/common/ErrorState";
import { SurfaceCard } from "../../../components/common/SurfaceCard";
import { useReconciliationCardDetail } from "../../../hooks/useReconciliation";
import { varianceCellClass } from "../../../utils/formatters";

// What each summary card opens: a heading, and what it counts.
const CARD_DETAILS = {
  sites_reporting: {
    title: "Sites reporting this month",
    hint: "Open a site's name to see its full statement.",
  },
  total_entries: {
    title: "Entries by site",
    hint: "Sites with the most entries first.",
  },
  over_tolerance: {
    title: "Entries over tolerance",
    hint: "Largest variance first. Open a site to see its statement.",
  },
  watch: {
    title: "Entries on watch",
    hint: "Largest variance first. Open a site to see its statement.",
  },
  within_tolerance: {
    title: "Entries within tolerance",
    hint: "Largest variance first. Open a site to see its statement.",
  },
  total_variance: {
    title: "Variance by site",
    hint: "Largest total variance first.",
  },
  largest_variance: {
    title: "Variance by site",
    hint: "The site at the top has the largest variance.",
  },
};

function statusLabel(status) {
  return (status || "")
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/^./, (char) => char.toUpperCase());
}

function StatusChip({ status }) {
  const tone =
    status === "WITHIN_TOLERANCE"
      ? "status-chip--success"
      : status === "OVER_TOLERANCE"
        ? "status-chip--error"
        : "status-chip--warning";
  return (
    <span className={`status-chip ${tone}`}>
      {statusLabel(status)}
    </span>
  );
}

function money(value) {
  return `₹${Number(value ?? 0).toLocaleString("en-IN")}`;
}

/** A site's name, as a link to its statement when it reported. */
function SiteLink({ row, packPath, month }) {
  const label = (
    <>
      <strong>{row.site_code}</strong>
      <span className="table-subtext">{row.site_name}</span>
    </>
  );
  if (row.reported === false) {
    return <div>{label}</div>;
  }
  const query = new URLSearchParams({
    site: row.site_id,
    ...(month ? { month } : {}),
  });
  return (
    <Link
      className="reco-card-detail__site"
      to={`${packPath}?${query.toString()}`}
      title={`Open the ${row.site_code} statement`}
    >
      {label}
    </Link>
  );
}

function SiteTable({ rows, packPath, month }) {
  return (
    <div className="data-table-wrapper">
      <table className="data-table">
        <thead>
          <tr>
            <th>Site</th>
            <th>Reporting</th>
            <th>Period status</th>
            <th>Entries</th>
            <th>Over tolerance</th>
            <th>Watch</th>
            <th>Within tolerance</th>
            <th>Total variance value</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.site_id}>
              <td>
                <SiteLink
                  row={row}
                  packPath={packPath}
                  month={month}
                />
              </td>
              <td>
                {row.reported ? (
                  <span className="status-chip status-chip--success">
                    Reported
                  </span>
                ) : (
                  <span className="status-chip status-chip--warning">
                    Not reported
                  </span>
                )}
              </td>
              <td>{statusLabel(row.period_status) || "-"}</td>
              <td>{row.reported ? row.total_entries : "-"}</td>
              <td>
                {row.reported ? row.over_tolerance_count : "-"}
              </td>
              <td>{row.reported ? row.watch_count : "-"}</td>
              <td>
                {row.reported ? row.within_tolerance_count : "-"}
              </td>
              <td
                className={
                  row.reported
                    ? varianceCellClass(row.total_variance_value)
                    : ""
                }
              >
                {row.reported ? money(row.total_variance_value) : "-"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EntryTable({ rows, packPath, month }) {
  return (
    <div className="data-table-wrapper">
      <table className="data-table">
        <thead>
          <tr>
            <th>Site</th>
            <th>Item</th>
            <th>UOM</th>
            <th>Book / theoretical</th>
            <th>Actual</th>
            <th>Variance qty</th>
            <th>Variance value</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.entry_id}>
              <td>
                <SiteLink
                  row={row}
                  packPath={packPath}
                  month={month}
                />
              </td>
              <td>{row.item_name}</td>
              <td>{row.uom}</td>
              <td>{row.theoretical_or_book_quantity}</td>
              <td>{row.actual_quantity}</td>
              <td className={varianceCellClass(row.variance_quantity)}>
                {row.variance_quantity}
              </td>
              <td className={varianceCellClass(row.variance_value)}>
                {money(row.variance_value)}
              </td>
              <td>
                <StatusChip status={row.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * The click-through behind one Reports summary card. ``month`` is
 * ``YYYY-MM`` (the month the cards show); site names open that
 * site's statement for the month.
 */
export function ReconciliationCardDetail({
  kind,
  month,
  packPath,
  onClose,
}) {
  const detailQuery = useReconciliationCardDetail(kind, {
    ...(month ? { month: `${month}-01` } : {}),
  });
  const info = CARD_DETAILS[kind];
  const data = detailQuery.data;

  return (
    <SurfaceCard
      title={info.title}
      className="print-hidden reco-card-detail"
      action={
        <button
          type="button"
          className="icon-button"
          onClick={onClose}
          aria-label="Close details"
        >
          <X size={16} />
        </button>
      }
    >
      <p className="table-subtext">{info.hint}</p>
      {detailQuery.isLoading ? (
        <AppLoader label="Loading details..." />
      ) : detailQuery.isError ? (
        <ErrorState
          title="Details unavailable"
          message={detailQuery.error?.message}
          onRetry={detailQuery.refetch}
        />
      ) : !data?.rows?.length ? (
        <EmptyState
          title="Nothing here for this month"
          message="No site or entry matches this card yet."
        />
      ) : (
        <>
          {data.shape === "entries" ? (
            <EntryTable
              rows={data.rows}
              packPath={packPath}
              month={month}
            />
          ) : (
            <SiteTable
              rows={data.rows}
              packPath={packPath}
              month={month}
            />
          )}
          {data.truncated ? (
            <p className="table-subtext">
              Showing the largest {data.rows.length} of{" "}
              {data.total} entries.
            </p>
          ) : null}
        </>
      )}
    </SurfaceCard>
  );
}
