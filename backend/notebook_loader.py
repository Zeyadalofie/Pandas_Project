"""Load the team's notebook and make its functions callable, without rewriting them.

The .ipynb file is the single source of truth. For every code cell we keep only:
  * imports (except Colab / IPython ones, which only exist inside Colab),
  * function definitions,
  * constants (UPPER_CASE names and plain literals such as the SQL strings).
Top-level statements that *run* the pipeline inside Colab (mounting Drive, calling the
functions, displaying tables) are skipped: the web backend calls the functions itself,
one step at a time, on the files the user uploads.

Cells before the "AI Project" heading are tagged "notebook" (the original team code);
cells after it are tagged "program" (the AI extension).
"""
from __future__ import annotations

import ast
import json
from pathlib import Path

import matplotlib

matplotlib.use("Agg")  # no screen on a server; figures are saved to bytes

NOTEBOOK_PATH = Path(__file__).parent / "notebook" / "Week06_Team06_With_AI_Project.ipynb"
PROGRAM_MARKER = "## AI Project"
SKIPPED_MODULES = ("google", "IPython")


def _cell_source(cell) -> str:
    source = cell.get("source", "")
    return source if isinstance(source, str) else "".join(source)


def _is_constant_assign(node: ast.Assign) -> bool:
    if len(node.targets) != 1 or not isinstance(node.targets[0], ast.Name):
        return False
    name = node.targets[0].id
    return name.isupper() or isinstance(node.value, ast.Constant)


def _keep(node: ast.stmt) -> bool:
    if isinstance(node, ast.Import):
        return not any(alias.name.startswith(SKIPPED_MODULES) for alias in node.names)
    if isinstance(node, ast.ImportFrom):
        return not (node.module or "").startswith(SKIPPED_MODULES)
    if isinstance(node, ast.FunctionDef):
        return True
    if isinstance(node, ast.Assign):
        return _is_constant_assign(node)
    return False


def load_notebook(path: Path = NOTEBOOK_PATH):
    """Return (namespace, catalog).

    namespace: dict holding the notebook's functions and constants, ready to call.
    catalog:   {name: {"kind", "cell", "code"}} with the exact source text from the notebook.
    """
    notebook = json.loads(Path(path).read_text(encoding="utf-8"))
    namespace: dict = {"__name__": "team06_notebook", "display": lambda *a, **k: None}
    catalog: dict = {}
    kind = "notebook"
    for index, cell in enumerate(notebook["cells"]):
        source = _cell_source(cell)
        if cell["cell_type"] == "markdown":
            if source.lstrip().startswith(PROGRAM_MARKER):
                kind = "program"
            continue
        if cell["cell_type"] != "code":
            continue
        tree = ast.parse(source)
        for node in tree.body:
            if not _keep(node):
                continue
            module = ast.Module(body=[node], type_ignores=[])
            try:
                exec(compile(module, f"<notebook cell {index}>", "exec"), namespace)
            except Exception:
                if isinstance(node, ast.FunctionDef):
                    raise
                continue  # a constant that needs Colab state; not needed by the functions
            if isinstance(node, ast.FunctionDef):
                catalog[node.name] = {"kind": kind, "cell": index,
                                      "code": ast.get_source_segment(source, node)}
            elif isinstance(node, ast.Assign) and isinstance(node.value, ast.Constant) \
                    and isinstance(node.value.value, str) and "SELECT" in node.value.value:
                catalog[node.targets[0].id] = {"kind": kind, "cell": index,
                                               "code": ast.get_source_segment(source, node)}
    return namespace, catalog
