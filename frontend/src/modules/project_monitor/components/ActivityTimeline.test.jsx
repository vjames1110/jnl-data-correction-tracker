import {
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ActivityTimeline } from "./ActivityTimeline";

function activityWith(comments, id = "activity-1") {
  return { id, comments };
}

const COMMENT = {
  id: 7,
  meeting_date: "2026-09-26",
  text: "Checked",
  created_by_name: "Dev Director",
  created_at: "2026-09-26T10:00:00Z",
};

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

describe("ActivityTimeline - correcting a mistaken meeting date", () => {
  it("offers no edit affordance when the viewer cannot edit", () => {
    render(
      <ActivityTimeline
        activity={activityWith([COMMENT])}
        canEdit={false}
        onEditMeetingDate={vi.fn()}
      />,
    );

    expect(
      screen.queryByLabelText("Correct this meeting date"),
    ).not.toBeInTheDocument();
  });

  it("offers no edit affordance when no handler is given, even if the viewer can edit", () => {
    render(
      <ActivityTimeline
        activity={activityWith([COMMENT])}
        canEdit
      />,
    );

    expect(
      screen.queryByLabelText("Correct this meeting date"),
    ).not.toBeInTheDocument();
  });

  it("opens a date input pre-filled with the current meeting date", () => {
    render(
      <ActivityTimeline
        activity={activityWith([COMMENT])}
        canEdit
        onEditMeetingDate={vi.fn()}
      />,
    );

    fireEvent.click(
      screen.getByLabelText("Correct this meeting date"),
    );

    expect(
      screen.getByLabelText("Meeting date"),
    ).toHaveValue("2026-09-26");
  });

  it("saves the corrected date against the right comment id", () => {
    const onEditMeetingDate = vi.fn();
    render(
      <ActivityTimeline
        activity={activityWith([COMMENT])}
        canEdit
        onEditMeetingDate={onEditMeetingDate}
      />,
    );

    fireEvent.click(
      screen.getByLabelText("Correct this meeting date"),
    );
    fireEvent.change(screen.getByLabelText("Meeting date"), {
      target: { value: "2026-09-19" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(onEditMeetingDate).toHaveBeenCalledWith(
      COMMENT.id,
      "2026-09-19",
      expect.objectContaining({
        onSuccess: expect.any(Function),
        onError: expect.any(Function),
      }),
    );
  });

  it("cancel reverts to the plain display without saving", () => {
    const onEditMeetingDate = vi.fn();
    render(
      <ActivityTimeline
        activity={activityWith([COMMENT])}
        canEdit
        onEditMeetingDate={onEditMeetingDate}
      />,
    );

    fireEvent.click(
      screen.getByLabelText("Correct this meeting date"),
    );
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onEditMeetingDate).not.toHaveBeenCalled();
    expect(
      screen.getByText(/Meeting: 26-09-2026/),
    ).toBeInTheDocument();
  });

  it("offers Request edit access when the save hits the 48-hour window", () => {
    const onEditMeetingDate = vi.fn((id, date, { onError }) =>
      onError({
        message: "You do not have permission to perform this action.",
        errors: { detail: "... the last 48 hours ..." },
      }),
    );
    const onRequestEditAccess = vi.fn();
    render(
      <ActivityTimeline
        activity={activityWith([COMMENT])}
        canEdit
        onEditMeetingDate={onEditMeetingDate}
        onRequestEditAccess={onRequestEditAccess}
        requestEditAccessStatus={{}}
      />,
    );

    fireEvent.click(
      screen.getByLabelText("Correct this meeting date"),
    );
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(
      screen.getByRole("button", { name: "Request edit access" }),
    ).toBeInTheDocument();
  });

  it("shows a plain error for anything other than the 48-hour window", () => {
    const onEditMeetingDate = vi.fn((id, date, { onError }) =>
      onError({ message: "Something went wrong.", errors: {} }),
    );
    render(
      <ActivityTimeline
        activity={activityWith([COMMENT])}
        canEdit
        onEditMeetingDate={onEditMeetingDate}
        onRequestEditAccess={vi.fn()}
      />,
    );

    fireEvent.click(
      screen.getByLabelText("Correct this meeting date"),
    );
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(
      screen.getByText("Something went wrong."),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Request edit access" }),
    ).not.toBeInTheDocument();
  });
});
