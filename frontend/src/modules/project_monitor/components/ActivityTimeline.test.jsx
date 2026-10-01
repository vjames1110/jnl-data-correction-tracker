import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ActivityTimeline } from "./ActivityTimeline";

function activityWith(comments) {
  return { comments };
}

describe("ActivityTimeline", () => {
  it("shows no updates recorded when there is no history", () => {
    render(<ActivityTimeline activity={activityWith([])} />);

    expect(
      screen.getByText("No meeting updates recorded yet."),
    ).toBeInTheDocument();
  });

  it("shows both the meeting date and when the update was actually logged", () => {
    render(
      <ActivityTimeline
        activity={activityWith([
          {
            id: 1,
            meeting_date: "2026-09-26",
            text: "Checked",
            created_by_name: "Dev Director",
            created_at: "2026-09-26T10:00:00Z",
          },
        ])}
      />,
    );

    expect(screen.getByText(/Meeting: 26-09-2026/)).toBeInTheDocument();
    expect(screen.getByText(/^Logged /)).toBeInTheDocument();
  });

  it("puts the latest meeting first", () => {
    render(
      <ActivityTimeline
        activity={activityWith([
          {
            id: 1,
            meeting_date: "2026-09-10",
            text: "First update",
            created_by_name: "PM One",
            created_at: "2026-09-10T09:00:00Z",
          },
          {
            id: 2,
            meeting_date: "2026-09-20",
            text: "Second update",
            created_by_name: "PM Two",
            created_at: "2026-09-20T09:00:00Z",
          },
        ])}
      />,
    );

    const items = screen.getAllByText(/update$/i);
    expect(items[0]).toHaveTextContent("Second update");
    expect(items[1]).toHaveTextContent("First update");
  });

  it("breaks a tie on the same meeting by actual logging order, latest first", () => {
    render(
      <ActivityTimeline
        activity={activityWith([
          {
            id: 1,
            meeting_date: "2026-09-26",
            text: "Logged earlier",
            created_by_name: "PM One",
            created_at: "2026-09-26T09:00:00Z",
          },
          {
            id: 2,
            meeting_date: "2026-09-26",
            text: "Logged later",
            created_by_name: "PM Two",
            created_at: "2026-09-26T11:00:00Z",
          },
        ])}
      />,
    );

    const items = screen.getAllByText(/^Logged (earlier|later)$/);
    expect(items[0]).toHaveTextContent("Logged later");
    expect(items[1]).toHaveTextContent("Logged earlier");
  });
});
