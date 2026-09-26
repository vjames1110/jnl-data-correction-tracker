import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { DprCostingHelp } from "./DprCostingHelp";

describe("DprCostingHelp", () => {
  it("explains the link with the worked example", async () => {
    const user = userEvent.setup();
    render(<DprCostingHelp />);

    await user.click(
      screen.getByText("How a DPR item links to Costing"),
    );

    expect(screen.getByText("₹1,40,000")).toBeInTheDocument();
    expect(screen.getByText("₹52,000")).toBeInTheDocument();
    expect(screen.getByText("₹49,600")).toBeInTheDocument();
    expect(screen.getByText("₹20,000")).toBeInTheDocument();
    expect(
      screen.getByText(/replaces/i),
    ).toBeInTheDocument();
  });
});
