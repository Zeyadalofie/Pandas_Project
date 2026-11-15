import React from "react";
import AnomalyChart from "./AnomalyChart.jsx";
import MetricBars from "./MetricBars.jsx";
import PatternHeat from "./PatternHeat.jsx";

const find = (steps, id) => steps.find((s) => s.id === id) ?? {};
const metric = (step, label) => step.metrics?.find((m) => m.label === label)?.value;

export function AiIdea() {
  return (
    <div className="idea">
      <div className="ideaCard rule">
        <h4>Fixed rule (notebook)</h4>
        <p className="big">480 min</p>
        <p>One ceiling for every request type. A 300-minute “Lost Item” passes, although it is far from normal for that type.</p>
      </div>
      <div className="ideaCard base">
        <h4>Baseline (program)</h4>
        <p className="big">median ± MAD</p>
        <p>A simple statistic that learns a separate ceiling for each request type. No model needed.</p>
      </div>
      <div className="ideaCard model">
        <h4>AI model (program)</h4>
        <p className="big">Isolation Forest</p>
        <p>An unsupervised model that learns what a normal request looks like from minutes, hour and type, then scores how unusual each row is.</p>
      </div>
    </div>
  );
}

export default function AiView({ steps, points, heat }) {
  const ai1 = find(steps, "ai1"), ai2 = find(steps, "ai2"), ai3 = find(steps, "ai3"), ai4 = find(steps, "ai4");
  const agreement = ai2.tables?.[0]?.rows ?? [];
  const bars = Object.fromEntries((ai3.bars ?? []).map((r) => [r.detector, r]));
  const pct = (v) => (v == null ? "–" : `${Math.round(v * 100)}%`);
  return (
    <section className="panel">
      <p className="eyebrow">Program code · AI project</p>
      <h2>Anomaly detection vs cleaning rules</h2>
      <p className="lead">
        The notebook rejects any request above a fixed 480-minute ceiling. The question: can a detector that learns what is
        normal <em>for each request type</em> find suspicious durations the fixed rule lets through?
      </p>
      <AiIdea />

      <h3 className="sec">What happened on your data</h3>
      <div className="metrics">
        <div><b>{metric(ai1, "rows to score")?.toLocaleString("en-US")}</b><span>rows scored</span></div>
        <div><b>{metric(ai1, "rejected by the 480 rule")}</b><span>rejected by the fixed rule</span></div>
        <div><b>{metric(ai2, "accepted rows flagged by both")}</b><span>accepted, but both detectors call them unusual</span></div>
        <div><b>{metric(ai2, "lowest learned ceiling (min)")}–{metric(ai2, "highest learned ceiling (min)")}</b><span>learned ceilings (min), vs 480 fixed</span></div>
      </div>
      {points && <AnomalyChart data={points} />}

      <h3 className="sec">Which detector is better? A test with a known answer</h3>
      <p className="lead">
        Real data has no label saying “this duration is wrong”, so known anomalies are hidden below the 480 ceiling in 20
        seeded runs. The fixed rule cannot see them by design; the real contest is the model against the baseline.
      </p>
      <table className="score">
        <thead><tr><th>Detector</th><th className="num">Also catches the rule's rejects</th><th className="num">Hidden anomalies found (recall)</th><th className="num">Flags that were right (precision)</th></tr></thead>
        <tbody>
          <tr><td>Fixed 480 rule</td><td className="num">–</td><td className="num">{pct(bars["Fixed 480 rule"]?.recall_mean)}</td><td className="num">{pct(bars["Fixed 480 rule"]?.precision_mean)}</td></tr>
          {agreement.map((row) => (
            <tr key={row[0]}><td>{row[0]}</td><td className="num">{row[2]} of {row[1]}</td><td className="num">{pct(bars[row[0]]?.recall_mean)}</td><td className="num">{pct(bars[row[0]]?.precision_mean)}</td></tr>
          ))}
        </tbody>
      </table>
      {ai3.bars && <MetricBars rows={ai3.bars} />}

      <div className="verdict">
        <h3>{ai4.headline}</h3>
        <p>{ai4.text}</p>
      </div>

      {heat && (
        <>
          <h3 className="sec">Second idea: demand patterns with K-Means</h3>
          <p className="lead">
            Every hour of the week is described by how many requests arrive, how long they take and which types they are.
            K-Means groups similar hours into {heat.k} patterns; the number of patterns is the one with the best silhouette
            score. Here the separation is {heat.strength} (silhouette {heat.silhouette}), so read the patterns as
            {heat.strength === "weak" ? " a rough guide, not sharp groups" : " meaningful groups"}.
          </p>
          <PatternHeat heat={heat} />
        </>
      )}

      <h3 className="sec">Third idea: ask the data in plain language</h3>
      <p className="lead">
        A question in Arabic or English becomes one read-only SQL query. Try it in the <b>Ask the data</b> tab.
      </p>
    </section>
  );
}
