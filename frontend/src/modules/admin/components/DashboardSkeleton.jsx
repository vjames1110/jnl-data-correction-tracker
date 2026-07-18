const kpiItems = Array.from({
  length: 6,
});

export function DashboardSkeleton() {
  return (
    <div
      className="admin-dashboard-page"
      aria-label="Loading admin dashboard"
    >
      <div className="dashboard-skeleton dashboard-skeleton--heading" />

      <section className="kpi-grid">
        {kpiItems.map((_, index) => (
          <div
            className="kpi-card"
            key={index}
          >
            <div className="dashboard-skeleton dashboard-skeleton--line" />
            <div className="dashboard-skeleton dashboard-skeleton--value" />
            <div className="dashboard-skeleton dashboard-skeleton--line dashboard-skeleton--short" />
          </div>
        ))}
      </section>

      <section className="dashboard-chart-grid">
        <div className="surface-card">
          <div className="dashboard-skeleton dashboard-skeleton--chart" />
        </div>
        <div className="surface-card">
          <div className="dashboard-skeleton dashboard-skeleton--chart" />
        </div>
      </section>
    </div>
  );
}
