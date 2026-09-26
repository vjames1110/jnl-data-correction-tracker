import clsx from "clsx";

export function KpiCard({
  label,
  value,
  icon: Icon,
  tone = "default",
  helper,
  onClick,
  selected = false,
}) {
  // With ``onClick`` the card opens what it counts (a real button
  // for the keyboard and screen readers); without it, unchanged.
  const interactive = typeof onClick === "function";
  const interactiveProps = interactive
    ? {
        role: "button",
        tabIndex: 0,
        "aria-pressed": selected,
        onClick,
        onKeyDown: (event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onClick(event);
          }
        },
      }
    : {};

  return (
    <article
      className={clsx(
        "kpi-card",
        `kpi-card--${tone}`,
        interactive && "kpi-card--clickable",
        selected && "kpi-card--selected",
      )}
      {...interactiveProps}
    >
      <div className="kpi-card__header">
        <span>{label}</span>

        <div className="kpi-card__icon">
          <Icon size={20} />
        </div>
      </div>

      <strong className="kpi-card__value">
        {value}
      </strong>

      {helper ? (
        <p className="kpi-card__helper">
          {helper}
        </p>
      ) : null}

      {interactive ? (
        <span className="kpi-card__hint">
          {selected ? "Hide details" : "View details"}
        </span>
      ) : null}
    </article>
  );
}