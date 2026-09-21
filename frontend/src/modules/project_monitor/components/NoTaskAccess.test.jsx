import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { NoTaskAccess } from "./NoTaskAccess";

describe("NoTaskAccess", () => {
  it("names the task and where to get it", () => {
    render(<NoTaskAccess task="Structures" />);

    expect(
      screen.getByText(
        "No access to Structures on this project",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/site access page/i),
    ).toBeInTheDocument();
  });
});
