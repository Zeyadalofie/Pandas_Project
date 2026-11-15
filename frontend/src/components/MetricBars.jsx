import React from "react";

const W = 880, H = 300, PAD = { l: 48, r: 16, t: 24, b: 36 };
const METRICS = [["precision", "Precision"], ["recall", "Recall"], ["average_precision", "Average precision"]];
const CLASS = { "Fixed 480 rule": "rule", "MAD baseline": "base", "Isolation Forest": "forest" };

export default function MetricBars({ rows }) {
  const band = (W - PAD.l - PAD.r) / METRICS.length;
  const bar = (band * 0.72) / rows.length;
  const y = (v) => PAD.t + (1 - Math.min(v, 1.05) / 1.05) * (H - PAD.t - PAD.b);
  return (
    <section className="chart">
      <div className="chartHead">
        <h5>Finding the injected anomalies: mean of the seeded runs (whiskers show one standard deviation)</h5>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Precision, recall and average precision by detector">
        {[0, 0.25, 0.5, 0.75, 1].map((t) => (
          <g key={t}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} className="grid" />
            <text x={PAD.l - 8} y={y(t) + 4} textAnchor="end" className="tick">{t.toFixed(2)}</text>
          </g>
        ))}
        {METRICS.map(([key, label], m) => (
          <g key={key}>
            <text x={PAD.l + band * (m + 0.5)} y={H - 12} textAnchor="middle" className="cat">{label}</text>
            {rows.map((row, i) => {
              const mean = row[`${key}_mean`] ?? 0;
              const sd = row[`${key}_std`] ?? 0;
              const x = PAD.l + band * m + band * 0.14 + bar * i;
              const cx = x + bar / 2 - 2;
              return (
                <g key={row.detector}>
                  <rect x={x} y={y(mean)} width={bar - 4} height={Math.max(y(0) - y(mean), 1)} rx="3" className={`bar ${CLASS[row.detector]}`}>
                    <title>{`${row.detector} · ${label}: ${mean.toFixed(3)} ± ${sd.toFixed(3)}`}</title>
                  </rect>
                  {sd > 0 && <path d={`M${cx} ${y(mean + sd)}V${y(Math.max(mean - sd, 0))}M${cx - 5} ${y(mean + sd)}h10M${cx - 5} ${y(Math.max(mean - sd, 0))}h10`} className="whisker" />}
                  <text x={cx} y={y(mean + sd) - 6} textAnchor="middle" className="val">{mean.toFixed(2)}</text>
                </g>
              );
            })}
          </g>
        ))}
      </svg>
      <div className="key">
        {rows.map((r) => (
          <span key={r.detector}><i className={`k bar ${CLASS[r.detector]}`} /> {r.detector}</span>
        ))}
      </div>
    </section>
  );
}
