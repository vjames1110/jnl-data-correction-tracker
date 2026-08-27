/**
 * Shared CSV-import helpers used by each reconciliation master's own
 * management page (Item Categories, Items, Company Defaults) - each
 * page owns its "Import CSV" button next to its existing "Export"
 * button, rather than a separate consolidated import/export screen.
 */

export function readTextFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      resolve(String(reader.result || ""));
    reader.onerror = () =>
      reject(
        new Error("Unable to read selected file."),
      );
    reader.readAsText(file);
  });
}

export function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = "";
  let inQuotes = false;

  for (
    let index = 0;
    index < text.length;
    index += 1
  ) {
    const char = text[index];
    const next = text[index + 1];

    if (
      char === '"' &&
      inQuotes &&
      next === '"'
    ) {
      value += '"';
      index += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      row.push(value.trim());
      value = "";
    } else if (
      (char === "\n" || char === "\r") &&
      !inQuotes
    ) {
      if (char === "\r" && next === "\n") {
        index += 1;
      }
      row.push(value.trim());
      if (row.some((cell) => cell !== "")) {
        rows.push(row);
      }
      row = [];
      value = "";
    } else {
      value += char;
    }
  }

  row.push(value.trim());
  if (row.some((cell) => cell !== "")) {
    rows.push(row);
  }

  if (!rows.length) {
    return [];
  }

  const headers = rows[0].map((header) =>
    header.trim(),
  );

  return rows.slice(1).map((cells) =>
    Object.fromEntries(
      headers.map((header, index) => [
        header,
        cells[index] ?? "",
      ]),
    ),
  );
}

export function toBoolean(
  value,
  fallback = false,
) {
  if (value === "" || value === undefined) {
    return fallback;
  }

  return ["true", "yes", "1", "active"].includes(
    String(value).trim().toLowerCase(),
  );
}

export function toNumber(value, fallback = 0) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue)
    ? numberValue
    : fallback;
}

export function findByCode(items, code) {
  if (!code) {
    return "";
  }

  const normalizedCode = String(code)
    .trim()
    .toLowerCase();

  return (
    items.find(
      (item) =>
        String(item.code || "")
          .trim()
          .toLowerCase() === normalizedCode,
    )?.id || ""
  );
}

export function compactPayload(payload) {
  return Object.fromEntries(
    Object.entries(payload).filter(
      ([, value]) =>
        value !== "" &&
        value !== null &&
        value !== undefined,
    ),
  );
}
