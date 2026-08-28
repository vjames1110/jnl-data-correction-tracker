// Variance/difference figures read as profit or loss: a positive
// value (used less than the recipe called for, or found a physical
// surplus) is a "profit" shown in green, a negative value (overuse,
// or a stock shortage) is a "loss" shown in red. Zero stays neutral.
// The sign itself already encodes which is which - this only picks
// the colour.
export function varianceCellClass(value) {
  const n = Number(value);
  if (
    value === null ||
    value === undefined ||
    value === "" ||
    !Number.isFinite(n) ||
    Math.abs(n) <= 1e-9
  ) {
    return "";
  }

  return n > 0
    ? "data-table__variance--profit"
    : "data-table__variance--loss";
}
