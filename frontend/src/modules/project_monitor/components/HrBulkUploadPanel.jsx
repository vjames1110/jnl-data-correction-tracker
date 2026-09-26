import { useState } from "react";

import {
  useUploadHr,
  useUploadHrMuster,
  useUploadHrStaff,
} from "../../../hooks/useProjectMonitor";
import { projectMonitorService } from "../../../services/projectMonitorService";
import { saveBlob, todayIso } from "../utils/finance";
import { BulkUploadCard } from "./BulkUploadCard";

const STAFF_COUNTERS = [
  { key: "staff_created", label: "added" },
  { key: "staff_updated", label: "updated" },
  { key: "staff_revised", label: "salary revised" },
  { key: "staff_unchanged", label: "unchanged" },
  { key: "salary_conflict", label: "salary conflicts", problem: true },
  { key: "site_not_found", label: "unknown site", problem: true },
  { key: "not_permitted", label: "not permitted", problem: true },
  { key: "invalid", label: "invalid", problem: true },
];

const MUSTER_COUNTERS = [
  { key: "muster_absent", label: "absent days set" },
  { key: "muster_half", label: "half days set" },
  { key: "muster_cleared", label: "back to present" },
  { key: "muster_unchanged", label: "unchanged" },
  { key: "muster_kept_manual", label: "manual costs kept" },
  { key: "staff_not_found", label: "staff not found", problem: true },
  { key: "off_payroll", label: "days off payroll", problem: true },
  { key: "site_not_found", label: "unknown site", problem: true },
  { key: "not_permitted", label: "not permitted", problem: true },
  { key: "invalid", label: "invalid", problem: true },
];

const LABOUR_COUNTERS = [
  { key: "labour_created", label: "labour rows added" },
  { key: "labour_duplicate", label: "already recorded" },
  { key: "overrides_saved", label: "staff days saved" },
  { key: "overrides_unchanged", label: "staff days unchanged" },
  { key: "staff_not_found", label: "staff not found", problem: true },
  { key: "site_not_found", label: "unknown site", problem: true },
  { key: "not_permitted", label: "not permitted", problem: true },
  { key: "invalid", label: "invalid", problem: true },
];

/**
 * The HR person's company-wide uploads: staff register, muster and
 * labour rows, each one Excel file for every site at once. Rows are
 * routed by their Site code; the selected project (if any) is only
 * the default for rows that leave the code blank.
 */
export function HrBulkUploadPanel({ siteId }) {
  const uploadStaff = useUploadHrStaff(siteId);
  const uploadMuster = useUploadHrMuster(siteId);
  const uploadLabour = useUploadHr(siteId);
  const [month, setMonth] = useState(() =>
    todayIso().slice(0, 7),
  );

  const download = (loader, filename) => async () =>
    saveBlob(await loader(), filename);

  return (
    <div className="pm-stack">
      <p className="pm-dpr-toolbar__help">
        Upload the Excel sheets HR already keeps - one file can
        cover every site. Each row goes to the site named in its
        <strong> Site code</strong> column, and is added, updated
        or left as it is; uploading the same file again changes
        nothing. Rows that cannot be used are listed with the
        reason.
      </p>

      <BulkUploadCard
        title="Staff register"
        help="Site code, Staff code, Name, Designation, Monthly salary, From date, To date and (to change a salary) Effective from. A different salary without an Effective from date is refused, so past days are never rewritten."
        templates={[
          {
            label: "Template",
            download: download(
              () =>
                projectMonitorService.downloadHrStaffTemplate(
                  siteId,
                ),
              "hr-staff-register-template.xlsx",
            ),
          },
        ]}
        counters={STAFF_COUNTERS}
        upload={(file) => uploadStaff.mutateAsync(file)}
      />

      <BulkUploadCard
        title="Muster (attendance)"
        help="Either one row per person per day (Site code, Staff code, Staff name, Date, Status) or one row per person with a column for each day. P = present, HD = half day, A = absent; blank leaves the day as it is."
        templates={[
          {
            label: "Template (rows)",
            download: download(
              () =>
                projectMonitorService.downloadHrMusterTemplate({
                  siteId,
                  layout: "flat",
                  month,
                }),
              "hr-muster-flat-template.xlsx",
            ),
          },
          {
            label: "Template (month grid)",
            download: download(
              () =>
                projectMonitorService.downloadHrMusterTemplate({
                  siteId,
                  layout: "grid",
                  month,
                }),
              "hr-muster-grid-template.xlsx",
            ),
          },
        ]}
        counters={MUSTER_COUNTERS}
        upload={(file) =>
          uploadMuster.mutateAsync({ file, month })
        }
      >
        <label className="form-field pm-bulk-month">
          <span>
            Month (only needed when the grid numbers its days 1-31
            without naming the month)
          </span>
          <input
            type="month"
            value={month}
            max={todayIso().slice(0, 7)}
            onChange={(event) =>
              event.target.value &&
              setMonth(event.target.value)
            }
          />
        </label>
      </BulkUploadCard>

      <BulkUploadCard
        title="Labour and staff day costs"
        help="Project (site code), Date, Type (Labour or Staff), Category or Staff name, Nos, Rate, Amount, Agency and Note - the sheet used for contract labour head-counts."
        templates={[
          {
            label: "Template",
            download: download(
              () =>
                projectMonitorService.downloadHrTemplate(
                  siteId,
                ),
              "hr-upload-template.xlsx",
            ),
          },
        ]}
        counters={LABOUR_COUNTERS}
        upload={(file) => uploadLabour.mutateAsync(file)}
      />
    </div>
  );
}
