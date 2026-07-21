export function buildParams(filters) {
  return Object.fromEntries(
    Object.entries(filters).filter(
      ([, value]) =>
        value !== "" &&
        value !== null &&
        value !== undefined,
    ),
  );
}

export function normalizeDatePayload(
  payload,
  fields,
) {
  return fields.reduce(
    (currentPayload, field) => ({
      ...currentPayload,
      [field]: currentPayload[field] || null,
    }),
    payload,
  );
}

export function downloadCsv(
  filename,
  rows,
  columns,
) {
  const escapeValue = (value) =>
    `"${String(value ?? "").replaceAll('"', '""')}"`;

  const csv = [
    columns.map((column) => column.label).join(","),
    ...rows.map((row) =>
      columns
        .map((column) =>
          escapeValue(row[column.key]),
        )
        .join(","),
    ),
  ].join("\n");

  const blob = new Blob([csv], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const anchor =
    document.createElement("a");

  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
