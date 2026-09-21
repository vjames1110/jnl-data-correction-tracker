import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { ProjectMonitorTabs } from "./ProjectMonitorTabs";

const hooks = vi.hoisted(() => ({ visible: vi.fn() }));

vi.mock("../../../hooks/useProjectMonitor", () => ({
  useOverdueCounts: () => ({ data: {} }),
  useVisibleTasks: (...args) => hooks.visible(...args),
}));

function renderTabs(held, noSites = false) {
  hooks.visible.mockReturnValue({
    isLoading: false,
    noSites,
    has: (task) => held.includes(task),
  });
  render(
    <MemoryRouter initialEntries={["/project-manager/hr?site=s1"]}>
      <ProjectMonitorTabs role="PROJECT_INCHARGE" active="hr" />
    </MemoryRouter>,
  );
}

const names = () =>
  screen.getAllByRole("link").map((link) => link.textContent);

describe("ProjectMonitorTabs", () => {
  it("shows only the tabs of the tasks the person holds", () => {
    renderTabs(["DPR_BILLS", "HR"]);

    expect(names()).toEqual([
      "All Projects",
      "Overview",
      "DPR & Bills",
      "HR",
    ]);
  });

  it("always keeps All Projects and Overview", () => {
    renderTabs([]);

    expect(names()).toEqual(["All Projects", "Overview"]);
  });

  it("shows every tab to someone holding every task", () => {
    renderTabs([
      "STRUCTURES",
      "BUILDINGS",
      "GIRDERS",
      "ACTION_ITEMS",
      "LINEAR_WORKS",
      "DPR_BILLS",
      "HR",
      "MACHINERY",
      "REPORTS",
    ]);

    expect(names()).toEqual([
      "All Projects",
      "Overview",
      "Structures",
      "Buildings",
      "Girders",
      "Action Items",
      "Linear Works",
      "DPR & Bills",
      "HR",
      "Machinery",
      "Reports",
    ]);
  });

  it("asks for the tasks of the site in the address", () => {
    renderTabs(["HR"]);

    expect(hooks.visible).toHaveBeenCalledWith("s1");
  });

  it("tells someone with no site that nothing has been assigned yet", () => {
    renderTabs([], true);

    expect(
      screen.getByText(
        /you have not been given access to any project yet/i,
      ),
    ).toBeInTheDocument();
  });

  it("shows no such notice to someone who has a site", () => {
    renderTabs(["HR"]);

    expect(
      screen.queryByText(/not been given access/i),
    ).toBeNull();
  });
});
