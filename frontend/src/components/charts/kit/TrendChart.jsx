import { useEffect, useState } from "react";

import { EmptyState } from "../../common/EmptyState";
import { ChartLegend } from "./ChartLegend";
import { formatCount, niceScale } from "./chartData";
import { DataTableToggle } from "./DataTableToggle";
import { useChartTooltip } from "./useChartTooltip";

const DEFAULT_WIDTH = 640;
const HEIGHT = 240;
const PAD = { top: 14, right: 18, bottom: 28, left: 44 };
const PLOT_H = HEIGHT - PAD.top - PAD.bottom;

const colour = (token) => `var(--viz-${token})`;

/**
 * Change over time: 2px lines (an area wash under a single series), an
 * end dot with a surface ring, hairline gridlines, and a crosshair
 * with a tooltip that follows the pointer (or the arrow keys).
 * `series` is `[{ key, label, token }]`; `data` rows carry `xKey` and
 * one value per series key.
 */
export function TrendChart({
  data,
  xKey,
  series,
  formatX = String,
  emptyTitle = "No trend yet",
  emptyMessage = "Not enough data to draw a trend.",
}) {
  const { frameRef, node, showAt, showAtPointer, hide } =
    useChartTooltip();
  const [active, setActive] = useState(null);
  // Drawn at the width it is shown at, so text keeps its real size
  // instead of scaling up with the picture.
  const [width, setWidth] = useState(DEFAULT_WIDTH);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame || typeof ResizeObserver === "undefined") {
      return undefined;
    }
    const measure = () =>
      setWidth(
        Math.max(320, Math.round(frame.clientWidth)) ||
          DEFAULT_WIDTH,
      );
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(frame);
    return () => observer.disconnect();
  }, [frameRef]);

  const WIDTH = width;
  const PLOT_W = WIDTH - PAD.left - PAD.right;

  if (!data?.length) {
    return (
      <EmptyState title={emptyTitle} message={emptyMessage} />
    );
  }

  const { max, ticks } = niceScale(
    Math.max(
      1,
      ...data.flatMap((row) =>
        series.map((item) => Number(row[item.key]) || 0),
      ),
    ),
  );
  const x = (index) =>
    PAD.left +
    (data.length === 1
      ? PLOT_W / 2
      : (index * PLOT_W) / (data.length - 1));
  const y = (value) => PAD.top + PLOT_H * (1 - value / max);
  const line = (key) =>
    data
      .map(
        (row, index) =>
          `${index ? "L" : "M"}${x(index).toFixed(1)},${y(
            Number(row[key]) || 0,
          ).toFixed(1)}`,
      )
      .join(" ");
  const labelStep = Math.max(
    1,
    Math.ceil(data.length / Math.max(2, Math.floor(PLOT_W / 90))),
  );
  const single = series.length === 1;

  const contentFor = (index) => ({
    title: formatX(data[index][xKey]),
    rows: series.map((item) => ({
      label: item.label,
      token: item.token,
      value: formatCount(data[index][item.key]),
    })),
  });

  const nearestIndex = (event) => {
    const box =
      event.currentTarget.ownerSVGElement.getBoundingClientRect();
    const px = ((event.clientX - box.left) / box.width) * WIDTH;
    return Math.min(
      data.length - 1,
      Math.max(
        0,
        Math.round(((px - PAD.left) / PLOT_W) * (data.length - 1)),
      ),
    );
  };

  const handleMove = (event) => {
    const index = nearestIndex(event);
    setActive(index);
    showAtPointer(event, contentFor(index));
  };

  const handleLeave = () => {
    setActive(null);
    hide();
  };

  const handleKey = (event) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") {
      return;
    }
    event.preventDefault();
    const index = Math.min(
      data.length - 1,
      Math.max(
        0,
        (active ?? (event.key === "ArrowRight" ? -1 : data.length)) +
          (event.key === "ArrowRight" ? 1 : -1),
      ),
    );
    setActive(index);
    const box = event.currentTarget.getBoundingClientRect();
    const frame = frameRef.current?.getBoundingClientRect();
    if (frame) {
      showAt(
        box.left - frame.left + (x(index) / WIDTH) * box.width,
        box.top - frame.top + (y(0) / HEIGHT) * box.height * 0.5,
        contentFor(index),
      );
    }
  };

  const last = data.length - 1;

  return (
    <div className="pm-viz" ref={frameRef}>
      {single ? null : <ChartLegend series={series} />}
      <svg
        className="pm-viz__trend"
        width={WIDTH}
        height={HEIGHT}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label={`${series
          .map((item) => item.label)
          .join(", ")} over time`}
        tabIndex={0}
        onKeyDown={handleKey}
        onBlur={handleLeave}
      >
        {ticks.map((tick) => (
          <g key={tick}>
            <line
              className="pm-viz__grid"
              x1={PAD.left}
              x2={WIDTH - PAD.right}
              y1={y(tick)}
              y2={y(tick)}
            />
            <text
              className="pm-viz__axis"
              x={PAD.left - 8}
              y={y(tick) + 4}
              textAnchor="end"
            >
              {formatCount(tick)}
            </text>
          </g>
        ))}

        {data.map((row, index) =>
          index % labelStep === 0 || index === last ? (
            <text
              key={String(row[xKey])}
              className="pm-viz__axis"
              x={x(index)}
              y={HEIGHT - 8}
              textAnchor="middle"
            >
              {formatX(row[xKey])}
            </text>
          ) : null,
        )}

        {single ? (
          <path
            d={`${line(series[0].key)} L${x(last).toFixed(1)},${y(
              0,
            )} L${x(0).toFixed(1)},${y(0)} Z`}
            fill={colour(series[0].token)}
            fillOpacity={0.1}
          />
        ) : null}

        {series.map((item) => (
          <path
            key={item.key}
            d={line(item.key)}
            fill="none"
            stroke={colour(item.token)}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ))}

        {active !== null ? (
          <line
            className="pm-viz__crosshair"
            x1={x(active)}
            x2={x(active)}
            y1={PAD.top}
            y2={PAD.top + PLOT_H}
          />
        ) : null}

        {series.map((item) => {
          const index = active ?? last;
          return (
            <g key={item.key}>
              <circle
                cx={x(index)}
                cy={y(Number(data[index][item.key]) || 0)}
                r={6}
                className="pm-viz__ring"
              />
              <circle
                cx={x(index)}
                cy={y(Number(data[index][item.key]) || 0)}
                r={4}
                fill={colour(item.token)}
              />
            </g>
          );
        })}

        <rect
          x={PAD.left}
          y={PAD.top}
          width={PLOT_W}
          height={PLOT_H}
          fill="transparent"
          onPointerMove={handleMove}
          onPointerLeave={handleLeave}
        />
      </svg>
      {node}
      <DataTableToggle
        columns={[
          { key: "x", label: "Date" },
          ...series.map((item) => ({
            key: item.key,
            label: item.label,
          })),
        ]}
        rows={data.map((row) => ({
          key: String(row[xKey]),
          cells: {
            x: formatX(row[xKey]),
            ...Object.fromEntries(
              series.map((item) => [
                item.key,
                formatCount(row[item.key]),
              ]),
            ),
          },
        }))}
      />
    </div>
  );
}
