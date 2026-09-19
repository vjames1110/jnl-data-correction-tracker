import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { EmptyState } from "../../../components/common/EmptyState";

// Same colour language as the status chips/progress bars.
const STATUS_SERIES = [
  { key: "done", label: "Complete", color: "#107e3e" },
  {
    key: "in_progress",
    label: "In progress",
    color: "#e9730c",
  },
  { key: "hold", label: "Hold / issue", color: "#9a3412" },
  {
    key: "not_started",
    label: "Not taken up",
    color: "#bb0000",
  },
];

export function ProjectProgressChart({ projects }) {
  const data = projects
    .filter((project) => project.activities.total > 0)
    .map((project) => ({
      name: project.site.site_code,
      ...project.activities,
    }));

  if (!data.length) {
    return (
      <EmptyState
        title="No progress data yet"
        message="Progress by project appears once activities exist."
      />
    );
  }

  return (
    <div
      className="chart-container"
      style={{
        height: Math.max(220, data.length * 44 + 60),
      }}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{
            top: 4,
            right: 16,
            left: 8,
            bottom: 0,
          }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            horizontal={false}
          />
          <XAxis
            type="number"
            allowDecimals={false}
            tick={{ fontSize: 12 }}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={70}
            tick={{ fontSize: 12 }}
          />
          <Tooltip />
          <Legend />
          {STATUS_SERIES.map((series) => (
            <Bar
              key={series.key}
              dataKey={series.key}
              name={series.label}
              stackId="status"
              fill={series.color}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function OverallStatusChart({ activities }) {
  const data = STATUS_SERIES.map((series) => ({
    name: series.label,
    value: activities[series.key],
    color: series.color,
  })).filter((entry) => entry.value > 0);

  if (!data.length) {
    return (
      <EmptyState
        title="No activities yet"
        message="The overall status split appears once activities exist."
      />
    );
  }

  return (
    <div className="chart-container">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius="55%"
            outerRadius="85%"
            paddingAngle={2}
          >
            {data.map((entry) => (
              <Cell
                key={entry.name}
                fill={entry.color}
              />
            ))}
          </Pie>
          <Tooltip />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
