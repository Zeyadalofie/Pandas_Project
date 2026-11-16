import React, { useMemo, useState } from "react";

const SOURCE_FILE = { jan: "inputs/jan_requests.csv", feb: "inputs/feb_requests.csv", mar: "inputs/team_data.db · table march_requests" };
const FATES = ["all", "accepted", "rejected", "duplicate"];
const PAGE = 60;

function journey(row) {
  const steps = [
    ["Files", `Stored in ${SOURCE_FILE[row.source]}`],
    ["EX01", `load_sources() reads it as text: row ${row.source_row} of “${row.source}”`],
  ];
  if (row.fate === "duplicate") {
    steps.push(["EX03", "clean_month() finds an identical earlier row and drops this copy. It stops here.", "dup"]);
    return steps;
  }
  if (row.fate === "rejected") {
    steps.push(["EX03", `clean_month() rejects it: ${row.detail.replaceAll(";", " + ").replaceAll("_", " ")}. It is kept in the rejected table with its reasons and goes no further.`, "rej"]);
    return steps;
  }
  steps.push(["EX03", "clean_month() normalises the text, parses date and minutes, and accepts the row.", "acc"]);
  steps.push(["EX05", `integrate() joins it to the desk lookup: ${row.detail} region. Written to team_output/analytical_table.csv.`]);
  steps.push(["EX06–07", `Counted in the ${row.detail} totals for its month (targets comparison and summaries).`]);
  steps.push(["AI-1", "The AI project does not reuse this row. It only learns the request types, regions and typical durations from the accepted table to generate its own practice dataset."]);
  return steps;
}

export default function TraceView({ rows }) {
  const [source, setSource] = useState("all");
  const [fate, setFate] = useState("all");
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(PAGE);
  const [picked, setPicked] = useState(null);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter(
      (r) =>
        (source === "all" || r.source === source) &&
        (fate === "all" || r.fate === fate) &&
        (!q || `${r.request_id} ${r.desk_code} ${r.desk} ${r.request_type} ${r.detail}`.toLowerCase().includes(q))
    );
  }, [rows, source, fate, query]);
  const current = picked ?? list[0];

  return (
    <section className="panel trace">
      <h2>Trace a single row</h2>
      <p className="lead">Pick any raw row to see each function that touched it and where it finished.</p>
      <div className="filters">
        <label>Source
          <select value={source} onChange={(e) => { setSource(e.target.value); setLimit(PAGE); }}>
            {["all", "jan", "feb", "mar"].map((s) => <option key={s}>{s}</option>)}
          </select>
        </label>
        <label>Result
          <select value={fate} onChange={(e) => { setFate(e.target.value); setLimit(PAGE); }}>
            {FATES.map((s) => <option key={s}>{s}</option>)}
          </select>
        </label>
        <label className="grow">Search
          <input value={query} placeholder="request id, desk, type, reason…" onChange={(e) => { setQuery(e.target.value); setLimit(PAGE); }} />
        </label>
        <span className="count">{list.length.toLocaleString("en-US")} of {rows.length.toLocaleString("en-US")} rows</span>
      </div>
      <div className="split">
        <div className="scroll tall">
          <table>
            <thead>
              <tr><th>source</th><th className="num">row</th><th>request_id</th><th>request_type</th><th>minutes (raw)</th><th>result</th></tr>
            </thead>
            <tbody>
              {list.slice(0, limit).map((r) => (
                <tr key={r.source + r.source_row} className={current === r ? "picked" : ""} onClick={() => setPicked(r)} tabIndex={0}
                  onKeyDown={(e) => e.key === "Enter" && setPicked(r)}>
                  <td>{r.source}</td><td className="num">{r.source_row}</td><td>{r.request_id}</td><td>{r.request_type}</td>
                  <td>{r.minutes === "" ? <span className="null">empty</span> : r.minutes}</td>
                  <td><span className={`fate ${r.fate}`}>{r.fate}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
          {list.length > limit && <button className="more" onClick={() => setLimit(limit + PAGE * 3)}>Show more rows</button>}
          {list.length === 0 && <p className="note pad">No rows match these filters.</p>}
        </div>
        {current && (
          <aside className="journey">
            <h3>{current.request_id || "(no id)"} <span>· {current.source} row {current.source_row}</span></h3>
            <dl>
              {["desk_code", "desk", "request_type", "status", "opened_at", "minutes"].map((k) => (
                <React.Fragment key={k}><dt>{k}</dt><dd>{current[k] === "" ? <span className="null">empty</span> : current[k]}</dd></React.Fragment>
              ))}
            </dl>
            <p className="note">Values above are the raw text, exactly as uploaded.</p>
            <ol>
              {journey(current).map(([label, text, mark], i) => (
                <li key={i} className={mark ?? ""}><b>{label}</b><span>{text}</span></li>
              ))}
            </ol>
          </aside>
        )}
      </div>
    </section>
  );
}
