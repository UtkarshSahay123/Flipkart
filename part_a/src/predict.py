from __future__ import annotations

from pathlib import Path

import joblib
import pandas as pd

from part_a.src.config import MODEL_PATH
from part_a.src.features import FEATURE_COLS
from part_a.src.rules import get_resources

REQUIRED_BUNDLE_KEYS = {
    "classifier",
    "regressor_delay",
    "regressor_radius",
    "regressor_risk",
    "le_event",
    "le_location",
    "le_road_issue",
    "feature_columns",
    "event_categories",
    "location_categories",
    "road_issue_categories",
    "crowd_scale",
}


def load_bundle(model_path: str | Path | None = None):
    path = Path(model_path) if model_path is not None else MODEL_PATH
    if not path.exists():
        return None

    try:
        bundle = joblib.load(path)
        if not REQUIRED_BUNDLE_KEYS.issubset(bundle.keys()):
            return None
        return bundle
    except Exception:
        return None


def build_feature_frame(event: dict, bundle: dict) -> pd.DataFrame:
    le_event = bundle["le_event"]
    le_location = bundle["le_location"]
    le_road_issue = bundle["le_road_issue"]
    feature_columns = bundle.get("feature_columns", FEATURE_COLS)

    missing_fields = [
        field for field in ["event_type", "location", "road_issue", "hour_of_day", "day_of_week", "is_weekend", "expected_crowd"]
        if field not in event
    ]
    if missing_fields:
        raise ValueError(f"Missing required fields: {', '.join(missing_fields)}")

    allowed_event_types = bundle.get("event_categories")
    allowed_locations = bundle.get("location_categories")
    if allowed_event_types and event["event_type"] not in allowed_event_types:
        raise ValueError(f"Unknown event_type '{event['event_type']}'. Allowed values: {', '.join(allowed_event_types)}")
    if allowed_locations and event["location"] not in allowed_locations:
        raise ValueError(f"Unknown location '{event['location']}'. Allowed values: {', '.join(allowed_locations)}")
    allowed_road_issues = bundle.get("road_issue_categories")
    if allowed_road_issues and event["road_issue"] not in allowed_road_issues:
        raise ValueError(f"Unknown road_issue '{event['road_issue']}'. Allowed values: {', '.join(allowed_road_issues)}")

    event_enc = le_event.transform([event["event_type"]])[0]
    location_enc = le_location.transform([event["location"]])[0]
    road_issue_enc = le_road_issue.transform([event["road_issue"]])[0]
    hour_of_day = int(event["hour_of_day"])
    is_peak_hour = 1 if (8 <= hour_of_day <= 10 or 17 <= hour_of_day <= 20) else 0
    crowd_scale = float(bundle.get("crowd_scale", 50000))
    crowd_normalized = float(event["expected_crowd"]) / max(crowd_scale, 1.0)

    return pd.DataFrame(
        [
            {
                "event_type_enc": event_enc,
                "location_enc": location_enc,
                "road_issue_enc": road_issue_enc,
                "hour_of_day": hour_of_day,
                "day_of_week": int(event["day_of_week"]),
                "is_weekend": int(event["is_weekend"]),
                "is_peak_hour": is_peak_hour,
                "crowd_normalized": crowd_normalized,
            }
        ],
        columns=feature_columns,
    )


def predict_event(event: dict, bundle: dict) -> dict:
    features = build_feature_frame(event, bundle)

    congestion_level = bundle["classifier"].predict(features)[0]
    delay_minutes = int(round(bundle["regressor_delay"].predict(features)[0]))
    affected_radius_km = round(float(bundle["regressor_radius"].predict(features)[0]), 1)
    risk_score = int(round(bundle["regressor_risk"].predict(features)[0]))
    resources = get_resources(risk_score, congestion_level)

    return {
        "congestion_level": congestion_level,
        "delay_minutes": delay_minutes,
        "affected_radius_km": affected_radius_km,
        "risk_score": risk_score,
        "resources": resources,
    }
