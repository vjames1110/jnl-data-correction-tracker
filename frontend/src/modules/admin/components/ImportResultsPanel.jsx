/**
 * Shows the outcome of a management page's "Import CSV" action -
 * a created/failed summary, plus the reason for every failed row so
 * a bad CSV is easy to fix and re-upload.
 */
export function ImportResultsPanel({
  error,
  results,
}) {
  if (!error && !results.length) {
    return null;
  }

  const createdCount = results.filter(
    (result) => result.status === "created",
  ).length;
  const failedRows = results.filter(
    (result) => result.status === "failed",
  );

  return (
    <div className="inline-alert">
      {error ? (
        <strong>{error}</strong>
      ) : (
        <>
          <div className="site-toolbar">
            <span>
              Imported {createdCount} /{" "}
              {results.length}
            </span>
            <span>
              Failed {failedRows.length}
            </span>
          </div>
          {failedRows.length ? (
            <div className="data-table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Row</th>
                    <th>Error</th>
                  </tr>
                </thead>
                <tbody>
                  {failedRows.map(
                    (result, index) => (
                      <tr key={index}>
                        <td>
                          {JSON.stringify(
                            result.row,
                          )}
                        </td>
                        <td>{result.error}</td>
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
