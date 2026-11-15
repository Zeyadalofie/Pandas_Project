import React, { useEffect, useState } from "react";
import DataTable from "./DataTable.jsx";
import AnomalyChart from "./AnomalyChart.jsx";
import MetricBars from "./MetricBars.jsx";
import Scene from "./Scene.jsx";

const KIND_LABEL = { notebook: "Notebook code", program: "Program code", system: "Web app" };

export default function StepDetail({ step, code, points, animate = true }) {
  const functions = step.functions.filter((name) => code[name]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(functions[0]);
  const [replay, setReplay] = useState(0);
  useEffect(() => {
    setActive(functions[0]);
  }, [step.id]);

  const ran = step.status === "done";
  return (
    <article className="detail" key={step.id}>
      <header>
        <div className="row">
          <span className={`kind ${step.kind}`}>{KIND_LABEL[step.kind]}</span>
          {step.kind !== "system" && <span className="owner">{step.owner}</span>}
          {ran && <span className="owner">took {step.ms >= 1000 ? `${(step.ms / 1000).toFixed(1)} s` : `${step.ms} ms`}</span>}
        </div>
        <h2>
          <span>{step.label}</span> {step.title}
        </h2>
        {ran && step.headline && <p className="lead">{step.headline}</p>}
      </header>

      {animate && step.status !== "pending" && step.status !== "error" && (
        <div className="stage">
          <Scene step={step} live={step.status === "running" || step.status === "idle"} replay={replay} />
          <button className="replay" onClick={() => setReplay((n) => n + 1)} title="Play this animation again">↻ Replay</button>
        </div>
      )}

      {step.status === "running" && (
        <div className="state running">
          <span className="spinner" /> Running {functions.length ? <code>{functions[0]}()</code> : "this step"}…
        </div>
      )}
      {step.status === "pending" && <div className="state">Waiting for the earlier steps.</div>}
      {step.status === "idle" && <div className="state">{functions.length ? "Upload files to run this step. Its code is shown below." : "Upload files to start. This step saves them to an inputs folder without changing them."}</div>}
      {step.status === "error" && (
        <div className="state failed">
          <b>This step stopped the run.</b>
          <p>{step.error}</p>
          <p className="note">Nothing after this step was executed, and no later output was written.</p>
        </div>
      )}

      {ran && (step.reads || step.writes) && (
        <section className="io" aria-label="where the data goes">
          <div className="box">
            <h5>Reads</h5>
            <ul>{(step.reads ?? []).map((r) => <li key={r}>{r}</li>)}</ul>
          </div>
          <div className="arrow">→</div>
          <div className="box fn">
            <h5>Runs</h5>
            <ul>
              {functions.length ? functions.map((f) => <li key={f}><code>{code[f].code.startsWith("def") ? `${f}()` : f}</code></li>) : <li>unpack and save</li>}
            </ul>
          </div>
          <div className="arrow">→</div>
          <div className="box">
            <h5>Writes</h5>
            <ul>{(step.writes ?? []).map((w) => <li key={w}>{w}</li>)}</ul>
          </div>
        </section>
      )}

      {ran && step.metrics && (
        <section className="metrics">
          {step.metrics.map((m) => (
            <div key={m.label}>
              <b>{typeof m.value === "number" ? m.value.toLocaleString("en-US") : m.value}</b>
              <span>{m.label}</span>
            </div>
          ))}
        </section>
      )}

      {ran && step.checks && (
        <ul className="checks">
          {step.checks.map((c) => (
            <li key={c.label} className={c.ok ? "ok" : "bad"}>
              <span>{c.ok ? "✓" : "✗"}</span> {c.label}
            </li>
          ))}
        </ul>
      )}

      {ran && step.chart === "anomaly" && points && <AnomalyChart data={points} />}
      {ran && step.bars && <MetricBars rows={step.bars} />}

      {ran && step.images && (
        <section className="gallery">
          {step.images.map((img) => (
            <figure key={img.url}>
              <img src={img.url} alt={img.title} />
              <figcaption>{img.title}</figcaption>
            </figure>
          ))}
        </section>
      )}

      {ran && step.text && (
        <section className="textblock">
          <h5>{step.text_title}</h5>
          {step.text.trim().startsWith("{") ? <pre>{step.text}</pre> : <p>{step.text}</p>}
        </section>
      )}

      {ran && (step.tables ?? []).map((t) => <DataTable key={t.title} table={t} />)}

      {functions.length > 0 && (
        <section className="code">
          <button className="toggle" onClick={() => setOpen((v) => !v)} aria-expanded={open || !ran}>
            {open || !ran ? "▾" : "▸"} Code this step runs, read from the notebook file
          </button>
          {(open || !ran) && (
            <>
              <div className="fnTabs">
                {functions.map((f) => (
                  <button key={f} className={f === active ? "on" : ""} onClick={() => setActive(f)}>
                    {f}
                  </button>
                ))}
              </div>
              {code[active] && (
                <>
                  <p className="note">
                    Notebook cell {code[active].cell + 1} · {KIND_LABEL[code[active].kind]}
                  </p>
                  <pre>{code[active].code}</pre>
                </>
              )}
            </>
          )}
        </section>
      )}
    </article>
  );
}
