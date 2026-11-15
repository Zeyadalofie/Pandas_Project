import React, { useState } from "react";
import DataTable from "./DataTable.jsx";

export default function AskView({ runId, examples, keyOnServer }) {
  const [question, setQuestion] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState([]);
  const [problem, setProblem] = useState(null);
  const canUseModel = keyOnServer || apiKey.trim().length > 0;

  async function ask(text) {
    const q = (text ?? question).trim();
    if (!q || busy) return;
    setBusy(true);
    setProblem(null);
    try {
      const response = await fetch(`/api/runs/${runId}/ask`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question: q, api_key: apiKey.trim() || null }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail ?? "The question could not be answered.");
      setHistory((old) => [data, ...old]);
      setQuestion("");
    } catch (error) {
      setProblem(String(error.message ?? error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel ask">
      <p className="eyebrow">Program code · AI project</p>
      <h2>Ask the data</h2>
      <p className="lead">
        Type a question in Arabic or English. It becomes one SQL <code>SELECT</code> on the accepted requests, and the SQL is
        shown so the answer can be checked. The query runs on a temporary read-only copy: nothing can be changed or deleted.
      </p>

      <form className="askBar" onSubmit={(e) => { e.preventDefault(); ask(); }}>
        <input dir="auto" value={question} onChange={(e) => setQuestion(e.target.value)}
          placeholder="e.g. Which region has the most accepted requests?  /  أي منطقة فيها أكثر طلبات مقبولة؟" />
        <button className="primary" disabled={busy || !question.trim()}>{busy ? "Working…" : "Ask"}</button>
      </form>

      <div className={`mode ${canUseModel ? "on" : ""}`}>
        {canUseModel
          ? "Language model is on: any question can be asked. Its SQL is still checked and run read-only."
          : "Offline mode: the built-in questions below work without internet. Add an API key to ask anything else."}
        <details>
          <summary>API key (optional)</summary>
          <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="Anthropic API key" autoComplete="off" />
          <p className="note">Used only for your questions in this page and never saved. Or set ANTHROPIC_API_KEY before starting the server.</p>
        </details>
      </div>

      <h3 className="sec">Built-in questions (work offline)</h3>
      <div className="chips">
        {examples.map((e) => (
          <React.Fragment key={e.en}>
            <button onClick={() => ask(e.en)} disabled={busy}>{e.en}</button>
            <button onClick={() => ask(e.ar)} disabled={busy} dir="rtl">{e.ar}</button>
          </React.Fragment>
        ))}
      </div>

      {problem && <div className="banner error">{problem}</div>}

      {history.map((item, i) => (
        <article key={history.length - i} className="answer">
          <header>
            <h4 dir="auto">{item.question}</h4>
            <span className={`kind ${item.source === "language model" ? "program" : ""}`}>SQL from: {item.source}</span>
          </header>
          <pre>{item.sql}</pre>
          <DataTable table={item.table} />
        </article>
      ))}
    </section>
  );
}
