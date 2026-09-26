import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AccountStatusChart } from "./AccountStatusChart";
import { CountBars } from "./CountBars";
import { LoginTrendChart } from "./LoginTrendChart";
import { RoleDistributionChart } from "./RoleDistributionChart";

describe("AccountStatusChart", () => {
  const data = [
    { key: "ACTIVE", label: "Active", count: 8 },
    { key: "INACTIVE", label: "Inactive", count: 1 },
    { key: "LOCKED", label: "Locked", count: 1 },
    { key: "SUSPENDED", label: "Suspended", count: 0 },
  ];

  it("leads with the total and splits it by status", () => {
    render(<AccountStatusChart data={data} />);

    expect(screen.getByText("10")).toBeInTheDocument();
    expect(screen.getByText("accounts")).toBeInTheDocument();
    expect(screen.getByText("80%")).toBeInTheDocument();
    expect(
      screen.getByRole("img", {
        name: "Accounts by status: 8 Active, 1 Inactive, 1 Locked",
      }),
    ).toBeInTheDocument();
  });

  it("colours each status the same way everywhere", () => {
    const { container } = render(<AccountStatusChart data={data} />);

    expect(
      container.querySelector(".pm-viz__seg--complete"),
    ).not.toBeNull();
    expect(container.querySelector(".pm-viz__seg--idle")).not.toBeNull();
    expect(container.querySelector(".pm-viz__seg--hold")).not.toBeNull();
  });

  it("says so when there is no data", () => {
    render(<AccountStatusChart data={[]} />);

    expect(screen.getByText("No status data")).toBeInTheDocument();
  });
});

describe("RoleDistributionChart", () => {
  it("ranks the roles people actually hold", () => {
    render(
      <RoleDistributionChart
        data={[
          { key: "ADMIN", label: "Admin", count: 2 },
          { key: "USER", label: "Request Creator", count: 40 },
          { key: "STORE_HO", label: "Store HO", count: 0 },
        ]}
      />,
    );

    expect(
      screen
        .getAllByRole("img")
        .map((bar) => bar.getAttribute("aria-label")),
    ).toEqual(["Request Creator: 40 users", "Admin: 2 users"]);
  });

  it("says so when there is no data", () => {
    render(<RoleDistributionChart data={[]} />);

    expect(screen.getByText("No role data")).toBeInTheDocument();
  });
});

describe("LoginTrendChart", () => {
  it("draws successful and failed logins as two lines", () => {
    const { container } = render(
      <LoginTrendChart
        data={[
          { date: "2026-09-01", successful: 5, failed: 1 },
          { date: "2026-09-02", successful: 7, failed: 0 },
        ]}
      />,
    );

    const legend = within(document.querySelector(".pm-viz__legend"));
    expect(legend.getByText("Successful")).toBeInTheDocument();
    expect(legend.getByText("Failed")).toBeInTheDocument();
    expect(
      container.querySelectorAll("svg path[stroke-width='2']"),
    ).toHaveLength(2);
  });

  it("says so when there is no trend", () => {
    render(<LoginTrendChart data={[]} />);

    expect(screen.getByText("No login trend")).toBeInTheDocument();
  });
});

describe("CountBars", () => {
  it("draws the API's name-and-count rows as ranked bars", () => {
    render(
      <CountBars
        data={[
          { site: "BKN", count: 3 },
          { site: "JPR", count: 9 },
        ]}
        nameKey="site"
        valueLabel="requests"
      />,
    );

    expect(
      screen
        .getAllByRole("img")
        .map((bar) => bar.getAttribute("aria-label")),
    ).toEqual(["JPR: 9 requests", "BKN: 3 requests"]);
  });

  it("shows a tooltip on hover", () => {
    render(
      <CountBars data={[{ site: "BKN", count: 3 }]} nameKey="site" />,
    );

    fireEvent.pointerMove(screen.getByRole("img"), {
      clientX: 4,
      clientY: 4,
    });

    expect(screen.getByRole("tooltip")).toHaveTextContent("BKN");
  });

  it("copes with missing data", () => {
    render(
      <CountBars
        data={undefined}
        nameKey="site"
        emptyTitle="No requests yet"
      />,
    );

    expect(screen.getByText("No requests yet")).toBeInTheDocument();
  });
});
