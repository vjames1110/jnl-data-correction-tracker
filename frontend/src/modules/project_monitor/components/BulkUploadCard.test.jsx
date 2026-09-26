import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { BulkUploadCard } from "./BulkUploadCard";

const COUNTERS = [
  { key: "created", label: "added" },
  { key: "unchanged", label: "unchanged" },
  { key: "invalid", label: "invalid", problem: true },
];

function renderCard(props = {}) {
  const upload = vi.fn().mockResolvedValue({
    created: 3,
    unchanged: 1,
    invalid: 0,
    errors: [],
    error_count: 0,
    by_site: [],
  });
  render(
    <BulkUploadCard
      title="Staff register"
      help="Help text"
      templates={[{ label: "Template", download: vi.fn() }]}
      counters={COUNTERS}
      upload={upload}
      {...props}
    />,
  );
  return upload;
}

function chooseFile() {
  const file = new File(["x"], "staff.xlsx");
  fireEvent.change(screen.getByLabelText("Staff register file"), {
    target: { files: [file] },
  });
  return file;
}

describe("BulkUploadCard", () => {
  it("uploads the chosen file and summarises what happened", async () => {
    const upload = renderCard();

    const file = chooseFile();

    await waitFor(() => expect(upload).toHaveBeenCalledWith(file));
    expect(
      await screen.findByText(/3 added · 1 unchanged/),
    ).toBeInTheDocument();
  });

  it("shows a per-site table with only the columns that were used", async () => {
    renderCard({
      upload: vi.fn().mockResolvedValue({
        created: 3,
        unchanged: 0,
        invalid: 0,
        errors: [],
        error_count: 0,
        by_site: [
          { site_code: "CHK", created: 2 },
          { site_code: "OTH", created: 1 },
        ],
      }),
    });

    chooseFile();

    const table = await screen.findByRole("table");
    expect(
      within(table).getAllByRole("columnheader").map((h) => h.textContent),
    ).toEqual(["Site", "added"]);
    expect(within(table).getByText("CHK")).toBeInTheDocument();
    expect(within(table).getByText("OTH")).toBeInTheDocument();
  });

  it("lists row problems and says how many more there are", async () => {
    renderCard({
      upload: vi.fn().mockResolvedValue({
        created: 0,
        unchanged: 0,
        invalid: 150,
        errors: ["Row 2: bad date.", "Row 3: no name."],
        error_count: 150,
        by_site: [],
      }),
    });

    chooseFile();

    expect(await screen.findByText("Row 2: bad date.")).toBeInTheDocument();
    expect(screen.getByText(/and 148 more rows with problems/)).toBeInTheDocument();
  });

  it("shows why an upload failed", async () => {
    renderCard({
      upload: vi
        .fn()
        .mockRejectedValue({ message: "The file is larger than 5 MB." }),
    });

    chooseFile();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The file is larger than 5 MB.",
    );
  });

  it("runs a template download", async () => {
    const download = vi.fn().mockResolvedValue(undefined);
    renderCard({ templates: [{ label: "Template", download }] });

    fireEvent.click(screen.getByRole("button", { name: /template/i }));

    await waitFor(() => expect(download).toHaveBeenCalled());
  });

  it("shows nothing until a file is uploaded", () => {
    renderCard();

    expect(screen.queryByText(/Upload:/)).toBeNull();
  });
});
