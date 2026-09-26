import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ReconciliationCardDetail } from "./ReconciliationCardDetail";

const hooks = vi.hoisted(() => ({ detail: vi.fn() }));

vi.mock("../../../hooks/useReconciliation", () => ({
  useReconciliationCardDetail: (...args) => hooks.detail(...args),
}));

const SITES = {
  shape: "sites",
  total: 2,
  truncated: false,
  rows: [
    {
      site_id: "s-bkn",
      site_code: "BKN",
      site_name: "Bikaner Site",
      reported: true,
      period_status: "SUBMITTED",
      total_entries: 5,
      over_tolerance_count: 1,
      watch_count: 1,
      within_tolerance_count: 3,
      total_variance_value: "12500.00",
    },
    {
      site_id: "s-jpr",
      site_code: "JPR",
      site_name: "Jaipur Site",
      reported: false,
      period_status: "",
      total_entries: 0,
      over_tolerance_count: 0,
      watch_count: 0,
      within_tolerance_count: 0,
      total_variance_value: "0.00",
    },
  ],
};

const ENTRIES = {
  shape: "entries",
  total: 1,
  truncated: false,
  rows: [
    {
      entry_id: "e1",
      site_id: "s-bkn",
      site_code: "BKN",
      site_name: "Bikaner Site",
      item_name: "OPC Cement",
      uom: "MT",
      theoretical_or_book_quantity: "40.000",
      actual_quantity: "45.000",
      variance_quantity: "-5.000",
      variance_value: "-32500.00",
      status: "OVER_TOLERANCE",
    },
  ],
};

function renderDetail(props = {}) {
  render(
    <MemoryRouter>
      <ReconciliationCardDetail
        kind="sites_reporting"
        month="2026-06"
        packPath="/store/statement-pack"
        onClose={vi.fn()}
        {...props}
      />
    </MemoryRouter>,
  );
}

describe("ReconciliationCardDetail", () => {
  beforeEach(() => {
    hooks.detail.mockReset();
  });

  it("asks for the card's details for the month shown", () => {
    hooks.detail.mockReturnValue({ data: SITES });
    renderDetail();

    expect(hooks.detail).toHaveBeenCalledWith("sites_reporting", {
      month: "2026-06-01",
    });
  });

  it("lists reporting and non-reporting sites, linking only the ones that reported", () => {
    hooks.detail.mockReturnValue({ data: SITES });
    renderDetail();

    const table = screen.getByRole("table");
    const link = within(table).getByRole("link", { name: /BKN/ });
    expect(link).toHaveAttribute(
      "href",
      "/store/statement-pack?site=s-bkn&month=2026-06",
    );
    expect(within(table).getByText("Reported")).toBeInTheDocument();
    expect(within(table).getByText("Not reported")).toBeInTheDocument();
    // A site with nothing to show has no statement to open.
    expect(
      within(table).queryByRole("link", { name: /JPR/ }),
    ).toBeNull();
    expect(within(table).getByText("Jaipur Site")).toBeInTheDocument();
  });

  it("lists the entries behind a status card with a link to each site", () => {
    hooks.detail.mockReturnValue({ data: ENTRIES });
    renderDetail({ kind: "over_tolerance" });

    expect(
      screen.getByRole("heading", { name: "Entries over tolerance" }),
    ).toBeInTheDocument();
    expect(screen.getByText("OPC Cement")).toBeInTheDocument();
    expect(screen.getByText("Over tolerance")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /BKN/ }),
    ).toHaveAttribute(
      "href",
      "/store/statement-pack?site=s-bkn&month=2026-06",
    );
  });

  it("says how many entries were left out when the list is capped", () => {
    hooks.detail.mockReturnValue({
      data: { ...ENTRIES, total: 900, truncated: true },
    });
    renderDetail({ kind: "watch" });

    expect(
      screen.getByText(/Showing the largest 1 of 900 entries/),
    ).toBeInTheDocument();
  });

  it("has a friendly empty state", () => {
    hooks.detail.mockReturnValue({
      data: { shape: "entries", rows: [], total: 0, truncated: false },
    });
    renderDetail({ kind: "watch" });

    expect(
      screen.getByText("Nothing here for this month"),
    ).toBeInTheDocument();
  });

  it("closes", () => {
    hooks.detail.mockReturnValue({ data: SITES });
    const onClose = vi.fn();
    renderDetail({ onClose });

    fireEvent.click(
      screen.getByRole("button", { name: "Close details" }),
    );

    expect(onClose).toHaveBeenCalled();
  });

  it("shows a loading state and an error state", () => {
    hooks.detail.mockReturnValue({ isLoading: true });
    renderDetail();
    expect(screen.getByText("Loading details...")).toBeInTheDocument();
  });
});
