import { useRef, useState } from "react";

/**
 * One tooltip for a whole chart. Each mark spreads `bind(content)`
 * to get pointer + keyboard-focus behaviour; the tip follows the
 * pointer (or sits over the focused mark) inside the chart frame.
 * Charts that track the pointer themselves (a line chart's crosshair)
 * use `showAtPointer` / `showAt` / `hide` directly.
 *
 * `content` is `{ title, rows: [{ label, token, value }] }`.
 */
export function useChartTooltip() {
  const frameRef = useRef(null);
  const [tip, setTip] = useState(null);

  const showAt = (x, y, content) => setTip({ x, y, content });
  const hide = () => setTip(null);

  const showAtPointer = (event, content) => {
    const frame = frameRef.current?.getBoundingClientRect();
    if (frame) {
      showAt(
        event.clientX - frame.left,
        event.clientY - frame.top,
        content,
      );
    }
  };

  const bind = (content) => ({
    tabIndex: 0,
    onPointerMove: (event) => showAtPointer(event, content),
    onPointerLeave: hide,
    onFocus: (event) => {
      const frame = frameRef.current?.getBoundingClientRect();
      const mark = event.currentTarget.getBoundingClientRect();
      if (frame) {
        showAt(
          mark.left - frame.left + mark.width / 2,
          mark.top - frame.top,
          content,
        );
      }
    },
    onBlur: hide,
  });

  const node = tip ? (
    <div
      className={
        tip.y < 130
          ? "pm-viz__tip pm-viz__tip--below"
          : "pm-viz__tip"
      }
      role="tooltip"
      style={{ left: tip.x, top: tip.y }}
    >
      <div className="pm-viz__tip-title">
        {tip.content.title}
      </div>
      {tip.content.rows.map((row) => (
        <div className="pm-viz__tip-row" key={row.label}>
          <span
            className={`pm-viz__key pm-viz__key--${row.token}`}
            aria-hidden="true"
          />
          <strong>{row.value}</strong>
          <span>{row.label}</span>
        </div>
      ))}
    </div>
  ) : null;

  return {
    frameRef,
    bind,
    node,
    showAt,
    showAtPointer,
    hide,
  };
}
