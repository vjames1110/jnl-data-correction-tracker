import { FileDown, Upload } from "lucide-react";
import { useRef, useState } from "react";

import { apiErrorMessage, saveBlob } from "../utils/finance";

/**
 * Excel/CSV bulk upload for a daily finance feed (HR, Machinery):
 * template download, file upload and a one-line result summary with
 * per-row errors. ``useUpload`` is the feed's upload mutation hook;
 * ``resultLabels`` maps result keys to their wording (only non-zero
 * counts are shown). Uploads are idempotent on the backend.
 */
export function FeedUploadControls({
  siteId,
  useUpload,
  downloadTemplate,
  templateFilename,
  resultLabels,
  help,
}) {
  const fileRef = useRef(null);
  const upload = useUpload(siteId);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  const handleFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }
    setResult(null);
    setError("");
    try {
      setResult(await upload.mutateAsync(file));
    } catch (uploadError) {
      setError(apiErrorMessage(uploadError));
    }
  };

  const handleTemplate = async () => {
    try {
      saveBlob(
        await downloadTemplate(siteId),
        templateFilename,
      );
    } catch (downloadError) {
      setError(apiErrorMessage(downloadError));
    }
  };

  const summary = result
    ? Object.entries(resultLabels)
        .filter(([key]) => result[key])
        .map(([key, label]) => `${result[key]} ${label}`)
        .join(" · ")
    : "";

  return (
    <div className="pm-dpr-import print-hidden">
      <div className="pm-dpr-toolbar">
        <div className="pm-dpr-toolbar__group">
          <span className="pm-dpr-toolbar__label">
            Bulk upload
          </span>
          <div className="pm-dpr-toolbar__buttons">
            <button
              type="button"
              className="button button--secondary button--sm"
              onClick={handleTemplate}
            >
              <FileDown size={14} /> Template
            </button>
            <button
              type="button"
              className="button button--secondary button--sm"
              onClick={() => fileRef.current?.click()}
              disabled={upload.isPending}
            >
              <Upload size={14} />{" "}
              {upload.isPending
                ? "Uploading..."
                : "Upload file"}
            </button>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.csv"
            style={{ display: "none" }}
            onChange={handleFile}
          />
        </div>
        <p className="pm-dpr-toolbar__help">{help}</p>
      </div>

      {error ? (
        <div className="inline-alert inline-alert--error">
          <strong>{error}</strong>
        </div>
      ) : null}
      {result ? (
        <div className="inline-alert">
          <strong>Upload: </strong>
          {summary || "nothing to do"}
          {result.errors?.length ? (
            <ul className="pm-import-errors">
              {result.errors.map((message) => (
                <li key={message}>{message}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
