// Any nonzero variance/difference figure - over or under - is worth
// flagging in red, not just an adverse (negative) one; zero stays neutral.
export function varianceCellClass(value) {
  const n = Number(value);
  return value !== null &&
    value !== undefined &&
    value !== "" &&
    Number.isFinite(n) &&
    Math.abs(n) > 1e-9
    ? "data-table__variance--flagged"
    : "";
}
