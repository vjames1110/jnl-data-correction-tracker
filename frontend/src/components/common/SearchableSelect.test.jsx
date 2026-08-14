import {
  render,
  screen,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { SearchableSelect } from "./SearchableSelect";

const options = [
  { value: "user-1", label: "EMP001 - Asha Sharma" },
  { value: "user-2", label: "EMP002 - Rohit Kumar" },
  { value: "user-3", label: "EMP003 - Meena Verma" },
];

describe("SearchableSelect", () => {
  it("shows the selected option's label when closed", () => {
    render(
      <SearchableSelect
        value="user-2"
        onChange={vi.fn()}
        options={options}
        ariaLabel="Employee"
      />,
    );

    expect(
      screen.getByRole("combobox", {
        name: /employee/i,
      }),
    ).toHaveValue("EMP002 - Rohit Kumar");
  });

  it("opens the option list on focus and filters as you type", async () => {
    render(
      <SearchableSelect
        value=""
        onChange={vi.fn()}
        options={options}
        ariaLabel="Employee"
      />,
    );

    const input = screen.getByRole("combobox", {
      name: /employee/i,
    });
    await userEvent.click(input);

    expect(
      screen.getByText("EMP001 - Asha Sharma"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("EMP002 - Rohit Kumar"),
    ).toBeInTheDocument();

    await userEvent.type(input, "meena");

    expect(
      screen.getByText("EMP003 - Meena Verma"),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("EMP001 - Asha Sharma"),
    ).not.toBeInTheDocument();
  });

  it("calls onChange and closes the menu when an option is clicked", async () => {
    const onChange = vi.fn();
    render(
      <SearchableSelect
        value=""
        onChange={onChange}
        options={options}
        ariaLabel="Employee"
      />,
    );

    await userEvent.click(
      screen.getByRole("combobox", {
        name: /employee/i,
      }),
    );
    await userEvent.click(
      screen.getByText("EMP002 - Rohit Kumar"),
    );

    expect(onChange).toHaveBeenCalledWith(
      "user-2",
    );
    expect(
      screen.queryByText("EMP001 - Asha Sharma"),
    ).not.toBeInTheDocument();
  });

  it("shows an empty-message when no options match", async () => {
    render(
      <SearchableSelect
        value=""
        onChange={vi.fn()}
        options={options}
        ariaLabel="Employee"
        emptyMessage="No matches found"
      />,
    );

    const input = screen.getByRole("combobox", {
      name: /employee/i,
    });
    await userEvent.click(input);
    await userEvent.type(input, "zzz");

    expect(
      screen.getByText("No matches found"),
    ).toBeInTheDocument();
  });

  it("clears the selection when the clear button is clicked", async () => {
    const onChange = vi.fn();
    render(
      <SearchableSelect
        value="user-1"
        onChange={onChange}
        options={options}
        ariaLabel="Employee"
      />,
    );

    await userEvent.click(
      screen.getByRole("button", {
        name: /clear selection/i,
      }),
    );

    expect(onChange).toHaveBeenCalledWith("");
  });

  it("does not open when disabled", async () => {
    render(
      <SearchableSelect
        value=""
        onChange={vi.fn()}
        options={options}
        ariaLabel="Employee"
        disabled
      />,
    );

    await userEvent.click(
      screen.getByRole("combobox", {
        name: /employee/i,
      }),
    );

    expect(
      screen.queryByText("EMP001 - Asha Sharma"),
    ).not.toBeInTheDocument();
  });
});
