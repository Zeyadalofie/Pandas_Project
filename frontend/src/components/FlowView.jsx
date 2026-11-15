import React, { useMemo, useState } from "react";

const W = 980, H = 520, NODE = 16, GAP = 14, TOP = 44, LABEL = 34;
const COLS = [150, 470, 790];
const ORDER = { "out:Accepted": 0, "out:Rejected": 1, "out:Exact duplicate": 2 };
const TITLES = ["Source file", "Cleaning result (EX03)", "Where it ends up"];

function tone(id) {
  if (id.includes("Accepted") || id.endsWith("region")) return "acc";
  if (id.includes("duplicate")) return "dup";
  if (id.startsWith("src:")) return "src";
  return "rej";
}

export default function FlowView({ flow }) {
  const [hover, setHover] = useState(null);
  const layout = useMemo(() => build(flow.links), [flow]);
  return (
    <section className="panel">
      <h2>Where every raw row goes</h2>
      <p className="lead">
        Band thickness is the number of rows. Hover a band or a box for the exact count. {flow.note}
      </p>
      <svg viewBox={`0 0 ${W} ${H}`} className="sankey" role="img" aria-label="Flow of rows from source files to their final place">
        {TITLES.map((t, i) => (
          <text key={t} x={COLS[i] + NODE / 2} y={20} textAnchor="middle" className="colTitle">{t}</text>
        ))}
        {layout.links.map((l) => (
          <path key={l.from + l.to} d={l.d} strokeWidth={Math.max(l.w, 1.5)}
            className={`band ${tone(l.to)} ${hover && hover !== l.from && hover !== l.to && hover !== l.from + l.to ? "dim" : ""}`}
            onMouseEnter={() => setHover(l.from + l.to)} onMouseLeave={() => setHover(null)}>
            <title>{`${name(l.from)} → ${name(l.to)}: ${l.value.toLocaleString("en-US")} rows`}</title>
          </path>
        ))}
        {layout.nodes.map((n) => (
          <g key={n.id} onMouseEnter={() => setHover(n.id)} onMouseLeave={() => setHover(null)}>
            <rect x={n.x} y={n.y} width={NODE} height={Math.max(n.h, 3)} rx="3" className={`node ${tone(n.id)}`} />
            <text x={n.col === 0 ? n.x - 10 : n.x + NODE + 10} y={n.y + Math.max(n.h, 3) / 2 - 2}
              textAnchor={n.col === 0 ? "end" : "start"} className="nodeName">{name(n.id)}</text>
            <text x={n.col === 0 ? n.x - 10 : n.x + NODE + 10} y={n.y + Math.max(n.h, 3) / 2 + 14}
              textAnchor={n.col === 0 ? "end" : "start"} className="nodeVal">{n.value.toLocaleString("en-US")} rows</text>
          </g>
        ))}
      </svg>
    </section>
  );
}

function name(id) {
  const text = id.slice(id.indexOf(":") + 1);
  if (id.startsWith("src:")) return { jan: "January CSV", feb: "February CSV", mar: "March (SQLite)" }[text] ?? text;
  return text.replaceAll("_", " ");
}

function build(links) {
  const nodes = new Map();
  const touch = (id) => {
    if (!nodes.has(id)) nodes.set(id, { id, inn: 0, out: 0, col: id.startsWith("src:") ? 0 : id.startsWith("out:") ? 1 : 2 });
    return nodes.get(id);
  };
  links.forEach((l) => {
    touch(l.from).out += l.value;
    touch(l.to).inn += l.value;
  });
  const cols = [0, 1, 2].map((c) => [...nodes.values()].filter((n) => n.col === c));
  cols[1].sort((a, b) => ORDER[a.id] - ORDER[b.id]);
  cols[2].sort((a, b) => (tone(a.id) === tone(b.id) ? b.inn - a.inn : tone(a.id) === "acc" ? -1 : 1));
  cols.forEach((col) => col.forEach((n) => (n.value = Math.max(n.inn, n.out))));
  // Every box keeps room for its two-line label, even when it holds only a few rows.
  const room = H - TOP - 20;
  const height = (col, s) => col.reduce((sum, n) => sum + Math.max(n.value * s, LABEL), 0) + GAP * (col.length - 1);
  let scale = Math.min(...cols.map((col) => (room - GAP * (col.length - 1)) / col.reduce((s, n) => s + n.value, 0)));
  while (cols.some((col) => height(col, scale) > room) && scale > 0.001) scale *= 0.96;
  cols.forEach((col, c) => {
    let y = TOP + (room - height(col, scale)) / 2;
    col.forEach((n) => {
      const h = n.value * scale, slot = Math.max(h, LABEL);
      Object.assign(n, { x: COLS[c], y: y + (slot - h) / 2, h, usedOut: 0, usedIn: 0 });
      y += slot + GAP;
    });
  });
  const rank = (id) => {
    const n = nodes.get(id);
    return n.col * 100 + cols[n.col].indexOf(n);
  };
  const drawn = [...links]
    .sort((a, b) => rank(a.from) - rank(b.from) || rank(a.to) - rank(b.to))
    .map((l) => {
      const a = nodes.get(l.from), b = nodes.get(l.to), w = l.value * scale;
      const y0 = a.y + a.usedOut + w / 2, y1 = b.y + b.usedIn + w / 2;
      a.usedOut += w;
      b.usedIn += w;
      const x0 = a.x + NODE, x1 = b.x, mid = (x0 + x1) / 2;
      return { ...l, w, d: `M${x0} ${y0}C${mid} ${y0} ${mid} ${y1} ${x1} ${y1}` };
    });
  return { nodes: [...nodes.values()], links: drawn };
}
