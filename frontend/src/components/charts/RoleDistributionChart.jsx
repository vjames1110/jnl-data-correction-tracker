import {
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

import { EmptyState } from "../common/EmptyState";

const chartColors = [
  "#0A6ED1",
  "#107E3E",
  "#E9730C",
  "#6A6D70",
  "#7B3FF2",
];

export function RoleDistributionChart({
  data = [],
}) {
  if (!data.length) {
    return (
      <EmptyState
        title="No role data"
        message="Role distribution will appear after user records are available."
      />
    );
  }

  return (
    <div className="chart-container">
      <ResponsiveContainer
        width="100%"
        height="100%"
      >
        <PieChart>
          <Pie
            data={data}
            dataKey="count"
            nameKey="label"
            innerRadius={58}
            outerRadius={88}
            paddingAngle={2}
          >
            {data.map((item, index) => (
              <Cell
                key={item.key}
                fill={
                  chartColors[
                    index %
                      chartColors.length
                  ]
                }
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
