export function formatDisplayDate(
  date,
  locale = "en-IN",
) {
  if (!date) {
    return "—";
  }

  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(date));
}

export function formatDisplayTime(
  date,
  locale = "en-IN",
) {
  if (!date) {
    return "--:--:--";
  }

  return new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  }).format(new Date(date));
}

export function formatDateTime(
  date,
  locale = "en-IN",
) {
  if (!date) {
    return "—";
  }

  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(date));
}

const RELATIVE_TIME_DIVISIONS = [
  { amount: 60, unit: "second" },
  { amount: 60, unit: "minute" },
  { amount: 24, unit: "hour" },
  { amount: 7, unit: "day" },
  { amount: 4.34524, unit: "week" },
  { amount: 12, unit: "month" },
  { amount: Number.POSITIVE_INFINITY, unit: "year" },
];

export function formatRelativeTime(
  date,
  locale = "en-IN",
) {
  if (!date) {
    return "—";
  }

  const target = new Date(date);

  if (Number.isNaN(target.getTime())) {
    return "—";
  }

  const formatter = new Intl.RelativeTimeFormat(
    locale,
    {
      numeric: "auto",
    },
  );

  let duration =
    (target.getTime() - Date.now()) / 1000;

  for (const division of RELATIVE_TIME_DIVISIONS) {
    if (Math.abs(duration) < division.amount) {
      return formatter.format(
        Math.round(duration),
        division.unit,
      );
    }

    duration /= division.amount;
  }

  return formatter.format(
    Math.round(duration),
    "year",
  );
}