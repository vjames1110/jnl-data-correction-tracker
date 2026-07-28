import {
  formatDateTime,
  formatPerson,
  getSlaState,
} from "./approvalDisplay";

export function hoursBetween(start, end) {
  const startDate = new Date(start);
  const endDate = new Date(end);

  if (
    Number.isNaN(startDate.getTime()) ||
    Number.isNaN(endDate.getTime())
  ) {
    return null;
  }

  return Math.max(
    0,
    Math.round(
      (endDate.getTime() - startDate.getTime()) /
        36_000,
    ) / 100,
  );
}

export function isToday(value) {
  if (!value) {
    return false;
  }

  const date = new Date(value);
  const today = new Date();

  return (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  );
}

export function average(values) {
  const validValues = values.filter(
    (value) => Number.isFinite(value),
  );

  if (!validValues.length) {
    return null;
  }

  return (
    Math.round(
      (validValues.reduce(
        (sum, value) => sum + value,
        0,
      ) /
        validValues.length) *
        10,
    ) / 10
  );
}

export function groupCounts(
  items,
  resolveName,
  nameKey,
) {
  const map = new Map();

  items.forEach((item) => {
    const name = resolveName(item) || "Not specified";
    map.set(name, (map.get(name) ?? 0) + 1);
  });

  return Array.from(map.entries())
    .map(([name, count]) => ({
      [nameKey]: name,
      count,
    }))
    .sort((first, second) => second.count - first.count);
}

export function buildApprovalSummary(steps) {
  const decidedSteps = steps.filter(
    (step) => step.decided_at,
  );
  const turnaroundHours = decidedSteps.map((step) =>
    hoursBetween(
      step.request_submitted_at || step.created_at,
      step.decided_at,
    ),
  );

  return {
    pending: steps.filter(
      (step) =>
        step.status === "PENDING" &&
        step.is_current,
    ).length,
    approved_today: steps.filter(
      (step) =>
        step.status === "APPROVED" &&
        isToday(step.decided_at),
    ).length,
    rejected: steps.filter(
      (step) => step.status === "REJECTED",
    ).length,
    returned: steps.filter(
      (step) => step.status === "RETURNED",
    ).length,
    overdue: steps.filter(
      (step) => getSlaState(step).key === "overdue",
    ).length,
    average_approval_time_hours:
      average(turnaroundHours),
  };
}

export function buildApprovalAnalytics(steps) {
  const decidedSteps = steps.filter(
    (step) => step.decided_at,
  );
  const measuredSteps = steps.filter(
    (step) => step.due_at && step.decided_at,
  );
  const onTimeDecisions = measuredSteps.filter(
    (step) =>
      new Date(step.decided_at).getTime() <=
      new Date(step.due_at).getTime(),
  );
  const turnaroundHours = decidedSteps.map((step) =>
    hoursBetween(
      step.request_submitted_at || step.created_at,
      step.decided_at,
    ),
  );

  return {
    site_wise_requests: groupCounts(
      steps,
      (step) =>
        [step.site_code, step.site_name]
          .filter(Boolean)
          .join(" "),
      "site",
    ),
    department_wise_requests: groupCounts(
      steps,
      (step) =>
        [step.department_code, step.department_name]
          .filter(Boolean)
          .join(" "),
      "department",
    ),
    employee_mistake_ranking: groupCounts(
      steps,
      (step) =>
        formatPerson({
          employeeId: step.requester_employee_id,
          name: step.requester_name,
        }),
      "employee",
    ),
    voucher_error_ranking: groupCounts(
      steps,
      (step) =>
        [step.voucher_code, step.voucher_name]
          .filter(Boolean)
          .join(" "),
      "voucher",
    ),
    approval_turnaround_hours:
      average(turnaroundHours),
    sla_compliance:
      measuredSteps.length > 0
        ? Math.round(
            (onTimeDecisions.length /
              measuredSteps.length) *
              1000,
          ) / 10
        : null,
  };
}

export function approvalExportRows(steps) {
  return steps.map((step) => ({
    "Request Reference": step.request_reference,
    "Request Status": step.request_status,
    "Approval Status": step.status,
    "Requester Employee ID":
      step.requester_employee_id,
    Requester: step.requester_name,
    Site: [step.site_code, step.site_name]
      .filter(Boolean)
      .join(" "),
    Department: [
      step.department_code,
      step.department_name,
    ]
      .filter(Boolean)
      .join(" "),
    Voucher: [
      step.voucher_code,
      step.voucher_name,
    ]
      .filter(Boolean)
      .join(" "),
    "Voucher Number": step.voucher_number,
    "Work Type": step.work_type_name,
    Reason: step.reason_name,
    Priority: step.priority_name,
    Amount: step.amount,
    "Approver Employee ID":
      step.approver_employee_id,
    Approver: step.approver_name,
    "Level Name": step.level_name,
    "Due At": formatDateTime(step.due_at),
    "Escalates At": formatDateTime(
      step.escalates_at,
    ),
    "Decided At": formatDateTime(step.decided_at),
    "Submitted At": formatDateTime(
      step.request_submitted_at,
    ),
  }));
}

function escapeCsvValue(value) {
  const text = sanitizeCell(value);

  if (
    text.includes(",") ||
    text.includes('"') ||
    text.includes("\n")
  ) {
    return `"${text.replaceAll('"', '""')}"`;
  }

  return text;
}

function sanitizeCell(value) {
  const text = String(value ?? "");

  if (/^[=+\-@]/.test(text.trim())) {
    return `'${text}`;
  }

  return text;
}

function escapeHtml(value) {
  return sanitizeCell(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function downloadBlob({
  content,
  fileName,
  type,
}) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function downloadApprovalCsv(rows) {
  const headers = Object.keys(rows[0] ?? {});
  const csv = [
    headers.map(escapeCsvValue).join(","),
    ...rows.map((row) =>
      headers
        .map((header) =>
          escapeCsvValue(row[header]),
        )
        .join(","),
    ),
  ].join("\n");

  downloadBlob({
    content: csv,
    fileName: "director-approvals.csv",
    type: "text/csv;charset=utf-8",
  });
}

export function downloadApprovalExcel(rows) {
  const headers = Object.keys(rows[0] ?? {});
  const headerCells = headers
    .map((header) => `<th>${header}</th>`)
    .join("");
  const bodyRows = rows
    .map(
      (row) =>
        `<tr>${headers
          .map(
            (header) =>
              `<td>${escapeHtml(row[header])}</td>`,
          )
          .join("")}</tr>`,
    )
    .join("");

  downloadBlob({
    content: `<table><thead><tr>${headerCells}</tr></thead><tbody>${bodyRows}</tbody></table>`,
    fileName: "director-approvals.xls",
    type: "application/vnd.ms-excel;charset=utf-8",
  });
}
