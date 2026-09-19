import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { ProjectDashboardPage } from "./ProjectDashboardPage";

const {
  useProjectDashboardMock,
  useDueTrackerMock,
  useOverdueCountsMock,
} = vi.hoisted(() => ({
  useProjectDashboardMock: vi.fn(),
  useDueTrackerMock: vi.fn(),
  useOverdueCountsMock: vi.fn(),
}));

vi.mock("../../../hooks/useProjectMonitor", () => ({
  useProjectDashboard: (...args) =>
    useProjectDashboardMock(...args),
  useDueTracker: (...args) =>
    useDueTrackerMock(...args),
  useOverdueCounts: (...args) =>
    useOverdueCountsMock(...args),
}));

vi.mock("../../../hooks/useAuth", () => ({
  useAuth: () => ({
    user: { role: "DIRECTOR" },
  }),
}));

// Recharts sizes itself through ResizeObserver, which jsdom lacks.
globalThis.ResizeObserver =
  globalThis.ResizeObserver ||
  class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };

function project(overrides = {}) {
  return {
    site: {
      id: "site-1",
      site_code: "CHK",
      site_name: "Chunar-Khairahi",
      project_name: "Chunar Doubling",
      client_or_section: "NCR Prayagraj",
      site_director_name: "A. Director",
      project_value: "125000000.00",
      start_date: "2026-01-01",
      end_date: "2026-12-31",
      effective_end_date: "2027-03-31",
      days_remaining: 10,
      countdown_status: "RED",
    },
    activities: {
      total: 40,
      done: 10,
      in_progress: 5,
      hold: 2,
      not_started: 23,
      percent_complete: 25,
    },
    modules: {
      structures: { total: 30, done: 8 },
      buildings: { total: 10, done: 2 },
      girders: { total: 0, done: 0 },
      action_items: { total: 0, done: 0 },
    },
    linear: { done_m: 500, scope_m: 2000, percent: 25 },
    overdue: { total: 3, action_items: 1 },
    ...overrides,
  };
}

const DASHBOARD = {
  generated_on: "2026-09-19",
  totals: {
    projects: 1,
    hidden_empty_sites: 2,
    activities: {
      total: 40,
      done: 10,
      in_progress: 5,
      hold: 2,
      not_started: 23,
      percent_complete: 25,
    },
    overdue: 3,
    overdue_action_items: 1,
    countdown: { GREEN: 0, ORANGE: 0, RED: 1, NONE: 0 },
    linear: { done_m: 500, scope_m: 2000 },
  },
  projects: [project()],
};

function renderPage() {
  render(
    <MemoryRouter>
      <ProjectDashboardPage />
    </MemoryRouter>,
  );
}

describe("ProjectDashboardPage", () => {
  beforeEach(() => {
    useProjectDashboardMock.mockReset();
    useDueTrackerMock.mockReset();
    useOverdueCountsMock.mockReset();
    useOverdueCountsMock.mockReturnValue({ data: undefined });
    useDueTrackerMock.mockReturnValue({
      isLoading: false,
      isError: false,
      data: { rows: [], total: 0, truncated: false },
    });
  });

  it("shows headline KPIs and one row per project", () => {
    useProjectDashboardMock.mockReturnValue({
      isLoading: false,
      isError: false,
      data: DASHBOARD,
    });

    renderPage();

    expect(
      screen.getByText("Projects monitored"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("2 site(s) with no data hidden"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("10 of 40 activities complete"),
    ).toBeInTheDocument();

    const link = screen.getByRole("link", { name: "Open" });
    expect(link).toHaveAttribute(
      "href",
      "/director/project-monitor?site=site-1",
    );
  });

  it("includes the print-only combined pack", () => {
    useProjectDashboardMock.mockReturnValue({
      isLoading: false,
      isError: false,
      data: DASHBOARD,
    });

    renderPage();

    const pack = screen
      .getByText("Project Monitoring - All Projects")
      .closest(".pm-pack");
    expect(pack).not.toBeNull();
    expect(
      within(pack).getByText("Module-wise completion"),
    ).toBeInTheDocument();
    expect(within(pack).getByText("8/30")).toBeInTheDocument();
  });

  it("shows an empty state when nothing is monitored", () => {
    useProjectDashboardMock.mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        ...DASHBOARD,
        totals: { ...DASHBOARD.totals, projects: 0 },
        projects: [],
      },
    });

    renderPage();

    expect(
      screen.getByText(
        "No projects are being monitored yet",
      ),
    ).toBeInTheDocument();
  });

  it("shows an error state with retry when loading fails", () => {
    useProjectDashboardMock.mockReturnValue({
      isLoading: false,
      isError: true,
      error: { message: "Boom" },
      refetch: vi.fn(),
    });

    renderPage();

    expect(
      screen.getByText("Dashboard unavailable"),
    ).toBeInTheDocument();
  });
});
