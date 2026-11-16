import React from "react";

/* Animated picture for each pipeline step. Every drawing is original SVG.
   Rule: an element's un-animated position is its FINAL position, so the scene
   still makes sense when animations are switched off. */

const an = (name, dur, delay = 0, ease = "ease-in-out") => ({
  animation: `${name} calc(${dur}s * var(--k)) calc(${delay}s * var(--k)) both ${ease}`,
});
const C = { ink: "#1b2a41", indigo: "#4f63d9", teal: "#20b9b0", amber: "#f4ad53", red: "#d9534f", grey: "#9daabd", paper: "#ffffff", soft: "#e6eaf4" };

const metric = (step, label) => step.metrics?.find((m) => m.label === label)?.value;

function Belt({ x = 40, w = 820, y = 186 }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height="14" rx="7" fill="#c9d0e0" />
      <rect x={x + 4} y={y + 3} width={w - 8} height="8" rx="4" className="beltMove" fill="url(#beltStripes)" />
      {[x + 14, x + w / 2, x + w - 14].map((cx) => <circle key={cx} cx={cx} cy={y + 7} r="5" fill="#8592a8" />)}
    </g>
  );
}
function Carton({ x, y, s = 1, label }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <rect x="0" y="0" width="64" height="50" rx="3" fill="#d9a66b" stroke="#a9753c" strokeWidth="2" />
      <rect x="27" y="0" width="10" height="50" fill="#c48e52" />
      {label && <text x="32" y="32" textAnchor="middle" className="scTiny" fill="#5f3d14">{label}</text>}
    </g>
  );
}
function FileIcon({ x, y, label, color = C.indigo, style }) {
  return (
    <g style={style}>
      <g transform={`translate(${x} ${y})`}>
        <path d="M0 0h26l10 10v36H0z" fill={C.paper} stroke={color} strokeWidth="2" />
        <path d="M26 0v10h10" fill="none" stroke={color} strokeWidth="2" />
        <path d="M6 20h24M6 27h24M6 34h16" stroke={color} strokeWidth="2" opacity=".55" />
        <text x="18" y="60" textAnchor="middle" className="scTiny">{label}</text>
      </g>
    </g>
  );
}
function Machine({ x, y, w = 150, h = 96, label, color = C.indigo, children }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect width={w} height={h} rx="10" fill={color} />
      <rect x="10" y="10" width={w - 20} height="26" rx="5" fill="#fff" opacity=".18" />
      <circle cx="22" cy="23" r="5" fill={C.amber} className="blink" />
      <circle cx="38" cy="23" r="5" fill="#fff" opacity=".7" />
      <text x={w / 2} y={h - 16} textAnchor="middle" className="scLabel" fill="#fff">{label}</text>
      {children}
    </g>
  );
}
function Robot({ x, y }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <line x1="40" y1="0" x2="40" y2="-16" stroke={C.ink} strokeWidth="3" />
      <circle cx="40" cy="-20" r="5" fill={C.amber} className="blink" />
      <rect x="8" y="0" width="64" height="46" rx="12" fill={C.teal} />
      <circle cx="28" cy="22" r="8" fill="#fff" /><circle cx="52" cy="22" r="8" fill="#fff" />
      <circle cx="28" cy="22" r="3.5" fill={C.ink} className="eye" /><circle cx="52" cy="22" r="3.5" fill={C.ink} className="eye" />
      <rect x="16" y="50" width="48" height="44" rx="8" fill="#12968f" />
      <rect x="28" y="60" width="24" height="10" rx="3" fill="#fff" opacity=".5" />
    </g>
  );
}
const Count = ({ x, y, value, label, color = C.ink }) =>
  value == null ? null : (
    <g style={an("sc-fade", 0.5, 2.1)}>
      <text x={x} y={y} textAnchor="middle" className="scNum" fill={color}>{Number(value).toLocaleString("en-US")}</text>
      {label && <text x={x} y={y + 16} textAnchor="middle" className="scTiny">{label}</text>}
    </g>
  );

/* ------------------------------------------------------------------ scenes */
const SCENES = {
  upload: () => (
    <g>
      <rect x="40" y="186" width="820" height="8" rx="4" fill="#c9d0e0" />
      {/* unpacking station */}
      <rect x="560" y="60" width="150" height="14" rx="4" fill={C.ink} />
      <rect x="627" y="74" width="16" height="40" fill="#51607a" />
      <g style={an("sc-press", 0.9, 1.45)}><rect x="606" y="100" width="58" height="12" rx="3" fill={C.indigo} /></g>
      <text x="635" y="50" textAnchor="middle" className="scLabel">Unpack</text>
      {/* carton rides in on the truck, slides to the station, then opens */}
      <g style={an("sc-carton", 2.4, 0, "linear")}>
        <Carton x={603} y={136} label="ZIP" />
        <g style={an("sc-lid", 0.5, 1.9)}><rect x="601" y="130" width="68" height="9" rx="2" fill="#c48e52" stroke="#a9753c" strokeWidth="1.5" /></g>
      </g>
      {[["jan.csv", 706], ["feb.csv", 754], ["team.db", 802], ["targets", 850]].map(([label, x], i) => (
        <FileIcon key={label} x={x} y={112} label={label} color={i === 2 ? C.teal : C.indigo}
          style={{ ...an("sc-fly", 0.6, 2.1 + i * 0.12, "cubic-bezier(.2,.9,.3,1.2)"), "--fx": `${620 - x}px` }} />
      ))}
      <g style={an("sc-truck", 1.15, 0, "cubic-bezier(.3,.6,.3,1)")}>
        <rect x="250" y="150" width="130" height="14" rx="3" fill="#51607a" />
        <path d="M380 164v-52h44l26 26v26z" fill={C.indigo} />
        <path d="M392 120h28l18 18h-46z" fill="#dfe6ff" />
        <rect x="244" y="164" width="212" height="8" rx="3" fill={C.ink} />
        {[284, 420].map((cx) => (
          <g key={cx}><circle cx={cx} cy="176" r="14" fill={C.ink} /><g className="wheel"><circle cx={cx} cy="176" r="6" fill="#c9d0e0" /><path d={`M${cx - 6} 176h12M${cx} 170v12`} stroke={C.ink} strokeWidth="2" /></g></g>
        ))}
      </g>
    </g>
  ),

  ex01: (step) => (
    <g>
      <Belt />
      {["jan", "feb", "db", "tgt"].map((label, i) => (
        <FileIcon key={label} x={330} y={126} label="" color={i === 2 ? C.teal : C.indigo} style={an("sc-intoMachine", 1.0, i * 0.32, "linear")} />
      ))}
      <Machine x={340} y={90} label="load_sources()" />
      {["jan", "feb", "mar"].map((name, t) => (
        <g key={name} style={an("sc-rise", 0.5, 1.4 + t * 0.25)}>
          <rect x={560 + t * 100} y="92" width="84" height="92" rx="6" fill={C.paper} stroke={C.soft} strokeWidth="2" />
          <rect x={560 + t * 100} y="92" width="84" height="18" rx="6" fill={C.indigo} opacity=".85" />
          {[0, 1, 2, 3, 4].map((r) => <rect key={r} x={568 + t * 100} y={118 + r * 12} width={68 - (r % 3) * 12} height="6" rx="3" fill={C.grey} opacity=".7" />)}
          <text x={602 + t * 100} y="106" textAnchor="middle" className="scTiny" fill="#fff">{name}</text>
        </g>
      ))}
      {["jan", "feb", "mar"].map((name, t) => <Count key={name} x={602 + t * 100} y={74} value={metric(step, `${name} raw rows`)} label="rows" />)}
      <text x="120" y="104" className="scLabel">4 files in</text>
    </g>
  ),

  ex02: (step) => (
    <g>
      <rect x="220" y="46" width="360" height="150" rx="8" fill={C.paper} stroke={C.soft} strokeWidth="2" />
      {[0, 1, 2, 3, 4, 5].map((r) => [0, 1, 2, 3].map((c) => {
        const bad = (r * 4 + c) % 7 === 3;
        return <rect key={`${r}${c}`} x={236 + c * 84} y={62 + r * 21} width="70" height="11" rx="4" fill={bad ? C.amber : C.grey} opacity={bad ? 1 : 0.55} style={bad ? an("sc-flash", 0.5, 0.5 + r * 0.25) : undefined} />;
      }))}
      <g className="scan"><circle cx="270" cy="92" r="26" fill="#fff" fillOpacity=".35" stroke={C.ink} strokeWidth="5" /><path d="M289 111l22 22" stroke={C.ink} strokeWidth="7" strokeLinecap="round" /></g>
      <Count x={680} y={96} value={metric(step, "exact duplicates")} label="exact duplicates" color={C.grey} />
      <Count x={680} y={156} value={metric(step, "missing-value tokens")} label="missing tokens" color="#b9770e" />
    </g>
  ),

  ex03: (step) => {
    const bins = [["Accepted", C.teal, 470, "accepted"], ["Rejected", C.red, 620, "rejected"], ["Duplicate", C.grey, 770, "exact duplicates"]];
    const items = [0, 0, 1, 0, 0, 2, 0, 1, 0, 0, 0, 1, 0, 0];
    const seen = [0, 0, 0];
    return (
      <g>
        <Belt x={40} w={790} y={92} />
        <Machine x={250} y={30} w={140} h={60} label="clean_month()" />
        {bins.map(([name, color, x, key]) => (
          <g key={name}>
            <path d={`M${x - 46} 128h92l-10 66h-72z`} fill={color} opacity=".16" stroke={color} strokeWidth="2.5" />
            <text x={x} y="216" textAnchor="middle" className="scLabel" fill={color === C.grey ? C.ink : color}>{name}</text>
            <Count x={x} y={124} value={metric(step, key)} color={color === C.grey ? C.ink : color} />
          </g>
        ))}
        {items.map((b, i) => {
          const n = seen[b]++;
          const x = bins[b][2] - 30 + (n % 4) * 17, y = 178 - Math.floor(n / 4) * 16;
          return <rect key={i} x={x} y={y} width="13" height="13" rx="3" fill={bins[b][1]}
            style={{ ...an("sc-sort", 1.1, i * 0.13, "cubic-bezier(.5,0,.8,.6)"), "--sx": `${70 - x}px`, "--sy": `${78 - y}px` }} />;
        })}
      </g>
    );
  },

  ex05: (step) => (
    <g>
      {["jan", "feb", "mar"].map((name, i) => (
        <g key={name}>
          <path d={`M90 ${62 + i * 52}C260 ${62 + i * 52} 280 114 420 114`} fill="none" stroke={[C.indigo, C.teal, C.amber][i]} strokeWidth="16" strokeLinecap="round" opacity=".28" pathLength="1" style={{ ...an("sc-draw", 0.9, i * 0.2), strokeDasharray: 1, "--len": 1 }} />
          <text x="62" y={67 + i * 52} textAnchor="middle" className="scLabel">{name}</text>
        </g>
      ))}
      <Machine x={420} y={66} w={130} label="integrate()" />
      <g style={an("sc-fromLeft", 0.7, 1.2)}>
        <rect x="610" y="52" width="210" height="130" rx="8" fill={C.paper} stroke={C.soft} strokeWidth="2" />
        {[0, 1, 2, 3, 4, 5].map((r) => (
          <g key={r}>
            <rect x="622" y={66 + r * 18} width="110" height="9" rx="4" fill={[C.indigo, C.teal, C.amber][r % 3]} opacity=".6" />
            <rect x="742" y={64 + r * 18} width="66" height="13" rx="6" fill={C.teal} style={an("sc-pop", 0.35, 1.8 + r * 0.1)} />
          </g>
        ))}
        <text x="775" y="48" textAnchor="middle" className="scTiny">+ region</text>
      </g>
      <Count x={715} y={206} value={metric(step, "analytical rows")} label="" />
    </g>
  ),

  ex06: (step) => (
    <g>
      <line x1="150" y1="186" x2="750" y2="186" stroke="#c9d0e0" strokeWidth="4" />
      {[[92, 70], [64, 84], [110, 96], [58, 50], [80, 88], [74, 60]].map(([a, t], i) => (
        <g key={i}>
          <rect x={180 + i * 96} y={186 - a} width="26" height={a} rx="4" fill={C.indigo} className="growY" style={an("sc-grow", 0.6, 0.2 + i * 0.14)} />
          <rect x={210 + i * 96} y={186 - t} width="26" height={t} rx="4" fill={C.grey} className="growY" style={an("sc-grow", 0.6, 0.3 + i * 0.14)} />
          <text x={208 + i * 96} y={178 - Math.max(a, t)} textAnchor="middle" className="scNum sm" fill={a >= t ? "#12968f" : C.red} style={an("sc-fade", 0.4, 1.5 + i * 0.1)}>{a >= t ? "▲" : "▼"}</text>
        </g>
      ))}
      <g style={an("sc-fade", 0.5, 2)}>
        <text x="800" y="96" textAnchor="middle" className="scNum" fill="#12968f">{metric(step, "above target") ?? ""}</text><text x="800" y="112" textAnchor="middle" className="scTiny">above target</text>
        <text x="800" y="152" textAnchor="middle" className="scNum" fill={C.red}>{metric(step, "below target") ?? ""}</text><text x="800" y="168" textAnchor="middle" className="scTiny">below target</text>
      </g>
      <text x="90" y="110" textAnchor="middle" className="scLabel">actual</text><rect x="62" y="118" width="56" height="8" rx="4" fill={C.indigo} />
      <text x="90" y="150" textAnchor="middle" className="scLabel">target</text><rect x="62" y="158" width="56" height="8" rx="4" fill={C.grey} />
    </g>
  ),

  ex07: () => (
    <g>
      <text x="450" y="34" textAnchor="middle" className="scLabel">region × month</text>
      {[0, 1, 2, 3].map((r) => [0, 1, 2, 3].map((c) => {
        const head = r === 0 || c === 0;
        return <rect key={`${r}${c}`} x={270 + c * 92} y={46 + r * 38} width="84" height="30" rx="6" fill={head ? C.indigo : C.teal} opacity={head ? 0.9 : 0.25 + ((r * 3 + c) % 4) * 0.2}
          className="popBox" style={an("sc-pop", 0.35, (r + c) * 0.16)} />;
      }))}
    </g>
  ),

  ex08: () => (
    <g>
      <Machine x={110} y={76} w={170} h={104} label="make_team_figures()" />
      <rect x="276" y="118" width="12" height="44" fill={C.ink} />
      {[0, 1, 2].map((i) => (
        <g key={i} style={{ ...an("sc-fromLeft", 0.7, 0.4 + i * 0.55, "cubic-bezier(.2,.8,.3,1)"), "--dx": `${-(160 + i * 180)}px` }}>
          <rect x={330 + i * 180} y="62" width="150" height="120" rx="8" fill={C.paper} stroke={C.soft} strokeWidth="2" />
          {i < 2 ? [0, 1, 2, 3, 4].map((b) => <rect key={b} x={346 + i * 180 + b * 25} y={162 - [50, 74, 40, 62, 84][(b + i) % 5]} width="17" height={[50, 74, 40, 62, 84][(b + i) % 5]} rx="3" fill={[C.indigo, C.teal, C.amber][b % 3]} />)
            : [0, 1, 2].map((b) => <g key={b}><rect x={706 + b * 40} y={162 - [60, 44, 72][b]} width="14" height={[60, 44, 72][b]} rx="3" fill={C.indigo} /><rect x={722 + b * 40} y={162 - [50, 56, 58][b]} width="14" height={[50, 56, 58][b]} rx="3" fill={C.grey} /></g>)}
          <text x={405 + i * 180} y="204" textAnchor="middle" className="scTiny">{["requests_by_region", "minutes_by_desk", "gap_vs_target"][i]}.png</text>
        </g>
      ))}
    </g>
  ),

  ex09: (step) => (
    <g>
      <Belt />
      <Machine x={60} y={84} w={150} h={100} label="run_pipeline()" />
      {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
        <g key={i} style={{ ...an("sc-fromLeft", 0.6, 0.2 + i * 0.17, "cubic-bezier(.2,.8,.3,1)"), "--dx": `${-(120 + i * 72)}px` }}>
          <Carton x={250 + i * 72} y={140} s={0.72} />
          <g className="popBox" style={an("sc-pop", 0.3, 1.5 + i * 0.09)}><circle cx={273 + i * 72} cy={128} r="11" fill={C.teal} /><path d={`M${267 + i * 72} 128l4 4 8-9`} fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" /></g>
        </g>
      ))}
      <text x="540" y="60" textAnchor="middle" className="scLabel">4 CSV + 3 PNG + manifest, each sealed with a checksum</text>
      <Count x={540} y={96} value={metric(step, "files written")} label="" color="#12968f" />
    </g>
  ),

  ex10: () => (
    <g>
      <rect x="300" y="26" width="300" height="184" rx="8" fill={C.paper} stroke={C.soft} strokeWidth="2" />
      <text x="324" y="56" className="scLabel">Findings brief</text>
      {[0, 1, 2, 3, 4, 5].map((i) => <path key={i} d={`M324 ${78 + i * 20}h${[250, 232, 246, 210, 240, 150][i]}`} stroke={C.grey} strokeWidth="6" strokeLinecap="round" pathLength="1" style={{ ...an("sc-draw", 0.4, 0.2 + i * 0.36, "linear"), strokeDasharray: 1, "--len": 1 }} />)}
      <g style={an("sc-pen", 2.3, 0.1, "linear")}><path d="M0 0l10-26 12 5-10 26-12 7z" fill={C.indigo} transform="translate(476 152)" /></g>
    </g>
  ),

  bonus: () => (
    <g>
      <g transform="translate(250 60)">
        <path d="M0 16v96c0 9 27 16 60 16s60-7 60-16V16" fill={C.indigo} />
        <ellipse cx="60" cy="16" rx="60" ry="16" fill="#7f8fe8" />
        <path d="M0 48c0 9 27 16 60 16s60-7 60-16M0 80c0 9 27 16 60 16s60-7 60-16" fill="none" stroke="#fff" strokeOpacity=".4" strokeWidth="2" />
      </g>
      <g style={{ ...an("sc-fromLeft", 0.7, 0.2), "--dx": "-170px" }}>
        <rect x="64" y="96" width="150" height="34" rx="17" fill={C.ink} /><text x="139" y="118" textAnchor="middle" className="scTiny" fill="#fff">SELECT … GROUP BY</text>
      </g>
      {[0, 1].map((t) => (
        <g key={t} style={an("sc-rise", 0.5, 1.1 + t * 0.4)}>
          <rect x={440 + t * 200} y="56" width="170" height="130" rx="8" fill={C.paper} stroke={C.soft} strokeWidth="2" />
          <rect x={440 + t * 200} y="56" width="170" height="20" rx="8" fill={C.teal} />
          {[0, 1, 2, 3, 4].map((r) => <rect key={r} x={452 + t * 200} y={88 + r * 18} width={146 - (r % 2) * 30} height="8" rx="4" fill={C.grey} opacity=".65" />)}
          <text x={525 + t * 200} y="206" textAnchor="middle" className="scTiny">{t ? "missing minutes" : "minutes by type"}</text>
        </g>
      ))}
    </g>
  ),

  ai1: (step) => {
    const cols = [C.indigo, C.indigo, C.indigo, C.teal, C.indigo, C.indigo, C.amber, C.indigo];
    return (
      <g>
        <Belt />
        <Machine x={60} y={78} w={190} h={106} label="make_messy_dataset()" />
        {cols.map((color, r) => (
          <g key={r} style={{ ...an("sc-fromLeft", 0.6, 0.2 + r * 0.17, "cubic-bezier(.2,.8,.3,1)"), "--dx": `${-(120 + r * 70)}px` }}>
            {[0, 1, 2, 3].map((c) => {
              const hole = (r * 3 + c * 5) % 7 === 2, big = r === 4 && c === 1;
              return hole
                ? <rect key={c} x={290 + r * 70} y={62 + c * 30} width="56" height="22" rx="5" fill="none" stroke={C.red} strokeWidth="2" strokeDasharray="5 4" />
                : <rect key={c} x={290 + r * 70 - (big ? 6 : 0)} y={62 + c * 30 - (big ? 6 : 0)} width={big ? 68 : 56} height={big ? 34 : 22} rx="5" fill={c === 0 ? color : C.grey} opacity={c === 0 ? 1 : 0.6} />;
            })}
          </g>
        ))}
        <text x="570" y="40" textAnchor="middle" className="scLabel">rows with gaps, one extreme value, and far more of one group</text>
        <Count x={155} y={46} value={metric(step, "empty cells")} label="empty cells" color={C.red} />
      </g>
    );
  },

  ai2: (step) => (
    <g>
      <rect x="150" y="40" width="400" height="160" rx="8" fill={C.paper} stroke={C.soft} strokeWidth="2" />
      {[0, 1, 2, 3, 4, 5].map((r) => [0, 1, 2, 3, 4].map((c) => {
        const hole = (r * 5 + c * 3) % 8 === 3;
        return hole
          ? <rect key={`${r}${c}`} x={166 + c * 76} y={56 + r * 23} width="64" height="13" rx="4" fill={C.amber} style={an("sc-flash", 0.5, 0.5 + (r + c) * 0.15)} />
          : <rect key={`${r}${c}`} x={166 + c * 76} y={56 + r * 23} width="64" height="13" rx="4" fill={C.grey} opacity=".5" />;
      }))}
      <g className="scan"><circle cx="200" cy="80" r="26" fill="#fff" fillOpacity=".35" stroke={C.ink} strokeWidth="5" /><path d="M219 99l22 22" stroke={C.ink} strokeWidth="7" strokeLinecap="round" /></g>
      {[[96, C.indigo], [34, C.teal], [11, C.amber]].map(([h, color], i) => (
        <rect key={i} x={620 + i * 46} y={170 - h} width="34" height={h} rx="4" fill={color} className="growY" style={an("sc-grow", 0.6, 1.2 + i * 0.15)} />
      ))}
      <text x="686" y="190" textAnchor="middle" className="scTiny">rows per region</text>
      <Count x={800} y={110} value={metric(step, "columns with gaps")} label="columns with gaps" color="#b9770e" />
    </g>
  ),

  ai3: (step) => (
    <g>
      <text x="450" y="30" textAnchor="middle" className="scLabel">each gap is filled by the method with the lowest measured error</text>
      <rect x="230" y="44" width="440" height="160" rx="8" fill={C.paper} stroke={C.soft} strokeWidth="2" />
      {[0, 1, 2, 3, 4, 5].map((r) => [0, 1, 2, 3, 4].map((c) => {
        const hole = (r * 5 + c * 3) % 8 === 3, x = 248 + c * 82, y = 60 + r * 23;
        return (
          <g key={`${r}${c}`}>
            {hole && <rect x={x} y={y} width="70" height="13" rx="4" fill="none" stroke={C.red} strokeWidth="1.5" strokeDasharray="4 3" style={an("sc-out", 0.3, 0.6 + (r + c) * 0.16)} />}
            <rect x={x} y={y} width="70" height="13" rx="4" fill={hole ? C.teal : C.grey} opacity={hole ? 1 : 0.5} className="popBox" style={hole ? an("sc-pop", 0.35, 0.6 + (r + c) * 0.16) : undefined} />
          </g>
        );
      }))}
      <Count x={130} y={120} value={metric(step, "cells filled")} label="cells filled" color="#12968f" />
      <Count x={770} y={120} value={metric(step, "gaps left")} label="gaps left" />
    </g>
  ),

  ai4: () => (
    <g>
      <text x="230" y="30" textAnchor="middle" className="scLabel">extreme values are capped at the fence</text>
      <line x1="80" y1="190" x2="380" y2="190" stroke="#c9d0e0" strokeWidth="4" />
      {[46, 60, 38, 150, 52, 44, 130, 58].map((h, i) => {
        const capped = Math.min(h, 84);
        return (
          <g key={i}>
            {h > 84 && <rect x={96 + i * 34} y={190 - h} width="22" height={h - 84} rx="3" fill={C.red} opacity=".7" style={an("sc-out", 0.6, 1.0 + i * 0.05)} />}
            <rect x={96 + i * 34} y={190 - capped} width="22" height={capped} rx="3" fill={h > 84 ? C.amber : C.indigo} />
          </g>
        );
      })}
      <line x1="80" y1="106" x2="380" y2="106" stroke={C.ink} strokeWidth="2" strokeDasharray="6 5" style={an("sc-fade", 0.4, 0.5)} />
      <text x="384" y="102" className="scTiny" style={an("sc-fade", 0.4, 0.5)}>fence</text>
      <text x="670" y="30" textAnchor="middle" className="scLabel">a power transform removes the long tail</text>
      <line x1="500" y1="190" x2="840" y2="190" stroke="#c9d0e0" strokeWidth="4" />
      <path d="M510 188C540 188 548 70 580 70C612 70 640 160 720 178C770 186 810 188 836 188" fill="none" stroke={C.grey} strokeWidth="4" style={an("sc-out", 0.6, 1.5)} />
      <path d="M510 188C580 188 610 64 670 64C730 64 760 188 836 188" fill="none" stroke={C.teal} strokeWidth="5" pathLength="1" style={{ ...an("sc-draw", 0.9, 1.6), strokeDasharray: 1, "--len": 1 }} />
    </g>
  ),

  ai5: (step) => {
    const real = [[610, 86], [668, 70], [704, 118], [640, 142], [716, 168], [600, 176]];
    const made = [[639, 78], [686, 94], [672, 130], [678, 155], [620, 159], [657, 106], [710, 143], [625, 114]];
    return (
      <g>
        <text x="220" y="30" textAnchor="middle" className="scLabel">large region: many real rows</text>
        {Array.from({ length: 46 }, (_, i) => <circle key={i} cx={110 + (i * 53) % 230} cy={56 + (i * 37) % 140} r="6" fill={C.indigo} opacity=".75" />)}
        <text x="640" y="30" textAnchor="middle" className="scLabel">small region: new rows between real neighbours</text>
        {made.map(([x, y], i) => {
          const [ax, ay] = real[i % real.length], [bx, by] = real[(i + 1) % real.length];
          return <path key={i} d={`M${ax} ${ay}L${bx} ${by}`} stroke={C.amber} strokeWidth="1.5" strokeDasharray="4 4" opacity=".7" style={an("sc-fade", 0.3, 0.5 + i * 0.18)} />;
        })}
        {real.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="8" fill={C.amber} stroke={C.ink} strokeWidth="1.5" />)}
        {made.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="7" fill="#fff" stroke={C.amber} strokeWidth="3" className="popBox" style={an("sc-pop", 0.35, 0.7 + i * 0.18)} />)}
        <Count x={820} y={120} value={metric(step, "synthetic rows added")} label="synthetic rows" color="#b9770e" />
      </g>
    );
  },

  ai6: () => {
    const groups = [[C.indigo, 300, 110], [C.teal, 600, 120]];
    return (
      <g>
        <text x="450" y="30" textAnchor="middle" className="scLabel">K-Means gathers similar requests into clusters</text>
        {Array.from({ length: 40 }, (_, i) => {
          const [color, gx, gy] = groups[i % 2];
          const x = gx + Math.cos(i * 2.4) * (20 + (i % 5) * 12), y = gy + Math.sin(i * 2.4) * (12 + (i % 4) * 9);
          const sx = 80 + ((i * 97) % 740) - x, sy = 50 + ((i * 53) % 140) - y;
          return <circle key={i} cx={x} cy={y} r="7" fill={color} style={{ ...an("sc-gather", 1.3, 0.2 + (i % 6) * 0.08, "cubic-bezier(.4,0,.2,1)"), "--sx": `${sx}px`, "--sy": `${sy}px` }} />;
        })}
        {groups.map(([color, gx, gy], i) => (
          <g key={i} className="popBox" style={an("sc-pop", 0.45, 1.6 + i * 0.12)}>
            <ellipse cx={gx} cy={gy} rx="96" ry="62" fill="none" stroke={color} strokeWidth="2.5" strokeDasharray="6 6" />
            <text x={gx} y={gy + 84} textAnchor="middle" className="scTiny">Cluster {i + 1}</text>
          </g>
        ))}
        <text x="450" y="218" textAnchor="middle" className="scTiny">trained three times: naive, prepared, prepared + balanced</text>
      </g>
    );
  },
};

export default function Scene({ step, live, replay }) {
  const draw = SCENES[step.id];
  if (!draw) return null;
  return (
    <div className={`scene ${live ? "live" : ""}`}>
      <svg viewBox="0 0 900 230" role="img" aria-label={`Animation: ${step.title}`}>
        <defs>
          <pattern id="beltStripes" width="24" height="8" patternUnits="userSpaceOnUse"><rect width="12" height="8" fill="#aab3c7" /></pattern>
        </defs>
        <g key={replay}>{draw(step)}</g>
      </svg>
    </div>
  );
}
