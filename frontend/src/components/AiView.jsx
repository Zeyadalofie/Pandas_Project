import React from "react";
import { Bars, FillErrors, Dispersion, ModelCompare, ClusterScatter } from "./PrepCharts.jsx";

const STAGES = [
  ["AI-1", "Generate", "A synthetic dataset with problems planted on purpose"],
  ["AI-2", "Explore", "Measure gaps, shape, spread and balance before touching anything"],
  ["AI-3", "Fill the gaps", "Mean or median by shape; method chosen by measured error"],
  ["AI-4", "Tame the spread", "Cap extreme values, reduce skew with a power transform"],
  ["AI-5", "Balance", "SMOTE-NC generates rows for the under-represented region"],
  ["AI-6", "Model", "K-Means on naive vs prepared vs balanced data"],
];

export function AiIdea() {
  return (
    <ol className="stages">
      {STAGES.map(([label, title, text]) => (
        <li key={label}>
          <b>{label}</b>
          <h4>{title}</h4>
          <p>{text}</p>
        </li>
      ))}
    </ol>
  );
}

export default function AiView({ prep }) {
  const f = prep.facts ?? {};
  const handling = (prep.dispersion ?? [])[0] ?? {};
  return (
    <section className="panel">
      <p className="eyebrow">Program code · AI project</p>
      <h2>EDA and data preparation for AI</h2>
      <p className="lead">
        A deliberately messy dataset is explored, repaired and balanced, and every decision is measured. The aim is data a
        model can learn from, not charts for a report.
      </p>
      <AiIdea />

      <h3 className="sec">Before and after</h3>
      <div className="metrics">
        <div><b>{f.empty_cells?.toLocaleString("en-US")} → 0</b><span>empty cells</span></div>
        <div><b>{handling.skew_before?.toFixed(2)} → {Math.abs(handling.skew_after_transform ?? 0).toFixed(2)}</b><span>skew of handling minutes</span></div>
        <div><b>{handling.max_before?.toFixed(0)} → {handling.max_after?.toFixed(0)}</b><span>largest handling value (min)</span></div>
        <div><b>{f.smallest_region_before_pct?.toFixed(0)}% → {f.smallest_region_after_pct?.toFixed(0)}%</b><span>share of the smallest region</span></div>
        <div><b>{f.naive_rows_kept_pct?.toFixed(0)}% vs 100%</b><span>rows kept: drop incomplete rows vs prepare</span></div>
      </div>

      <h3 className="sec">1 · What the exploration found</h3>
      <div className="two">
        {prep.missing && <Bars title="Missing values by column" rows={prep.missing} unit="%" colorA="#f4ad53" />}
        {prep.balance_before && <Bars title="Rows per region (largest vs smallest)" rows={prep.balance_before} />}
      </div>

      <h3 className="sec">2 · Filling the gaps: which method is closest to the truth?</h3>
      {prep.fill && <FillErrors fill={prep.fill} />}

      <h3 className="sec">3 · Dispersion and skew</h3>
      {prep.dispersion && <Dispersion rows={prep.dispersion} />}

      <h3 className="sec">4 · Balancing with synthetic rows</h3>
      {prep.balance_after && <Bars title="Rows per region after SMOTE-NC" rows={prep.balance_after} legend={["real rows", "synthetic rows"]} />}

      <h3 className="sec">5 · Does the preparation matter to the model?</h3>
      {prep.comparison && <ModelCompare rows={prep.comparison} best={prep.best} />}
      {prep.points && <ClusterScatter points={prep.points} />}

      <div className="verdict">
        <h3>Summary written from the measured numbers</h3>
        <p>{prep.brief}</p>
      </div>
    </section>
  );
}
