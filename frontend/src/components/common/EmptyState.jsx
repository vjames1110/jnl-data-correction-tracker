import { Inbox } from "lucide-react";

export function EmptyState({
  title = "No data available",
  message = "There are no records to display.",
}) {
  return (
    <div className="empty-state">
      <Inbox size={32} />
      <h3>{title}</h3>
      <p>{message}</p>
    </div>
  );
}
