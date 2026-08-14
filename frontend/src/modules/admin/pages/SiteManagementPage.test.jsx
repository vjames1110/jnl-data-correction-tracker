import {
  render,
  screen,
  waitFor,
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
  useDownloadSiteTemplateMock: vi.fn(),
  useExportSiteFailedRowsMock: vi.fn(),
  useImportSitesMock: vi.fn(),
  usePreviewSiteImportMock: vi.fn(),
  useSiteExportMock: vi.fn(),
  useSiteImportColumnsMock: vi.fn(),
  useSitesMock: vi.fn(),
  useUpdateSiteMock: vi.fn(),
  useUsersDropdownMock: vi.fn(),
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
  useDownloadSiteTemplate: (...args) =>
    hooks.useDownloadSiteTemplateMock(...args),
  useExportSiteFailedRows: (...args) =>
    hooks.useExportSiteFailedRowsMock(...args),
  useImportSites: (...args) =>
    hooks.useImportSitesMock(...args),
  usePreviewSiteImport: (...args) =>
    hooks.usePreviewSiteImportMock(...args),
  useSiteExport: (...args) =>
    hooks.useSiteExportMock(...args),
  useSiteImportColumns: (...args) =>
    hooks.useSiteImportColumnsMock(...args),
  useSites: (...args) =>
    hooks.useSitesMock(...args),
  useUpdateSite: (...args) =>
    hooks.useUpdateSiteMock(...args),
  useUsersDropdown: (...args) =>
    hooks.useUsersDropdownMock(...args),
}));

function mockMutations() {
  const createSite = vi.fn();

  hooks.useCreateSiteMock.mockReturnValue({
    mutateAsync: createSite,
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
  hooks.useDownloadSiteTemplateMock.mockReturnValue({
    mutateAsync: vi.fn(),
    isPending: false,
  });
  hooks.usePreviewSiteImportMock.mockReturnValue({
    mutateAsync: vi.fn(),
    isPending: false,
  });
  hooks.useImportSitesMock.mockReturnValue({
    mutateAsync: vi.fn(),
    isPending: false,
  });
  hooks.useExportSiteFailedRowsMock.mockReturnValue({
    mutateAsync: vi.fn(),
    isPending: false,
  });
  hooks.useSiteImportColumnsMock.mockReturnValue({
    data: {
      columns: [],
      required_columns: [],
    },
  });

  return { createSite };
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
    hooks.useUsersDropdownMock.mockReturnValue({
      data: [
        {
          id: "director-1",
          label: "DIR001 - Site Director",
        },
        {
          id: "pm-1",
          label: "PM001 - Project Manager",
        },
      ],
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
    const { createSite } = mockMutations();

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

    await userEvent.selectOptions(
      screen.getByLabelText(/company/i),
      "company-1",
    );
    await userEvent.type(
      screen.getByLabelText(/^site code$/i),
      "BKN",
    );
    await userEvent.type(
      screen.getByLabelText(/site name/i),
      "Bikaner Site",
    );
    await userEvent.selectOptions(
      screen.getByLabelText(/^director$/i),
      "director-1",
    );
    await userEvent.selectOptions(
      screen.getByLabelText(/project manager/i),
      "pm-1",
    );
    await userEvent.click(
      screen.getByRole("button", {
        name: /save site/i,
      }),
    );

    await waitFor(() => {
      expect(createSite).toHaveBeenCalledWith(
        expect.objectContaining({
          company: "company-1",
          site_code: "BKN",
          site_name: "Bikaner Site",
          site_director: "director-1",
          site_hod: "pm-1",
        }),
      );
    });
  });
});
