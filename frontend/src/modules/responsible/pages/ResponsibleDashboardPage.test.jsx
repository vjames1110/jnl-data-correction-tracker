import {
  render,
  screen,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { ResponsibleDashboardPage } from "./ResponsibleDashboardPage";

const {
  useAssignmentCountsMock,
  useMyAssignmentsMock,
} = vi.hoisted(() => ({
  useAssignmentCountsMock: vi.fn(),
  useMyAssignmentsMock: vi.fn(),
}));

vi.mock(
  "../../../hooks/useCorrectionRequests",
  () => ({
    useAssignmentCounts: () =>
      useAssignmentCountsMock(),
    useMyAssignments: (...args) =>
      useMyAssignmentsMock(...args),
  }),
);

function renderPage() {
  render(
    <MemoryRouter>
      <ResponsibleDashboardPage />
    </MemoryRouter>,
  );
}

describe("ResponsibleDashboardPage", () => {
  beforeEach(() => {
    useAssignmentCountsMock.mockReset();
    useMyAssignmentsMock.mockReset();
  });

  it("shows a loading state", () => {
    useAssignmentCountsMock.mockReturnValue({
      isLoading: true,
    });
    useMyAssignmentsMock.mockReturnValue({
      isLoading: true,
    });

    renderPage();

    expect(
      screen.getByText(/loading work dashboard/i),
    ).toBeInTheDocument();
  });

  it("shows an error state with retry", () => {
    const refetch = vi.fn();
    useAssignmentCountsMock.mockReturnValue({
      isLoading: false,
      isError: true,
      error: { message: "Counts failed" },
      refetch,
    });
    useMyAssignmentsMock.mockReturnValue({
      isLoading: false,
      isError: false,
      data: { items: [] },
      refetch,
    });

    renderPage();

    expect(
      screen.getByText("Counts failed"),
    ).toBeInTheDocument();
  });

  it("renders assignment counts and rows", () => {
    useAssignmentCountsMock.mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        newly_assigned: 2,
        accepted: 1,
        in_progress: 3,
        on_hold: 1,
        overdue: 1,
        resolved_today: 4,
      },
    });
    useMyAssignmentsMock.mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        items: [
          {
            id: "req-1",
            reference: "DCT-2026-000001",
            current_status: "IN_PROGRESS",
            site_code: "S1",
            site_name: "Site One",
            department_code: "D1",
            department_name: "Dept One",
            voucher_number: "V-100",
            voucher_name: "Sales Voucher",
            sla_deadline: null,
            updated_at: "2026-08-10T10:00:00Z",
            submitted_at: "2026-08-08T10:00:00Z",
          },
        ],
      },
    });

    renderPage();

    expect(
      screen.getByText("DCT-2026-000001"),
    ).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("shows an empty state when there is no assigned work", () => {
    useAssignmentCountsMock.mockReturnValue({
      isLoading: false,
      isError: false,
      data: {},
    });
    useMyAssignmentsMock.mockReturnValue({
      isLoading: false,
      isError: false,
      data: { items: [] },
    });

    renderPage();

    expect(
      screen.getByText(
        /no matching assignments/i,
      ),
    ).toBeInTheDocument();
  });
});
