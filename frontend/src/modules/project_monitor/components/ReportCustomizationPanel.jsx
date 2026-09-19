import {
  Banknote,
  Building2,
  CheckCheck,
  FileText,
  Landmark,
  Link2,
  ListChecks,
  Route,
  X,
} from "lucide-react";

const SECTION_DEFS = [
  {
    key: "details",
    label: "Project details",
    description: "Value, dates, extensions & countdown",
    icon: FileText,
  },
  {
    key: "structures",
    label: "Structures",
    description: "Bridges, RUB, ROB task sheets",
    icon: Landmark,
  },
  {
    key: "buildings",
    label: "Buildings",
    description: "Floor-wise construction progress",
    icon: Building2,
  },
  {
    key: "girders",
    label: "Girders & bearings",
    description: "Span-wise girder, bearing & EJ chains",
    icon: Link2,
  },
  {
    key: "actionItems",
    label: "Action items",
    description: "Open & completed follow-ups",
    icon: ListChecks,
  },
  {
    key: "linearWorks",
    label: "Linear works",
    description: "Chainage scope & progress register",
    icon: Route,
  },
  {
    key: "financial",
    label: "DPR & bills",
    description: "Executed value, billing & balance",
    icon: Banknote,
  },
];

/**
 * Print-hidden control surface that decides which sections
 * ``ProjectMonitorReportSheet`` renders below it. Purely a set of
 * booleans keyed the same as the sheet's own ``sections`` prop - no
 * data shape of its own, so adding a future section only means
 * appending to ``SECTION_DEFS`` here and to the sheet's switch.
 */
export function ReportCustomizationPanel({
  sections,
  counts,
  hiddenKeys = [],
  onToggle,
  onSelectAll,
  onClearAll,
}) {
  const defs = SECTION_DEFS.filter(
    (def) => !hiddenKeys.includes(def.key),
  );
  const activeCount = defs.filter(
    (def) => sections[def.key],
  ).length;

  return (
    <div className="pm-report-customize print-hidden">
      <div className="pm-report-customize__head">
        <div>
          <h2>Customize this report</h2>
          <p>
            Choose which sections to include -
            the preview below updates instantly.
          </p>
        </div>
        <div className="pm-report-customize__bulk">
          <span className="pm-report-customize__count">
            {activeCount} of{" "}
            {defs.length} included
          </span>
          <button
            type="button"
            className="button button--tertiary"
            onClick={onSelectAll}
          >
            <CheckCheck size={14} /> Select all
          </button>
          <button
            type="button"
            className="button button--tertiary"
            onClick={onClearAll}
          >
            <X size={14} /> Clear all
          </button>
        </div>
      </div>

      <div className="pm-report-customize__grid">
        {defs.map((def) => {
          const Icon = def.icon;
          const isOn = Boolean(
            sections[def.key],
          );
          const count = counts?.[def.key];
          return (
            <button
              type="button"
              key={def.key}
              className={
                isOn
                  ? "pm-report-toggle pm-report-toggle--on"
                  : "pm-report-toggle"
              }
              onClick={() => onToggle(def.key)}
              aria-pressed={isOn}
            >
              <span className="pm-report-toggle__icon">
                <Icon size={18} />
              </span>
              <span className="pm-report-toggle__body">
                <span className="pm-report-toggle__label">
                  {def.label}
                  {typeof count === "number" ? (
                    <span className="pm-report-toggle__badge">
                      {count}
                    </span>
                  ) : null}
                </span>
                <span className="pm-report-toggle__description">
                  {def.description}
                </span>
              </span>
              <span
                className="pm-report-toggle__switch"
                aria-hidden="true"
              >
                <span className="pm-report-toggle__knob" />
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
