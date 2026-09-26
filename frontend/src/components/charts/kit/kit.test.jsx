import {
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DivergingBars } from "./DivergingBars";
import { RankBars } from "./RankBars";
import { StackedColumns } from "./StackedColumns";
import { TrendChart } from "./TrendChart";
import { niceScale, shareOf } from "./chartData";

describe("chart number helpers", () => {
  it("picks whole-number steps of 1, 2 or 5 times a power of ten", () => {
    expect(niceScale(0)).toEqual({ max: 1, ticks: [0, 1] });
    expect(niceScale(3).ticks).toEqual([0, 1, 2, 3]);
    expect(niceScale(22)).toEqual({
      max: 25,
      ticks: [0, 5, 10, 15, 20, 25],
    });
    expect(niceScale(42)).toEqual({
      max: 50,
      ticks: [0, 10, 20, 30, 40, 50],
    });
  });

  it("never produces a fractional tick for counts", () => {
    [1, 2, 7, 13, 50, 99, 130, 1234].forEach((max) => {
      const { ticks } = niceScale(max);
      expect(ticks.every((tick) => Number.isInteger(tick))).toBe(true);
      expect(ticks.at(-1)).toBeGreaterThanOrEqual(max);
      expect(ticks.length).toBeLessThanOrEqual(7);
    });
  });

  it("works out shares without dividing by zero", () => {
    expect(shareOf(1, 4)).toBe(25);
    expect(shareOf(3, 0)).toBe(0);
  });
});

describe("RankBars", () => {
  const rows = [
    { key: "a", label: "Site A", value: 3 },
    { key: "b", label: "Site B", value: 12 },
    { key: "c", label: "Site C", value: 0 },
  ];

  it("ranks the longest first and leaves out empty rows", () => {
    render(<RankBars rows={rows} valueLabel="requests" />);

    const labels = screen
      .getAllByRole("img")
      .map((bar) => bar.getAttribute("aria-label"));
    expect(labels).toEqual([
      "Site B: 12 requests",
      "Site A: 3 requests",
    ]);
  });

  it("sizes each bar against the largest", () => {
    render(<RankBars rows={rows} />);

    expect(
      screen.getByRole("img", { name: /Site B/ }),
    ).toHaveStyle({ width: "100%" });
    expect(
      screen.getByRole("img", { name: /Site A/ }),
    ).toHaveStyle({ width: "25%" });
  });

  it("shows a tooltip for a bar on hover and on keyboard focus", () => {
    render(<RankBars rows={rows} valueLabel="requests" />);
    const bar = screen.getByRole("img", { name: /Site B/ });

    fireEvent.pointerMove(bar, { clientX: 10, clientY: 10 });
    expect(screen.getByRole("tooltip")).toHaveTextContent("Site B");
    expect(screen.getByRole("tooltip")).toHaveTextContent("12");

    fireEvent.pointerLeave(bar);
    expect(screen.queryByRole("tooltip")).toBeNull();

    fireEvent.focus(bar);
    expect(screen.getByRole("tooltip")).toBeInTheDocument();
    fireEvent.blur(bar);
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("shows the top rows with a switch for the rest", () => {
    const many = Array.from({ length: 14 }, (_, index) => ({
      key: `r${index}`,
      label: `Row ${index}`,
      value: 20 - index,
    }));
    render(<RankBars rows={many} limit={10} />);

    expect(screen.getAllByRole("img")).toHaveLength(10);
    fireEvent.click(
      screen.getByRole("button", { name: "Show all 14" }),
    );
    expect(screen.getAllByRole("img")).toHaveLength(14);
    fireEvent.click(
      screen.getByRole("button", { name: "Show top 10" }),
    );
    expect(screen.getAllByRole("img")).toHaveLength(10);
  });

  it("has no legend for a single series", () => {
    render(<RankBars rows={rows} />);

    expect(document.querySelector(".pm-viz__legend")).toBeNull();
  });

  it("says so when there is nothing to draw", () => {
    render(
      <RankBars
        rows={[{ key: "z", label: "Z", value: 0 }]}
        emptyTitle="No requests yet"
      />,
    );

    expect(screen.getByText("No requests yet")).toBeInTheDocument();
  });
});

describe("TrendChart", () => {
  const data = [
    { date: "2026-09-01", successful: 4, failed: 1 },
    { date: "2026-09-02", successful: 9, failed: 0 },
    { date: "2026-09-03", successful: 6, failed: 2 },
  ];
  const series = [
    { key: "successful", label: "Successful", token: "complete" },
    { key: "failed", label: "Failed", token: "critical" },
  ];

  it("draws one line per series with a legend", () => {
    const { container } = render(
      <TrendChart data={data} xKey="date" series={series} />,
    );

    expect(
      container.querySelectorAll("svg path[stroke-width='2']"),
    ).toHaveLength(2);
    const legend = within(document.querySelector(".pm-viz__legend"));
    expect(legend.getByText("Successful")).toBeInTheDocument();
    expect(legend.getByText("Failed")).toBeInTheDocument();
  });

  it("uses an area wash and no legend for a single series", () => {
    const { container } = render(
      <TrendChart
        data={data}
        xKey="date"
        series={[series[0]]}
      />,
    );

    expect(container.querySelector("path[fill-opacity='0.1']")).not.toBeNull();
    expect(document.querySelector(".pm-viz__legend")).toBeNull();
  });

  it("marks the newest point with a dot ringed in the surface colour", () => {
    const { container } = render(
      <TrendChart data={data} xKey="date" series={[series[0]]} />,
    );

    expect(container.querySelectorAll("circle")).toHaveLength(2);
    expect(container.querySelector("circle.pm-viz__ring")).not.toBeNull();
  });

  it("steps through the points with the arrow keys and shows each in a tooltip", () => {
    const { container } = render(
      <TrendChart
        data={data}
        xKey="date"
        series={series}
        formatX={(value) => `on ${value}`}
      />,
    );
    const svg = container.querySelector("svg");

    fireEvent.keyDown(svg, { key: "ArrowRight" });
    expect(screen.getByRole("tooltip")).toHaveTextContent("on 2026-09-01");

    fireEvent.keyDown(svg, { key: "ArrowRight" });
    expect(screen.getByRole("tooltip")).toHaveTextContent("on 2026-09-02");
    expect(screen.getByRole("tooltip")).toHaveTextContent("9");

    fireEvent.blur(svg);
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("offers the same numbers as a table", () => {
    render(<TrendChart data={data} xKey="date" series={series} />);

    fireEvent.click(screen.getByText("View as table"));

    const table = screen.getByRole("table");
    expect(within(table).getAllByRole("row")).toHaveLength(4);
    expect(within(table).getByText("2026-09-02")).toBeInTheDocument();
  });

  it("says so when there is no data", () => {
    render(
      <TrendChart
        data={[]}
        xKey="date"
        series={series}
        emptyTitle="No login trend"
      />,
    );

    expect(screen.getByText("No login trend")).toBeInTheDocument();
  });
});

describe("StackedColumns", () => {
  const data = [
    { month: "2026-08", ok: 3, watch: 1, over: 0 },
    { month: "2026-09", ok: 2, watch: 0, over: 2 },
  ];
  const series = [
    { key: "ok", label: "Within", token: "complete" },
    { key: "watch", label: "Watch", token: "hold" },
    { key: "over", label: "Over", token: "critical" },
  ];

  it("draws a column per month with only the parts that exist", () => {
    render(
      <StackedColumns data={data} xKey="month" series={series} />,
    );

    expect(
      screen.getByRole("img", { name: "2026-08: 3 Within, 1 Watch" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: "2026-09: 2 Within, 2 Over" }),
    ).toBeInTheDocument();
    expect(
      within(document.querySelector(".pm-viz__legend")).getByText("Within"),
    ).toBeInTheDocument();
  });

  it("tells every part of a column in its tooltip", () => {
    const { container } = render(
      <StackedColumns data={data} xKey="month" series={series} />,
    );
    const segment = container.querySelector(".pm-viz__seg");

    fireEvent.pointerMove(segment, { clientX: 5, clientY: 5 });

    const tip = screen.getByRole("tooltip");
    expect(tip).toHaveTextContent("2026-08 - 4 entries");
    expect(tip).toHaveTextContent("Watch");
  });

  it("says so when every month is empty", () => {
    render(
      <StackedColumns
        data={[{ month: "2026-09", ok: 0, watch: 0, over: 0 }]}
        xKey="month"
        series={series}
        emptyTitle="No trend data"
      />,
    );

    expect(screen.getByText("No trend data")).toBeInTheDocument();
  });
});

describe("DivergingBars", () => {
  const rows = [
    { key: "a", label: "AAA", sub: "Site A", value: -52000 },
    { key: "b", label: "BBB", sub: "Site B", value: 8000 },
    { key: "c", label: "CCC", sub: "Site C", value: -1000 },
  ];
  const format = (value) => `Rs ${value}`;

  it("puts the biggest swing first, losses left and savings right", () => {
    const { container } = render(
      <DivergingBars rows={rows} format={format} />,
    );

    const bars = screen.getAllByRole("img");
    expect(bars.map((bar) => bar.getAttribute("aria-label"))).toEqual([
      "AAA: Rs -52000",
      "BBB: Rs 8000",
      "CCC: Rs -1000",
    ]);
    expect(
      container.querySelectorAll(".pm-viz__diverge-fill--neg"),
    ).toHaveLength(2);
    expect(
      container.querySelectorAll(".pm-viz__diverge-fill--pos"),
    ).toHaveLength(1);
  });

  it("scales bars to half the track from the largest swing", () => {
    render(<DivergingBars rows={rows} format={format} />);

    expect(
      screen.getByRole("img", { name: /AAA/ }),
    ).toHaveStyle({ width: "50%" });
    expect(
      screen.getByRole("img", { name: /BBB/ }),
    ).toHaveStyle({ width: `${(8000 / 52000) * 50}%` });
  });

  it("names what loss and saving mean in its legend", () => {
    render(<DivergingBars rows={rows} format={format} />);

    expect(screen.getByText("Loss (over-use)")).toBeInTheDocument();
    expect(screen.getByText("Saving")).toBeInTheDocument();
  });

  it("shows a tooltip on hover", () => {
    render(
      <DivergingBars rows={rows} format={format} valueLabel="Net variance" />,
    );

    fireEvent.pointerMove(screen.getByRole("img", { name: /AAA/ }), {
      clientX: 5,
      clientY: 5,
    });

    expect(screen.getByRole("tooltip")).toHaveTextContent("Rs -52000");
  });

  it("says so when there are no sites", () => {
    render(
      <DivergingBars
        rows={[]}
        emptyTitle="No site variance yet"
      />,
    );

    expect(screen.getByText("No site variance yet")).toBeInTheDocument();
  });
});
