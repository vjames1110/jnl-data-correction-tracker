import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// A plain function, not vi.fn(): the spy would re-throw a rejected
// promise as an unhandled error, which is not what is being tested.
const download = vi.hoisted(() => ({
  calls: [],
  impl: async () => {},
}));

vi.mock("../../services/attachmentDownload", async () => {
  const actual = await vi.importActual(
    "../../services/attachmentDownload",
  );
  return {
    ...actual,
    downloadAttachment: (attachment) => {
      download.calls.push(attachment);
      return download.impl(attachment);
    },
  };
});
vi.mock("../../config/env", () => ({
  env: { apiBaseUrl: "https://api.example.com/api/v1" },
}));
vi.mock("../../services/apiClient", () => ({
  apiClient: { get: vi.fn() },
}));

import { AttachmentLink } from "./AttachmentLink";

const ATTACHMENT = {
  id: "a1",
  original_name: "stock-sheet.pdf",
  download_url:
    "https://api.example.com/api/v1/reconciliation/attachments/a1/download/",
};

describe("AttachmentLink", () => {
  beforeEach(() => {
    download.calls = [];
    download.impl = async () => {};
  });

  it("shows the file name and downloads it on click", async () => {
    render(<AttachmentLink attachment={ATTACHMENT} />);

    fireEvent.click(
      screen.getByRole("button", {
        name: "stock-sheet.pdf",
      }),
    );

    await waitFor(() =>
      expect(download.calls).toEqual([ATTACHMENT]),
    );
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("is a button, not a bare link that would send no login token", () => {
    render(<AttachmentLink attachment={ATTACHMENT} />);

    expect(screen.queryByRole("link")).toBeNull();
  });

  it("says so when the file is no longer in storage", async () => {
    download.impl = async () => {
      throw { status: 404 };
    };
    render(<AttachmentLink attachment={ATTACHMENT} />);

    fireEvent.click(screen.getByRole("button"));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /upload it again/i,
    );
    expect(screen.getByRole("button")).not.toBeDisabled();
  });

  it("uses custom content when given", () => {
    render(
      <AttachmentLink attachment={ATTACHMENT}>
        <span>Open proof</span>
      </AttachmentLink>,
    );

    expect(
      screen.getByRole("button", { name: "Open proof" }),
    ).toBeInTheDocument();
  });
});
