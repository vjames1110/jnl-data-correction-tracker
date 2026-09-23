import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ChainageSegmentsList } from "./ChainageSegmentsList";

const SEGMENTS = [
  {
    id: "seg-1",
    from_chainage_km: "0.000",
    to_chainage_km: "5.000",
    vendor: "ABC Infra",
  },
  {
    id: "seg-2",
    from_chainage_km: "5.000",
    to_chainage_km: "9.000",
    vendor: "",
  },
];

describe("ChainageSegmentsList", () => {
  it("lists every segment, with an unassigned stretch called out", () => {
    render(
      <ChainageSegmentsList
        segments={SEGMENTS}
        canEdit={false}
        onAddSegment={vi.fn()}
        onDeleteSegment={vi.fn()}
      />,
    );

    expect(screen.getByText("ABC Infra")).toBeInTheDocument();
    expect(screen.getByText("Not assigned")).toBeInTheDocument();
  });

  it("says so when nothing has been recorded", () => {
    render(
      <ChainageSegmentsList
        segments={[]}
        canEdit={false}
        onAddSegment={vi.fn()}
        onDeleteSegment={vi.fn()}
      />,
    );

    expect(
      screen.getByText("No chainage segments recorded yet."),
    ).toBeInTheDocument();
  });

  it("hides the add and delete controls without edit access", () => {
    render(
      <ChainageSegmentsList
        segments={SEGMENTS}
        canEdit={false}
        onAddSegment={vi.fn()}
        onDeleteSegment={vi.fn()}
      />,
    );

    expect(
      screen.queryByRole("button", { name: /add chainage segment/i }),
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: /delete chainage segment/i }),
    ).toBeNull();
  });

  it("submits a new segment with the vendor left blank", () => {
    const onAddSegment = vi.fn((_, options) => options?.onSuccess?.());
    render(
      <ChainageSegmentsList
        segments={[]}
        canEdit
        onAddSegment={onAddSegment}
        addSegmentStatus={{ isPending: false, isError: false }}
        onDeleteSegment={vi.fn()}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: /add chainage segment/i }),
    );
    fireEvent.change(screen.getByLabelText("From (km)"), {
      target: { value: "10" },
    });
    fireEvent.change(screen.getByLabelText("To (km)"), {
      target: { value: "12" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(onAddSegment).toHaveBeenCalledWith(
      {
        from_chainage_km: "10",
        to_chainage_km: "12",
        vendor: "",
      },
      expect.any(Object),
    );
  });

  it("deletes a segment", () => {
    const onDeleteSegment = vi.fn();
    render(
      <ChainageSegmentsList
        segments={SEGMENTS}
        canEdit
        onAddSegment={vi.fn()}
        onDeleteSegment={onDeleteSegment}
      />,
    );

    fireEvent.click(
      screen.getAllByRole("button", {
        name: /delete chainage segment/i,
      })[0],
    );

    expect(onDeleteSegment).toHaveBeenCalledWith("seg-1");
  });
});
