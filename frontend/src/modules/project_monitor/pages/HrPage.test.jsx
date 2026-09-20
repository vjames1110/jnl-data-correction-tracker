import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { HrPage } from "./HrPage";

const hooks = vi.hoisted(() => ({
  useHrAccess: vi.fn(),
  useHrSummary: vi.fn(),
  useLabourEntries: vi.fn(),
  useStaffMembers: vi.fn(),
  useStaffOverrides: vi.fn(),
}));

const mutation = { mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false, isError: false };

vi.mock("../../../hooks/useProjectMonitor", () => ({
  useHrAccess: (...a) => hooks.useHrAccess(...a),
  useHrSummary: (...a) => hooks.useHrSummary(...a),
  useLabourEntries: (...a) => hooks.useLabourEntries(...a),
  useStaffMembers: (...a) => hooks.useStaffMembers(...a),
  useStaffOverrides: (...a) => hooks.useStaffOverrides(...a),
  useCreateLabour: () => mutation,
  useDeleteLabour: () => mutation,
  useCreateStaff: () => mutation,
  useUpdateStaff: () => mutation,
  useDeleteStaff: () => mutation,
  useSaveStaffOverride: () => mutation,
  useDeleteStaffOverride: () => mutation,
  useUploadHr: () => mutation,
  useOverdueCounts: () => ({ data: {} }),
}));

vi.mock("../../../hooks/useOrganization", () => ({
  useSitesDropdown: () => ({
    data: [{ id: "site-1", code: "CHK", label: "Chunar" }],
  }),
}));

vi.mock("../../../hooks/useAuth", () => ({
  useAuth: () => ({ user: { role: "PROJECT_MANAGER" } }),
}));

const SUMMARY = {
  month: "2026-09",
  days: [
    {
      date: "2026-09-01",
      labour_nos: "5.00",
      labour_cost: "4000.00",
      staff_cost: "1000.00",
      total: "5000.00",
    },
  ],
  totals: {
    labour_man_days: "5.00",
    labour_cost: "4000.00",
    staff_cost: "1000.00",
    total: "5000.00",
  },
  labour_by_category: [],
};

function renderPage() {
  render(
    <MemoryRouter initialEntries={["/project-manager/hr?site=site-1"]}>
      <HrPage />
    </MemoryRouter>,
  );
}

describe("HrPage", () => {
  beforeEach(() => {
    hooks.useHrSummary.mockReturnValue({ data: SUMMARY });
    hooks.useLabourEntries.mockReturnValue({ data: [] });
    hooks.useStaffMembers.mockReturnValue({ data: [] });
    hooks.useStaffOverrides.mockReturnValue({ data: [] });
  });

  it("explains the missing access to an unassigned Project Manager", () => {
    hooks.useHrAccess.mockReturnValue({
      data: { can_view: false, can_enter: false },
    });
    renderPage();

    expect(
      screen.getByText("No access to this site's HR data"),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("tab", { name: /staff/i }),
    ).toBeNull();
  });

  it("shows the cost table to someone who can view", () => {
    hooks.useHrAccess.mockReturnValue({
      data: { can_view: true, can_enter: false },
    });
    renderPage();

    expect(
      screen.getByText("HR cost this month"),
    ).toBeInTheDocument();
  });

  it("hides every entry form from a view-only user", () => {
    hooks.useHrAccess.mockReturnValue({
      data: { can_view: true, can_enter: false },
    });
    renderPage();

    screen.getByRole("tab", { name: /labour/i }).click();
    expect(
      screen.queryByRole("button", { name: /add labour/i }),
    ).toBeNull();
  });

  it("offers the entry form to the assigned HR owner", async () => {
    hooks.useHrAccess.mockReturnValue({
      data: { can_view: true, can_enter: true },
    });
    renderPage();

    screen.getByRole("tab", { name: /labour/i }).click();
    expect(
      await screen.findByRole("button", {
        name: /add labour/i,
      }),
    ).toBeInTheDocument();
  });
});
