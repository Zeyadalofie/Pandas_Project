# Week 06 · Team 06 — Pipeline Explorer

A local web app that takes the project files and shows, step by step, what the team notebook does with them and where the data goes.

- **Notebook code** (EX01–EX10 + the SQL bonus): runs exactly as written, straight from the `.ipynb` file.
- **Program code** (AI-1 to AI-6): EDA and data preparation for AI, stored as the last cells of the same notebook:
  - AI-1: generate a synthetic dataset with planted problems (gaps that follow patterns, extreme values, skew, an under-represented region).
  - AI-2: explore and measure the problems.
  - AI-3: fill the gaps; mean or median is chosen from the column's shape, and the fill method by measured error.
  - AI-4: cap extreme values and reduce skew with a power transform.
  - AI-5: balance the small region with synthetic rows (SMOTE-NC).
  - AI-6: train K-Means on naive, prepared and balanced data and compare.

## Run it (Python 3.10 or newer is all you need)

On Windows: double-click `run.bat`. The first run installs the packages, then opens `http://localhost:8000`.

Or manually:

```
pip install -r requirements.txt
python run.py
```

Then upload `week_06_team_project_data_S000.zip` (or the four files inside it) and press **Run the pipeline**.

## Run it from VS Code

1. Open the folder: File → Open Folder → `Weak6_project5`.
2. Open a terminal (Terminal → New Terminal) and run, the first time only:

```
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

3. Start the local server:

```
python run.py
```

The browser opens `http://localhost:8000`. Stop the server with Ctrl+C in the terminal.

To start it with F5 instead: unzip `vscode-config.zip` inside the folder (it creates a `.vscode` folder). After that, F5 installs the packages and starts the server.

The server is fully local (`127.0.0.1`); nothing is uploaded to the internet.

## What the site shows

| Tab | Contents |
|---|---|
| Step by step | An animated scene for every step (a truck delivers the ZIP, a machine opens the carton, rows are sorted into bins, ...), plus what the step read, which function ran, what it wrote, its tables and checks, and the function's code from the notebook. Change the animation speed with the **Animation** menu |
| AI data prep | The whole AI project on one page: what was found, how each gap was filled, before and after treatment, the balancing, and the model comparison |
| Data flow | A diagram of where every raw row ended up: accepted (and in which region), rejected (and why), or duplicate |
| Trace a row | Pick any row and see every function that touched it and where it stopped |
| Outputs | Download the outputs: the eight required files, the SQL bonus, and the AI project files |

## How the notebook code runs unchanged

`backend/notebook_loader.py` reads `backend/notebook/Week06_Team06_With_AI_Project.ipynb` and keeps, from each cell, only the imports, the functions and the constants. It skips the lines that only make sense inside Colab (mounting Drive, display calls). `backend/runner.py` then calls those same functions in order on the uploaded files. No analysis function is written twice.

So if you edit a function in the notebook and replace the file in `backend/notebook/`, the site runs the new version.

## Project structure

```
run.py / run.bat        start the site
requirements.txt        Python packages (includes imbalanced-learn for SMOTE-NC)
backend/
  app.py                FastAPI: upload, run status, files
  notebook_loader.py    loads the notebook's functions as they are
  runner.py             runs the steps and records each step's inputs and outputs
  notebook/             the notebook (the same file that runs in Colab)
frontend/
  src/                  React code
  dist/                 the built version served by Python (no Node needed to run)
runs/                   created at run time: inputs and outputs of each run
```

## Editing the interface (optional, needs Node.js)

```
cd frontend
npm install
npm run dev      # development on http://localhost:5173 with the backend running on 8000
npm run build    # updates dist
```

## Notes

The dataset is synthetic, so the results show how the method works, not real service performance. Steps AI-3 and AI-6 take a second or two because they test several methods and train the model repeatedly. Everything runs offline.
