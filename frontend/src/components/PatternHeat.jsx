import React, { useState } from "react";

export const PATTERN_COLORS = ["#4f63d9", "#20b9b0", "#f4ad53", "#9daabd", "#d9534f"];

export default function PatternHeat({ heat }) {
  const [hover, setHover] = useState(null);
  const [only, setOnly] = useState(null);
  const hours = [];
  const lo = Math.min(...heat.slots.map((s) => s.hour)), hi = Math.max(...heat.slots.map((s) => s.hour));
  for (let h = lo; h <= hi; h++) hours.push(h);
  const at = Object.fromEntries(heat.slots.map((s) => [`${s.weekday}-${s.hour}`, s]));
  return (
    <section className="chart">
      <div className="chartHead">
        <h5>Demand patterns across the week (number = accepted requests in that hour)</h5>
        <span className="muted">silhouette {heat.silhouette} · {heat.strength} separation</span>
      </div>
      <div className="heatWrap">
        <table className="heat">
          <thead>
            <tr><th />{hours.map((h) => <th key={h}>{String(h).padStart(2, "0")}</th>)}</tr>
          </thead>
          <tbody>
            {heat.weekdays.map((day, d) => (
              <tr key={day}>
                <th>{day}</th>
                {hours.map((h) => {
                  const slot = at[`${d}-${h}`];
                  if (!slot) return <td key={h} className="empty" />;
                  const dim = only && only !== slot.pattern;
                  return (
                    <td key={h} style={{ background: PATTERN_COLORS[(slot.pattern - 1) % 5], opacity: dim ? 0.15 : 1, color: slot.pattern === 3 ? "#1b2a41" : "#fff" }}
                      onMouseEnter={() => setHover({ ...slot, day })} onMouseLeave={() => setHover(null)}>
                      {slot.requests}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="heatTip">
        {hover
          ? `${hover.day} ${String(hover.hour).padStart(2, "0")}:00 · ${hover.requests} requests · mean ${hover.mean_minutes} min · pattern ${hover.pattern}`
          : "Hover a cell for details. Click a pattern below to isolate it."}
      </p>
      <div className="patterns">
        {heat.summary.map((p) => (
          <button key={p.pattern} className={only === p.pattern ? "on" : ""} onClick={() => setOnly(only === p.pattern ? null : p.pattern)}>
            <i style={{ background: PATTERN_COLORS[(p.pattern - 1) % 5] }} />
            <b>Pattern {p.pattern}</b>
            <span>{p.time_slots} slots · {Math.round(p.share_of_requests * 100)}% of requests · {p.requests_per_slot.toFixed(1)} per slot · {p.mean_minutes.toFixed(0)} min avg</span>
          </button>
        ))}
      </div>
    </section>
  );
}
