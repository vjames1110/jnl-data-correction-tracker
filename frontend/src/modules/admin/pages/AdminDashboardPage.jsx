import { useState } from "react";
import {
  Activity,
  KeyRound,
  LockKeyhole,
  ShieldAlert,
  UserCheck,
  Users,
} from "lucide-react";

import { AccountStatusChart } from "../../../components/charts/AccountStatusChart";
import { LoginTrendChart } from "../../../components/charts/LoginTrendChart";
import { RoleDistributionChart } from "../../../components/charts/RoleDistributionChart";
import { ErrorState } from "../../../components/common/ErrorState";
import { AppLoader } from "../../../components/common/AppLoader";
import { SurfaceCard } from "../../../components/common/SurfaceCard";
import {
  useDashboard,
  useRecentActivity,
} from "../../../hooks/useDashboard";
import { KpiCard } from "../components/KpiCard";
import { RecentActivityTable } from "../components/RecentActivityTable";
import { DashboardSkeleton } from "../components/DashboardSkeleton";

const dashboardPeriods = [
  {
    value: "7d",
    label: "Last 7 days",
  },
  {
    value: "30d",
    label: "Last 30 days",
  },
  {
    value: "90d",
    label: "Last 90 days",
  },
];

export function AdminDashboardPage() {
  const [period, setPeriod] =
    useState("30d");

  const dashboardQuery =
    useDashboard(period);

  const activityQuery =
    useRecentActivity(10);

  if (dashboardQuery.isLoading) {
    return <DashboardSkeleton />;
  }

  if (dashboardQuery.isError) {
    return (
      <ErrorState
        title="Admin dashboard unavailable"
        message={
          dashboardQuery.error?.message
        }
        onRetry={dashboardQuery.refetch}
      />
    );
  }

  const dashboard = dashboardQuery.data;
  const summary = dashboard?.summary;

  return (
    <div className="admin-dashboard-page">
      <div className="page-heading">
        <div>
          <span className="page-eyebrow">
            Administration Overview
          </span>

          <h1>Admin Dashboard</h1>

          <p>
            Monitor user accounts,
            authentication activity and system
            access across the platform.
          </p>
        </div>

        <label className="period-selector">
          <span>Reporting period</span>

          <select
            value={period}
            onChange={(event) =>
              setPeriod(event.target.value)
            }
          >
            {dashboardPeriods.map((item) => (
              <option
                key={item.value}
                value={item.value}
              >
                {item.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <section className="kpi-grid">
        <KpiCard
          label="Total Users"
          value={summary?.total_users ?? 0}
          icon={Users}
          helper="All registered system accounts"
        />

        <KpiCard
          label="Active Users"
          value={summary?.active_users ?? 0}
          icon={UserCheck}
          tone="success"
          helper="Active and permitted accounts"
        />

        <KpiCard
          label="Locked Accounts"
          value={summary?.locked_users ?? 0}
          icon={LockKeyhole}
          tone="warning"
          helper="Accounts requiring review"
        />

        <KpiCard
          label="Temporary Passwords"
          value={
            summary?.temporary_password_users ??
            0
          }
          icon={KeyRound}
          tone="information"
          helper="Password change still pending"
        />

        <KpiCard
          label="Failed Logins"
          value={summary?.failed_logins ?? 0}
          icon={ShieldAlert}
          tone="error"
          helper={`During the selected ${dashboard?.period?.days ?? 0}-day period`}
        />

        <KpiCard
          label="Login Success Rate"
          value={`${summary?.login_success_rate ?? 0}%`}
          icon={Activity}
          tone="success"
          helper="Successful authentication attempts"
        />
      </section>

      <section className="dashboard-chart-grid">
        <SurfaceCard title="User Role Distribution">
          <RoleDistributionChart
            data={
              dashboard?.role_distribution ??
              []
            }
          />
        </SurfaceCard>

        <SurfaceCard title="Account Status Distribution">
          <AccountStatusChart
            data={
              dashboard
                ?.account_status_distribution ??
              []
            }
          />
        </SurfaceCard>
      </section>

      <SurfaceCard title="Authentication Trend">
        <LoginTrendChart
          data={dashboard?.login_trend ?? []}
        />
      </SurfaceCard>

      <SurfaceCard title="Recent Authentication Activity">
        {activityQuery.isLoading ? (
          <AppLoader label="Loading activity..." />
        ) : activityQuery.isError ? (
          <ErrorState
            message={
              activityQuery.error?.message
            }
            onRetry={activityQuery.refetch}
          />
        ) : (
          <RecentActivityTable
            items={
              activityQuery.data?.items ?? []
            }
          />
        )}
      </SurfaceCard>
    </div>
  );
}
