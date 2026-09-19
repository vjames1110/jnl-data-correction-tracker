/**
 * Small helpers shared by the finance-tier (DPR & Bills) screens.
 */

function flatten(value) {
  if (Array.isArray(value)) {
    return value.flatMap(flatten);
  }
  if (value && typeof value === "object") {
    return Object.values(value).flatMap(flatten);
  }
  return value ? [String(value)] : [];
}

/** The readable message(s) from a failed API call. */
export function apiErrorMessage(error) {
  const errors = error?.response?.data?.errors;
  const messages = flatten(errors);
  if (messages.length) {
    return messages.join(" ");
  }
  return (
    error?.response?.data?.message ||
    error?.message ||
    "Something went wrong."
  );
}

/** Save a Blob (e.g. a downloaded .xlsx template) to disk. */
export function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

// The viewer's LOCAL calendar date (the prototype used the UTC date,
// which is a day behind in India for the first hours of each day).
export function todayIso() {
  return new Date().toLocaleDateString("en-CA");
}

export function parseNumber(value) {
  if (value === "" || value === null || value === undefined) {
    return null;
  }
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
}
