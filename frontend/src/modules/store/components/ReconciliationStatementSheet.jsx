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
 * Reshapes output entries (one row per material+grade+batch) into the
 * grade-as-columns matrix the statement's Section 2/3 tables need.
 * Quantities are summed per (material, grade) - a material can have more
 * than one production batch logged against the same grade in a period,
 * mirroring how services/variance.py aggregates theoretical consumption.
 */
function buildOutputPivot(outputEntries) {
  const materialsById = new Map();
  const gradeSet = new Set();
  const qtyByMaterialGrade = new Map();
  const ratioByMaterialGrade = new Map();

  outputEntries.forEach((output) => {
    const itemId = output.item;
    const grade = output.grade_label || "";
    gradeSet.add(grade);

    if (!materialsById.has(itemId)) {
      materialsById.set(itemId, {
        id: itemId,
        item_code: output.item_code,
        item_name: output.item_name,
      });
    }

    if (!qtyByMaterialGrade.has(itemId)) {
      qtyByMaterialGrade.set(itemId, new Map());
    }
    const gradeQtyMap = qtyByMaterialGrade.get(itemId);
    const qty = toNumber(output.output_quantity) ?? 0;
    gradeQtyMap.set(
      grade,
      (gradeQtyMap.get(grade) ?? 0) + qty,
    );

    if (!ratioByMaterialGrade.has(itemId)) {
      ratioByMaterialGrade.set(itemId, new Map());
    }
    const ratioMap = ratioByMaterialGrade.get(itemId);
    if (!ratioMap.has(grade)) {
      ratioMap.set(
        grade,
        toNumber(output.resolved_mix_ratio),
      );
    }
  });

  const grades = Array.from(gradeSet).sort((a, b) =>
    a.localeCompare(b),
  );
  const materials = Array.from(materialsById.values());

  const qtyByGrade = new Map();
  grades.forEach((grade) => {
    let max = null;
    materials.forEach((material) => {
      const q = qtyByMaterialGrade
        .get(material.id)
        ?.get(grade);
      if (q !== undefined && (max === null || q > max)) {
        max = q;
      }
    });
    qtyByGrade.set(grade, max);
  });

  return {
    materials,
    grades,
    qtyByMaterialGrade,
    ratioByMaterialGrade,
    qtyByGrade,
  };
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
  const entryByItemId = new Map(
    entries.map((entry) => [entry.item, entry]),
  );
  const hasLocationData = entries.some(
    (entry) => entry.section || entry.rack,
  );
  const pivot = buildOutputPivot(outputEntries);
  const producedTotal = pivot.grades.reduce(
    (sum, grade) =>
      sum + (pivot.qtyByGrade.get(grade) ?? 0),
    0,
  );

  function materialLabel(material) {
    const uom = entryByItemId.get(material.id)?.uom;
    return `${material.item_code} - ${material.item_name}${
      uom ? ` (${uom})` : ""
    }`;
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
                  {materialLabel({
                    id: entry.item,
                    item_code: entry.item_code,
                    item_name: entry.item_name,
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

      {pivot.materials.length ? (
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
            consumption is calculated from.
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
                {pivot.materials.map((material) => (
                  <tr key={material.id}>
                    <td className="recon-sheet__col-label">
                      Design Mix -{" "}
                      {materialLabel(material)}
                    </td>
                    {pivot.grades.map((grade) => {
                      const hasBatch = pivot.qtyByMaterialGrade
                        .get(material.id)
                        ?.has(grade);
                      const ratio = pivot.ratioByMaterialGrade
                        .get(material.id)
                        ?.get(grade);
                      return (
                        <td key={grade}>
                          {!hasBatch
                            ? "-"
                            : ratio === null ||
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

          <h3>
            3. Theoretical Consumption
            (Production &times; Design Mix)
          </h3>
          <p className="recon-sheet__note">
            Each cell = Quantity Produced for that
            grade &times; that material&rsquo;s
            Design Mix ratio for that grade. The
            Total column is the theoretical figure
            used in Section 4&rsquo;s comparison
            below.
          </p>
          <div className="recon-sheet__table-wrap">
            <table className="recon-sheet__table">
              <thead>
                <tr>
                  <th className="recon-sheet__col-label">
                    Material
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
                {pivot.materials.map((material) => {
                  const matchedEntry =
                    entryByItemId.get(material.id);
                  let fallbackTotal = 0;
                  let hasAnyCell = false;
                  return (
                    <tr key={material.id}>
                      <td className="recon-sheet__col-label">
                        {materialLabel(material)}
                      </td>
                      {pivot.grades.map((grade) => {
                        const qty = pivot.qtyByMaterialGrade
                          .get(material.id)
                          ?.get(grade);
                        const ratio = pivot.ratioByMaterialGrade
                          .get(material.id)
                          ?.get(grade);
                        if (
                          qty === undefined ||
                          ratio === null ||
                          ratio === undefined
                        ) {
                          return (
                            <td key={grade}>
                              {qty === undefined
                                ? "-"
                                : "Not configured"}
                            </td>
                          );
                        }
                        const theoretical = qty * ratio;
                        hasAnyCell = true;
                        fallbackTotal += theoretical;
                        return (
                          <td key={grade}>
                            {fmtQty(theoretical)}
                          </td>
                        );
                      })}
                      <td className="recon-sheet__cell--emph">
                        {matchedEntry
                          ? fmtQty(
                              matchedEntry.theoretical_or_book_quantity,
                            )
                          : hasAnyCell
                            ? fmtQty(fallbackTotal)
                            : "-"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      ) : null}

      <h3>
        4. Final Analysis (Actual vs
        Theoretical)
      </h3>
      <p className="recon-sheet__note">
        &ldquo;Theoretical&rdquo; means: for
        materials with production output recorded
        above, the Section 3 total (design mix
        &times; quantity produced); for direct-count
        items with no production output, the Book
        Stock figure entered in Section 1.
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
                  {entry.item_code} -{" "}
                  {entry.item_name}
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
