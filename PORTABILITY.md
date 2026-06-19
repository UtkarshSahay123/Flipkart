# Portability Guide

This project is designed to run on any Windows device without hard-coded paths. Here's what is and isn't portable.

## What IS Device-Independent

### Frontend (Dashboard)
- The `dashboard/` folder can be moved or copied to any location.
- The HTML, CSS, and JavaScript use relative paths internally.
- The API endpoint is configured in `dashboard/config.json`, not hard-coded.
- You can run the dashboard on a different machine than the API by updating `config.json`.

### Python Backend (Part A)
- All Python code in `part_a/` uses relative paths from `Path(__file__)`.
- You can rename folders, move the project, or clone it to a different device.
- The training script uses `--data-path` and `--model-path` arguments, so datasets can live anywhere.
- Example: `python -m part_a.src.train --data-path /custom/path/traffic_events.csv --model-path /custom/path/model.pkl`

### Virtual Environment
- The `.trafficenv` folder should stay in the repo root for the scripts to find it.
- If you move `.trafficenv` elsewhere, update the Python interpreter path in your terminal commands.

## What MUST Stay Intact

### Folder Structure
The relative folder structure must be preserved:

```
project_root/
  part_a/
    data/raw/
    data/processed/
    src/
    models/
    api/
    notebooks/
    tests/
  dashboard/
  .trafficenv/
```

If you rename `part_a/` to something else, the Python imports (`from part_a.src.train import ...`) will break. Rename it everywhere at once if needed.

### Configuration Files
- `part_a/requirements.txt` — lists all dependencies
- `dashboard/config.json` — API endpoint configuration (this IS portable; just edit the values)

## Running on a Different Device

1. **Clone/copy the entire project** to the new device (preserving folder structure).
2. **Create a new virtual environment** in the project root and name it `.trafficenv`:
   ```bash
   python -m venv .trafficenv
   ```
3. **Install dependencies**:
   ```bash
   .trafficenv\Scripts\activate
   pip install -r part_a\requirements.txt
   ```
4. **Update `dashboard/config.json`** if the API runs on a different port or machine.
5. **Run the API** and dashboard as normal.

## Running the API on a Different Machine

If you want to run the API on `machine-a` and the dashboard on `machine-b`:

1. Copy `part_a/` to `machine-a`, set up `.trafficenv`, and run the API.
2. Copy `dashboard/` to `machine-b`.
3. Edit `dashboard/config.json` on `machine-b`:
   ```json
   {
     "api_base": "http://machine-a-ip:8000"
   }
   ```
4. Open the dashboard on `machine-b` and it will call `machine-a`'s API.

## Hardcoded Assumptions to Avoid Breaking

- Do NOT rename `part_a/` without updating all import statements.
- Do NOT move `.trafficenv` outside the project root without updating terminal commands.
- Do NOT remove `part_a/__init__.py` or change the package structure.

## Verification

To verify portability after a move or copy:

```bash
# Test the training pipeline
python -m part_a.src.train --data-path part_a/data/raw/traffic_events.csv

# Test the API
uvicorn part_a.api.main:app --reload --port 8000

# Open dashboard/index.html in a browser via http://127.0.0.1:4173
```

If all three work, the project is portable.
