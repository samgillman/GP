import { fmt } from "./data";
import type { ResultTable } from "./data";

function cellText(value: string | number | null | undefined) {
  return typeof value === "number" ? fmt(value) : (value ?? "");
}

/** One results page as a numbered grid. In two-column tables a one-cell row is
 * a section heading and an empty row is a spacer, as on Prism results sheets. */
export function ResultTableGrid({
  table,
  tableName,
}: {
  table: ResultTable;
  tableName?: string;
}) {
  const keyValue = table.columns.length === 2 && table.columns[1] === "";
  const width = table.columns.length;
  const rows =
    tableName && keyValue
      ? [["Table Analyzed", tableName], [], ...table.rows]
      : table.rows;
  return (
    <div className="results-table-wrap">
      <table
        className={`results-table result-page${keyValue ? " key-value" : ""}`}
        aria-label={table.title}
      >
        <thead>
          <tr>
            <th className="output-row-number" />
            {table.columns.map((column, index) => (
              <th
                key={index}
                className={index === 0 ? "stat-label" : undefined}
              >
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            const number = <th className="output-row-number">{index + 1}</th>;
            if (!row.length)
              return (
                <tr key={index} className="result-spacer">
                  {number}
                  <td colSpan={width} />
                </tr>
              );
            if (row.length === 1)
              return (
                <tr key={index} className="result-section">
                  {number}
                  <th className="stat-label" colSpan={width}>
                    {cellText(row[0])}
                  </th>
                </tr>
              );
            return (
              <tr key={index}>
                {number}
                <th className="stat-label">{cellText(row[0])}</th>
                {Array.from({ length: width - 1 }, (_, column) => (
                  <td key={column}>{cellText(row[column + 1])}</td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
