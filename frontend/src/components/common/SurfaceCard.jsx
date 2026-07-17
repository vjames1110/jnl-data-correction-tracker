import clsx from "clsx";

export function SurfaceCard({
  children,
  className,
  title,
  action,
}) {
  return (
    <section
      className={clsx(
        "surface-card",
        className,
      )}
    >
      {title || action ? (
        <div className="surface-card__header">
          <h2>{title}</h2>
          {action}
        </div>
      ) : null}

      <div className="surface-card__body">
        {children}
      </div>
    </section>
  );
}