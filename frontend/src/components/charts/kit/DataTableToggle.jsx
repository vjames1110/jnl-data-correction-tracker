/**
 * "View as table": the same numbers a chart draws, for anyone who
 * cannot or would rather not read the marks. Collapsed by default.
 */
export function DataTableToggle({ columns, rows }) {
  return (
    <details className="pm-viz__table print-hidden">
      <summary>View as table</summary>
      <div className="data-table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column.key}>{column.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key}>
                {columns.map((column) => (
                  <td key={column.key}>
                    {row.cells[column.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
