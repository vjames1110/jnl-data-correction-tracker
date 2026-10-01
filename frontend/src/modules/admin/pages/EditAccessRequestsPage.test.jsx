import {
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { EditAccessRequestsPage } from "./EditAccessRequestsPage";

const hooks = vi.hoisted(() => ({
  listRequests: vi.fn(),
  grant: vi.fn(),
  deny: vi.fn(),
}));

const PENDING_REQUEST = {
  id: "req-1",
  activity: "a1",
  activity_name: "Box raft",
  activity_group_title: "Box structure",
  parent_label: "Br. No. 214",
  site_id: "site-1",
  site_name: "Chunar-Khairahi",
  reason: "Need to fix a typo in % done",
  status: "PENDING",
  requested_by_name: "Asha Rao",
  created_at: "2026-10-01T05:00:00Z",
  decided_by_name: "",
  decided_at: null,
  decision_remarks: "",
  access_until: null,
};

const GRANTED_REQUEST = {
  ...PENDING_REQUEST,
  id: "req-2",
  status: "GRANTED",
  decided_by_name: "Dev Director",
  decided_at: "2026-10-01T06:00:00Z",
  decision_remarks: "Go ahead",
};

vi.mock("../../../hooks/useProjectMonitor", () => ({
  useEditAccessRequests: (params) =>
    hooks.listRequests(params),
  useGrantEditAccessRequest: () => ({
    mutate: hooks.grant,
    isPending: false,
    isError: false,
  }),
  useDenyEditAccessRequest: () => ({
    mutate: hooks.deny,
    isPending: false,
    isError: false,
  }),
}));

describe("EditAccessRequestsPage", () => {
  it("lists a pending request with a Grant and Deny action", () => {
    hooks.listRequests.mockReturnValue({
      data: [PENDING_REQUEST],
      isLoading: false,
      isError: false,
    });

    render(<EditAccessRequestsPage />);

    expect(screen.getByText("Box raft")).toBeInTheDocument();
    expect(screen.getByText("Asha Rao")).toBeInTheDocument();
    expect(
      screen.getByText(/Need to fix a typo/),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Grant 48h" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Deny" }),
    ).toBeInTheDocument();
  });

  it("sends the typed remarks when granting", () => {
    hooks.listRequests.mockReturnValue({
      data: [PENDING_REQUEST],
      isLoading: false,
      isError: false,
    });

    render(<EditAccessRequestsPage />);

    fireEvent.change(
      screen.getByLabelText("Remarks for Box raft"),
      { target: { value: "Go ahead" } },
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Grant 48h" }),
    );

    expect(hooks.grant).toHaveBeenCalledWith({
      requestId: "req-1",
      payload: { remarks: "Go ahead" },
    });
  });

  it("denies with the typed remarks", () => {
    hooks.listRequests.mockReturnValue({
      data: [PENDING_REQUEST],
      isLoading: false,
      isError: false,
    });

    render(<EditAccessRequestsPage />);

    fireEvent.click(
      screen.getByRole("button", { name: "Deny" }),
    );

    expect(hooks.deny).toHaveBeenCalledWith({
      requestId: "req-1",
      payload: { remarks: "" },
    });
  });

  it("shows a decided request's outcome with no actions", () => {
    hooks.listRequests.mockReturnValue({
      data: [GRANTED_REQUEST],
      isLoading: false,
      isError: false,
    });

    render(<EditAccessRequestsPage />);

    const row = screen.getByText("Box raft").closest("tr");
    expect(within(row).getByText("Granted")).toBeInTheDocument();
    expect(
      within(row).getByText(/Dev Director/),
    ).toBeInTheDocument();
    expect(
      within(row).queryByRole("button", { name: "Grant 48h" }),
    ).toBeNull();
  });

  it("shows an empty state when there is nothing to review", () => {
    hooks.listRequests.mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
    });

    render(<EditAccessRequestsPage />);

    expect(
      screen.getByText(/No edit access requests match/),
    ).toBeInTheDocument();
  });

  it("asks for the Pending filter by default", () => {
    hooks.listRequests.mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
    });

    render(<EditAccessRequestsPage />);

    expect(hooks.listRequests).toHaveBeenCalledWith({
      status: "PENDING",
    });
  });

  it("switches the filter when another status tab is chosen", () => {
    hooks.listRequests.mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
    });

    render(<EditAccessRequestsPage />);
    fireEvent.click(screen.getByRole("tab", { name: "Granted" }));

    expect(hooks.listRequests).toHaveBeenLastCalledWith({
      status: "GRANTED",
    });
  });
});
