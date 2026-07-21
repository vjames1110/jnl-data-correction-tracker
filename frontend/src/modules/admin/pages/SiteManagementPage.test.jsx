import {
  render,
  screen,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { SiteManagementPage } from "./SiteManagementPage";

const hooks = vi.hoisted(() => ({
  useActivateSiteMock: vi.fn(),
  useCompaniesDropdownMock: vi.fn(),
  useCreateSiteMock: vi.fn(),
  useDeactivateSiteMock: vi.fn(),
  useSiteExportMock: vi.fn(),
  useSitesMock: vi.fn(),
  useUpdateSiteMock: vi.fn(),
}));

vi.mock("../../../hooks/useOrganization", () => ({
  useActivateSite: (...args) =>
    hooks.useActivateSiteMock(...args),
  useCompaniesDropdown: (...args) =>
    hooks.useCompaniesDropdownMock(...args),
  useCreateSite: (...args) =>
    hooks.useCreateSiteMock(...args),
  useDeactivateSite: (...args) =>
    hooks.useDeactivateSiteMock(...args),
  useSiteExport: (...args) =>
    hooks.useSiteExportMock(...args),
  useSites: (...args) =>
    hooks.useSitesMock(...args),
  useUpdateSite: (...args) =>
    hooks.useUpdateSiteMock(...args),
}));

function mockMutations() {
  hooks.useCreateSiteMock.mockReturnValue({
    mutateAsync: vi.fn(),
    isPending: false,
  });
  hooks.useUpdateSiteMock.mockReturnValue({
    mutateAsync: vi.fn(),
    isPending: false,
  });
  hooks.useActivateSiteMock.mockReturnValue({
    mutate: vi.fn(),
  });
  hooks.useDeactivateSiteMock.mockReturnValue({
    mutate: vi.fn(),
  });
}

describe("SiteManagementPage", () => {
  beforeEach(() => {
    Object.values(hooks).forEach((mock) =>
      mock.mockReset(),
    );

    hooks.useCompaniesDropdownMock.mockReturnValue({
      data: [
        {
          id: "company-1",
          code: "JNL",
          label: "Jhajharia Nirman Limited",
        },
      ],
    });
    hooks.useSiteExportMock.mockReturnValue({
      refetch: vi.fn(),
      isFetching: false,
    });
    mockMutations();
  });

  it("renders site table records", () => {
    hooks.useSitesMock.mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        items: [
          {
            id: "site-1",
            company: "company-1",
            company_code: "JNL",
            company_name:
              "Jhajharia Nirman Limited",
            site_code: "BKN",
            site_name: "Bikaner Site",
            project_name: "Solar Park",
            state: "Rajasthan",
            district: "Bikaner",
            is_active: true,
          },
        ],
        meta: {
          pagination: {
            page: 1,
            total_pages: 1,
            has_previous: false,
            has_next: false,
          },
        },
      },
    });

    render(
      <MemoryRouter>
        <SiteManagementPage />
      </MemoryRouter>,
    );

    expect(
      screen.getByText("Bikaner Site"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("BKN"),
    ).toBeInTheDocument();
    expect(
      screen.getAllByText("Active")[0],
    ).toBeInTheDocument();
  });

  it("opens the add site form", async () => {
    hooks.useSitesMock.mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        items: [],
        meta: {},
      },
    });

    render(
      <MemoryRouter>
        <SiteManagementPage />
      </MemoryRouter>,
    );

    await userEvent.click(
      screen.getByRole("button", {
        name: /add site/i,
      }),
    );

    expect(
      screen.getByRole("heading", {
        name: /add site/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText(/company/i),
    ).toBeInTheDocument();
  });
});
