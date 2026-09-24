import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { MiscUsageCard } from "./MiscUsageCard";

const CEMENT = {
  id: "i-cement",
  item_code: "CEM",
  item_name: "Cement OPC",
  uom: "MT",
};
const SAND = {
  id: "i-sand",
  item_code: "SND",
  item_name: "River Sand",
  uom: "CUM",
};

const ROW = {
  id: "m1",
  item: "i-cement",
  item_code: "CEM",
  item_name: "Cement OPC",
  uom: "MT",
  quantity: "10.000",
  queued: false,
};

function renderCard(props = {}) {
  const handlers = {
    onAdd: vi.fn().mockResolvedValue(true),
    onUpdate: vi.fn().mockResolvedValue(true),
    onDelete: vi.fn(),
  };
  render(
    <MiscUsageCard
      rows={[]}
      materials={[CEMENT, SAND]}
      isEditable
      submitting={false}
      {...handlers}
      {...props}
    />,
  );
  return handlers;
}

describe("MiscUsageCard", () => {
  it("explains the section and says when nothing is logged", () => {
    renderCard();

    expect(
      screen.getByText("Miscellaneous Use"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /enter only the consumed quantity/i,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "No miscellaneous use recorded for this period.",
      ),
    ).toBeInTheDocument();
  });

  it("adds a usage with just a material and a quantity, then clears the form", async () => {
    const { onAdd } = renderCard();

    fireEvent.change(screen.getByLabelText("Material"), {
      target: { value: "i-sand" },
    });
    fireEvent.change(
      screen.getByLabelText(/Consumed Quantity \(CUM\)/),
      { target: { value: "4.5" } },
    );
    fireEvent.click(
      screen.getByRole("button", { name: /add usage/i }),
    );

    expect(onAdd).toHaveBeenCalledWith({
      item: "i-sand",
      quantity: "4.5",
    });
    await waitFor(() =>
      expect(screen.getByLabelText("Material")).toHaveValue(
        "",
      ),
    );
  });

  it("keeps what was typed when the save is rejected", async () => {
    const onAdd = vi.fn().mockResolvedValue(false);
    renderCard({ onAdd });

    fireEvent.change(screen.getByLabelText("Material"), {
      target: { value: "i-cement" },
    });
    fireEvent.change(
      screen.getByLabelText(/Consumed Quantity/),
      { target: { value: "3" } },
    );
    fireEvent.click(
      screen.getByRole("button", { name: /add usage/i }),
    );

    await waitFor(() => expect(onAdd).toHaveBeenCalled());
    expect(screen.getByLabelText("Material")).toHaveValue(
      "i-cement",
    );
  });

  it("only offers the materials that are still free", () => {
    renderCard({ materials: [SAND] });

    const options = screen
      .getAllByRole("option")
      .map((option) => option.textContent);
    expect(options).toContain("River Sand");
    expect(options).not.toContain("Cement OPC");
  });

  it("says when every material is already logged", () => {
    renderCard({ materials: [], rows: [ROW] });

    expect(
      screen.getByText("All materials already logged"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /add usage/i }),
    ).toBeDisabled();
  });

  it("lists logged usage with its quantity and unit", () => {
    renderCard({ rows: [ROW] });

    const table = within(screen.getByRole("table"));
    expect(table.getByText("Cement OPC")).toBeInTheDocument();
    expect(table.getByText("10.000")).toBeInTheDocument();
    expect(table.getByText("MT")).toBeInTheDocument();
  });

  it("edits the quantity of a logged usage in place", async () => {
    const { onUpdate } = renderCard({ rows: [ROW] });

    fireEvent.click(
      screen.getByRole("button", {
        name: "Edit Cement OPC usage",
      }),
    );
    fireEvent.change(
      screen.getByLabelText(
        "Consumed quantity of Cement OPC",
      ),
      { target: { value: "6" } },
    );
    fireEvent.click(
      screen.getByRole("button", { name: /^save$/i }),
    );

    expect(onUpdate).toHaveBeenCalledWith(ROW, "6");
    await waitFor(() =>
      expect(
        screen.queryByLabelText(
          "Consumed quantity of Cement OPC",
        ),
      ).toBeNull(),
    );
  });

  it("cancels an edit without saving", () => {
    const { onUpdate } = renderCard({ rows: [ROW] });

    fireEvent.click(
      screen.getByRole("button", {
        name: "Edit Cement OPC usage",
      }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Cancel edit" }),
    );

    expect(onUpdate).not.toHaveBeenCalled();
    expect(screen.getByText("10.000")).toBeInTheDocument();
  });

  it("deletes a usage", () => {
    const { onDelete } = renderCard({ rows: [ROW] });

    fireEvent.click(
      screen.getByRole("button", {
        name: "Delete Cement OPC usage",
      }),
    );

    expect(onDelete).toHaveBeenCalledWith(ROW);
  });

  it("marks a change that is still waiting to sync", () => {
    renderCard({ rows: [{ ...ROW, queued: true }] });

    expect(screen.getByText("Queued")).toBeInTheDocument();
  });

  it("is read-only when the period cannot be edited", () => {
    renderCard({ rows: [ROW], isEditable: false });

    expect(
      within(screen.getByRole("table")).getByText("Cement OPC"),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /add usage/i }),
    ).toBeNull();
    expect(
      screen.queryByRole("button", {
        name: "Delete Cement OPC usage",
      }),
    ).toBeNull();
    expect(screen.queryByText("Actions")).toBeNull();
  });

  it("shows why a change was refused", () => {
    renderCard({
      error:
        "This material already has a miscellaneous use entry for this period - edit it instead of adding another.",
    });

    expect(
      screen.getByText(/edit it instead of adding another/),
    ).toBeInTheDocument();
  });
});
