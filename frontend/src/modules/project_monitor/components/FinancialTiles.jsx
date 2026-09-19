import {
  Banknote,
  CalendarClock,
  Gauge,
  Receipt,
  TrendingUp,
  Wallet,
} from "lucide-react";

import { KpiCard } from "../../admin/components/KpiCard";
import {
  formatDate,
  formatMoneyCompact,
} from "../utils/status";

/**
 * The money-aware contract status: what's been done and billed, what
 * is left, and whether yesterday's execution keeps pace with what the
 * remaining days require. Every figure comes from the backend's
 * ``financial-summary`` - nothing is recomputed here.
 */
export function FinancialTiles({ summary }) {
  const percent = Number(summary.percent_done ?? 0);
  const varied =
    summary.varied_value !== null &&
    summary.varied_value !== undefined;
  const onPace = summary.pace === "ON_PACE";
  const short = summary.pace === "SHORT_BY";

  return (
    <div className="pm-finance-tiles">
      <section className="kpi-grid kpi-grid--compact pm-finance-tiles__grid">
        <KpiCard
          label="Contract value"
          value={formatMoneyCompact(summary.valued)}
          icon={Wallet}
          helper={
            varied
              ? `As varied · original ${formatMoneyCompact(summary.original_value)}`
              : summary.contract_no
                ? `LOA ${summary.contract_no}`
                : "As awarded"
          }
        />
        <KpiCard
          label="Done up to last bill"
          value={formatMoneyCompact(
            summary.work_done_to_last_bill,
          )}
          icon={Receipt}
          tone="information"
          helper={
            summary.last_bill_no || summary.last_bill_date
              ? `${summary.last_bill_no || "Last bill"} · ${formatDate(summary.last_bill_date)}`
              : "No bill recorded yet"
          }
        />
        <KpiCard
          label="DPR value after last bill"
          value={formatMoneyCompact(
            summary.dpr_value_after_last_bill,
          )}
          icon={TrendingUp}
          tone="success"
          helper={`Total done ${formatMoneyCompact(summary.work_done_total)}`}
        />
        <KpiCard
          label="Balance value"
          value={formatMoneyCompact(summary.balance_value)}
          icon={Banknote}
          tone="warning"
          helper={`${percent}% of the contract done`}
        />
        <KpiCard
          label="Per day required"
          value={
            summary.per_day_required === null
              ? "-"
              : formatMoneyCompact(summary.per_day_required)
          }
          icon={CalendarClock}
          helper={
            summary.days_remaining === null
              ? "End date not set"
              : summary.days_remaining > 0
                ? `${summary.days_remaining} day(s) left`
                : "Contract period has ended"
          }
        />
        <KpiCard
          label="Executed yesterday"
          value={formatMoneyCompact(
            summary.executed_yesterday,
          )}
          icon={Gauge}
          tone={
            onPace
              ? "success"
              : short
                ? "warning"
                : "default"
          }
          helper={
            onPace
              ? "On pace"
              : short
                ? `Short by ${formatMoneyCompact(summary.shortfall)}`
                : `7-day average ${formatMoneyCompact(summary.seven_day_average)}`
          }
        />
      </section>

      <div
        className="pm-finance-progress"
        title={`${percent}% done`}
      >
        <div
          className="pm-finance-progress__fill"
          style={{ width: `${Math.min(percent, 100)}%` }}
        />
      </div>
    </div>
  );
}
