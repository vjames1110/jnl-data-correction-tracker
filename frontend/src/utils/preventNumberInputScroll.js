/**
 * A focused `<input type="number">` changes its value on every
 * mouse-wheel tick - a plain browser default, not something a form
 * can opt out of per field, and independent of whether the spinner
 * arrows are even visible (see the CSS that hides them in
 * global.css). With ~115 number inputs across the app, this means a
 * stray scroll over a field silently corrupts whatever was typed.
 * Blurring the field the moment a wheel event reaches it - before the
 * browser applies the scroll as an increment - is the one app-wide
 * fix, rather than adding an onWheel handler to every input.
 */
export function preventNumberInputScroll(
  doc = document,
) {
  const handleWheel = () => {
    const target = doc.activeElement;
    if (
      target instanceof HTMLInputElement &&
      target.type === "number"
    ) {
      target.blur();
    }
  };

  doc.addEventListener("wheel", handleWheel, {
    passive: true,
  });

  return () =>
    doc.removeEventListener("wheel", handleWheel);
}
