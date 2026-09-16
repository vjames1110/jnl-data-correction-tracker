import { formatDate } from "../utils/status";

const STATUS_CLASS = {
  GREEN: "pm-countdown-badge--green",
  ORANGE: "pm-countdown-badge--orange",
  RED: "pm-countdown-badge--red",
};

function countdownMessage(
  daysRemaining,
  effectiveEndDate,
) {
  if (daysRemaining < 0) {
    return `Project is overdue by ${Math.abs(daysRemaining)} day${
      Math.abs(daysRemaining) === 1 ? "" : "s"
    } (was due ${formatDate(effectiveEndDate)}).`;
  }
  return `Project has ${daysRemaining} day${
    daysRemaining === 1 ? "" : "s"
  } remaining to end.`;
}

/**
 * The color-coded completion countdown - green/orange/red driven
 * entirely by the backend's ``days_remaining``/``countdown_status``
 * (see ``ProjectSiteSerializer``), so the Overview dashboard and the
 * printable Reports page always agree on the number and the color.
 */
export function ProjectCountdownBadge({
  daysRemaining,
  countdownStatus,
  effectiveEndDate,
}) {
  if (
    daysRemaining == null ||
    !countdownStatus
  ) {
    return (
      <p className="pm-countdown-badge pm-countdown-badge--none">
        End date not set - no completion
        countdown to show.
      </p>
    );
  }

  return (
    <p
      className={`pm-countdown-badge ${STATUS_CLASS[countdownStatus] || ""}`}
    >
      {countdownMessage(
        daysRemaining,
        effectiveEndDate,
      )}
    </p>
  );
}
