"""Run the notebook's functions one step at a time and record what each step did.

Nothing here re-implements the analysis. Every step calls a function that lives in the
notebook (loaded by notebook_loader) and then describes its inputs and outputs so the
web page can show where the data went.
"""
from __future__ import annotations

import hashlib
import json
import sqlite3
import threading
import time
import traceback
import zipfile
from pathlib import Path

import pandas as pd

from notebook_loader import load_notebook

EXPECTED_FILES = ("jan_requests.csv", "feb_requests.csv", "team_data.db", "targets.csv")
PLOT_LOCK = threading.Lock()   # matplotlib's pyplot is not safe across threads

# id, label, title, kind, owner, functions shown in the "code" panel
STEP_SPECS = [
    ("upload", "Files", "Receive and unpack the uploaded files", "system", "Web app", []),
    ("ex01", "EX01", "Load the four sources", "notebook", "Role A · Salem Alharbi", ["load_sources", "check_interface"]),
    ("ex02", "EX02", "Intake report on the raw data", "notebook", "Role A · Salem Alharbi", ["intake_report"]),
    ("ex03", "EX03–04", "Clean every month and reconcile the counts", "notebook", "Role B · Mohammed Almogbel", ["clean_month", "clean_all_months"]),
    ("ex05", "EX05", "Integrate months with the desk lookup", "notebook", "Role C · Ziyad Alharbi", ["integrate"]),
    ("ex06", "EX06", "Compare accepted requests with targets", "notebook", "Role C · Ziyad Alharbi", ["compare_targets"]),
    ("ex07", "EX07", "Summaries by region and by desk", "notebook", "Role D · Fahad Hamdan Alharbi", ["summaries"]),
    ("ex08", "EX08", "Draw the three team figures", "notebook", "Role D · Fahad Hamdan Alharbi", ["make_team_figures"]),
    ("ex09", "EX09", "Run the full pipeline and verify the outputs", "notebook", "Team", ["run_pipeline", "_csv_bytes"]),
    ("ex10", "EX10", "Facts and findings brief", "notebook", "Role D + Team", ["brief_facts"]),
    ("bonus", "Bonus", "SQL insights on the analytical table", "notebook", "Mohammed Almogbel", ["handling_sql", "quality_sql"]),
    ("ai1", "AI-1", "Build the modelling table and detectors", "program", "AI project", ["build_model_table", "mad_scores", "forest_scores"]),
    ("ai2", "AI-2", "Score the real data and learn ceilings", "program", "AI project", ["score_table", "rule_agreement", "suggested_ceilings", "review_candidates"]),
    ("ai3", "AI-3", "Controlled test with injected anomalies", "program", "AI project", ["injection_experiment", "paired_gap"]),
    ("ai4", "AI-4", "AI figures, facts and brief", "program", "AI project", ["make_ai_figures", "ai_brief_facts", "write_ai_outputs"]),
]


def table(df: pd.DataFrame, title: str, limit: int | None = None, note: str | None = None) -> dict:
    """DataFrame -> JSON-safe table (NaN -> null, datetimes -> text)."""
    total = int(len(df))
    part = (df.head(limit) if limit else df).copy()
    for column in part.columns:
        if pd.api.types.is_datetime64_any_dtype(part[column]):
            part[column] = part[column].dt.strftime("%Y-%m-%d %H:%M")
    part = part.round(4)
    return {"title": title, "columns": [str(c) for c in part.columns],
            "rows": json.loads(part.to_json(orient="values")), "total": total, "note": note}


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


class Run:
    def __init__(self, run_id: str, run_dir: Path, uploads: dict[str, bytes]):
        self.id = run_id
        self.dir = run_dir
        self.uploads = uploads
        self.status = "running"
        self.error: str | None = None
        self.steps = [{"id": s[0], "label": s[1], "title": s[2], "kind": s[3], "owner": s[4],
                       "functions": s[5], "status": "pending"} for s in STEP_SPECS]
        self.flow: dict | None = None
        self.rows: list | None = None
        self.points: list | None = None
        self.outputs: list = []
        self.code: dict = {}
        self.ctx: dict = {}

    # ------------------------------------------------------------------ public
    def snapshot(self) -> dict:
        return {"id": self.id, "status": self.status, "error": self.error, "steps": self.steps,
                "flow": self.flow, "rows": self.rows, "points": self.points,
                "outputs": self.outputs, "code": self.code}

    def execute(self) -> None:
        try:
            self.ns, catalog = load_notebook()
            self.code = catalog
        except Exception as exc:  # the notebook itself is broken
            self.status, self.error = "error", f"Could not load the notebook: {exc}"
            return
        for step in self.steps:
            step["status"] = "running"
            started = time.perf_counter()
            try:
                with PLOT_LOCK:
                    payload = getattr(self, f"_{step['id']}")()
                step.update(payload)
                step["ms"] = round((time.perf_counter() - started) * 1000)
                step["status"] = "done"
            except Exception as exc:
                step["ms"] = round((time.perf_counter() - started) * 1000)
                step["status"] = "error"
                step["error"] = f"{type(exc).__name__}: {exc}"
                step["trace"] = traceback.format_exc(limit=4)
                self.status, self.error = "error", f"{step['label']} failed: {exc}"
                return
        self.status = "done"

    # ------------------------------------------------------------------ helpers
    def _url(self, relative: str) -> str:
        return f"/api/runs/{self.id}/files/{relative}"

    def _save_images(self, folder: str, images: dict[str, bytes]) -> list:
        target = self.dir / folder
        target.mkdir(parents=True, exist_ok=True)
        saved = []
        for name in sorted(images):
            (target / name).write_bytes(images[name])
            saved.append({"title": name, "url": self._url(f"{folder}/{name}")})
        return saved

    # ------------------------------------------------------------------ steps
    def _upload(self) -> dict:
        inputs = self.dir / "inputs"
        inputs.mkdir(parents=True, exist_ok=True)
        found: dict[str, bytes] = {}
        origin = {}
        for name, data in self.uploads.items():
            if name.lower().endswith(".zip"):
                with zipfile.ZipFile(__import__("io").BytesIO(data)) as archive:
                    for member in archive.namelist():
                        base = Path(member).name          # never trust paths inside a ZIP
                        if base in EXPECTED_FILES:
                            found[base] = archive.read(member)
                            origin[base] = f"{name} → {member}"
            elif Path(name).name in EXPECTED_FILES:
                found[Path(name).name] = data
                origin[Path(name).name] = name
        missing = [n for n in EXPECTED_FILES if n not in found]
        if missing:
            raise ValueError(f"Missing input files: {', '.join(missing)}. Upload the course ZIP "
                             f"or these four files: {', '.join(EXPECTED_FILES)}")
        rows = []
        for name in EXPECTED_FILES:
            (inputs / name).write_bytes(found[name])
            rows.append([name, origin[name], len(found[name]), sha256(found[name])[:16], f"inputs/{name}"])
        self.uploads = {}
        self.ctx["paths"] = {"jan": inputs / "jan_requests.csv", "feb": inputs / "feb_requests.csv",
                             "db": inputs / "team_data.db", "targets": inputs / "targets.csv"}
        return {"headline": "4 input files saved; the originals are never modified.",
                "reads": ["your upload"], "writes": [f"inputs/{n}" for n in EXPECTED_FILES],
                "tables": [{"title": "Files received", "total": 4, "note": None,
                            "columns": ["file", "came from", "bytes", "sha256 (first 16)", "saved to"], "rows": rows}]}

    def _ex01(self) -> dict:
        ns, months = self.ns, self.ns["MONTHS"]
        sources = ns["load_sources"](self.ctx["paths"])
        self.ctx["sources"] = sources
        tables = [table(sources[m], f"{m}: raw rows exactly as stored (text)", limit=6) for m in months]
        tables += [table(sources["desks"], "desks lookup (SQLite, read-only)"),
                   table(sources["targets"], "targets")]
        return {"headline": "CSV fields are read as text; SQLite is opened read-only. Nothing is cleaned yet.",
                "metrics": [{"label": f"{m} raw rows", "value": int(len(sources[m]))} for m in months] +
                           [{"label": "desks", "value": int(len(sources["desks"]))},
                            {"label": "targets", "value": int(len(sources["targets"]))}],
                "reads": ["inputs/jan_requests.csv", "inputs/feb_requests.csv",
                          "inputs/team_data.db (march_requests, desks)", "inputs/targets.csv"],
                "writes": ["memory: sources[jan | feb | mar | desks | targets]"], "tables": tables}

    def _ex02(self) -> dict:
        intake = self.ns["intake_report"](self.ctx["sources"])
        return {"headline": "Problems are counted on the raw data, before any cleaning can hide them.",
                "metrics": [{"label": "exact duplicates", "value": int(intake["exact_duplicates"].sum())},
                            {"label": "missing-value tokens", "value": int(intake["missing_tokens"].sum())}],
                "reads": ["memory: sources"], "writes": ["memory: intake report"],
                "tables": [table(intake, "Intake report")]}

    def _ex03(self) -> dict:
        ns, sources = self.ns, self.ctx["sources"]
        # Same normalisation run_pipeline applies before cleaning.
        codes = set(sources["desks"]["desk_code"].astype(str).str.strip())
        codes = {c.zfill(3) if c.isdigit() else c for c in codes}
        cleaned, summary = ns["clean_all_months"](sources, codes)
        self.ctx.update(cleaned=cleaned, cleaning_summary=summary, valid_codes=codes)
        reasons, samples = [], []
        for month in ns["MONTHS"]:
            rejected = cleaned[month]["rejected"]
            for reason, count in rejected["reasons"].value_counts().sort_index().items():
                reasons.append({"source": month, "reasons": reason, "rows": int(count)})
            samples.append(rejected.assign(source=month))
        rejected_all = pd.concat(samples, ignore_index=True)
        front = ["source", "source_row", "reasons"]
        rejected_all = rejected_all[front + [c for c in rejected_all.columns if c not in front]]
        return {"headline": "Every raw row ends in exactly one place: duplicate, rejected (with reasons) or accepted.",
                "metrics": [{"label": "raw rows", "value": int(summary["raw_rows"].sum())},
                            {"label": "exact duplicates", "value": int(summary["exact_duplicates"].sum())},
                            {"label": "rejected", "value": int(summary["rejected"].sum())},
                            {"label": "accepted", "value": int(summary["accepted"].sum())}],
                "checks": [{"label": "raw = duplicates + accepted + rejected, for every month",
                            "ok": bool(summary["reconciled"].all())}],
                "reads": ["memory: sources[jan | feb | mar]", "desk codes from the SQLite lookup"],
                "writes": ["memory: cleaned[month].accepted", "memory: cleaned[month].rejected (+ reasons)"],
                "tables": [table(summary, "Cleaning summary"),
                           table(pd.DataFrame(reasons, columns=["source", "reasons", "rows"]), "Why rows were rejected"),
                           table(rejected_all, "Rejected rows", limit=12,
                                 note="Use the “Trace a row” tab to see every row.")]}

    def _ex05(self) -> dict:
        analytical = self.ns["integrate"](self.ctx["cleaned"], self.ctx["sources"]["desks"])
        self.ctx["analytical"] = analytical
        by_region = analytical.groupby("region", as_index=False).size().rename(columns={"size": "accepted_requests"})
        return {"headline": "Accepted months are stacked, then each row gets its region and staffed hours from the desk lookup.",
                "metrics": [{"label": "analytical rows", "value": int(len(analytical))},
                            {"label": "columns", "value": int(analytical.shape[1])},
                            {"label": "regions", "value": int(analytical["region"].nunique())}],
                "checks": [{"label": "every accepted row matched exactly one desk", "ok": True},
                           {"label": "no request_id appears in two months", "ok": True}],
                "reads": ["memory: cleaned[month].accepted", "memory: sources[desks]"],
                "writes": ["memory: analytical table"],
                "tables": [table(by_region, "Accepted requests per region"),
                           table(analytical, "Analytical table", limit=8)]}

    def _ex06(self) -> dict:
        vs_target = self.ns["compare_targets"](self.ctx["analytical"], self.ctx["sources"]["targets"])
        self.ctx["vs_target"] = vs_target
        return {"headline": "Starts from all targets, so a region-month with zero requests still appears.",
                "metrics": [{"label": "above target", "value": int((vs_target["gap"] > 0).sum())},
                            {"label": "below target", "value": int((vs_target["gap"] < 0).sum())},
                            {"label": "on target", "value": int((vs_target["gap"] == 0).sum())}],
                "reads": ["memory: analytical table", "memory: sources[targets]"],
                "writes": ["memory: vs_target"], "tables": [table(vs_target, "Actual vs target (gap = actual − target)")]}

    def _ex07(self) -> dict:
        region_month, desks_summary = self.ns["summaries"](self.ctx["analytical"])
        self.ctx.update(region_month=region_month, desks_summary=desks_summary)
        return {"headline": "Missing durations stay missing: totals and means use known minutes only.",
                "reads": ["memory: analytical table"], "writes": ["memory: region_month", "memory: desks_summary"],
                "tables": [table(region_month, "Accepted requests: region × month"),
                           table(desks_summary, "Per desk: volume and handling minutes")]}

    def _ex08(self) -> dict:
        figures = self.ns["make_team_figures"](self.ctx["analytical"], self.ctx["desks_summary"], self.ctx["vs_target"])
        self.ctx["figures"] = figures
        return {"headline": "Three PNG figures are rendered in memory; they are written to disk only in EX09.",
                "reads": ["memory: analytical table", "memory: vs_target"],
                "writes": ["memory: 3 PNG images"], "images": self._save_images("preview", figures)}

    def _ex09(self) -> dict:
        ns, out = self.ns, self.dir / "team_output"
        result = ns["run_pipeline"](self.ctx["paths"], out)
        self.ctx["result"] = result
        first = {p.name: sha256(p.read_bytes()) for p in sorted(out.iterdir()) if p.is_file()}
        ns["run_pipeline"](self.ctx["paths"], out)
        second = {p.name: sha256(p.read_bytes()) for p in sorted(out.iterdir()) if p.is_file()}
        manifest = result["manifest"]
        same_table = bool(result["analytical"].equals(self.ctx["analytical"]))
        rows = [[name, len((out / name).read_bytes()), digest[:16], f"team_output/{name}"]
                for name, digest in first.items()]
        self.outputs += [{"group": "Required outputs", "name": n, "url": self._url(f"team_output/{n}")} for n in first]
        return {"headline": "The whole pipeline runs again from the files, validates first, then writes 8 outputs.",
                "metrics": [{"label": "raw", "value": manifest["raw_rows"]},
                            {"label": "duplicates", "value": manifest["exact_duplicates"]},
                            {"label": "rejected", "value": manifest["rejected"]},
                            {"label": "accepted", "value": manifest["accepted"]},
                            {"label": "files written", "value": len(first)}],
                "checks": [{"label": "second run produced byte-identical files", "ok": first == second},
                           {"label": "counts reconcile across all months", "ok": bool(manifest["reconciled"])},
                           {"label": "pipeline table equals the step-by-step table shown above", "ok": same_table},
                           {"label": "4 CSV + 3 PNG + manifest present", "ok": len(first) == 8}],
                "reads": ["inputs/ (all four files, read again from disk)"],
                "writes": [f"team_output/{n}" for n in first],
                "tables": [{"title": "Files written", "total": len(rows), "note": None,
                            "columns": ["file", "bytes", "sha256 (first 16)", "saved to"], "rows": rows}],
                "text": json.dumps(manifest, indent=2), "text_title": "manifest.json"}

    def _ex10(self) -> dict:
        facts, brief = self.ns["brief_facts"](self.ctx["result"])
        fact_rows = [[k, v] for k, v in facts.items()]
        return {"headline": "The brief is generated from the measured outputs, not typed by hand.",
                "reads": ["memory: pipeline result"], "writes": ["memory: facts + brief"],
                "tables": [{"title": "Facts", "columns": ["fact", "value"], "rows": fact_rows,
                            "total": len(fact_rows), "note": None}],
                "text": brief, "text_title": f"Findings brief ({len(brief.split())} words)"}

    def _bonus(self) -> dict:
        ns, analytical = self.ns, self.ctx["result"]["analytical"]
        con = sqlite3.connect(":memory:")
        try:
            analytical.to_sql("analytical", con, index=False, if_exists="replace")
            handling = pd.read_sql_query(ns["handling_sql"], con)
            quality = pd.read_sql_query(ns["quality_sql"], con)
        finally:
            con.close()
        out = self.dir / "bonus_output"
        out.mkdir(parents=True, exist_ok=True)
        handling.to_csv(out / "handling_by_type_month.csv", index=False)
        quality.to_csv(out / "missing_minutes_by_region_month.csv", index=False)
        self.outputs += [{"group": "Bonus (SQL)", "name": n, "url": self._url(f"bonus_output/{n}")}
                         for n in ("handling_by_type_month.csv", "missing_minutes_by_region_month.csv")]
        return {"headline": "The notebook's two SQL queries run on a temporary in-memory copy; the original database is untouched.",
                "metrics": [{"label": "missing durations", "value": int(quality["missing_minutes"].sum())},
                            {"label": "known durations", "value": int(handling["known_duration_count"].sum())}],
                "checks": [{"label": "SQL totals equal the analytical table",
                            "ok": int(handling["accepted_requests"].sum()) == len(analytical)}],
                "reads": ["memory: analytical table → temporary SQLite"],
                "writes": ["bonus_output/handling_by_type_month.csv", "bonus_output/missing_minutes_by_region_month.csv"],
                "tables": [table(handling, "Bonus A — handling minutes by request type and month"),
                           table(quality, "Bonus B — missing durations by region and month")]}

    def _ai1(self) -> dict:
        model_table, unscored = self.ns["build_model_table"](self.ctx["result"]["cleaned"])
        self.ctx.update(model_table=model_table, unscored=unscored)
        return {"headline": "Rows with a known duration are collected: accepted rows plus rows the rule rejected only for their minutes.",
                "metrics": [{"label": "rows to score", "value": int(len(model_table))},
                            {"label": "rejected by the 480 rule", "value": int(model_table["rule_rejected"].sum())},
                            {"label": "missing durations (not scored)", "value": int(unscored)}],
                "reads": ["memory: cleaned[month].accepted", "memory: cleaned[month].rejected"],
                "writes": ["memory: model table"], "tables": [table(model_table, "Modelling table", limit=8)]}

    def _ai2(self) -> dict:
        ns = self.ns
        scored = ns["score_table"](self.ctx["model_table"])
        agreement, ceilings = ns["rule_agreement"](scored), ns["suggested_ceilings"](scored)
        review = ns["review_candidates"](scored)
        self.ctx.update(scored=scored, agreement=agreement, ceilings=ceilings, review=review)
        repeat = ns["score_table"](self.ctx["model_table"])
        limits = dict(zip(ceilings["request_type"], ceilings["suggested_ceiling"]))
        self.points = {"max_minutes": ns["MAX_MINUTES"], "ceilings": {k: float(v) for k, v in limits.items()},
                       "rows": json.loads(scored[["source", "source_row", "request_id", "request_type", "minutes",
                                                  "rule_rejected", "both_flag", "mad_score", "forest_score"]]
                                          .round(3).to_json(orient="records"))}
        return {"headline": "Two detectors score every row: a per-type robust statistic (baseline) and an Isolation Forest (model).",
                "metrics": [{"label": "accepted rows flagged by both", "value": int(len(review))},
                            {"label": "lowest learned ceiling (min)", "value": round(float(ceilings["suggested_ceiling"].min()), 1)},
                            {"label": "highest learned ceiling (min)", "value": round(float(ceilings["suggested_ceiling"].max()), 1)},
                            {"label": "fixed ceiling (min)", "value": ns["MAX_MINUTES"]}],
                "checks": [{"label": "scoring twice gives identical results (fixed seed)", "ok": bool(scored.equals(repeat))}],
                "reads": ["memory: model table"], "writes": ["memory: scores, flags, learned ceilings"],
                "chart": "anomaly",
                "tables": [table(agreement, "Agreement with the fixed rule"),
                           table(ceilings, "Ceiling learned for each request type"),
                           table(review, "Accepted rows both detectors call unusual", limit=15)]}

    def _ai3(self) -> dict:
        ns = self.ns
        runs, summary, injected = ns["injection_experiment"](self.ctx["scored"])
        gap, gap_se = ns["paired_gap"](runs)
        self.ctx.update(injection_summary=summary, ap_gap=gap, ap_gap_se=gap_se)
        return {"headline": "Known anomalies are hidden under the 480 ceiling in 20 seeded runs, so precision and recall can be measured.",
                "metrics": [{"label": "anomalies injected per run", "value": int(injected)},
                            {"label": "runs", "value": int(runs["run"].nunique())},
                            {"label": "avg. precision gap (forest − baseline)", "value": f"{gap:+.3f} ± {gap_se:.3f}"}],
                "reads": ["memory: scored table (rows not already suspected)"],
                "writes": ["memory: per-run metrics, summary"],
                "bars": json.loads(summary.round(4).to_json(orient="records")),
                "tables": [table(summary, "Mean and spread over the runs",
                                 note="The fixed rule scores zero recall by design: the injected values stay under its ceiling.")]}

    def _ai4(self) -> dict:
        ns, c = self.ns, self.ctx
        figures = ns["make_ai_figures"](c["scored"], c["ceilings"], c["injection_summary"])
        facts, brief = ns["ai_brief_facts"](c["scored"], c["agreement"], c["ceilings"], c["review"],
                                            c["injection_summary"], c["unscored"], c["ap_gap"], c["ap_gap_se"])
        names = ns["write_ai_outputs"](self.dir / "ai_output", c["scored"], c["ceilings"],
                                       c["injection_summary"], brief, figures)
        manifest = c["result"]["manifest"]["files_sha256"]
        untouched = all(sha256((self.dir / "team_output" / n).read_bytes()) == d for n, d in manifest.items())
        self.outputs += [{"group": "AI project", "name": n, "url": self._url(f"ai_output/{n}")} for n in names]
        self._finish()
        fact_rows = [[k, round(v, 4) if isinstance(v, float) else v] for k, v in facts.items()]
        return {"headline": f"Verdict from the measured numbers: {facts['better_detector']}.",
                "checks": [{"label": "required outputs are byte-for-byte unchanged by the AI project", "ok": untouched}],
                "reads": ["memory: scores, ceilings, test summary"], "writes": [f"ai_output/{n}" for n in names],
                "images": [{"title": n, "url": self._url(f"ai_output/{n}")} for n in names if n.endswith(".png")],
                "tables": [{"title": "AI facts", "columns": ["fact", "value"], "rows": fact_rows,
                            "total": len(fact_rows), "note": None}],
                "text": brief, "text_title": f"AI brief ({len(brief.split())} words)"}

    # ------------------------------------------------------------------ whole-run views
    def _finish(self) -> None:
        """Data-flow diagram, per-row trace, and one ZIP with everything."""
        ns, c = self.ns, self.ctx
        cleaned, analytical, scored = c["result"]["cleaned"], c["result"]["analytical"], c["scored"]
        region_of = {(r.source, int(r.source_row)): r.region for r in analytical.itertuples()}
        flag_of = {(r.source, int(r.source_row)): bool(r.both_flag) for r in scored.itertuples()}
        links: dict[tuple, int] = {}
        rows = []

        def add(a, b, n=1):
            links[(a, b)] = links.get((a, b), 0) + n

        for month in ns["MONTHS"]:
            raw = c["sources"][month]
            accepted = set(cleaned[month]["accepted"]["source_row"].astype(int))
            rejected = dict(zip(cleaned[month]["rejected"]["source_row"].astype(int),
                                cleaned[month]["rejected"]["reasons"]))
            for position, record in enumerate(raw.to_dict("records"), start=1):
                key = (month, position)
                if position in accepted:
                    fate, detail = "accepted", region_of.get(key, "")
                    add(f"src:{month}", "out:Accepted"); add("out:Accepted", f"end:{detail} region")
                elif position in rejected:
                    fate, detail = "rejected", rejected[position]
                    add(f"src:{month}", "out:Rejected")
                    for reason in detail.split(";"):
                        add("out:Rejected", f"end:{reason}")
                else:
                    fate, detail = "duplicate", "exact copy of an earlier row"
                    add(f"src:{month}", "out:Exact duplicate")
                rows.append({"source": month, "source_row": position, "fate": fate, "detail": detail,
                             "unusual": flag_of.get(key, False),
                             **{k: record.get(k, "") for k in ns["RAW_COLUMNS"]}})
        self.flow = {"links": [{"from": a, "to": b, "value": v} for (a, b), v in links.items()],
                     "note": "A rejected row with two reasons is drawn once into each reason, "
                             "so reason totals can exceed the rejected count."}
        self.rows = rows
        bundle = self.dir / "Week06_Team06_Results.zip"
        with zipfile.ZipFile(bundle, "w", compression=zipfile.ZIP_DEFLATED) as archive:
            for folder in ("team_output", "bonus_output", "ai_output"):
                for path in sorted((self.dir / folder).iterdir()):
                    archive.write(path, arcname=f"{folder}/{path.name}")
        self.outputs.insert(0, {"group": "Everything", "name": bundle.name, "url": self._url(bundle.name)})
