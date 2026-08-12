export function formatNotificationEvent(
  eventType,
) {
  return String(eventType ?? "-")
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) =>
      letter.toUpperCase(),
    );
}

export function notificationSeverityTone(
  severity,
) {
  if (severity === "SUCCESS") {
    return "success";
  }

  if (severity === "WARNING") {
    return "warning";
  }

  if (severity === "CRITICAL") {
    return "error";
  }

  return "neutral";
}
