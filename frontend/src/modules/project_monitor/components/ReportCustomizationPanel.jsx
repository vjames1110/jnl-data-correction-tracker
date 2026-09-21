import {
  Banknote,
  Building2,
  Check,
  FileText,
  HardHat,
  Landmark,
  Link2,
  ListChecks,
  Route,
  Truck,
} from "lucide-react";

const SECTION_DEFS = [
  { key: "details", label: "Project details", icon: FileText },
  { key: "structures", label: "Structures", icon: Landmark },
  { key: "buildings", label: "Buildings", icon: Building2 },
  { key: "girders", label: "Girders & bearings", icon: Link2 },
  { key: "actionItems", label: "Action items", icon: ListChecks },
  { key: "linearWorks", label: "Linear works", icon: Route },
  { key: "financial", label: "DPR & bills", icon: Banknote },
  { key: "hr", label: "HR", icon: HardHat },
  { key: "machinery", label: "Machinery", icon: Truck },
];

/**
 * Print-hidden control surface that decides which sections
 * ``ProjectMonitorReportSheet`` renders below it: one small chip per
 * section, named and nothing more. Purely a set of booleans keyed the
 * same as the sheet's own ``sections`` prop - adding a section means
 * appending to ``SECTION_DEFS`` here and to the sheet.
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
      <div className="pm-report-customize__bar">
        <h2>Customize report</h2>
        <span className="pm-report-customize__count">
          {activeCount} of {defs.length} included
        </span>
        <span className="pm-report-customize__bulk">
          <button type="button" onClick={onSelectAll}>
            Select all
          </button>
          <button type="button" onClick={onClearAll}>
            Clear all
          </button>
        </span>
      </div>

      <div
        className="pm-report-chips"
        role="group"
        aria-label="Report sections"
      >
        {defs.map((def) => {
          const Icon = def.icon;
          const isOn = Boolean(sections[def.key]);
          const count = counts?.[def.key];
          return (
            <button
              type="button"
              key={def.key}
              className={
                isOn
                  ? "pm-report-chip pm-report-chip--on"
                  : "pm-report-chip"
              }
              onClick={() => onToggle(def.key)}
              aria-pressed={isOn}
            >
              {isOn ? (
                <Check size={13} strokeWidth={3} />
              ) : (
                <Icon size={13} />
              )}
              <span>{def.label}</span>
              {typeof count === "number" ? (
                <span className="pm-report-chip__count">
                  {count}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
