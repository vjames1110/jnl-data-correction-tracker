import { FileDown, Upload } from "lucide-react";
import { useRef, useState } from "react";

import { apiErrorMessage } from "../utils/finance";

/**
 * One Excel/CSV bulk upload: what the file is, template downloads,
 * the upload button and - after an upload - a one-line summary, a
 * per-site table and the row-level problems. ``counters`` names the
 * result keys in the order they are shown; a counter marked
 * ``problem`` is drawn as a warning. Uploads are idempotent on the
 * backend, so uploading the same file again is safe.
 */
export function BulkUploadCard({
  title,
  help,
  templates,
  counters,
  upload,
  children,
}) {
  const fileRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  const handleFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }
    setBusy(true);
    setResult(null);
    setError("");
    try {
      setResult(await upload(file));
    } catch (uploadError) {
      setError(apiErrorMessage(uploadError));
    } finally {
      setBusy(false);
    }
  };

  const handleTemplate = async (template) => {
    setError("");
    try {
      await template.download();
    } catch (downloadError) {
      setError(apiErrorMessage(downloadError));
    }
  };

  const summary = result
    ? counters
        .filter(({ key }) => result[key])
        .map(({ key, label }) => `${result[key]} ${label}`)
        .join(" · ")
    : "";
  const siteRows = result?.by_site ?? [];
  const shownColumns = counters.filter(({ key }) =>
    siteRows.some((row) => row[key]),
  );
  const hiddenErrors =
    (result?.error_count ?? 0) - (result?.errors?.length ?? 0);
  const hasProblems = counters.some(
    ({ key, problem }) => problem && result?.[key],
  );

  return (
    <section
      className="pm-bulk-card print-hidden"
      aria-label={title}
    >
      <header className="pm-bulk-card__head">
        <h3>{title}</h3>
        <p className="pm-dpr-toolbar__help">{help}</p>
      </header>

      {children}

      <div className="pm-dpr-toolbar__buttons">
        {templates.map((template) => (
          <button
            key={template.label}
            type="button"
            className="button button--secondary button--sm"
            onClick={() => handleTemplate(template)}
          >
            <FileDown size={14} /> {template.label}
          </button>
        ))}
        <button
          type="button"
          className="button button--primary button--sm"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
        >
          <Upload size={14} />{" "}
          {busy ? "Uploading..." : "Upload file"}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.csv"
          style={{ display: "none" }}
          onChange={handleFile}
          aria-label={`${title} file`}
        />
      </div>

      {error ? (
        <div
          className="inline-alert inline-alert--error"
          role="alert"
        >
          <strong>{error}</strong>
        </div>
      ) : null}

      {result ? (
        <div
          className={
            hasProblems
              ? "inline-alert inline-alert--warning"
              : "inline-alert inline-alert--success"
          }
        >
          <strong>Upload: </strong>
          {summary || "nothing to do"}

          {siteRows.length ? (
            <div className="pm-table-wrap">
              <table className="pm-report__table pm-bulk-sites">
                <thead>
                  <tr>
                    <th>Site</th>
                    {shownColumns.map(({ key, label }) => (
                      <th key={key} className="pm-num">
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {siteRows.map((row) => (
                    <tr key={row.site_code}>
                      <td>{row.site_code}</td>
                      {shownColumns.map(({ key }) => (
                        <td key={key} className="pm-num">
                          {row[key] || "-"}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          {result.errors?.length ? (
            <ul className="pm-import-errors">
              {result.errors.map((message) => (
                <li key={message}>{message}</li>
              ))}
              {hiddenErrors > 0 ? (
                <li>
                  ...and {hiddenErrors} more rows with
                  problems.
                </li>
              ) : null}
            </ul>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
