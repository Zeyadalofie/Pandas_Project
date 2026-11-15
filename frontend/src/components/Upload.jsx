import React, { useRef, useState } from "react";

export default function Upload({ expected, onStart }) {
  const [files, setFiles] = useState([]);
  const [over, setOver] = useState(false);
  const input = useRef(null);

  const names = files.map((f) => f.name);
  const hasZip = names.some((n) => n.toLowerCase().endsWith(".zip"));
  const missing = hasZip ? [] : expected.filter((n) => !names.includes(n));
  const ready = files.length > 0 && missing.length === 0;

  function add(list) {
    const incoming = Array.from(list);
    setFiles((old) => [...old.filter((o) => !incoming.some((n) => n.name === o.name)), ...incoming]);
  }

  return (
    <section className="upload">
      <div
        className={`drop ${over ? "over" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          add(e.dataTransfer.files);
        }}
        onClick={() => input.current.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && input.current.click()}
      >
        <input ref={input} type="file" multiple hidden accept=".zip,.csv,.db" onChange={(e) => add(e.target.files)} />
        <strong>Drop the project files here, or click to choose</strong>
        <span>
          Either the course ZIP (<code>week_06_team_project_data_S000.zip</code>) or the four files inside it.
        </span>
      </div>

      <div className="needs">
        <h3>Files the notebook needs</h3>
        <ul>
          {expected.map((name) => {
            const ok = hasZip || names.includes(name);
            return (
              <li key={name} className={ok ? "ok" : ""}>
                <span className="tick">{ok ? "✓" : "○"}</span>
                <code>{name}</code>
                {hasZip && <em>from the ZIP</em>}
              </li>
            );
          })}
        </ul>
        {files.length > 0 && (
          <p className="chosen">
            Selected: {names.join(", ")}{" "}
            <button className="link" onClick={() => setFiles([])}>
              clear
            </button>
          </p>
        )}
        <button className="primary" disabled={!ready} onClick={() => onStart(files)}>
          Run the pipeline
        </button>
        {!ready && files.length > 0 && <p className="hint">Still missing: {missing.join(", ")}</p>}
      </div>
    </section>
  );
}
