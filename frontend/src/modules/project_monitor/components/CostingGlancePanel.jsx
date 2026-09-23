import {
  AlertTriangle,
  Banknote,
  CalendarDays,
  HardHat,
  TrendingUp,
  Wallet,
} from "lucide-react";

import { KpiCard } from "../../admin/components/KpiCard";
import {
  formatMoneyCompact,
  formatPercent,
  formatQty,
} from "../utils/status";

function marginTone(row) {
  if (!row || row.expense_ratio === null) {
    return "default";
  }
  return row.flagged ? "warning" : "success";
}

function PeriodTiles({ title, row }) {
  if (!row) {
    return null;
  }
  return (
    <div className="pm-costing-period">
      <h3>{title}</h3>
      <section className="kpi-grid kpi-grid--compact pm-finance-tiles__grid">
        <KpiCard
          label="Value of work done"
          value={formatMoneyCompact(row.value)}
          icon={TrendingUp}
          tone="success"
        />
        <KpiCard
          label="Total expense"
          value={formatMoneyCompact(row.total_expense)}
          icon={Wallet}
        />
        <KpiCard
          label="Margin before overheads"
          value={formatMoneyCompact(row.margin)}
          icon={Banknote}
          tone={marginTone(row)}
          helper={
            row.expense_ratio === null
              ? "No value recorded"
              : `Expense is ${formatPercent(Math.round(row.expense_ratio * 100))} of value`
          }
        />
      </section>
    </div>
  );
}

/**
 * "Today at a glance": today, yesterday, month-to-date and the
 * whole-project cumulative, side by side, plus how much labour is on
 * site today - everything from one backend call, nothing recomputed
 * here.
 */
export function CostingGlancePanel({ glance }) {
  if (!glance) {
    return null;
  }

  return (
    <div className="pm-stack">
      {glance.today?.flagged ? (
        <div className="inline-alert inline-alert--warning">
          <AlertTriangle size={16} /> Today&apos;s expense has
          passed 90% of the value of work done.
        </div>
      ) : null}

      <section className="kpi-grid kpi-grid--compact pm-dashboard-kpis">
        <KpiCard
          label="Labour on site today"
          value={formatQty(glance.labour_on_site_today)}
          icon={HardHat}
        />
        <KpiCard
          label="Today's concrete"
          value={`${formatQty(glance.today?.concrete_cum)} cum`}
          icon={CalendarDays}
          helper={
            glance.today?.concrete_source === "STORES"
              ? "Stores figure"
              : glance.today?.concrete_source === "ESTIMATED"
                ? "Estimated from DPR"
                : "Nothing recorded"
          }
        />
      </section>

      <div className="pm-costing-periods">
        <PeriodTiles title="Today" row={glance.today} />
        <PeriodTiles title="Yesterday" row={glance.yesterday} />
        <PeriodTiles
          title="Month to date"
          row={glance.month_to_date}
        />
        <PeriodTiles
          title="Cumulative (whole project)"
          row={glance.cumulative}
        />
      </div>
      {!glance.cumulative ? (
        <p className="pm-timeline-empty">
          Cumulative figures appear once a DPR entry has been made
          for this site.
        </p>
      ) : null}
    </div>
  );
}
