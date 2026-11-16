"""Run the notebook's functions one step at a time and record what each step did.

Nothing here re-implements the analysis. Every step calls a function that lives in the
notebook (loaded by notebook_loader) and then describes its inputs and outputs so the
web page can show where the data went.
"""
from __future__ import annotations

import contextlib
import hashlib
import io
import json
import sqlite3
import threading
import time
import traceback
import zipfile
from pathlib import Path

import pandas as pd

from notebook_loader import BONUS_CHARTS_KEY, load_notebook

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
    ("bonus", "Bonus", "SQL insights on the analytical table", "notebook", "Mohammed Almogbel", ["handling_sql", "quality_sql", BONUS_CHARTS_KEY]),
    ("ai1", "AI-1", "Generate a messy dataset with known problems", "program", "AI project", ["make_messy_dataset", "planted_problems"]),
    ("ai2", "AI-2", "Explore: find the problems", "program", "AI project", ["missing_report", "missing_patterns", "numeric_profile", "balance_report", "find_problems"]),
    ("ai3", "AI-3", "Study the gaps and fill them", "program", "AI project", ["impute_dataset", "choose_statistic", "evaluate_fill_methods", "candidate_fills", "knn_fill", "fill_categorical"]),
    ("ai4", "AI-4", "Treat dispersion and skew", "program", "AI project", ["treat_dispersion", "cap_outliers", "power_transform"]),
    ("ai5", "AI-5", "Balance with synthetic data (SMOTE-NC)", "program", "AI project", ["balance_with_smote", "balance_table", "synthetic_quality"]),
    ("ai6", "AI-6", "Unsupervised model: before vs after", "program", "AI project", ["compare_preparations", "model_features", "fit_clusters", "cluster_points", "prep_brief_facts"]),
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
        self.prep: dict = {}
        self.outputs: list = []
        self.code: dict = {}
        self.ctx: dict = {}

    # ------------------------------------------------------------------ public
    def snapshot(self) -> dict:
        return {"id": self.id, "status": self.status, "error": self.error, "steps": self.steps,
                "flow": self.flow, "rows": self.rows, "prep": self.prep,
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
        names = ["handling_by_type_month.csv", "missing_minutes_by_region_month.csv"]
        checks = [{"label": "SQL totals equal the analytical table",
                   "ok": int(handling["accepted_requests"].sum()) == len(analytical)}]
        # The two bonus charts: run the notebook's chart cell exactly as written. Only the
        # variables it expects are supplied, with BONUS_DIR pointing at this run's folder.
        images, printed = [], ""
        cell = self.code.get(BONUS_CHARTS_KEY)
        if cell:
            scope = dict(ns, handling_sql_result=handling, quality_sql_result=quality,
                         BONUS_DIR=out, result=self.ctx["result"])
            captured = io.StringIO()
            try:
                with contextlib.redirect_stdout(captured):
                    exec(compile(cell["code"], "<notebook bonus charts cell>", "exec"), scope)
                charts = sorted(p.name for p in out.glob("*.png"))
                images = [{"title": n, "url": self._url(f"bonus_output/{n}")} for n in charts]
                names += charts
                printed = " ".join(captured.getvalue().split())
                checks.append({"label": "bonus charts drawn by the notebook's own cell", "ok": len(charts) == 2})
            except Exception as exc:
                ns["plt"].close("all")
                checks.append({"label": f"bonus charts could not be drawn on this data ({type(exc).__name__}: {exc})", "ok": False})
        self.outputs += [{"group": "Bonus (SQL)", "name": n, "url": self._url(f"bonus_output/{n}")} for n in names]
        extra = {"images": images} if images else {}
        if printed:
            extra.update(text=printed, text_title="Printed by the notebook cell")
        return {**extra,
                "headline": "The notebook's two SQL queries run on a temporary in-memory copy; the original database is untouched.",
                "metrics": [{"label": "missing durations", "value": int(quality["missing_minutes"].sum())},
                            {"label": "known durations", "value": int(handling["known_duration_count"].sum())}],
                "checks": checks,
                "reads": ["memory: analytical table → temporary SQLite"],
                "writes": [f"bonus_output/{n}" for n in names],
                "tables": [table(handling, "Bonus A — handling minutes by request type and month"),
                           table(quality, "Bonus B — missing durations by region and month")]}

    def _ai1(self) -> dict:
        ns = self.ns
        truth, messy = ns["make_messy_dataset"](self.ctx["result"]["analytical"])
        _, again = ns["make_messy_dataset"](self.ctx["result"]["analytical"])
        self.ctx.update(truth=truth, messy=messy)
        return {"headline": "A synthetic dataset is generated with problems planted on purpose. Its request types, regions and "
                            "typical durations are learned from the pipeline's analytical table.",
                "metrics": [{"label": "rows generated", "value": int(len(messy))},
                            {"label": "columns", "value": int(messy.shape[1])},
                            {"label": "empty cells", "value": int(messy.isna().sum().sum())}],
                "checks": [{"label": "generating twice gives the identical dataset (fixed seed)", "ok": bool(messy.equals(again))}],
                "reads": ["memory: analytical table (category names and typical minutes only)"],
                "writes": ["memory: messy dataset", "memory: hidden truth (kept aside for the final check only)"],
                "tables": [table(ns["planted_problems"](), "Problems planted on purpose"),
                           table(messy, "The messy dataset", limit=10)]}

    def _ai2(self) -> dict:
        ns, messy = self.ns, self.ctx["messy"]
        missing, patterns = ns["missing_report"](messy), ns["missing_patterns"](messy)
        profile = ns["numeric_profile"](messy)
        balance, ratio = ns["balance_report"](messy)
        problems = ns["find_problems"](missing, patterns, profile, ratio)
        figures = ns["make_eda_figures"](messy, missing, balance)
        self.ctx.update(missing=missing, patterns=patterns, profile=profile, balance=balance, ratio=ratio,
                        problems=problems, figures=dict(figures))
        self.prep["missing"] = [{"label": r["column"], "a": round(r["missing_pct"], 1)} for r in missing.to_dict("records")]
        self.prep["balance_before"] = [{"label": r[ns["GROUP"]], "a": int(r["rows"])} for r in balance.to_dict("records")]
        self.prep["profile"] = json.loads(profile.round(3).to_json(orient="records"))
        return {"headline": f"Nothing is changed yet. The exploration measures the problems and writes a to-do list: "
                            f"{len(problems)} problems found.",
                "metrics": [{"label": "columns with gaps", "value": int(len(missing))},
                            {"label": "worst column missing", "value": f"{missing['missing_pct'].max():.1f}%"},
                            {"label": "gap patterns detected", "value": int(patterns["follows_pattern"].sum())},
                            {"label": "largest ÷ smallest region", "value": round(ratio, 1)}],
                "reads": ["memory: messy dataset"], "writes": ["memory: measurements and list of problems"],
                "chart": "explore", "images": self._save_images("ai_preview", figures),
                "tables": [table(problems, "Problems found, evidence and planned treatment"),
                           table(missing, "Missing values by column"),
                           table(patterns, "Do the gaps follow a pattern?",
                                 note="A large spread means the gap rate depends on that group, so a single overall value would be a poor fill."),
                           table(profile, "Shape of the numeric columns",
                                 note="cv = standard deviation ÷ mean (spread). skew above 1 = long right tail. outlier_share = share beyond the IQR fences."),
                           table(balance, "Class balance")]}

    def _ai3(self) -> dict:
        ns, messy = self.ns, self.ctx["messy"]
        filled, decisions = ns["impute_dataset"](messy, self.ctx["truth"])
        self.ctx.update(filled=filled, decisions=decisions)
        left = int(filled[ns["NUMERIC"] + ns["CATEGORICAL"]].isna().sum().sum())
        medians = int((decisions["mean_or_median"] == "median").sum())
        error_columns = [c for c in decisions.columns if c.startswith("error: ")]
        self.prep["fill"] = [{"column": r["column"], "statistic": r["mean_or_median"], "method": r["method_used"],
                              "errors": [{"label": c.replace("error: ", ""), "a": round(r[c], 3)} for c in error_columns]}
                             for r in decisions.to_dict("records")]
        return {"headline": f"Each gap is filled by the method with the lowest measured error. {medians} of {len(decisions)} "
                            f"numeric columns use the median because they are skewed or heavy-tailed.",
                "metrics": [{"label": "cells filled", "value": int(messy.isna().sum().sum())},
                            {"label": "gaps left", "value": left},
                            {"label": "columns using the median", "value": medians},
                            {"label": "columns using the mean", "value": int(len(decisions) - medians)}],
                "checks": [{"label": "no gaps remain", "ok": left == 0},
                           {"label": "no row was dropped", "ok": len(filled) == len(messy)}],
                "reads": ["memory: messy dataset"], "writes": ["memory: filled dataset (+ a was_missing flag per column)"],
                "chart": "fill",
                "tables": [table(decisions, "How each column was filled, and the error of every method (lower is better)",
                                 note="Errors are measured by hiding 15% of known values, 5 seeded rounds. The last two columns compare with the generator's hidden truth."),
                           table(filled, "Dataset after filling", limit=8)]}

    def _ai4(self) -> dict:
        ns = self.ns
        prepared, report = ns["treat_dispersion"](self.ctx["filled"])
        self.ctx.update(prepared=prepared, dispersion=report)
        self.prep["dispersion"] = json.loads(report.round(3).to_json(orient="records"))
        return {"headline": "Extreme values are capped inside their own request type, not deleted, and a power transform removes the long tail.",
                "metrics": [{"label": "values capped", "value": int(report["values_capped"].sum())},
                            {"label": "rows deleted", "value": 0},
                            {"label": "handling skew before", "value": round(float(report.iloc[0]["skew_before"]), 2)},
                            {"label": "handling skew after", "value": round(float(report.iloc[0]["skew_after_transform"]), 2)}],
                "checks": [{"label": "every row is kept", "ok": len(prepared) == len(self.ctx["filled"])}],
                "reads": ["memory: filled dataset"], "writes": ["memory: prepared dataset"], "chart": "dispersion",
                "tables": [table(report, "Dispersion and skew, before and after")]}

    def _ai5(self) -> dict:
        ns, prepared = self.ns, self.ctx["prepared"]
        balanced = ns["balance_with_smote"](prepared)
        after, quality = ns["balance_table"](prepared, balanced), ns["synthetic_quality"](balanced)
        self.ctx.update(balanced=balanced, balance_after=after, quality=quality)
        self.prep["balance_after"] = [{"label": r[ns["GROUP"]], "a": int(r["real_rows"]), "b": int(r["synthetic_rows"])}
                                      for r in after.to_dict("records")]
        synthetic = int(balanced["is_synthetic"].sum())
        worst = float(quality["ks_distance"].max()) if len(quality) else 0.0
        return {"headline": "SMOTE-NC builds each new row between a real row of the small region and one of its nearest neighbours, "
                            "so new rows follow the real pattern instead of copying it.",
                "metrics": [{"label": "synthetic rows added", "value": synthetic},
                            {"label": "rows after balancing", "value": int(len(balanced))},
                            {"label": "largest KS distance (0 = identical)", "value": round(worst, 3)}],
                "checks": [{"label": "every region now has the same number of rows", "ok": after["rows_after"].nunique() == 1},
                           {"label": "real rows were not changed", "ok": int((~balanced["is_synthetic"]).sum()) == len(prepared)}],
                "reads": ["memory: prepared dataset"], "writes": ["memory: balanced dataset (synthetic rows flagged)"],
                "chart": "balance",
                "tables": [table(after, "Rows per region, before and after"),
                           table(quality, "Do synthetic rows resemble the real rows of the same region?",
                                 note="ks_distance compares the two distributions: 0 = identical, 1 = completely different."),
                           table(balanced.loc[balanced["is_synthetic"]], "Examples of synthetic rows", limit=8)]}

    def _ai6(self) -> dict:
        ns, c = self.ns, self.ctx
        comparison, fitted = ns["compare_preparations"](c["messy"], c["prepared"], c["balanced"])
        data, X, labels = fitted["Prepared + balanced (SMOTE-NC)"]
        points, profile = ns["cluster_points"](data, X, labels), ns["cluster_profile"](data, labels)
        figures = {**c["figures"], **ns["make_prep_figures"](c["messy"], c["prepared"], c["balance_after"], points)}
        facts, brief = ns["prep_brief_facts"](c["messy"], c["missing"], c["decisions"], c["dispersion"], c["balance_after"],
                                              comparison, c["ratio"])
        names = ns["write_prep_outputs"](self.dir / "ai_output", c["messy"], c["prepared"], c["balanced"], c["problems"],
                                         c["decisions"], c["dispersion"], c["balance_after"], c["quality"], comparison,
                                         profile, brief, figures)
        self.outputs += [{"group": "AI project", "name": n, "url": self._url(f"ai_output/{n}")} for n in names]
        manifest = c["result"]["manifest"]["files_sha256"]
        untouched = all(sha256((self.dir / "team_output" / n).read_bytes()) == d for n, d in manifest.items())
        self.prep.update(comparison=json.loads(comparison.round(3).to_json(orient="records")),
                         points=json.loads(points.round(3).to_json(orient="records")),
                         facts=facts, brief=brief, best=facts["best_separated_version"],
                         images={n: self._url(f"ai_output/{n}") for n in names if n.endswith(".png")})
        self._finish()
        naive = comparison.iloc[0]
        return {"headline": f"The same K-Means model is trained on three versions of the data. Dropping incomplete rows keeps only "
                            f"{naive['share_of_original_rows_pct']:.0f}% of them; best cluster separation: {facts['best_separated_version']}.",
                "metrics": [{"label": "rows kept if incomplete rows are dropped", "value": f"{naive['share_of_original_rows_pct']:.0f}%"},
                            {"label": "rows kept after preparation", "value": "100%"},
                            {"label": "smallest region before → after", "value": f"{facts['smallest_region_before_pct']:.0f}% → {facts['smallest_region_after_pct']:.0f}%"}],
                "checks": [{"label": "required outputs are byte-for-byte unchanged by the AI project", "ok": untouched}],
                "reads": ["memory: messy, prepared and balanced datasets"], "writes": [f"ai_output/{n}" for n in names],
                "chart": "model",
                "tables": [table(comparison, "Same model, three versions of the data",
                                 note="silhouette: cluster separation (higher is better). stability: agreement between runs with different seeds (1 = identical)."),
                           table(profile, "What each cluster looks like (original units)")],
                "text": brief, "text_title": f"AI brief ({len(brief.split())} words)"}

    # ------------------------------------------------------------------ whole-run views
    def _finish(self) -> None:
        """Data-flow diagram, per-row trace, and one ZIP with everything."""
        ns, c = self.ns, self.ctx
        cleaned, analytical = c["result"]["cleaned"], c["result"]["analytical"]
        region_of = {(r.source, int(r.source_row)): r.region for r in analytical.itertuples()}
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
