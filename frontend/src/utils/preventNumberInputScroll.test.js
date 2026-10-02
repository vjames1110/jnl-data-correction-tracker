import { describe, expect, it } from "vitest";

import { preventNumberInputScroll } from "./preventNumberInputScroll";

describe("preventNumberInputScroll", () => {
  it("blurs a focused number input when the wheel moves over it", () => {
    const stop = preventNumberInputScroll(document);

    const input = document.createElement("input");
    input.type = "number";
    document.body.appendChild(input);
    input.focus();
    expect(document.activeElement).toBe(input);

    input.dispatchEvent(
      new Event("wheel", { bubbles: true }),
    );

    expect(document.activeElement).not.toBe(input);

    stop();
    input.remove();
  });

  it("leaves a focused text input alone", () => {
    const stop = preventNumberInputScroll(document);

    const input = document.createElement("input");
    input.type = "text";
    document.body.appendChild(input);
    input.focus();

    input.dispatchEvent(
      new Event("wheel", { bubbles: true }),
    );

    expect(document.activeElement).toBe(input);

    stop();
    input.remove();
  });

  it("does nothing once stopped", () => {
    const stop = preventNumberInputScroll(document);
    stop();

    const input = document.createElement("input");
    input.type = "number";
    document.body.appendChild(input);
    input.focus();

    input.dispatchEvent(
      new Event("wheel", { bubbles: true }),
    );

    expect(document.activeElement).toBe(input);

    input.remove();
  });
});
