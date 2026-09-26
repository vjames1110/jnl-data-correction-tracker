import {
  AlertTriangle,
  Banknote,
  CalendarDays,
  HardHat,
  TrendingUp,
  Wallet,
} from "lucide-react";

import { AppLoader } from "../../../components/common/AppLoader";
import { ErrorState } from "../../../components/common/ErrorState";
import { KpiCard } from "../../admin/components/KpiCard";
import {
  formatDate,
  formatMoneyCompact,
  formatPercent,
  formatQty,
} from "../utils/status";
import { apiErrorMessage, todayIso } from "../utils/finance";
import { WorkspaceSwitch } from "./WorkspaceSwitch";

const GLANCE_PERIODS = [
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "last_7_days", label: "Last 7 days" },
  { key: "month_to_date", label: "Month to date" },
  { key: "last_month", label: "Last month" },
  { key: "whole_project", label: "Whole project" },
  { key: "date", label: "Pick a date" },
];

function marginTone(row) {
  if (!row || row.expense_ratio === null) {
    return "default";
  }
  return row.flagged ? "warning" : "success";
}

function rangeLabel(selected) {
  if (!selected.start) {
    return "";
  }
  return selected.single_day
    ? formatDate(selected.start)
    : `${formatDate(selected.start)} to ${formatDate(selected.end)}`;
}

function FeedNotes({ selected }) {
  const missing = selected.missing_feeds ?? {};
  const parts = [
    ["DPR", missing.dpr],
    ["HR", missing.hr],
    ["Machinery", missing.machinery],
  ].filter(([, count]) => count > 0);
  if (!parts.length || !selected.days) {
    return null;
  }
  return (
    <p className="pm-dpr-toolbar__help">
      {selected.single_day
        ? "Nothing recorded for: "
        : `Days with nothing recorded (of ${selected.days}): `}
      {parts
        .map(([name, count]) =>
          selected.single_day ? name : `${name} ${count}`,
        )
        .join(", ")}
      . A missing feed makes the margin look better than it is.
    </p>
  );
}

/**
 * "Today at a glance" for one chosen period: a filter bar (today,
 * yesterday, last 7 days, month to date, last month, whole project
 * or any single date) and the cards for that period - value of work
 * done, expense, margin, labour and concrete. Everything comes from
 * one backend call (``glance.selected``); nothing is recomputed here.
 */
export function CostingGlancePanel({
  glance,
  period = "today",
  onPeriodChange,
  pickedDate,
  onDateChange,
  isLoading = false,
  error = null,
  onRetry,
}) {
  if (!glance && !isLoading && !error) {
    return null;
  }
  const selected = glance?.selected;

  return (
    <div className="pm-stack">
      <div className="pm-glance-filter print-hidden">
        <WorkspaceSwitch
          label="Period"
          value={period}
          onChange={onPeriodChange}
          options={GLANCE_PERIODS}
        />
        {period === "date" ? (
          <label className="filter-control">
            <span>Date</span>
            <input
              type="date"
              value={pickedDate}
              max={todayIso()}
              onChange={(event) =>
                event.target.value &&
                onDateChange(event.target.value)
              }
            />
          </label>
        ) : null}
      </div>

      {isLoading ? (
        <AppLoader label="Loading this period..." />
      ) : error ? (
        <ErrorState
          title="Costing unavailable"
          message={apiErrorMessage(error)}
          onRetry={onRetry}
        />
      ) : !selected ? null : (
        <>
          <div className="pm-glance-heading">
            <h3>{selected.label}</h3>
            {rangeLabel(selected) ? (
              <span className="sub">{rangeLabel(selected)}</span>
            ) : null}
          </div>

          {selected.flagged ? (
            <div className="inline-alert inline-alert--warning">
              <AlertTriangle size={16} />{" "}
              {selected.single_day
                ? "This day's expense has passed 90% of the value of work done."
                : "Expense over this period has passed 90% of the value of work done."}
            </div>
          ) : null}

          {!selected.start ? (
            <p className="pm-timeline-empty">
              Nothing to show yet - figures appear once a DPR entry
              has been made for this site.
            </p>
          ) : (
            <>
              <section className="kpi-grid kpi-grid--compact pm-glance-tiles">
                <KpiCard
                  label="Value of work done"
                  value={formatMoneyCompact(selected.value)}
                  icon={TrendingUp}
                  tone="success"
                />
                <KpiCard
                  label="Total expense"
                  value={formatMoneyCompact(selected.total_expense)}
                  icon={Wallet}
                />
                <KpiCard
                  label="Margin before overheads"
                  value={formatMoneyCompact(selected.margin)}
                  icon={Banknote}
                  tone={marginTone(selected)}
                  helper={
                    selected.expense_ratio === null
                      ? "No value recorded"
                      : `Expense is ${formatPercent(
                          Math.round(selected.expense_ratio * 100),
                        )} of value`
                  }
                />
                <KpiCard
                  label={
                    selected.labour?.kind === "man_days"
                      ? "Labour man-days"
                      : "Labour on site"
                  }
                  value={formatQty(selected.labour?.value)}
                  icon={HardHat}
                />
                <KpiCard
                  label="Concrete"
                  value={`${formatQty(selected.concrete_cum)} cum`}
                  icon={CalendarDays}
                  helper={
                    selected.concrete_source === "STORES"
                      ? "Stores figure"
                      : selected.concrete_source === "ESTIMATED"
                        ? "Estimated from DPR"
                        : selected.single_day
                          ? "Nothing recorded"
                          : "Stores figures and DPR estimates"
                  }
                />
              </section>
              <FeedNotes selected={selected} />
            </>
          )}
        </>
      )}
    </div>
  );
}
