import {
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  ModuleProgressChart,
  OverallStatusChart,
  ProjectProgressChart,
} from "./DashboardCharts";

function project(code, activities, overrides = {}) {
  return {
    site: {
      id: code,
      site_code: code,
      site_name: `${code} site`,
      project_name: `${code} project`,
    },
    activities,
    modules: {
      structures: {
        total: 6,
        done: 3,
        in_progress: 1,
        hold: 0,
        not_started: 2,
      },
      buildings: {
        total: 2,
        done: 0,
        in_progress: 0,
        hold: 1,
        not_started: 1,
      },
      girders: {
        total: 0,
        done: 0,
        in_progress: 0,
        hold: 0,
        not_started: 0,
      },
      action_items: {
        total: 0,
        done: 0,
        in_progress: 0,
        hold: 0,
        not_started: 0,
      },
    },
    linear: { done_m: 500, scope_m: 2000 },
    ...overrides,
  };
}

const A = project("AAA", {
  total: 8,
  done: 4,
  in_progress: 1,
  hold: 1,
  not_started: 2,
  percent_complete: 50,
});
const B = project("BBB", {
  total: 10,
  done: 1,
  in_progress: 2,
  hold: 0,
  not_started: 7,
  percent_complete: 10,
});

describe("ProjectProgressChart", () => {
  it("draws one row per project with the completion figure beside it", () => {
    render(<ProjectProgressChart projects={[A, B]} />);

    expect(screen.getByText("AAA")).toBeInTheDocument();
    expect(screen.getByText("50%")).toBeInTheDocument();
    expect(screen.getByText("4 of 8")).toBeInTheDocument();
    expect(screen.getByText("10%")).toBeInTheDocument();
    // A legend names every status colour.
    [
      "Complete",
      "In progress",
      "Hold / issue",
      "Not taken up",
    ].forEach((label) =>
      expect(screen.getByText(label)).toBeInTheDocument(),
    );
  });

  it("describes each bar to screen readers", () => {
    render(<ProjectProgressChart projects={[A]} />);

    expect(
      screen.getByRole("img", {
        name: "AAA - 8 activities: 4 Complete, 1 In progress, 1 Hold / issue, 2 Not taken up",
      }),
    ).toBeInTheDocument();
  });

  it("shows every status in a tooltip on hover and keyboard focus", () => {
    const { container } = render(
      <ProjectProgressChart projects={[A]} />,
    );
    const segment = container.querySelector(
      ".pm-viz__seg--complete",
    );

    fireEvent.pointerMove(segment, {
      clientX: 20,
      clientY: 20,
    });
    const tip = screen.getByRole("tooltip");
    expect(within(tip).getByText("4 (50%)")).toBeInTheDocument();
    expect(within(tip).getByText("2 (25%)")).toBeInTheDocument();
    expect(within(tip).getAllByText("1 (13%)")).toHaveLength(2);

    fireEvent.pointerLeave(segment);
    expect(screen.queryByRole("tooltip")).toBeNull();

    fireEvent.focus(segment);
    expect(screen.getByRole("tooltip")).toBeInTheDocument();
    fireEvent.blur(segment);
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("skips projects that have no activities yet", () => {
    const empty = project("EMP", {
      total: 0,
      done: 0,
      in_progress: 0,
      hold: 0,
      not_started: 0,
      percent_complete: null,
    });
    render(<ProjectProgressChart projects={[A, empty]} />);

    expect(screen.queryByText("EMP")).toBeNull();
  });

  it("explains itself when there is nothing to draw", () => {
    render(<ProjectProgressChart projects={[]} />);

    expect(
      screen.getByText("No progress data yet"),
    ).toBeInTheDocument();
  });
});

describe("OverallStatusChart", () => {
  it("leads with the completion figure and lists each status with its share", () => {
    const { container } = render(
      <OverallStatusChart
        activities={{
          total: 40,
          done: 10,
          in_progress: 5,
          hold: 2,
          not_started: 23,
          percent_complete: 25,
        }}
      />,
    );

    expect(
      container.querySelector(".pm-viz__hero-number"),
    ).toHaveTextContent("25%");
    expect(
      screen.getByText("complete - 10 of 40 activities"),
    ).toBeInTheDocument();
    const notStarted = screen
      .getByText("Not taken up")
      .closest("li");
    expect(within(notStarted).getByText("23")).toBeInTheDocument();
    expect(within(notStarted).getByText("58%")).toBeInTheDocument();
  });

  it("explains itself when there are no activities", () => {
    render(
      <OverallStatusChart
        activities={{
          total: 0,
          done: 0,
          in_progress: 0,
          hold: 0,
          not_started: 0,
          percent_complete: null,
        }}
      />,
    );

    expect(
      screen.getByText("No activities yet"),
    ).toBeInTheDocument();
  });
});

describe("ModuleProgressChart", () => {
  it("adds up each kind of work across the projects and shows linear works in metres", () => {
    render(<ModuleProgressChart projects={[A, B]} />);

    // Structures: two projects with 3 of 6 each = 6 of 12.
    const structures = screen
      .getByText("Structures")
      .closest(".pm-viz__row");
    expect(within(structures).getByText("50%")).toBeInTheDocument();
    expect(
      within(structures).getByText("6 of 12"),
    ).toBeInTheDocument();
    const buildings = screen
      .getByText("Buildings")
      .closest(".pm-viz__row");
    expect(within(buildings).getByText("0%")).toBeInTheDocument();

    // Kinds of work with nothing recorded are left out.
    expect(screen.queryByText("Girders")).toBeNull();
    expect(screen.queryByText("Action items")).toBeNull();

    const linear = screen
      .getByText("Linear works")
      .closest(".pm-viz__row");
    expect(within(linear).getByText("25%")).toBeInTheDocument();
    expect(
      within(linear).getByText("1,000 of 4,000 m"),
    ).toBeInTheDocument();
  });

  it("explains itself when there is no work yet", () => {
    const blank = project(
      "NONE",
      {
        total: 0,
        done: 0,
        in_progress: 0,
        hold: 0,
        not_started: 0,
      },
      {
        modules: {},
        linear: { done_m: 0, scope_m: 0 },
      },
    );
    render(<ModuleProgressChart projects={[blank]} />);

    expect(
      screen.getByText("No work recorded yet"),
    ).toBeInTheDocument();
  });
});
