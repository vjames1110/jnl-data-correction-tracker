import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { EscalationPanel } from "./EscalationPanel";

const hooks = vi.hoisted(() => ({
  list: vi.fn(),
  create: vi.fn(),
  remove: vi.fn(),
}));

vi.mock("../../../hooks/useProjectMonitor", () => ({
  useDprEscalations: () => hooks.list(),
  useCreateDprEscalation: () => ({
    mutateAsync: hooks.create,
    isPending: false,
    isError: false,
  }),
  useDeleteDprEscalation: () => ({
    mutate: hooks.remove,
    isError: false,
  }),
}));

const STEPS = [
  {
    id: "e1",
    effective_from: "2026-08-01",
    percent: "4.000",
    note: "Clause 46",
  },
  {
    id: "e2",
    effective_from: "2026-09-01",
    percent: "6.500",
    note: "",
  },
];

beforeEach(() => {
  hooks.list.mockReturnValue({ data: STEPS });
  hooks.create.mockReset().mockResolvedValue({});
  hooks.remove.mockReset();
  vi.spyOn(window, "confirm").mockReturnValue(true);
});

describe("EscalationPanel", () => {
  it("lists the steps as totals from a date", () => {
    render(<EscalationPanel siteId="s" canEnter />);

    expect(screen.getByText("01-08-2026")).toBeInTheDocument();
    expect(screen.getByText("+4%")).toBeInTheDocument();
    expect(screen.getByText("+6.5%")).toBeInTheDocument();
    expect(screen.getByText("Clause 46")).toBeInTheDocument();
    expect(
      screen.getByText(/replaces the one before it/i),
    ).toBeInTheDocument();
  });

  it("says so when there is no escalation", () => {
    hooks.list.mockReturnValue({ data: [] });
    render(<EscalationPanel siteId="s" canEnter />);

    expect(
      screen.getByText(/no escalation yet/i),
    ).toBeInTheDocument();
  });

  it("adds a step for the site", async () => {
    render(<EscalationPanel siteId="site-1" canEnter />);

    fireEvent.change(screen.getByLabelText("Effective from"), {
      target: { value: "2026-09-20" },
    });
    fireEvent.change(
      screen.getByLabelText("Total escalation %"),
      { target: { value: "8.5" } },
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Add escalation" }),
    );

    expect(hooks.create).toHaveBeenCalledWith({
      site: "site-1",
      effective_from: "2026-09-20",
      percent: "8.5",
      note: "",
    });
  });

  it("deletes a step after confirming", () => {
    render(<EscalationPanel siteId="s" canEnter />);

    fireEvent.click(
      screen.getByRole("button", {
        name: "Delete escalation from 01-08-2026",
      }),
    );

    expect(window.confirm).toHaveBeenCalled();
    expect(hooks.remove).toHaveBeenCalledWith("e1");
  });

  it("is read-only for a viewer", () => {
    render(<EscalationPanel siteId="s" canEnter={false} />);

    expect(screen.getByText("+4%")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Add escalation" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /delete escalation/i }),
    ).not.toBeInTheDocument();
  });
});
