import clsx from "clsx";

/**
 * The in-page "workspace" switcher (Rolling Diagram / Day-wise, DPR
 * grid / Register / RA bills / ...): a segmented control, deliberately
 * different from the underlined top tab strip so it reads as choosing
 * a working view inside a page rather than navigating to another one.
 */
export function WorkspaceSwitch({
  options,
  value,
  onChange,
  label = "Workspace",
}) {
  return (
    <div
      className="pm-workspace print-hidden"
      role="tablist"
      aria-label={label}
    >
      {options.map((option) => {
        const Icon = option.icon;
        const isActive = option.key === value;
        return (
          <button
            key={option.key}
            type="button"
            role="tab"
            aria-selected={isActive}
            className={clsx(
              "pm-workspace__item",
              isActive && "pm-workspace__item--active",
            )}
            onClick={() => onChange(option.key)}
          >
            {Icon ? <Icon size={15} /> : null}
            <span>{option.label}</span>
            {option.badge ? (
              <span className="pm-workspace__badge">
                {option.badge}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
