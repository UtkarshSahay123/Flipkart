from __future__ import annotations

from pathlib import Path
import sys

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from fastapi.middleware.cors import CORSMiddleware

PROJECT_ROOT = Path(__file__).resolve().parents[1]
REPO_ROOT = PROJECT_ROOT.parent
for candidate_path in (REPO_ROOT, PROJECT_ROOT):
    candidate = str(candidate_path)
    if candidate not in sys.path:
        sys.path.insert(0, candidate)

from part_a.src.predict import load_bundle, predict_event

app = FastAPI(title="Part A Prediction API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
MODEL_BUNDLE = load_bundle()


class EventInput(BaseModel):
    event_type: str = Field(..., examples=["Political Rally"])
    location: str = Field(..., examples=["MG Road"])
    road_issue: str = Field(..., examples=["Potholes"])
    hour_of_day: int = Field(..., ge=0, le=23)
    day_of_week: int = Field(..., ge=0, le=6)
    is_weekend: int = Field(..., ge=0, le=1)
    expected_crowd: int = Field(..., ge=0)


@app.get("/health")
def health():
    return {"status": "ok", "model_loaded": MODEL_BUNDLE is not None}


@app.get("/categories", summary="Get model category lists for dynamic UI")
def get_model_categories():
    """Returns event/location/road_issue categories present in the loaded model bundle."""
    if MODEL_BUNDLE is None:
        raise HTTPException(status_code=503, detail="Model bundle is not loaded")

    return {
        "event_categories": MODEL_BUNDLE.get("event_categories", []),
        "location_categories": MODEL_BUNDLE.get("location_categories", []),
        "road_issue_categories": MODEL_BUNDLE.get("road_issue_categories", []),
    }


@app.post("/predict")
def predict(event: EventInput):
    if MODEL_BUNDLE is None:
        raise HTTPException(status_code=503, detail="Model bundle is not available. Run src/train.py first.")

    try:
        return predict_event(event.model_dump(), MODEL_BUNDLE)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
