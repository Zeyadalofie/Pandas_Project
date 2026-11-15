"""FastAPI backend: upload files, run the notebook step by step, serve results and the web page."""
from __future__ import annotations

import os
import sys
import threading
import uuid
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel
from fastapi.staticfiles import StaticFiles

from notebook_loader import load_notebook
from runner import EXPECTED_FILES, STEP_SPECS, Run

ROOT = Path(__file__).resolve().parent.parent
RUNS_DIR = ROOT / "runs"
DIST_DIR = ROOT / "frontend" / "dist"
MAX_UPLOAD_BYTES = 50 * 1024 * 1024

app = FastAPI(title="Week 06 · Team 06 pipeline explorer")
RUNS: dict[str, Run] = {}


@app.get("/api/info")
def info():
    """What the page needs before any upload: the steps and the notebook's own code."""
    _, catalog = load_notebook()
    steps = [{"id": s[0], "label": s[1], "title": s[2], "kind": s[3], "owner": s[4], "functions": s[5]}
             for s in STEP_SPECS]
    return {"steps": steps, "code": catalog, "expected_files": EXPECTED_FILES,
            "llm_key_on_server": bool(os.environ.get("ANTHROPIC_API_KEY"))}


@app.post("/api/runs")
async def create_run(files: list[UploadFile] = File(...)):
    uploads, total = {}, 0
    for upload in files:
        data = await upload.read()
        total += len(data)
        if total > MAX_UPLOAD_BYTES:
            raise HTTPException(413, "Upload is larger than 50 MB.")
        uploads[Path(upload.filename or "file").name] = data
    run_id = uuid.uuid4().hex[:12]
    run = Run(run_id, RUNS_DIR / run_id, uploads)
    RUNS[run_id] = run
    threading.Thread(target=run.execute, daemon=True).start()
    return {"id": run_id}


@app.get("/api/runs/{run_id}")
def get_run(run_id: str):
    run = RUNS.get(run_id)
    if run is None:
        raise HTTPException(404, "Unknown run.")
    return run.snapshot()


class Question(BaseModel):
    question: str
    api_key: str | None = None


@app.post("/api/runs/{run_id}/ask")
def ask(run_id: str, body: Question):
    """Question -> SQL -> table, using the notebook's own answer_question()."""
    run = RUNS.get(run_id)
    if run is None or run.status != "done":
        raise HTTPException(409, "Run the pipeline first.")
    # A key typed in the page is used for this request only; it is never written to disk.
    key = (body.api_key or "").strip() or os.environ.get("ANTHROPIC_API_KEY")
    try:
        return run.ask(body.question, key)
    except ValueError as error:
        raise HTTPException(400, str(error))


@app.get("/api/runs/{run_id}/files/{relative:path}")
def get_file(run_id: str, relative: str):
    run = RUNS.get(run_id)
    if run is None:
        raise HTTPException(404, "Unknown run.")
    base = run.dir.resolve()
    target = (base / relative).resolve()
    if base not in target.parents or not target.is_file():
        raise HTTPException(404, "No such file.")
    return FileResponse(target, filename=target.name if target.suffix in {".zip", ".csv", ".json", ".txt"} else None)


if DIST_DIR.is_dir():
    app.mount("/", StaticFiles(directory=DIST_DIR, html=True), name="site")
