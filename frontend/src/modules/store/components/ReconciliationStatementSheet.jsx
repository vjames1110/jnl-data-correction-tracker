import { env } from "../../../config/env";
import { varianceCellClass } from "../../../utils/formatters";

const NUMBER_FORMATTER = new Intl.NumberFormat(
  "en-IN",
  {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  },
);
const INR_FORMATTER = new Intl.NumberFormat(
  "en-IN",
  {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  },
);

function toNumber(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function fmtQty(value) {
  const n = toNumber(value);
  if (n === null) {
    return "-";
  }
  const formatted = NUMBER_FORMATTER.format(
    Math.abs(n),
  );
  return n < 0 ? `(${formatted})` : formatted;
}

function fmtPct(value) {
  const n = toNumber(value);
  if (n === null) {
    return "-";
  }
  const formatted = `${Math.abs(n).toFixed(1)}%`;
  return n < 0 ? `(${formatted})` : formatted;
}

function fmtInr(value) {
  const n = toNumber(value);
  if (n === null) {
    return "-";
  }
  const formatted = INR_FORMATTER.format(
    Math.abs(Math.round(n)),
  );
  return n < 0 ? `(${formatted})` : formatted;
}

function fmtRatio(value) {
  const n = toNumber(value);
  return n === null ? "-" : n.toFixed(4);
}

function negClass(value) {
  const n = toNumber(value);
  return n !== null && n < 0
    ? "recon-sheet__cell--neg"
    : "";
}

function variancePercentage(entry) {
  const theoretical = toNumber(
    entry.theoretical_or_book_quantity,
  );
  const variance = toNumber(entry.variance_quantity);
  if (
    theoretical === null ||
    variance === null ||
    Math.abs(theoretical) < 1e-9
  ) {
    return null;
  }
  return (variance / theoretical) * 100;
}

function formatMonth(isoDate) {
  if (!isoDate) {
    return "-";
  }
  const [year, month] = isoDate.split("-");
  const date = new Date(
    Number(year),
    Number(month) - 1,
    1,
  );
  return date.toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
  });
}

function gradeLabel(grade) {
  return grade || "General";
}

/**
 * Sums production output (e.g. cum of Concrete produced) per grade
 * for the period. There's one shared production run, not one per
 * material - every norm-based material's design mix / theoretical
 * consumption is resolved against this same per-grade total, via
 * each entry's own ``mix_ratio_by_grade`` (see
 * ReconciliationEntrySerializer.get_mix_ratio_by_grade).
 */
function buildProductionPivot(outputEntries) {
  const gradeSet = new Set();
  const qtyByGrade = new Map();

  outputEntries.forEach((output) => {
    const grade = output.grade_label || "";
    gradeSet.add(grade);
    const qty = toNumber(output.output_quantity) ?? 0;
    qtyByGrade.set(
      grade,
      (qtyByGrade.get(grade) ?? 0) + qty,
    );
  });

  const grades = Array.from(gradeSet).sort((a, b) =>
    a.localeCompare(b),
  );

  return { grades, qtyByGrade };
}

export function ReconciliationStatementSheet({
  period,
  entries,
  outputEntries,
}) {
  const totalVarianceValue = entries.reduce(
    (sum, entry) =>
      sum + (toNumber(entry.variance_value) ?? 0),
    0,
  );
  const hasLocationData = entries.some(
    (entry) => entry.section || entry.rack,
  );
  const pivot = buildProductionPivot(outputEntries);
  const producedTotal = pivot.grades.reduce(
    (sum, grade) =>
      sum + (pivot.qtyByGrade.get(grade) ?? 0),
    0,
  );
  // Concrete (or whatever is flagged as the production output) is
  // never itself reconciled, so it never appears here - only the
  // raw materials the recipe is made from do. Sections 2/3 are
  // material-level reference tables (design mix / theoretical
  // consumption for every grade this material could apply to) -
  // deduped to one row per material, since a material can now carry
  // more than one entry (one per grade actually produced) and
  // mix_ratio_by_grade already covers every grade regardless of
  // which entry it's read from.
  const normBasedEntries = Array.from(
    new Map(
      entries
        .filter(
          (entry) =>
            entry.reconciliation_type ===
            "NORM_BASED",
        )
        .map((entry) => [entry.item, entry]),
    ).values(),
  );

  function materialLabel(entry) {
    return `${entry.item_name}${
      entry.uom ? ` (${entry.uom})` : ""
    }`;
  }

  // Section 1's columns and Section 3's rows are per-ENTRY, and a
  // material can now have a separate entry per grade - append the
  // grade so two entries for the same material aren't shown under
  // identical labels. Deliberately doesn't reuse materialLabel's
  // UOM suffix, to keep matching each section's existing label
  // format otherwise.
  function entryLabel(entry) {
    return entry.grade_label
      ? `${entry.item_name} - ${entry.grade_label}`
      : entry.item_name;
  }

  return (
    <div className="recon-sheet">
      <h2 className="recon-sheet__title">
        Store Reconciliation Statement
      </h2>
      <div className="recon-sheet__subtitle">
        {env.companyName}
      </div>

      <table className="recon-sheet__details">
        <tbody>
          <tr>
            <td>Site</td>
            <td>
              {period.site_code} -{" "}
              {period.site_name}
            </td>
          </tr>
          <tr>
            <td>Assessment Month</td>
            <td>
              {formatMonth(period.period_month)}
            </td>
          </tr>
          {period.opening_stock_date ? (
            <tr>
              <td>Opening Stock Date</td>
              <td>
                {period.opening_stock_date}
              </td>
            </tr>
          ) : null}
          {period.closing_stock_date ? (
            <tr>
              <td>Closing Stock Date</td>
              <td>
                {period.closing_stock_date}
              </td>
            </tr>
          ) : null}
          <tr>
            <td>Status</td>
            <td>{period.status_display}</td>
          </tr>
        </tbody>
      </table>

      <h3>
        1. Stock &amp; Receipts (Actual
        Consumption)
      </h3>
      <div className="recon-sheet__table-wrap">
        <table className="recon-sheet__table">
          <thead>
            <tr>
              <th className="recon-sheet__col-label">
                Particulars
              </th>
              {entries.map((entry) => (
                <th key={entry.id}>
                  {entryLabel({
                    id: entry.item,
                    item_code: entry.item_code,
                    item_name: entry.item_name,
                    grade_label: entry.grade_label,
                  })}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {hasLocationData ? (
              <>
                <tr>
                  <td className="recon-sheet__col-label">
                    Section
                  </td>
                  {entries.map((entry) => (
                    <td key={entry.id}>
                      {entry.section || "-"}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="recon-sheet__col-label">
                    Rack
                  </td>
                  {entries.map((entry) => (
                    <td key={entry.id}>
                      {entry.rack || "-"}
                    </td>
                  ))}
                </tr>
              </>
            ) : null}
            <tr>
              <td className="recon-sheet__col-label">
                Opening Stock / Book Stock
              </td>
              {entries.map((entry) => (
                <td key={entry.id}>
                  {fmtQty(
                    entry.opening_stock ??
                      entry.book_stock,
                  )}
                </td>
              ))}
            </tr>
            <tr>
              <td className="recon-sheet__col-label">
                Add: Receipts / Physical Count
              </td>
              {entries.map((entry) => (
                <td key={entry.id}>
                  {fmtQty(
                    entry.receipts ??
                      entry.physical_count,
                  )}
                </td>
              ))}
            </tr>
            <tr>
              <td className="recon-sheet__col-label">
                Less: Closing Stock
              </td>
              {entries.map((entry) => (
                <td key={entry.id}>
                  {fmtQty(entry.closing_stock)}
                </td>
              ))}
            </tr>
            <tr>
              <td className="recon-sheet__col-label">
                Net Consumption (Actual)
              </td>
              {entries.map((entry) => (
                <td
                  key={entry.id}
                  className={`recon-sheet__cell--emph ${negClass(entry.actual_quantity)}`}
                >
                  {fmtQty(entry.actual_quantity)}
                </td>
              ))}
            </tr>
            {!entries.length ? (
              <tr>
                <td className="recon-sheet__empty">
                  No items recorded for this
                  period.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {pivot.grades.length ? (
        <>
          <h3>
            2. Production Output &amp; Approved
            Design Mix
          </h3>
          <p className="recon-sheet__note">
            Design mix figures are the configured
            quantity of each material required per
            unit of output at each grade - the rate
            Section 3&rsquo;s theoretical
            consumption below is calculated from.
          </p>
          <div className="recon-sheet__table-wrap">
            <table className="recon-sheet__table">
              <thead>
                <tr>
                  <th className="recon-sheet__col-label">
                    Particulars
                  </th>
                  {pivot.grades.map((grade) => (
                    <th key={grade}>
                      {gradeLabel(grade)}
                    </th>
                  ))}
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="recon-sheet__col-label recon-sheet__cell--emph">
                    Quantity Produced
                  </td>
                  {pivot.grades.map((grade) => (
                    <td
                      key={grade}
                      className="recon-sheet__cell--emph"
                    >
                      {fmtQty(
                        pivot.qtyByGrade.get(grade),
                      )}
                    </td>
                  ))}
                  <td className="recon-sheet__cell--emph">
                    {fmtQty(producedTotal)}
                  </td>
                </tr>
                {normBasedEntries.map((entry) => (
                  <tr key={entry.id}>
                    <td className="recon-sheet__col-label">
                      Design Mix -{" "}
                      {materialLabel(entry)}
                    </td>
                    {pivot.grades.map((grade) => {
                      const ratio =
                        entry.mix_ratio_by_grade?.[
                          grade
                        ];
                      return (
                        <td key={grade}>
                          {ratio === null ||
                          ratio === undefined
                            ? "Not configured"
                            : fmtRatio(ratio)}
                        </td>
                      );
                    })}
                    <td>-</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}

      <h3>
        3. Final Analysis (Actual vs
        Theoretical)
      </h3>
      <p className="recon-sheet__note">
        &ldquo;Theoretical&rdquo; means: for
        materials with production output recorded
        above, quantity produced &times; the
        material&rsquo;s Design Mix ratio (Section
        2) for that grade; for direct-count items
        with no production output, the Book Stock
        figure entered in Section 1.
      </p>
      <div className="recon-sheet__table-wrap">
        <table className="recon-sheet__table">
          <thead>
            <tr>
              <th className="recon-sheet__col-label">
                Item
              </th>
              <th>Actual</th>
              <th>Theoretical / Book</th>
              <th>Difference</th>
              <th>Difference %</th>
              <th>Rate</th>
              <th>Difference Value (INR)</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.id}>
                <td className="recon-sheet__col-label">
                  {entryLabel(entry)}
                </td>
                <td>
                  {fmtQty(entry.actual_quantity)}
                </td>
                <td>
                  {fmtQty(
                    entry.theoretical_or_book_quantity,
                  )}
                </td>
                <td
                  className={varianceCellClass(
                    entry.variance_quantity,
                  )}
                >
                  {fmtQty(
                    entry.variance_quantity,
                  )}
                </td>
                <td
                  className={varianceCellClass(
                    variancePercentage(entry),
                  )}
                >
                  {fmtPct(
                    variancePercentage(entry),
                  )}
                </td>
                <td>
                  {entry.resolved_rate === null ||
                  entry.resolved_rate === undefined
                    ? "-"
                    : INR_FORMATTER.format(
                        Math.round(
                          toNumber(
                            entry.resolved_rate,
                          ) ?? 0,
                        ),
                      )}
                </td>
                <td
                  className={varianceCellClass(
                    entry.variance_value,
                  )}
                >
                  {fmtInr(entry.variance_value)}
                </td>
              </tr>
            ))}
            <tr className="recon-sheet__row--grand">
              <td
                colSpan={6}
                className="recon-sheet__col-label"
              >
                TOTAL VARIANCE VALUE
              </td>
              <td
                className={varianceCellClass(
                  totalVarianceValue,
                )}
              >
                {fmtInr(totalVarianceValue)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="recon-sheet__footer">
        <span>
          {period.site_code} - {period.site_name}{" "}
          &middot; {formatMonth(period.period_month)}
        </span>
        <span>
          Figures in each item&rsquo;s own unit
          of measure unless stated
        </span>
      </div>
    </div>
  );
}
