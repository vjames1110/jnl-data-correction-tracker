import { beforeEach, describe, expect, it, vi } from "vitest";

const { apiClientGet } = vi.hoisted(() => ({
  apiClientGet: vi.fn(),
}));

vi.mock("../config/env", () => ({
  env: {
    apiBaseUrl: "https://api.example.com/api/v1",
  },
}));
vi.mock("./apiClient", () => ({
  apiClient: { get: apiClientGet },
}));

import {
  attachmentErrorMessage,
  downloadAttachment,
  toApiPath,
} from "./attachmentDownload";

describe("toApiPath", () => {
  it("turns the absolute download URL into a path under the API base", () => {
    expect(
      toApiPath(
        "https://api.example.com/api/v1/reconciliation/attachments/abc/download/",
      ),
    ).toBe("/reconciliation/attachments/abc/download/");
  });

  it("ignores an http:// URL built behind a proxy", () => {
    expect(
      toApiPath(
        "http://api.example.com/api/v1/corrections/attachments/abc/download/",
      ),
    ).toBe("/corrections/attachments/abc/download/");
  });

  it("leaves a path outside the base untouched", () => {
    expect(toApiPath("/somewhere/else/")).toBe(
      "/somewhere/else/",
    );
  });
});

describe("downloadAttachment", () => {
  beforeEach(() => {
    apiClientGet.mockReset();
    URL.createObjectURL = vi.fn(() => "blob:fake");
    URL.revokeObjectURL = vi.fn();
  });

  it("fetches the file with the authenticated client and saves it under its own name", async () => {
    const blob = new Blob(["pdf"]);
    apiClientGet.mockResolvedValue({ data: blob });
    const clicked = [];
    const realCreate = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation(
      (tag) => {
        const element = realCreate(tag);
        if (tag === "a") {
          element.click = () =>
            clicked.push({
              href: element.href,
              download: element.download,
            });
        }
        return element;
      },
    );

    await downloadAttachment({
      download_url:
        "https://api.example.com/api/v1/reconciliation/attachments/abc/download/",
      original_name: "stock-sheet.pdf",
    });

    expect(apiClientGet).toHaveBeenCalledWith(
      "/reconciliation/attachments/abc/download/",
      expect.objectContaining({ responseType: "blob" }),
    );
    expect(clicked).toEqual([
      { href: "blob:fake", download: "stock-sheet.pdf" },
    ]);
    document.createElement.mockRestore();
  });
});

describe("attachmentErrorMessage", () => {
  it("explains a missing file in plain words", () => {
    expect(attachmentErrorMessage({ status: 404 })).toMatch(
      /upload it again/i,
    );
  });

  it("explains a permission problem", () => {
    expect(attachmentErrorMessage({ status: 403 })).toMatch(
      /permission/i,
    );
  });

  it("falls back to the error message, then a generic one", () => {
    expect(
      attachmentErrorMessage({ status: 500, message: "Boom" }),
    ).toBe("Boom");
    expect(attachmentErrorMessage(undefined)).toMatch(
      /could not be downloaded/i,
    );
  });
});
