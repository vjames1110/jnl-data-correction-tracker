import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { GirderJobWorkspace } from "./GirderJobWorkspace";
import { handlers, row } from "./workspaceFixtures";

const JOB = {
  id: "j1",
  bridge_name: "Br. No. 310",
  groups: [
    {
      group_order: 0,
      group_title: "Approvals",
      group_subtitle: "",
      rows: [row("g1", "GAD Approval", "COMPLETE", { is_doc: true })],
    },
  ],
  spans: [
    {
      id: "sp1",
      label: "S1",
      girder_type: "Welded plate girder",
      span_length_m: "24.40",
      drawing_no: "RDSO/B-1",
      vendor: "ABC Steel",
      po_number: "PO-9",
      overall_progress: { done: 1, total: 3 },
      groups: [
        {
          group_order: 0,
          group_title: "Girder",
          group_subtitle: "",
          rows: [row("f1", "Fabrication", "COMPLETE")],
        },
        {
          group_order: 1,
          group_title: "Bearings",
          group_subtitle: "",
          rows: [row("f2", "Bearing supply", "NOT_STARTED")],
        },
      ],
    },
    {
      id: "sp2",
      label: "S2",
      girder_type: "",
      span_length_m: null,
      drawing_no: "",
      vendor: "",
      po_number: "",
      overall_progress: { done: 0, total: 1 },
      groups: [
        {
          group_order: 0,
          group_title: "Girder",
          group_subtitle: "",
          rows: [row("h1", "Launching", "NOT_STARTED")],
        },
      ],
    },
  ],
};

function renderWorkspace(props = {}) {
  render(
    <GirderJobWorkspace
      job={JOB}
      metaLine="Ch. 15.500 km"
      onReviewAll={vi.fn()}
      reviewAllStatus={{ isPending: false }}
      onUpdateSpan={vi.fn()}
      updateSpanStatus={{ isPending: false }}
      {...handlers()}
      {...props}
    />,
  );
}

describe("GirderJobWorkspace", () => {
  it("has a segment for the bridge GAD and one per span", () => {
    renderWorkspace();

    expect(
      screen.getByRole("tab", { name: "Bridge GAD" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /S1/ })).toHaveTextContent("1/3");
    expect(screen.getByRole("tab", { name: /S2/ })).toHaveTextContent("0/1");
    expect(screen.getByText("GAD Approval")).toBeInTheDocument();
  });

  it("opens a span with its own details and chains as segments", () => {
    renderWorkspace();

    fireEvent.click(screen.getByRole("tab", { name: /S1/ }));

    expect(screen.getByText(/Vendor: ABC Steel/)).toBeInTheDocument();
    expect(screen.getByText(/PO: PO-9/)).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Bearings/ })).toBeInTheDocument();
    expect(screen.getByText("Fabrication")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: /Bearings/ }));
    expect(screen.getByText("Bearing supply")).toBeInTheDocument();
  });

  it("edits a span vendor, PO and drawing number in place", () => {
    const onUpdateSpan = vi.fn();
    renderWorkspace({ onUpdateSpan });

    fireEvent.click(screen.getByRole("tab", { name: /S1/ }));
    fireEvent.click(
      screen.getByRole("button", { name: /edit vendor/i }),
    );
    fireEvent.change(screen.getByLabelText("Vendor"), {
      target: { value: "New Steel" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(onUpdateSpan).toHaveBeenCalledWith(
      "sp1",
      { vendor: "New Steel", po_number: "PO-9", drawing_no: "RDSO/B-1" },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
  });

  it("does not offer span editing to someone who cannot edit", () => {
    renderWorkspace({ canEdit: false });

    fireEvent.click(screen.getByRole("tab", { name: /S1/ }));

    expect(
      screen.queryByRole("button", { name: /edit vendor/i }),
    ).toBeNull();
  });

  it("opens on the first span when there is no bridge-level sheet", () => {
    renderWorkspace({ job: { ...JOB, groups: [] } });

    expect(screen.queryByRole("tab", { name: "Bridge GAD" })).toBeNull();
    expect(screen.getByText(/Vendor: ABC Steel/)).toBeInTheDocument();
  });

  it("closes an open row when the section changes", () => {
    const onSelectActivity = vi.fn();
    renderWorkspace({ onSelectActivity });

    fireEvent.click(screen.getByRole("tab", { name: /S2/ }));

    expect(onSelectActivity).toHaveBeenCalledWith(null);
  });
});
