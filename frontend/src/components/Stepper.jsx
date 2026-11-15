import React from "react";

const GROUPS = [
  ["system", "Input"],
  ["notebook", "Notebook code"],
  ["program", "Program code"],
];

export default function Stepper({ steps, selected, onSelect }) {
  return (
    <aside className="stepper">
      {GROUPS.map(([kind, title]) => {
        const members = steps.map((s, i) => [s, i]).filter(([s]) => s.kind === kind);
        if (!members.length) return null;
        return (
          <div key={kind} className="group">
            <h4 className={`kind ${kind}`}>{title}</h4>
            <ol>
              {members.map(([step, i]) => (
                <li key={step.id}>
                  <button
                    className={`step ${step.status} ${i === selected ? "sel" : ""}`}
                    onClick={() => onSelect(i)}
                  >
                    <span className="dot" aria-hidden="true">
                      {step.status === "done" ? "✓" : step.status === "error" ? "!" : ""}
                    </span>
                    <span className="txt">
                      <b>{step.label}</b>
                      <span>{step.title}</span>
                    </span>
                    {step.status === "done" && <span className="ms">{fmt(step.ms)}</span>}
                  </button>
                </li>
              ))}
            </ol>
          </div>
        );
      })}
    </aside>
  );
}

function fmt(ms) {
  if (ms == null) return "";
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)} s` : `${ms} ms`;
}
