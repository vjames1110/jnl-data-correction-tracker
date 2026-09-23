/**
 * The one place every "how do we print a date" decision is made, so
 * the whole app agrees on DD-MM-YYYY. Two different inputs need two
 * different treatments:
 *
 * - A plain calendar date ("2026-09-23", no time of day - a DPR day,
 *   an extension date, a chainage date) has no timezone of its own,
 *   so it is read as text, never round-tripped through a JS ``Date``
 *   (which would attach the browser's local midnight and can shift
 *   the calendar day near a timezone boundary). ``formatCalendarDate``.
 * - A real timestamp (an audit "created_at", "reviewed_at", "now")
 *   is shown in the viewer's local time, same as before this file
 *   existed - only the OUTPUT FORMAT changes here, not the timezone
 *   behaviour. ``formatDateTime``.
 *
 * Every module's own ``formatDate``/``formatDateTime`` (each keeps
 * its own "no value" fallback text - "-", "—", "Not set" - and its
 * own name, since call sites already import those) delegates to
 * these two so the actual day/month/year order and separator live in
 * exactly one place.
 */

function pad2(value) {
  return String(value).padStart(2, "0");
}

/**
 * ``value`` may be ``"YYYY-MM-DD"``, a full ISO timestamp (only its
 * date prefix is used - see the module note on why this never goes
 * through ``Date``), or already a ``Date``/timestamp (falls back to
 * ``formatDateTime`` for those). Returns ``"DD-MM-YYYY"`` or
 * ``null``.
 */
export function formatCalendarDate(value) {
  if (!value) {
    return null;
  }
  if (typeof value === "string") {
    const match = value.match(
      /^(\d{4})-(\d{2})-(\d{2})/,
    );
    if (match) {
      const [, year, month, day] = match;
      return `${day}-${month}-${year}`;
    }
  }
  const withTime = formatDateTime(value, {
    dateOnly: true,
  });
  return withTime;
}

/**
 * ``value`` is a real timestamp (a ``Date``, or anything ``new
 * Date()`` accepts) - shown in the viewer's local time as
 * ``"DD-MM-YYYY"`` (``dateOnly: true``) or ``"DD-MM-YYYY, hh:mm am"``.
 * Returns ``null`` for an empty or unparseable value.
 */
export function formatDateTime(
  value,
  { dateOnly = false } = {},
) {
  if (!value) {
    return null;
  }
  const date =
    value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  const datePart = `${pad2(date.getDate())}-${pad2(
    date.getMonth() + 1,
  )}-${date.getFullYear()}`;
  if (dateOnly) {
    return datePart;
  }
  const timePart = new Intl.DateTimeFormat("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(date);
  return `${datePart}, ${timePart}`;
}
