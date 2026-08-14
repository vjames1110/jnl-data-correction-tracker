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

import { ErpFieldConfigurationPage } from "./ErpFieldConfigurationPage";
import { ErpImportExportPage } from "./ErpImportExportPage";
import { ErpResponsibleMappingPage } from "./ErpResponsibleMappingPage";

const hooks = vi.hoisted(() => ({
  useActivateErpRequestFieldConfigurationMock:
    vi.fn(),
  useActivateErpResponsiblePersonMappingMock:
    vi.fn(),
  useCreateErpRequestFieldConfigurationMock:
    vi.fn(),
  useCreateErpResponsiblePersonMappingMock:
    vi.fn(),
  useDeactivateErpRequestFieldConfigurationMock:
    vi.fn(),
  useDeactivateErpResponsiblePersonMappingMock:
    vi.fn(),
  useDepartmentsDropdownMock: vi.fn(),
  useErpModuleExportMock: vi.fn(),
  useErpModulesDropdownMock: vi.fn(),
  useErpPrioritiesDropdownMock: vi.fn(),
  useErpPriorityExportMock: vi.fn(),
  useErpReasonCategoriesDropdownMock:
    vi.fn(),
  useErpReasonCategoryExportMock: vi.fn(),
  useErpRequestFieldConfigurationExportMock:
    vi.fn(),
  useErpRequestFieldConfigurationsMock:
    vi.fn(),
  useErpResponsiblePersonMappingExportMock:
    vi.fn(),
  useErpResponsiblePersonMappingsMock:
    vi.fn(),
  useErpVoucherTypeExportMock: vi.fn(),
  useErpVoucherTypesDropdownMock: vi.fn(),
  useErpWorkTypeExportMock: vi.fn(),
  useErpWorkTypesDropdownMock: vi.fn(),
  useImportErpMastersMock: vi.fn(),
  useSitesDropdownMock: vi.fn(),
  useUpdateErpRequestFieldConfigurationMock:
    vi.fn(),
  useUpdateErpResponsiblePersonMappingMock:
    vi.fn(),
  useUsersDropdownMock: vi.fn(),
}));

vi.mock("../../../hooks/useErp", () => ({
  useActivateErpRequestFieldConfiguration: (
    ...args
  ) =>
    hooks.useActivateErpRequestFieldConfigurationMock(
      ...args,
    ),
  useActivateErpResponsiblePersonMapping: (
    ...args
  ) =>
    hooks.useActivateErpResponsiblePersonMappingMock(
      ...args,
    ),
  useCreateErpRequestFieldConfiguration: (
    ...args
  ) =>
    hooks.useCreateErpRequestFieldConfigurationMock(
      ...args,
    ),
  useCreateErpResponsiblePersonMapping: (
    ...args
  ) =>
    hooks.useCreateErpResponsiblePersonMappingMock(
      ...args,
    ),
  useDeactivateErpRequestFieldConfiguration: (
    ...args
  ) =>
    hooks.useDeactivateErpRequestFieldConfigurationMock(
      ...args,
    ),
  useDeactivateErpResponsiblePersonMapping: (
    ...args
  ) =>
    hooks.useDeactivateErpResponsiblePersonMappingMock(
      ...args,
    ),
  useErpModuleExport: (...args) =>
    hooks.useErpModuleExportMock(...args),
  useErpModulesDropdown: (...args) =>
    hooks.useErpModulesDropdownMock(...args),
  useErpPrioritiesDropdown: (...args) =>
    hooks.useErpPrioritiesDropdownMock(...args),
  useErpPriorityExport: (...args) =>
    hooks.useErpPriorityExportMock(...args),
  useErpReasonCategoriesDropdown: (...args) =>
    hooks.useErpReasonCategoriesDropdownMock(
      ...args,
    ),
  useErpReasonCategoryExport: (...args) =>
    hooks.useErpReasonCategoryExportMock(
      ...args,
    ),
  useErpRequestFieldConfigurationExport: (
    ...args
  ) =>
    hooks.useErpRequestFieldConfigurationExportMock(
      ...args,
    ),
  useErpRequestFieldConfigurations: (
    ...args
  ) =>
    hooks.useErpRequestFieldConfigurationsMock(
      ...args,
    ),
  useErpResponsiblePersonMappingExport: (
    ...args
  ) =>
    hooks.useErpResponsiblePersonMappingExportMock(
      ...args,
    ),
  useErpResponsiblePersonMappings: (
    ...args
  ) =>
    hooks.useErpResponsiblePersonMappingsMock(
      ...args,
    ),
  useErpVoucherTypeExport: (...args) =>
    hooks.useErpVoucherTypeExportMock(...args),
  useErpVoucherTypesDropdown: (...args) =>
    hooks.useErpVoucherTypesDropdownMock(
      ...args,
    ),
  useErpWorkTypeExport: (...args) =>
    hooks.useErpWorkTypeExportMock(...args),
  useErpWorkTypesDropdown: (...args) =>
    hooks.useErpWorkTypesDropdownMock(...args),
  useImportErpMasters: (...args) =>
    hooks.useImportErpMastersMock(...args),
  useUpdateErpRequestFieldConfiguration: (
    ...args
  ) =>
    hooks.useUpdateErpRequestFieldConfigurationMock(
      ...args,
    ),
  useUpdateErpResponsiblePersonMapping: (
    ...args
  ) =>
    hooks.useUpdateErpResponsiblePersonMappingMock(
      ...args,
    ),
}));

vi.mock("../../../hooks/useOrganization", () => ({
  useDepartmentsDropdown: (...args) =>
    hooks.useDepartmentsDropdownMock(...args),
  useSitesDropdown: (...args) =>
    hooks.useSitesDropdownMock(...args),
  useUsersDropdown: (...args) =>
    hooks.useUsersDropdownMock(...args),
}));

function mutationMock() {
  return {
    mutate: vi.fn(),
    mutateAsync: vi.fn().mockResolvedValue({}),
    isPending: false,
  };
}

function exportMock() {
  return {
    refetch: vi.fn().mockResolvedValue({
      data: [],
    }),
    isFetching: false,
  };
}

function renderWithRouter(element) {
  render(
    <MemoryRouter>{element}</MemoryRouter>,
  );
}

describe("ERP final phase pages", () => {
  beforeEach(() => {
    Object.values(hooks).forEach((mock) =>
      mock.mockReset(),
    );

    hooks.useErpModulesDropdownMock.mockReturnValue({
      data: [
        {
          id: "module-1",
          code: "FIN",
          label: "Finance",
        },
      ],
    });
    hooks.useErpVoucherTypesDropdownMock.mockReturnValue(
      {
        data: [
          {
            id: "voucher-1",
            code: "JV",
            label: "Journal Voucher",
          },
        ],
      },
    );
    hooks.useErpWorkTypesDropdownMock.mockReturnValue({
      data: [
        {
          id: "work-1",
          code: "EDIT",
          label: "Edit",
        },
      ],
    });
    hooks.useErpPrioritiesDropdownMock.mockReturnValue(
      {
        data: [
          {
            id: "priority-1",
            code: "HIGH",
            label: "High",
          },
        ],
      },
    );
    hooks.useErpReasonCategoriesDropdownMock.mockReturnValue(
      {
        data: [],
      },
    );
    hooks.useDepartmentsDropdownMock.mockReturnValue({
      data: [
        {
          id: "department-1",
          code: "ACC",
          label: "Accounts",
        },
      ],
    });
    hooks.useSitesDropdownMock.mockReturnValue({
      data: [
        {
          id: "site-1",
          code: "BKN",
          label: "Bikaner Site",
        },
      ],
    });
    hooks.useUsersDropdownMock.mockReturnValue({
      data: [
        {
          id: "person-1",
          employee_id: "RESP001",
          full_name: "Responsible User",
          label: "RESP001 - Responsible User",
        },
      ],
    });

    [
      hooks.useActivateErpRequestFieldConfigurationMock,
      hooks.useActivateErpResponsiblePersonMappingMock,
      hooks.useCreateErpRequestFieldConfigurationMock,
      hooks.useCreateErpResponsiblePersonMappingMock,
      hooks.useDeactivateErpRequestFieldConfigurationMock,
      hooks.useDeactivateErpResponsiblePersonMappingMock,
      hooks.useUpdateErpRequestFieldConfigurationMock,
      hooks.useUpdateErpResponsiblePersonMappingMock,
    ].forEach((mock) =>
      mock.mockReturnValue(mutationMock()),
    );

    [
      hooks.useErpModuleExportMock,
      hooks.useErpPriorityExportMock,
      hooks.useErpReasonCategoryExportMock,
      hooks.useErpRequestFieldConfigurationExportMock,
      hooks.useErpResponsiblePersonMappingExportMock,
      hooks.useErpVoucherTypeExportMock,
      hooks.useErpWorkTypeExportMock,
    ].forEach((mock) =>
      mock.mockReturnValue(exportMock()),
    );

    hooks.useImportErpMastersMock.mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue([
        {
          status: "created",
          row: {
            module_name: "Finance",
          },
        },
      ]),
      isPending: false,
    });
  });

  it("creates a work assignee mapping", async () => {
    const createMapping = mutationMock();
    hooks.useCreateErpResponsiblePersonMappingMock.mockReturnValue(
      createMapping,
    );
    hooks.useErpResponsiblePersonMappingsMock.mockReturnValue(
      {
        isLoading: false,
        isError: false,
        data: {
          items: [],
          meta: {},
        },
      },
    );

    renderWithRouter(
      <ErpResponsibleMappingPage />,
    );

    await userEvent.click(
      screen.getByRole("button", {
        name: /add mapping/i,
      }),
    );
    await userEvent.selectOptions(
      screen.getByLabelText(/^erp module$/i),
      "module-1",
    );
    await userEvent.selectOptions(
      screen.getByLabelText(
        /^work assignee$/i,
      ),
      "person-1",
    );
    await userEvent.selectOptions(
      screen.getByLabelText(/^voucher type$/i),
      "voucher-1",
    );
    await userEvent.click(
      screen.getByRole("button", {
        name: /save mapping/i,
      }),
    );

    await waitFor(() => {
      expect(
        createMapping.mutateAsync,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          erp_module: "module-1",
          voucher_type: "voucher-1",
          responsible_person: "person-1",
        }),
      );
    });
  });

  it("creates a field configuration rule", async () => {
    const createRule = mutationMock();
    hooks.useCreateErpRequestFieldConfigurationMock.mockReturnValue(
      createRule,
    );
    hooks.useErpRequestFieldConfigurationsMock.mockReturnValue(
      {
        isLoading: false,
        isError: false,
        data: {
          items: [],
          meta: {},
        },
      },
    );

    renderWithRouter(
      <ErpFieldConfigurationPage />,
    );

    await userEvent.click(
      screen.getByRole("button", {
        name: /add field rule/i,
      }),
    );
    await userEvent.type(
      screen.getByLabelText(/^field label$/i),
      "Voucher Number",
    );
    await userEvent.selectOptions(
      screen.getByLabelText(/^field state$/i),
      "REQUIRED",
    );
    await userEvent.selectOptions(
      screen.getByLabelText(/^erp module$/i),
      "module-1",
    );
    await userEvent.click(
      screen.getByRole("button", {
        name: /save field rule/i,
      }),
    );

    await waitFor(() => {
      expect(
        createRule.mutateAsync,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          field_label: "Voucher Number",
          field_state: "REQUIRED",
          erp_module: "module-1",
        }),
      );
    });
  });

  it("imports selected ERP master CSV rows", async () => {
    const importMasters = {
      mutateAsync: vi.fn().mockResolvedValue([
        {
          status: "created",
          row: {
            module_name: "Finance",
          },
        },
      ]),
      isPending: false,
    };
    hooks.useImportErpMastersMock.mockReturnValue(
      importMasters,
    );

    renderWithRouter(<ErpImportExportPage />);

    const csv = [
      "module_name,description,display_order,is_active",
      "Finance,Accounts module,1,true",
    ].join("\n");
    const file = new File([csv], "modules.csv", {
      type: "text/csv",
    });

    await userEvent.upload(
      screen.getByLabelText(/^csv file$/i),
      file,
    );
    await userEvent.click(
      screen.getByRole("button", {
        name: /import rows/i,
      }),
    );

    await waitFor(() => {
      expect(
        importMasters.mutateAsync,
      ).toHaveBeenCalledWith({
        resource: "modules",
        rows: [
          expect.objectContaining({
            module_name: "Finance",
            display_order: 1,
            is_active: true,
          }),
        ],
      });
    });
    expect(
      screen.getByText(/created 1 \/ 1/i),
    ).toBeInTheDocument();
  });
});
