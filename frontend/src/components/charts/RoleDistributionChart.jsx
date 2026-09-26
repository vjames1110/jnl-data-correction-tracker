import { RankBars } from "./kit/RankBars";

/**
 * Users per role. There are a dozen roles, so ranked bars (longest
 * first, roles nobody holds left out) read better than a pie whose
 * slices would all need a colour.
 */
export function RoleDistributionChart({ data = [] }) {
  return (
    <RankBars
      rows={data.map((item) => ({
        key: item.key,
        label: item.label,
        value: item.count,
      }))}
      valueLabel="users"
      limit={8}
      emptyTitle="No role data"
      emptyMessage="Role distribution will appear after user records are available."
    />
  );
}
