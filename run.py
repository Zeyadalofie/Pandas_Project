"""Start the site:  python run.py   then open http://localhost:8000"""
import sys
import threading
import webbrowser
from pathlib import Path


sys.path.insert(0, str(Path(__file__).parent / "backend"))

REQUIRED = {"fastapi": "fastapi", "uvicorn": "uvicorn", "multipart": "python-multipart", "pandas": "pandas",
            "numpy": "numpy", "matplotlib": "matplotlib", "sklearn": "scikit-learn", "imblearn": "imbalanced-learn"}


def missing_packages():
    import importlib.util
    return [package for module, package in REQUIRED.items() if importlib.util.find_spec(module) is None]


if __name__ == "__main__":
    missing = missing_packages()
    if missing:
        print("Missing Python packages:", ", ".join(missing))
        print("Install them with:  pip install -r requirements.txt")
        sys.exit(1)
    import uvicorn
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    if "--no-browser" not in sys.argv:
        threading.Timer(1.5, lambda: webbrowser.open(f"http://localhost:{port}")).start()
    uvicorn.run("app:app", host="127.0.0.1", port=port, app_dir=str(Path(__file__).parent / "backend"))
