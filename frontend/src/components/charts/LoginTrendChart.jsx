import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { EmptyState } from "../common/EmptyState";

export function LoginTrendChart({
  data = [],
}) {
  if (!data.length) {
    return (
      <EmptyState
        title="No login trend"
        message="Authentication trend data is not available for this period."
      />
    );
  }

  return (
    <div className="chart-container chart-container--wide">
      <ResponsiveContainer
        width="100%"
        height="100%"
      >
        <LineChart
          data={data}
          margin={{
            top: 10,
            right: 15,
            left: -15,
            bottom: 0,
          }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            vertical={false}
          />

          <XAxis
            dataKey="date"
            tick={{ fontSize: 11 }}
            tickFormatter={(value) =>
              new Intl.DateTimeFormat(
                "en-IN",
                {
                  day: "2-digit",
                  month: "short",
                },
              ).format(
                new Date(`${value}T00:00:00`),
              )
            }
          />

          <YAxis
            allowDecimals={false}
            tick={{ fontSize: 12 }}
          />

          <Tooltip />
          <Legend />

          <Line
            type="monotone"
            dataKey="successful"
            name="Successful"
            stroke="#107E3E"
            strokeWidth={2}
            dot={false}
          />

          <Line
            type="monotone"
            dataKey="failed"
            name="Failed"
            stroke="#BB0000"
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
