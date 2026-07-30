import {
  BriefcaseBusiness,
  CheckCircle2,
  Clock3,
  PauseCircle,
  PlayCircle,
  TimerReset,
} from "lucide-react";

import { SurfaceCard } from "../../../components/common/SurfaceCard";

const dashboardCards = [
  {
    key: "new",
    label: "Newly Assigned",
    value: 0,
    icon: BriefcaseBusiness,
  },
  {
    key: "accepted",
    label: "Accepted",
    value: 0,
    icon: CheckCircle2,
  },
  {
    key: "progress",
    label: "In Progress",
    value: 0,
    icon: PlayCircle,
  },
  {
    key: "hold",
    label: "On Hold",
    value: 0,
    icon: PauseCircle,
    warning: true,
  },
  {
    key: "overdue",
    label: "Overdue",
    value: 0,
    icon: TimerReset,
    warning: true,
  },
  {
    key: "resolved",
    label: "Resolved Today",
    value: 0,
    icon: Clock3,
  },
];

function WorkKpiCard({
  icon: Icon,
  label,
  value,
  warning,
}) {
  return (
    <div
      className={
        warning
          ? "user-kpi-card user-kpi-card--warning"
          : "user-kpi-card"
      }
    >
      <div className="user-kpi-card__header">
        <span>{label}</span>
        <Icon size={16} />
      </div>
      <strong>{value}</strong>
    </div>
  );
}

export function ResponsibleDashboardPage() {
  return (
    <div className="responsible-page">
      <div className="page-heading">
        <div>
          <span className="page-eyebrow">
            Responsible Person Portal
          </span>
          <h1>Work Dashboard</h1>
          <p>
            Operational view for assigned ERP
            correction work.
          </p>
        </div>
      </div>

      <div className="user-kpi-grid responsible-kpi-grid">
        {dashboardCards.map((card) => (
          <WorkKpiCard key={card.key} {...card} />
        ))}
      </div>

      <SurfaceCard title="Assigned Work">
        <div className="table-empty-state">
          Assigned work will appear here after Phase
          13.3 connects the assignment list.
        </div>
      </SurfaceCard>
    </div>
  );
}
