import { useUploadHr } from "../../../hooks/useProjectMonitor";
import { projectMonitorService } from "../../../services/projectMonitorService";
import { FeedUploadControls } from "./FeedUploadControls";

const RESULT_LABELS = {
  labour_created: "labour rows added",
  labour_duplicate: "already recorded",
  overrides_saved: "staff days saved",
  overrides_unchanged: "staff days unchanged",
  staff_not_found: "staff not found",
  site_not_found: "unknown site code",
  not_permitted: "not permitted",
  invalid: "invalid",
};

/**
 * Bulk upload for labour and staff days. Rows are routed by site
 * code, so a file can hold several projects (each row is still
 * checked against the uploader's HR assignment).
 */
export function HrUploadControls({ siteId }) {
  return (
    <FeedUploadControls
      siteId={siteId}
      useUpload={useUploadHr}
      downloadTemplate={
        projectMonitorService.downloadHrTemplate
      }
      templateFilename="hr-upload-template.xlsx"
      resultLabels={RESULT_LABELS}
      help="Excel (.xlsx) or CSV with Project (site code), Date, Type (Labour or Staff), Category or Staff name, Nos, Rate, Amount, Agency and Note. Staff rows set that person's cost for the day (0 = absent)."
    />
  );
}
