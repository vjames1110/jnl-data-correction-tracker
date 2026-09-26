import { fireEvent, render, screen } from "@testing-library/react";
import { Building2 } from "lucide-react";
import { describe, expect, it, vi } from "vitest";

import { KpiCard } from "./KpiCard";

function renderCard(props = {}) {
  render(
    <KpiCard
      label="Sites Reporting"
      value="2 / 58"
      icon={Building2}
      {...props}
    />,
  );
}

describe("KpiCard", () => {
  it("is a plain card when nothing is attached to it", () => {
    renderCard();

    expect(screen.getByText("2 / 58")).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByText(/view details/i)).toBeNull();
  });

  it("becomes a button that opens what it counts", () => {
    const onClick = vi.fn();
    renderCard({ onClick });

    fireEvent.click(screen.getByRole("button"));

    expect(onClick).toHaveBeenCalledTimes(1);
    expect(screen.getByText("View details")).toBeInTheDocument();
  });

  it("can be opened from the keyboard", () => {
    const onClick = vi.fn();
    renderCard({ onClick });
    const card = screen.getByRole("button");

    fireEvent.keyDown(card, { key: "Enter" });
    fireEvent.keyDown(card, { key: " " });
    fireEvent.keyDown(card, { key: "a" });

    expect(onClick).toHaveBeenCalledTimes(2);
  });

  it("says when it is open", () => {
    renderCard({ onClick: vi.fn(), selected: true });

    expect(screen.getByRole("button")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByText("Hide details")).toBeInTheDocument();
  });
});
