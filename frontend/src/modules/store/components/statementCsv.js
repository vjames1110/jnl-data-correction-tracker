function csvCell(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text)
    ? `"${text.replaceAll('"', '""')}"`
    : text;
}

function toCsvString(rows) {
  return rows
    .map((row) => row.map(csvCell).join(","))
    .join("\r\n");
}

export function downloadCsvRows(filename, rows) {
  const csv = toCsvString(rows);
  const blob = new Blob([csv], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function num(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * One site's statement, in the same four sections the printed sheet
 * shows - a plain array-of-rows CSV, so it opens cleanly in Excel/Sheets.
 */
export function buildStatementCsvRows({
  period,
  entries,
  outputEntries,
}) {
  const rows = [
    ["STORE RECONCILIATION STATEMENT"],
    [
      `${period.site_code} - ${period.site_name}`,
    ],
    [period.period_month, period.status_display],
    [
      "Opening Stock Date",
      period.opening_stock_date || "",
      "Closing Stock Date",
      period.closing_stock_date || "",
    ],
    [],
    ["1. STOCK & RECEIPTS (ACTUAL CONSUMPTION)"],
    [
      "Item",
      "UOM",
      "Section",
      "Rack",
      "Opening/Book",
      "Receipts/Physical",
      "Closing",
      "Actual",
    ],
  ];

  entries.forEach((entry) => {
    rows.push([
      `${entry.item_code} - ${entry.item_name}`,
      entry.uom,
      entry.section || "",
      entry.rack || "",
      entry.opening_stock ?? entry.book_stock ?? "",
      entry.receipts ?? entry.physical_count ?? "",
      entry.closing_stock ?? "",
      entry.actual_quantity ?? "",
    ]);
  });

  if (outputEntries.length) {
    rows.push(
      [],
      ["2. PRODUCTION OUTPUT & APPROVED MIX RATIO"],
      [
        "Item",
        "Grade",
        "Output Quantity",
        "Mix Ratio",
        "Theoretical Quantity",
      ],
    );
    outputEntries.forEach((output) => {
      const ratio = output.resolved_mix_ratio;
      const theoretical =
        ratio != null
          ? num(output.output_quantity) * num(ratio)
          : "";
      rows.push([
        `${output.item_code} - ${output.item_name}`,
        output.grade_label || "",
        output.output_quantity,
        ratio ?? "Not configured",
        theoretical,
      ]);
    });
  }

  rows.push(
    [],
    ["3. FINAL ANALYSIS (ACTUAL VS THEORETICAL)"],
    [
      "Item",
      "Actual",
      "Theoretical/Book",
      "Difference",
      "Rate",
      "Difference Value (INR)",
    ],
  );

  let totalVarianceValue = 0;
  entries.forEach((entry) => {
    totalVarianceValue += num(entry.variance_value);
    rows.push([
      `${entry.item_code} - ${entry.item_name}`,
      entry.actual_quantity ?? "",
      entry.theoretical_or_book_quantity ?? "",
      entry.variance_quantity ?? "",
      entry.resolved_rate ?? "",
      entry.variance_value ?? "",
    ]);
  });
  rows.push([
    "TOTAL VARIANCE VALUE",
    "",
    "",
    "",
    "",
    totalVarianceValue.toFixed(2),
  ]);

  return rows;
}

/**
 * Every site's statement from a statement-pack response, one after
 * another with a blank line between - the CSV companion to Print Pack.
 */
export function buildStatementPackCsvRows(statements) {
  const rows = [];
  statements.forEach((statement, index) => {
    if (index > 0) {
      rows.push([], []);
    }
    rows.push(
      ...buildStatementCsvRows({
        period: statement.period,
        entries: statement.entries,
        outputEntries: statement.output_entries,
      }),
    );
  });
  return rows;
}
