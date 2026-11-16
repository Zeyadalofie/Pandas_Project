import React, { useState } from "react";

const PALETTE = ["#4f63d9", "#20b9b0", "#f4ad53", "#d9534f", "#9daabd", "#1b2a41"];
const num = (v, d = 1) => (typeof v === "number" ? (Math.abs(v) < 0.5 / 10 ** d ? 0 : v).toLocaleString("en-US", { maximumFractionDigits: d }) : v);

/* Horizontal bars. rows: [{label, a, b?}] — b is drawn stacked after a. */
export function Bars({ title, rows, unit = "", colorA = "#4f63d9", colorB = "#f4ad53", legend, best }) {
  const max = Math.max(...rows.map((r) => r.a + (r.b ?? 0)), 1e-9);
  return (
    <section className="chart">
      <div className="chartHead">
        <h5>{title}</h5>
        {legend && (
          <span className="key inline">
            <span><i className="k sq" style={{ background: colorA }} /> {legend[0]}</span>
            <span><i className="k sq" style={{ background: colorB }} /> {legend[1]}</span>
          </span>
        )}
      </div>
      <div className="hbars">
        {rows.map((r) => (
          <div key={r.label} className={`hbar ${best === r.label ? "best" : ""}`}>
            <span className="lab">{r.label}</span>
            <span className="track">
              <i style={{ width: `${(r.a / max) * 100}%`, background: colorA }} />
              {r.b > 0 && <i style={{ width: `${(r.b / max) * 100}%`, background: colorB }} />}
            </span>
            <span className="val">
              {num(r.a, 2)}{unit}{r.b > 0 ? ` + ${num(r.b)}` : ""}{best === r.label ? "  ✓ lowest" : ""}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

export function FillErrors({ fill }) {
  const [column, setColumn] = useState(fill[0]?.column);
  const current = fill.find((f) => f.column === column) ?? fill[0];
  if (!current) return null;
  const best = current.errors.reduce((m, e) => (e.a < m.a ? e : m), current.errors[0]).label;
  return (
    <div>
      <div className="pick">
        <span>Column:</span>
        {fill.map((f) => (
          <button key={f.column} className={f.column === current.column ? "on" : ""} onClick={() => setColumn(f.column)}>{f.column}</button>
        ))}
      </div>
      <Bars title={`Error of each fill method on hidden known values: ${current.column} (lower is better)`} rows={current.errors} best={best} colorA="#9daabd" />
      <p className="note">
        Shape says <b>{current.statistic}</b> (the column is {current.statistic === "median" ? "skewed or heavy-tailed" : "roughly symmetric"}). Method used: <b>{current.method}</b>.
      </p>
    </div>
  );
}

export function Dispersion({ rows }) {
  return (
    <section className="chart">
      <div className="chartHead"><h5>Before and after treatment</h5></div>
      <table className="score flat">
        <thead>
          <tr><th>Column</th><th className="num">Values capped</th><th className="num">Largest value</th><th className="num">Spread (CV)</th><th className="num">Skew</th></tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.column}>
              <td>{r.column}</td>
              <td className="num">{r.values_capped}</td>
              <td className="num">{num(r.max_before)} → <b>{num(r.max_after)}</b></td>
              <td className="num">{num(r.cv_before, 2)} → <b>{num(r.cv_after, 2)}</b></td>
              <td className="num">{num(r.skew_before, 2)} → {num(r.skew_after_capping, 2)} → <b>{num(r.skew_after_transform, 2)}</b></td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="note">Skew is shown raw → after capping → after the power transform. Near 0 means a symmetric shape.</p>
    </section>
  );
}

export function ModelCompare({ rows, best }) {
  return (
    <div className="versions">
      {rows.map((r) => (
        <div key={r.version} className={`version ${r.version === best ? "best" : ""}`}>
          <h4>{r.version}</h4>
          <dl>
            <dt>Rows used</dt><dd>{r.rows_used.toLocaleString("en-US")} <span>({num(r.share_of_original_rows_pct, 0)}% of the original)</span></dd>
            <dt>Smallest region</dt><dd>{num(r.smallest_region_share_pct)}% <span>of the rows</span></dd>
            <dt>Clusters</dt><dd>{r.clusters}</dd>
            <dt>Separation (silhouette)</dt><dd>{num(r.silhouette, 3)}</dd>
            <dt>Stability across seeds</dt><dd>{num(r.stability, 3)}</dd>
          </dl>
          {r.version === best && <p className="tag">best separated</p>}
        </div>
      ))}
    </div>
  );
}

const W = 880, H = 420, PAD = 28;
export function ClusterScatter({ points }) {
  const [mode, setMode] = useState("cluster");
  const [hover, setHover] = useState(null);
  const xs = points.map((p) => p.x), ys = points.map((p) => p.y);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const sx = (v) => PAD + ((v - x0) / (x1 - x0 || 1)) * (W - 2 * PAD);
  const sy = (v) => H - PAD - ((v - y0) / (y1 - y0 || 1)) * (H - 2 * PAD);
  const regions = [...new Set(points.map((p) => p.region))].sort();
  const keyOf = (p) => (mode === "cluster" ? `Cluster ${p.cluster}` : mode === "region" ? p.region : p.is_synthetic ? "Synthetic row" : "Real row");
  const colorOf = (p) =>
    mode === "cluster" ? PALETTE[(p.cluster - 1) % 6] : mode === "region" ? PALETTE[regions.indexOf(p.region) % 6] : p.is_synthetic ? "#f4ad53" : "#4f63d9";
  const keys = [...new Set(points.map(keyOf))].sort();
  return (
    <section className="chart">
      <div className="chartHead">
        <h5>Clusters on the prepared and balanced data (each dot is one request, 2-D view by PCA)</h5>
        <label>Colour by{" "}
          <select value={mode} onChange={(e) => setMode(e.target.value)}>
            <option value="cluster">cluster</option>
            <option value="region">region</option>
            <option value="synthetic">real vs synthetic</option>
          </select>
        </label>
      </div>
      <div className="chartWrap">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Scatter of clustered requests">
          <rect x="1" y="1" width={W - 2} height={H - 2} rx="8" fill="#fafbfd" stroke="#e1e5ee" />
          {points.map((p, i) => (
            <circle key={i} cx={sx(p.x)} cy={sy(p.y)} r="3.4" fill={colorOf(p)} opacity=".62"
              onMouseEnter={() => setHover({ ...p, cx: sx(p.x), cy: sy(p.y) })} onMouseLeave={() => setHover(null)} />
          ))}
        </svg>
        {hover && (
          <div className="tip" style={{ left: `${(hover.cx / W) * 100}%`, top: `${(hover.cy / H) * 100}%` }}>
            Cluster {hover.cluster} · {hover.region} · {hover.is_synthetic ? "synthetic row" : "real row"}
          </div>
        )}
      </div>
      <div className="key">
        {keys.map((k) => {
          const sample = points.find((p) => keyOf(p) === k);
          return <span key={k}><i className="k" style={{ background: colorOf(sample) }} /> {k}</span>;
        })}
      </div>
    </section>
  );
}
