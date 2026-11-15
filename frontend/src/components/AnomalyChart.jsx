import React, { useMemo, useState } from "react";

const W = 880;
const H = 380;
const PAD = { l: 56, r: 16, t: 16, b: 40 };

// Stable horizontal jitter from the request id, so the picture never changes between renders.
function jitter(text) {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) >>> 0;
  return (h % 1000) / 1000 - 0.5;
}

export default function AnomalyChart({ data }) {
  const [zoom, setZoom] = useState(false);
  const [hover, setHover] = useState(null);
  const types = useMemo(() => Object.keys(data.ceilings).sort(), [data]);
  const maxCeiling = Math.max(...Object.values(data.ceilings));
  const top = zoom ? Math.ceil((maxCeiling * 2.2) / 10) * 10 : Math.ceil((data.max_minutes * 1.08) / 20) * 20;
  const band = (W - PAD.l - PAD.r) / types.length;
  const y = (m) => PAD.t + (1 - Math.min(Math.max(m, 0), top) / top) * (H - PAD.t - PAD.b);
  const ticks = Array.from({ length: 5 }, (_, i) => Math.round((top / 4) * i));
  const offScale = data.rows.filter((r) => r.minutes > top || r.minutes < 0).length;

  const dots = data.rows
    .map((r) => {
      const t = types.indexOf(r.request_type);
      if (t < 0) return null;
      const kind = r.rule_rejected ? "rule" : r.both_flag ? "flag" : "ok";
      return { ...r, kind, cx: PAD.l + band * (t + 0.5) + jitter(r.request_id) * band * 0.56, cy: y(r.minutes) };
    })
    .filter(Boolean)
    .sort((a, b) => (a.kind === "ok" ? -1 : 1) - (b.kind === "ok" ? -1 : 1));

  return (
    <section className="chart">
      <div className="chartHead">
        <h5>Handling minutes by request type: fixed ceiling vs the ceiling learned for each type</h5>
        <label>
          <input type="checkbox" checked={zoom} onChange={(e) => setZoom(e.target.checked)} /> Zoom into the normal range
        </label>
      </div>
      <div className="chartWrap">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Scatter of handling minutes by request type">
          {ticks.map((t) => (
            <g key={t}>
              <line x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} className="grid" />
              <text x={PAD.l - 8} y={y(t) + 4} textAnchor="end" className="tick">{t}</text>
            </g>
          ))}
          <text x={14} y={H / 2} transform={`rotate(-90 14 ${H / 2})`} textAnchor="middle" className="axis">Handling minutes</text>
          {data.max_minutes <= top && (
            <g>
              <line x1={PAD.l} x2={W - PAD.r} y1={y(data.max_minutes)} y2={y(data.max_minutes)} className="fixed" />
              <text x={W - PAD.r} y={y(data.max_minutes) - 6} textAnchor="end" className="tick">fixed ceiling {data.max_minutes}</text>
            </g>
          )}
          {types.map((type, t) => (
            <g key={type}>
              <line x1={PAD.l + band * (t + 0.14)} x2={PAD.l + band * (t + 0.86)} y1={y(data.ceilings[type])} y2={y(data.ceilings[type])} className="learned" />
              <text x={PAD.l + band * (t + 0.5)} y={H - 14} textAnchor="middle" className="cat">{type}</text>
            </g>
          ))}
          {dots.map((d) =>
            d.kind === "rule" ? (
              <path key={d.source + d.source_row} d={`M${d.cx - 4} ${d.cy - 4}L${d.cx + 4} ${d.cy + 4}M${d.cx + 4} ${d.cy - 4}L${d.cx - 4} ${d.cy + 4}`}
                className="dot rule" onMouseEnter={() => setHover(d)} onMouseLeave={() => setHover(null)} />
            ) : (
              <circle key={d.source + d.source_row} cx={d.cx} cy={d.cy} r={d.kind === "flag" ? 5.5 : 3}
                className={`dot ${d.kind}`} onMouseEnter={() => setHover(d)} onMouseLeave={() => setHover(null)} />
            )
          )}
        </svg>
        {hover && (
          <div className="tip" style={{ left: `${(hover.cx / W) * 100}%`, top: `${(hover.cy / H) * 100}%` }}>
            <b>{hover.request_id}</b> · {hover.source} row {hover.source_row}
            <br />
            {hover.request_type}: {hover.minutes} min
            <br />
            baseline score {hover.mad_score} · forest score {hover.forest_score}
            <br />
            {hover.kind === "rule" ? "Rejected by the 480 rule" : hover.kind === "flag" ? "Accepted, but both detectors call it unusual" : "Accepted, not flagged"}
          </div>
        )}
      </div>
      <div className="key">
        <span><i className="k ok" /> Accepted, not flagged</span>
        <span><i className="k flag" /> Accepted, flagged by both detectors</span>
        <span><i className="k rule">×</i> Rejected by the 480 rule</span>
        <span><i className="k learned" /> Ceiling learned for the type</span>
        {offScale > 0 && <span className="muted">{offScale} values beyond the axis are drawn at its edge</span>}
      </div>
    </section>
  );
}
