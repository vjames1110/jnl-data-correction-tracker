import { TrendChart } from "./kit/TrendChart";

const SERIES = [
  { key: "successful", label: "Successful", token: "complete" },
  { key: "failed", label: "Failed", token: "critical" },
];

const shortDate = (value) =>
  new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
  }).format(new Date(`${value}T00:00:00`));

export function LoginTrendChart({ data = [] }) {
  return (
    <TrendChart
      data={data}
      xKey="date"
      series={SERIES}
      formatX={shortDate}
      emptyTitle="No login trend"
      emptyMessage="Authentication trend data is not available for this period."
    />
  );
}
