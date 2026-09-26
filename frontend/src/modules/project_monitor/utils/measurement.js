/**
 * The measurement sheet's arithmetic, mirroring the server's
 * (`DprMeasurement.quantity`): nos x whichever of length / breadth /
 * depth are filled, negative for a deduction. Only a live preview -
 * after saving, the total shown is the server's.
 */

const DIMENSIONS = ["nos", "length", "breadth", "depth"];
const TOLERANCE = 0.0005;

function filled(value) {
  return value !== "" && value !== null && value !== undefined;
}

export function lineQuantity(line) {
  const factors = DIMENSIONS.filter((name) =>
    filled(line[name]),
  ).map((name) => Number(line[name]));
  if (!factors.length || factors.some(Number.isNaN)) {
    return 0;
  }
  const product = factors.reduce((total, value) => total * value, 1);
  const rounded = Math.round(product * 1000) / 1000;
  return line.is_deduction ? -rounded : rounded;
}

export function sheetTotal(lines) {
  const total = lines.reduce(
    (sum, line) => sum + lineQuantity(line),
    0,
  );
  return Math.round(total * 1000) / 1000;
}

/** A line the server would accept: something measured, no negatives. */
export function isMeasured(line) {
  return DIMENSIONS.some((name) => filled(line[name]));
}

/**
 * How the measured total stands against the quantity typed in the
 * grid: `none` (nothing measured), `unentered` (measured but no
 * quantity typed), `match`, `short` (measured less than entered) or
 * `over` (measured more). `diff` is the absolute gap.
 */
export function compareWithEntered(total, entered) {
  const measured = Number(total) || 0;
  const typed = Number(entered) || 0;
  if (!measured) {
    return { state: "none", diff: 0 };
  }
  if (!typed) {
    return { state: "unentered", diff: measured };
  }
  const diff = Math.round(Math.abs(measured - typed) * 1000) / 1000;
  if (diff < TOLERANCE) {
    return { state: "match", diff: 0 };
  }
  return { state: measured < typed ? "short" : "over", diff };
}

export function comparisonText(total, entered) {
  const { state, diff } = compareWithEntered(total, entered);
  const measured = Math.round(Number(total) * 1000) / 1000;
  const typed = Math.round(Number(entered) * 1000) / 1000;
  switch (state) {
    case "match":
      return `Matches the ${typed} entered`;
    case "short":
      return `Measured ${measured} of ${typed} entered`;
    case "over":
      return `Measured ${measured} - ${diff} more than the ${typed} entered`;
    case "unentered":
      return `Measured ${measured} - no quantity entered yet`;
    default:
      return "Nothing measured yet";
  }
}
