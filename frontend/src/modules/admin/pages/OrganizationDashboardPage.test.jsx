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

import { OrganizationDashboardPage } from "./OrganizationDashboardPage";

const {
  useOrganizationDashboardMock,
} = vi.hoisted(() => ({
  useOrganizationDashboardMock: vi.fn(),
}));

vi.mock("../../../hooks/useOrganization", () => ({
  useOrganizationDashboard: (...args) =>
    useOrganizationDashboardMock(...args),
}));

describe("OrganizationDashboardPage", () => {
  beforeEach(() => {
    useOrganizationDashboardMock.mockReset();
  });

  it("shows organization master KPIs", () => {
    useOrganizationDashboardMock.mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        summary: {
          total_sites: 3,
          active_sites: 2,
          departments: 5,
          designations: 8,
          director_mappings: 1,
          missing_hod_mappings: 4,
        },
        sites: [
          {
            id: "site-1",
            site_code: "BKN",
            site_name: "Bikaner Site",
            state: "Rajasthan",
            district: "Bikaner",
            is_active: true,
            site_hod: null,
          },
        ],
        departments: [
          {
            id: "department-1",
            department_code: "FIN",
            department_name: "Finance",
            department_hod: null,
          },
        ],
      },
    });

    render(
      <MemoryRouter>
        <OrganizationDashboardPage />
      </MemoryRouter>,
    );

    expect(
      screen.getByText("Total Sites"),
    ).toBeInTheDocument();
    expect(
      screen.getAllByText("Bikaner Site")[0],
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", {
        name: /manage sites/i,
      }),
    ).toHaveAttribute(
      "href",
      "/admin/organization/sites",
    );
  });

  it("shows dashboard loading state", () => {
    useOrganizationDashboardMock.mockReturnValue({
      isLoading: true,
    });

    render(
      <MemoryRouter>
        <OrganizationDashboardPage />
      </MemoryRouter>,
    );

    expect(
      screen.getByText(
        /loading organization dashboard/i,
      ),
    ).toBeInTheDocument();
  });
});
