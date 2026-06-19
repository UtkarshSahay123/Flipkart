from __future__ import annotations

from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = PROJECT_ROOT / "data"
RAW_DATA_PATH = DATA_DIR / "raw" / "traffic_events.csv"
PROCESSED_DATA_PATH = DATA_DIR / "processed" / "traffic_events_processed.csv"
MODELS_DIR = PROJECT_ROOT / "models"
MODEL_PATH = MODELS_DIR / "model.pkl"
METRICS_PATH = MODELS_DIR / "metrics.json"
DEFAULT_TEST_SIZE = 0.2
DEFAULT_RANDOM_STATE = 42