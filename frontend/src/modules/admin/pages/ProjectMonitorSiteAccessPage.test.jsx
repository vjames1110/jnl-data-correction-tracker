import {
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ProjectMonitorSiteAccessPage } from "./ProjectMonitorSiteAccessPage";

const hooks = vi.hoisted(() => ({
  setAccess: vi.fn(),
  siteAccess: vi.fn(),
}));

const TASKS = [
  ["OVERVIEW", "Project details & extensions", "progress"],
  ["STRUCTURES", "Structures", "progress"],
  ["BUILDINGS", "Buildings", "progress"],
  ["GIRDERS", "Girders, bearings & EJ", "progress"],
  ["ACTION_ITEMS", "Action items", "progress"],
  ["LINEAR_WORKS", "Linear works", "progress"],
  ["DPR_BILLS", "DPR & Bills", "finance"],
  ["HR", "HR (labour & staff)", "finance"],
  ["MACHINERY", "Machinery & fuel", "finance"],
  ["REPORTS", "Reports", "reports"],
].map(([key, label, group]) => ({
  key,
  label,
  group,
  group_label:
    group === "progress"
      ? "Progress tracking"
      : group === "finance"
        ? "Finance"
        : "Reports",
}));

const ACCESS = {
  site: "site-1",
  tasks: TASKS,
  people: [
    {
      user: "u1",
      user_name: "Kiran Das",
      user_employee_id: "PI001",
      role: "PROJECT_INCHARGE",
      role_label: "Project Incharge",
      tasks: TASKS.map((task) => task.key),
    },
    {
      user: "u2",
      user_name: "Meena Iyer",
      user_employee_id: "PI002",
      role: "PROJECT_INCHARGE",
      role_label: "Project Incharge",
      tasks: ["DPR_BILLS"],
    },
  ],
  eligible: [
    {
      id: "u3",
      employee_id: "PM001",
      name: "Asha Rao",
      role: "PROJECT_MANAGER",
      role_label: "Project Manager",
    },
  ],
};

const PEOPLE = [
  {
    id: "u1",
    employee_id: "PI001",
    name: "Kiran Das",
    role: "PROJECT_INCHARGE",
    role_label: "Project Incharge",
    sites: [
      {
        id: "site-1",
        code: "CHK",
        name: "Chunar",
        task_count: 10,
        all_tasks: true,
      },
    ],
  },
  {
    id: "u4",
    employee_id: "PM009",
    name: "Ravi Nair",
    role: "PROJECT_MANAGER",
    role_label: "Project Manager",
    sites: [],
  },
];

vi.mock("../../../hooks/useProjectMonitor", () => ({
  useSiteAccess: () => hooks.siteAccess(),
  useSiteScope: () => ({ data: PEOPLE }),
  useSetSiteAccess: () => ({
    mutateAsync: hooks.setAccess,
    isPending: false,
    isError: false,
  }),
}));

vi.mock("../../../hooks/useOrganization", () => ({
  useSitesDropdown: () => ({
    data: [{ id: "site-1", code: "CHK", label: "Chunar" }],
  }),
}));

function open() {
  render(<ProjectMonitorSiteAccessPage />);
  fireEvent.change(screen.getByLabelText("Project / Site"), {
    target: { value: "site-1" },
  });
}

describe("ProjectMonitorSiteAccessPage", () => {
  beforeEach(() => {
    hooks.setAccess.mockReset();
    hooks.setAccess.mockResolvedValue({});
    hooks.siteAccess.mockReturnValue({ data: ACCESS });
    vi.spyOn(window, "confirm").mockReturnValue(true);
  });

  it("asks for a site first", () => {
    render(<ProjectMonitorSiteAccessPage />);

    expect(screen.getByText("Pick a site")).toBeInTheDocument();
  });

  it("shows every person on the site with a checkbox per task", () => {
    open();

    const boxes = screen.getAllByRole("checkbox");
    expect(boxes).toHaveLength(2 * TASKS.length);
    expect(
      screen.getByLabelText("Kiran Das: Structures"),
    ).toBeChecked();
    // A second Incharge holding one task only.
    expect(
      screen.getByLabelText("Meena Iyer: DPR & Bills"),
    ).toBeChecked();
    expect(
      screen.getByLabelText("Meena Iyer: HR (labour & staff)"),
    ).not.toBeChecked();
  });

  it("groups the tasks under Progress, Finance and Reports", () => {
    open();

    expect(
      screen.getByText("Progress tracking"),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Finance").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Reports").length).toBeGreaterThan(0);
  });

  it("saves the ticked tasks for one person in a single call", async () => {
    open();
    fireEvent.click(
      screen.getByLabelText("Meena Iyer: HR (labour & staff)"),
    );
    const row = screen.getByText("Meena Iyer").closest("tr");
    fireEvent.click(
      within(row).getByRole("button", { name: "Save" }),
    );

    expect(hooks.setAccess).toHaveBeenCalledWith({
      site: "site-1",
      user: "u2",
      tasks: ["DPR_BILLS", "HR"],
    });
  });

  it("keeps Save off until something changes", () => {
    open();

    const row = screen.getByText("Meena Iyer").closest("tr");
    expect(
      within(row).getByRole("button", { name: "Save" }),
    ).toBeDisabled();
  });

  it("has quick presets for all tasks, progress, finance and none", () => {
    open();
    const row = screen.getByText("Meena Iyer").closest("tr");

    fireEvent.click(within(row).getByRole("button", { name: "Finance" }));
    expect(
      screen.getByLabelText("Meena Iyer: DPR & Bills"),
    ).toBeChecked();
    expect(
      screen.getByLabelText("Meena Iyer: Structures"),
    ).not.toBeChecked();

    fireEvent.click(within(row).getByRole("button", { name: "All" }));
    expect(
      screen.getByLabelText("Meena Iyer: Reports"),
    ).toBeChecked();

    fireEvent.click(within(row).getByRole("button", { name: "None" }));
    expect(
      screen.getByLabelText("Meena Iyer: DPR & Bills"),
    ).not.toBeChecked();
  });

  it("removes a person from the site by saving no tasks", () => {
    open();
    fireEvent.click(
      screen.getByRole("button", {
        name: /remove meena iyer from this site/i,
      }),
    );

    expect(hooks.setAccess).toHaveBeenCalledWith({
      site: "site-1",
      user: "u2",
      tasks: [],
    });
  });

  it("adds a person, who starts with no tasks ticked", async () => {
    open();
    fireEvent.change(screen.getByLabelText("Add a person"), {
      target: { value: "u3" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^add$/i }));

    const box = screen.getByLabelText("Asha Rao: Structures");
    expect(box).not.toBeChecked();
    const row = screen.getByText("Asha Rao").closest("tr");
    expect(
      within(row).getByRole("button", { name: "Save" }),
    ).toBeDisabled();

    fireEvent.click(box);
    fireEvent.click(
      within(row).getByRole("button", { name: "Save" }),
    );
    expect(hooks.setAccess).toHaveBeenCalledWith({
      site: "site-1",
      user: "u3",
      tasks: ["STRUCTURES"],
    });
  });

  it("lists every person with their sites and flags people with none", () => {
    open();

    expect(
      screen.getByText("People and their sites"),
    ).toBeInTheDocument();
    expect(screen.getByText("CHK · all tasks")).toBeInTheDocument();
    expect(
      screen.getByText(
        "No site - cannot see or enter anything",
      ),
    ).toBeInTheDocument();
  });
});
