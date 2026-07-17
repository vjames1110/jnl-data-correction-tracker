import clsx from "clsx";

export function KpiCard({
  label,
  value,
  icon: Icon,
  tone = "default",
  helper,
}) {
  return (
    <article
      className={clsx(
        "kpi-card",
        `kpi-card--${tone}`,
      )}
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
    </article>
  );
}