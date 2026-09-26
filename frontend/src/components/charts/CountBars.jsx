import { RankBars } from "./kit/RankBars";

/**
 * "How many, per category" for the analytics pages: rows shaped like
 * the API's `[{ <nameKey>: "Site A", count: 12 }]`, drawn as ranked
 * bars in the shared chart style.
 */
export function CountBars({
  data = [],
  nameKey,
  dataKey = "count",
  valueLabel = "requests",
  emptyTitle = "Nothing to show yet",
  emptyMessage = "There is no data for this yet.",
  limit,
}) {
  return (
    <RankBars
      rows={data.map((item, index) => ({
        key: `${item[nameKey]}-${index}`,
        label: String(item[nameKey] ?? "-"),
        value: Number(item[dataKey]) || 0,
      }))}
      valueLabel={valueLabel}
      emptyTitle={emptyTitle}
      emptyMessage={emptyMessage}
      limit={limit}
    />
  );
}
