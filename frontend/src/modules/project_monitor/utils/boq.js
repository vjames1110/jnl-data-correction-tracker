/**
 * Railway BOQ rate maths, kept identical to the server's
 * (`DprItem.compute_bid_rate` / `boq.effective_rate`): amounts are
 * worked in whole paise and percentages in thousandths of a percent,
 * rounded half-to-even the way Python's Decimal.quantize does, so the
 * live preview in the form never differs from the saved rate.
 */

function scaled(value, decimals) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return null;
  }
  return BigInt(Math.round(number * 10 ** decimals));
}

/** amount x (1 + percent / 100), to 2 dp; null when not a number. */
export function applyPercent(amount, percent) {
  const paise = scaled(amount, 2);
  if (paise === null) {
    return null;
  }
  const thousandths = scaled(percent || 0, 3);
  if (thousandths === null) {
    return null;
  }
  const numerator = paise * (100000n + thousandths);
  const denominator = 100000n;
  let quotient = numerator / denominator;
  const remainder = numerator % denominator;
  const twice = (remainder < 0n ? -remainder : remainder) * 2n;
  const negative = numerator < 0n;
  if (twice > denominator) {
    quotient += negative ? -1n : 1n;
  } else if (twice === denominator && quotient % 2n !== 0n) {
    quotient += negative ? -1n : 1n;
  }
  return Number(quotient) / 100;
}

/**
 * The bid rate from an authority rate and the percentage that applies
 * (the item's own, else the contract-wide one, else 0).
 */
export function bidRate(authorityRate, itemPercent, contractPercent) {
  if (
    authorityRate === "" ||
    authorityRate === null ||
    authorityRate === undefined
  ) {
    return null;
  }
  const percent =
    itemPercent !== "" &&
    itemPercent !== null &&
    itemPercent !== undefined
      ? itemPercent
      : contractPercent;
  return applyPercent(authorityRate, percent);
}

/** "+5.5% above" / "-3% below" / "at par" for a percentage. */
export function describePercent(percent) {
  const value = Number(percent);
  if (percent === null || percent === undefined || Number.isNaN(value)) {
    return "not set";
  }
  if (value === 0) {
    return "at par";
  }
  return value > 0
    ? `${value}% above`
    : `${Math.abs(value)}% below`;
}

/** The next free number under a group: 4 -> 4.1, then 4.2 ... */
export function suggestChildNumber(parent, items) {
  if (!parent || !parent.item_no) {
    return "";
  }
  const prefix = `${parent.item_no.replace(/\.$/, "")}.`;
  let highest = 0;
  items.forEach((item) => {
    if (
      item.parent_id === parent.id &&
      item.item_no?.startsWith(prefix)
    ) {
      const tail = Number(item.item_no.slice(prefix.length));
      if (Number.isInteger(tail) && tail > highest) {
        highest = tail;
      }
    }
  });
  return `${prefix}${highest + 1}`;
}
