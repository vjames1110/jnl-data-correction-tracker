import { useUploadMachinery } from "../../../hooks/useProjectMonitor";
import { projectMonitorService } from "../../../services/projectMonitorService";
import { saveBlob } from "../utils/finance";
import { BulkUploadCard } from "./BulkUploadCard";

const COUNTERS = [
  { key: "usage_created", label: "machine days added" },
  { key: "usage_updated", label: "machine days updated" },
  { key: "usage_unchanged", label: "machine days unchanged" },
  { key: "fuel_created", label: "fuel rows added" },
  { key: "fuel_duplicate", label: "fuel already recorded" },
  { key: "machines_created", label: "new machines to review" },
  { key: "site_not_found", label: "unknown site code", problem: true },
  { key: "not_permitted", label: "not permitted", problem: true },
  { key: "invalid", label: "invalid", problem: true },
];

/**
 * The Machinery Department's company-wide upload: machine days, fuel
 * and maintenance for every site in one Excel file. Each row goes to
 * the site named in its Site code; the selected project (if any) is
 * only the default for rows that leave the code blank.
 */
export function MachineryBulkUploadPanel({ siteId }) {
  const upload = useUploadMachinery(siteId);

  return (
    <div className="pm-stack">
      <p className="pm-dpr-toolbar__help">
        Upload the Excel sheet the department already keeps - one
        file can cover every site. Each row goes to the site named
        in its <strong>Project (site code)</strong> column;
        uploading the same file again changes nothing. Rows that
        cannot be used are listed with the reason.
      </p>

      <BulkUploadCard
        title="Machine days, fuel and maintenance"
        help="Project (site code), Date, Machine, Source (Market/HO), Days-hrs, Hire cost, Fuel litres, Fuel cost, Maintenance, Other and Remarks. Hire cost blank = from the machine's rate; fuel litres need a fuel cost. A machine nobody registered is created and flagged for review."
        templates={[
          {
            label: "Template",
            download: async () =>
              saveBlob(
                await projectMonitorService.downloadMachineryTemplate(
                  siteId,
                ),
                "machinery-upload-template.xlsx",
              ),
          },
        ]}
        counters={COUNTERS}
        upload={(file) => upload.mutateAsync(file)}
      />
    </div>
  );
}
