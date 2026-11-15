"""Start the site:  python run.py   then open http://localhost:8000"""
import sys
import threading
import webbrowser
from pathlib import Path

import uvicorn

sys.path.insert(0, str(Path(__file__).parent / "backend"))

if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    if "--no-browser" not in sys.argv:
        threading.Timer(1.5, lambda: webbrowser.open(f"http://localhost:{port}")).start()
    uvicorn.run("app:app", host="127.0.0.1", port=port, app_dir=str(Path(__file__).parent / "backend"))
