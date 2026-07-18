import {
  render,
  screen,
} from "@testing-library/react";
import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { AdminDashboardPage } from "./AdminDashboardPage";

const {
  useDashboardMock,
  useRecentActivityMock,
} = vi.hoisted(() => ({
  useDashboardMock: vi.fn(),
  useRecentActivityMock: vi.fn(),
}));

vi.mock("../../../hooks/useDashboard", () => ({
  useDashboard: (...args) =>
    useDashboardMock(...args),
  useRecentActivity: (...args) =>
    useRecentActivityMock(...args),
}));

vi.mock("../../../components/charts/RoleDistributionChart", () => ({
  RoleDistributionChart: () => (
    <div>Role Chart</div>
  ),
}));

vi.mock("../../../components/charts/AccountStatusChart", () => ({
  AccountStatusChart: () => (
    <div>Status Chart</div>
  ),
}));

vi.mock("../../../components/charts/LoginTrendChart", () => ({
  LoginTrendChart: () => (
    <div>Trend Chart</div>
  ),
}));

describe("AdminDashboardPage", () => {
  beforeEach(() => {
    useDashboardMock.mockReset();
    useRecentActivityMock.mockReset();
  });

  it("shows the dashboard loading skeleton", () => {
    useDashboardMock.mockReturnValue({
      isLoading: true,
    });
    useRecentActivityMock.mockReturnValue({
      isLoading: false,
      data: {
        items: [],
      },
    });

    render(<AdminDashboardPage />);

    expect(
      screen.getByLabelText(
        /loading admin dashboard/i,
      ),
    ).toBeInTheDocument();
  });

  it("shows dashboard API errors", () => {
    useDashboardMock.mockReturnValue({
      isLoading: false,
      isError: true,
      error: {
        message: "Network unavailable",
      },
      refetch: vi.fn(),
    });
    useRecentActivityMock.mockReturnValue({
      isLoading: false,
    });

    render(<AdminDashboardPage />);

    expect(
      screen.getByText(
        /admin dashboard unavailable/i,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/network unavailable/i),
    ).toBeInTheDocument();
  });
});
