import React from "react";

function cell(value) {
  if (value === null || value === undefined) return <span className="null">missing</span>;
  if (value === true) return "yes";
  if (value === false) return "no";
  if (value === "") return <span className="null">empty</span>;
  if (typeof value === "number") return Number.isInteger(value) ? value.toLocaleString("en-US") : value.toFixed(Math.abs(value) < 10 ? 3 : 1);
  return String(value);
}

export default function DataTable({ table }) {
  const numeric = table.columns.map((_, c) => table.rows.some((r) => typeof r[c] === "number"));
  return (
    <figure className="tbl">
      <figcaption>
        <b>{table.title}</b>
        <span>
          {table.rows.length < table.total
            ? `first ${table.rows.length} of ${table.total.toLocaleString("en-US")} rows`
            : `${table.total.toLocaleString("en-US")} row${table.total === 1 ? "" : "s"}`}
        </span>
      </figcaption>
      <div className="scroll">
        <table>
          <thead>
            <tr>
              {table.columns.map((name, c) => (
                <th key={c} className={numeric[c] ? "num" : ""}>
                  {name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row, r) => (
              <tr key={r}>
                {row.map((value, c) => (
                  <td key={c} className={numeric[c] ? "num" : ""}>
                    {cell(value)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {table.note && <p className="note">{table.note}</p>}
    </figure>
  );
}
