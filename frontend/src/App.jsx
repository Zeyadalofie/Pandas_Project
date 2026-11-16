import React, { useEffect, useMemo, useRef, useState } from "react";
import Upload from "./components/Upload.jsx";
import Stepper from "./components/Stepper.jsx";
import StepDetail from "./components/StepDetail.jsx";
import FlowView from "./components/FlowView.jsx";
import TraceView from "./components/TraceView.jsx";
import OutputsView from "./components/OutputsView.jsx";
import AiView, { AiIdea } from "./components/AiView.jsx";

// Animation speed: how long each step's scene plays before the next step is revealed.
const SPEEDS = { Normal: { ms: 2900, k: 1 }, Fast: { ms: 1300, k: 0.42 }, Off: { ms: 350, k: 0.001 } };
const TABS = [
  ["steps", "Step by step"],
  ["ai", "AI data prep"],
  ["flow", "Data flow"],
  ["trace", "Trace a row"],
  ["outputs", "Outputs"],
];

export default function App() {
  const [info, setInfo] = useState(null);
  const [run, setRun] = useState(null);
  const [runId, setRunId] = useState(null);
  const [revealed, setRevealed] = useState(0);
  const [selected, setSelected] = useState(0);
  const [tab, setTab] = useState("steps");
  const [problem, setProblem] = useState(null);
  const [speed, setSpeed] = useState("Normal");
  const follow = useRef(true);

  useEffect(() => {
    fetch("/api/info")
      .then((r) => r.json())
      .then(setInfo)
      .catch(() => setProblem("The Python backend is not reachable. Start it with: python run.py"));
  }, []);

  // Poll the backend while a run is in progress.
  useEffect(() => {
    if (!runId) return;
    let alive = true;
    let timer;
    const tick = async () => {
      try {
        const data = await (await fetch(`/api/runs/${runId}`)).json();
        if (!alive) return;
        setRun(data);
        if (data.status === "running") timer = setTimeout(tick, 350);
      } catch {
        if (alive) setProblem("Lost the connection to the backend.");
      }
    };
    tick();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [runId]);

  // Reveal finished steps one at a time so each one can be seen.
  const steps = run?.steps ?? [];
  useEffect(() => {
    const next = steps[revealed];
    if (!next || (next.status !== "done" && next.status !== "error")) return;
    const timer = setTimeout(() => {
      setRevealed((n) => n + 1);
      if (follow.current) setSelected(Math.min(revealed + 1, steps.length - 1));
    }, SPEEDS[speed].ms);
    return () => clearTimeout(timer);
  }, [steps, revealed, speed]);

  const shown = useMemo(
    () =>
      (run ? steps : info?.steps ?? []).map((step, i) => {
        if (!run) return { ...step, status: "idle" };
        if (i < revealed) return step;
        if (i === revealed) return { ...step, status: step.status === "pending" ? "pending" : "running" };
        return { ...step, status: "pending" };
      }),
    [run, steps, info, revealed]
  );

  const finished = run && revealed >= steps.length && run.status === "done";
  const failed = run?.status === "error" && steps.findIndex((s) => s.status === "error") < revealed;

  async function start(files) {
    setProblem(null);
    const form = new FormData();
    files.forEach((f) => form.append("files", f));
    try {
      const response = await fetch("/api/runs", { method: "POST", body: form });
      if (!response.ok) throw new Error((await response.json()).detail ?? "Upload failed");
      const { id } = await response.json();
      follow.current = true;
      setRun(null);
      setRevealed(0);
      setSelected(0);
      setTab("steps");
      setRunId(id);
    } catch (error) {
      setProblem(String(error.message ?? error));
    }
  }

  function reset() {
    setRunId(null);
    setRun(null);
    setRevealed(0);
    setSelected(0);
    setTab("steps");
  }

  const current = shown[selected];
  const doneCount = Math.min(revealed, steps.length);

  return (
    <div className="app" style={{ "--k": SPEEDS[speed].k }}>
      <header className="top">
        <div>
          <p className="eyebrow">Week 06 · Team 06 · Reproducible data pipeline</p>
          <h1>Pipeline Explorer</h1>
          <p className="sub">
            Upload the project files and watch the team notebook process them, one function at a time.
          </p>
        </div>
        <div className="legend">
          <span className="kind notebook">Notebook code</span>
          <span className="kind program">Program code</span>
          <p>The backend runs the functions straight from the .ipynb file. Nothing is rewritten.</p>
        </div>
      </header>

      {problem && <div className="banner error">{problem}</div>}

      {!runId && <Upload expected={info?.expected_files ?? []} onStart={start} />}

      {runId && (
        <>
          <div className="runbar">
            <div className="progress" aria-label="progress">
              <div style={{ width: `${steps.length ? (doneCount / steps.length) * 100 : 0}%` }} />
            </div>
            <span className="runstate">
              {failed
                ? "Stopped on an error"
                : finished
                ? `Finished: ${steps.length} steps`
                : `Running step ${Math.min(doneCount + 1, steps.length || 1)} of ${steps.length || "…"}`}
            </span>
            <label className="speed">
              Animation
              <select value={speed} onChange={(e) => setSpeed(e.target.value)}>
                {Object.keys(SPEEDS).map((name) => <option key={name}>{name}</option>)}
              </select>
            </label>
            <button className="ghost" onClick={reset}>
              Upload other files
            </button>
          </div>

          <nav className="tabs">
            {TABS.map(([id, label]) => {
              const locked = id !== "steps" && !finished;
              return (
                <button
                  key={id}
                  className={tab === id ? "on" : ""}
                  disabled={locked}
                  title={locked ? "Available when the run finishes" : ""}
                  onClick={() => setTab(id)}
                >
                  {label}
                </button>
              );
            })}
          </nav>

          {tab === "steps" && (
            <div className="work">
              <Stepper
                steps={shown}
                selected={selected}
                onSelect={(i) => {
                  follow.current = false;
                  setSelected(i);
                }}
              />
              {current && <StepDetail step={current} code={run?.code ?? info?.code ?? {}} prep={run?.prep} animate={speed !== "Off"} />}
            </div>
          )}
          {tab === "ai" && finished && <AiView prep={run.prep ?? {}} />}
          {tab === "flow" && finished && <FlowView flow={run.flow} />}
          {tab === "trace" && finished && <TraceView rows={run.rows} />}
          {tab === "outputs" && finished && <OutputsView outputs={run.outputs} />}
        </>
      )}

      {!runId && info && (
        <section className="preview">
          <h2>The AI project in one picture</h2>
          <p className="lead">EDA for modelling: a messy dataset is explored, repaired and balanced, then an unsupervised model shows whether the preparation mattered.</p>
          <AiIdea />
          <h2>What will run</h2>
          <div className="work">
            <Stepper steps={shown} selected={selected} onSelect={setSelected} />
            {current && <StepDetail step={current} code={info.code} animate />}
          </div>
        </section>
      )}

      <footer>
        Team 06: Salem Alharbi · Mohammed Almogbel · Ziyad Alharbi · Fahad Hamdan Alharbi. The dataset is
        synthetic; results show a method, not real service performance.
      </footer>
    </div>
  );
}
