import { FileDown, Upload } from "lucide-react";
import { useRef, useState } from "react";

import {
  useImportDprItems,
  useUploadDpr,
} from "../../../hooks/useProjectMonitor";
import { projectMonitorService } from "../../../services/projectMonitorService";
import { apiErrorMessage, saveBlob } from "../utils/finance";

const ITEM_LABELS = {
  created: "added",
  skipped_existing: "already there",
  skipped_invalid: "skipped (invalid)",
};
const DPR_LABELS = {
  created: "added",
  skipped_duplicate: "already recorded",
  skipped_locked: "skipped (day locked)",
  item_not_found: "skipped (item not found)",
  invalid: "skipped (invalid)",
};

function ResultSummary({ title, result, labels, error }) {
  if (!result && !error) {
    return null;
  }
  return (
    <div
      className={
        error
          ? "inline-alert inline-alert--error"
          : "inline-alert"
      }
    >
      {error ? (
        <strong>{error}</strong>
      ) : (
        <>
          <strong>{title}: </strong>
          {Object.entries(labels)
            .map(
              ([key, label]) =>
                `${result[key] ?? 0} ${label}`,
            )
            .join(" · ")}
          {result.errors?.length ? (
            <ul className="pm-import-errors">
              {result.errors.map((message) => (
                <li key={message}>{message}</li>
              ))}
            </ul>
          ) : null}
        </>
      )}
    </div>
  );
}

/**
 * Excel/CSV in and out: import the contract item list, download the
 * DPR upload template pre-filled with the active items, and upload a
 * filled DPR file. Re-uploading the same file never duplicates.
 */
export function DprImportControls({ siteId }) {
  const itemFileRef = useRef(null);
  const dprFileRef = useRef(null);
  const importItems = useImportDprItems(siteId);
  const uploadDpr = useUploadDpr(siteId);
  const [itemResult, setItemResult] = useState(null);
  const [itemError, setItemError] = useState("");
  const [dprResult, setDprResult] = useState(null);
  const [dprError, setDprError] = useState("");

  const run = async (event, mutation, setResult, setError) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }
    setResult(null);
    setError("");
    try {
      setResult(await mutation.mutateAsync(file));
    } catch (error) {
      setError(apiErrorMessage(error));
    }
  };

  const download = async (kind, filename) => {
    try {
      saveBlob(
        await projectMonitorService.downloadDprTemplate(
          siteId,
          kind,
        ),
        filename,
      );
    } catch (error) {
      setDprError(apiErrorMessage(error));
    }
  };

  return (
    <div className="pm-dpr-import print-hidden">
      <div className="pm-dpr-toolbar">
        <div className="pm-dpr-toolbar__group">
          <span className="pm-dpr-toolbar__label">
            Contract items
          </span>
          <div className="pm-dpr-toolbar__buttons">
            <button
              type="button"
              className="button button--secondary button--sm"
              onClick={() =>
                download(
                  "items",
                  "dpr-item-list-template.xlsx",
                )
              }
            >
              <FileDown size={14} /> Template
            </button>
            <button
              type="button"
              className="button button--secondary button--sm"
              onClick={() => itemFileRef.current?.click()}
              disabled={importItems.isPending}
            >
              <Upload size={14} />{" "}
              {importItems.isPending
                ? "Importing..."
                : "Import list"}
            </button>
          </div>
          <input
            ref={itemFileRef}
            type="file"
            accept=".xlsx,.csv"
            style={{ display: "none" }}
            onChange={(event) =>
              run(
                event,
                importItems,
                setItemResult,
                setItemError,
              )
            }
          />
        </div>

        <div className="pm-dpr-toolbar__group">
          <span className="pm-dpr-toolbar__label">
            Daily DPR
          </span>
          <div className="pm-dpr-toolbar__buttons">
            <button
              type="button"
              className="button button--secondary button--sm"
              onClick={() =>
                download("dpr", "dpr-upload-template.xlsx")
              }
            >
              <FileDown size={14} /> Template
            </button>
            <button
              type="button"
              className="button button--secondary button--sm"
              onClick={() => dprFileRef.current?.click()}
              disabled={uploadDpr.isPending}
            >
              <Upload size={14} />{" "}
              {uploadDpr.isPending
                ? "Uploading..."
                : "Upload filled DPR"}
            </button>
          </div>
          <input
            ref={dprFileRef}
            type="file"
            accept=".xlsx,.csv"
            style={{ display: "none" }}
            onChange={(event) =>
              run(
                event,
                uploadDpr,
                setDprResult,
                setDprError,
              )
            }
          />
        </div>

        <p className="pm-dpr-toolbar__help">
          Excel (.xlsx) or CSV. The item list needs
          Description, Qty and Rate columns; the DPR file
          needs Date, Qty and an Item no or Description.
        </p>
      </div>
      <ResultSummary
        title="Item list"
        result={itemResult}
        labels={ITEM_LABELS}
        error={itemError}
      />
      <ResultSummary
        title="DPR upload"
        result={dprResult}
        labels={DPR_LABELS}
        error={dprError}
      />
    </div>
  );
}
