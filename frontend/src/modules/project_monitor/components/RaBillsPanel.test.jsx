import {
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { RaBillsPanel } from "./RaBillsPanel";

const hooks = vi.hoisted(() => ({
  createBill: vi.fn(),
  bills: vi.fn(),
}));

vi.mock("../../../hooks/useProjectMonitor", () => ({
  useRaBills: () => hooks.bills(),
  useCreateRaBill: () => ({
    mutateAsync: hooks.createBill,
    isPending: false,
    isError: false,
  }),
  useDeleteRaBill: () => ({ mutate: vi.fn(), isError: false }),
  useUpdateRaBill: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
    isError: false,
  }),
}));

const ITEMS = [
  {
    id: "item-1",
    item_no: "1.1",
    description: "Earthwork",
    is_active: true,
    executed_qty: "100",
    billed_qty: "40",
  },
];

function billsData(bills = []) {
  return {
    data: {
      bills,
      totals: { gross: "0", received: "0", outstanding: "0" },
      opening: { billed_value: "0" },
    },
  };
}

function open() {
  render(
    <RaBillsPanel siteId="site-1" items={ITEMS} canEnter />,
  );
  fireEvent.click(
    screen.getByRole("button", { name: /add bill/i }),
  );
}

describe("RaBillsPanel - amount bills", () => {
  beforeEach(() => {
    hooks.createBill.mockReset();
    hooks.createBill.mockResolvedValue({});
    hooks.bills.mockReturnValue(billsData());
  });

  it("starts as an item bill with the quantities table", () => {
    open();

    expect(
      screen.getByText("Quantities billed in this bill"),
    ).toBeInTheDocument();
    expect(
      screen.queryByLabelText(/bill amount/i),
    ).toBeNull();
  });

  it("switches to an amount bill: no quantities, an amount field", () => {
    open();
    fireEvent.click(
      screen.getByRole("radio", {
        name: /amount against project value/i,
      }),
    );

    expect(
      screen.queryByText("Quantities billed in this bill"),
    ).toBeNull();
    expect(screen.getByText("Bill amount (₹)")).toBeInTheDocument();
    expect(
      screen.getByText(/recorded as received on the bill date/i),
    ).toBeInTheDocument();
  });

  it("sends an amount bill with no item lines", () => {
    open();
    fireEvent.click(
      screen.getByRole("radio", {
        name: /amount against project value/i,
      }),
    );
    const inputs = document.querySelectorAll(
      ".pm-bill-form input",
    );
    // Bill no., Bill date, Bill amount, Amount received, Received on, Remarks
    fireEvent.change(inputs[0], { target: { value: "RA-L1" } });
    fireEvent.change(inputs[2], { target: { value: "150000" } });
    fireEvent.submit(document.querySelector(".pm-bill-form"));

    expect(hooks.createBill).toHaveBeenCalledTimes(1);
    const payload = hooks.createBill.mock.calls[0][0];
    expect(payload.kind).toBe("AMOUNT");
    expect(payload.amount).toBe(150000);
    expect(payload.bill_no).toBe("RA-L1");
    expect(payload).not.toHaveProperty("lines");
    // Blank received = the server records the whole amount.
    expect(payload.received_amount).toBeNull();
  });

  it("sends item quantities for an item bill", () => {
    open();
    fireEvent.change(
      screen.getByLabelText(
        /quantity of earthwork in this bill/i,
      ),
      { target: { value: "25" } },
    );
    const inputs = document.querySelectorAll(
      ".pm-bill-form input",
    );
    fireEvent.change(inputs[0], { target: { value: "RA-1" } });
    fireEvent.submit(document.querySelector(".pm-bill-form"));

    const payload = hooks.createBill.mock.calls[0][0];
    expect(payload.kind).toBe("ITEMS");
    expect(payload.lines).toEqual([{ item: "item-1", qty: 25 }]);
    expect(payload).not.toHaveProperty("amount");
  });

  it("shows an amount bill as a lump sum in the bills table", () => {
    hooks.bills.mockReturnValue({
      data: {
        bills: [
          {
            id: "b1",
            bill_no: "RA-L1",
            bill_date: "2026-09-10",
            kind: "AMOUNT",
            amount: "150000.00",
            gross: "150000.00",
            received_amount: "150000.00",
            received_on: "2026-09-10",
            outstanding: "0.00",
            remarks: "Mobilisation advance",
            lines: [],
          },
        ],
        totals: {
          gross: "150000.00",
          received: "150000.00",
          outstanding: "0.00",
        },
        opening: { billed_value: "0" },
      },
    });
    render(<RaBillsPanel siteId="site-1" items={ITEMS} canEnter />);

    expect(
      screen.getByText("Lump sum against project value"),
    ).toBeInTheDocument();
    expect(screen.getByText("Mobilisation advance")).toBeInTheDocument();
  });
});
