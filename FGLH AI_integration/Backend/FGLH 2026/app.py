"""
GridLock AI — Flask REST API

Endpoints:
  POST /predict      — Main prediction + recommendation
  GET  /zones        — List all known zones, corridors, junctions
  GET  /health       — API health check
  GET  /model-info   — Model accuracy, feature importance, metadata
"""

import logging
from flask import Flask, request, jsonify
from flask_cors import CORS
import joblib
import numpy as np
import os

# ============================================================
# DEBUG LOGGING SETUP
# ============================================================
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger("gridlock_api")

from recommendation import recommend
from feature_engineering import (
    FEATURE_COLUMNS,
    CATEGORICAL_COLUMNS,
    CORRIDOR_IMPORTANCE,
    EVENT_CAUSE_SEVERITY,
    BASE_RADIUS,
)

# ============================================================
# INIT APP
# ============================================================

app = Flask(__name__)
CORS(app)  # Enable CORS for dashboard integration

# ============================================================
# LOAD MODELS & ENCODERS
# ============================================================

MODELS_DIR = "models"
ENCODERS_DIR = "encoders"


def load_all():
    """Load all models, encoders, and metadata."""
    models = {
        "congestion": joblib.load(f"{MODELS_DIR}/congestion_model.pkl"),
        "delay": joblib.load(f"{MODELS_DIR}/delay_model.pkl"),
        "risk": joblib.load(f"{MODELS_DIR}/risk_model.pkl"),
        "priority": joblib.load(f"{MODELS_DIR}/priority_model.pkl"),
        "geo_kmeans": joblib.load(f"{MODELS_DIR}/geo_kmeans.pkl"),
    }

    encoders = {}
    for fname in os.listdir(ENCODERS_DIR):
        if fname.endswith("_encoder.pkl"):
            name = fname.replace("_encoder.pkl", "")
            encoders[name] = joblib.load(f"{ENCODERS_DIR}/{fname}")

    metadata = joblib.load(f"{MODELS_DIR}/training_metadata.pkl")
    lookups = joblib.load(f"{MODELS_DIR}/lookups.pkl")

    return models, encoders, metadata, lookups


models, encoders, metadata, lookups = load_all()


# ============================================================
# HELPER: Resolve event_cause from request payload
# ============================================================

def resolve_event_cause(data: dict) -> str:
    """
    Resolve event_cause from the request payload.

    The frontend sends the field as "cause" (JS shorthand property),
    while the backend expects "event_cause". This helper checks both
    field names so valid causes are never silently dropped to "others".
    """
    # Check "event_cause" first, then fall back to "cause"
    raw = data.get("event_cause") or data.get("cause") or "others"
    normalized = str(raw).lower().strip()

    logger.debug("[event_cause] received raw field: event_cause=%r, cause=%r",
                 data.get("event_cause"), data.get("cause"))
    logger.debug("[event_cause] normalized value: %r", normalized)

    return normalized


# ============================================================
# HELPER: Build feature vector from request
# ============================================================

def build_feature_vector(data: dict) -> np.ndarray:
    """
    Convert API request JSON into the feature vector the models expect.

    Expected input fields:
      - event_type: str
      - event_cause / cause: str
      - requires_road_closure: bool/int
      - zone: str (optional, default "Unknown")
      - corridor: str (optional, default "Non-corridor")
      - latitude: float (optional, default 12.97)
      - longitude: float (optional, default 77.59)
      - hour: int
      - day_of_week: int (0=Mon, 6=Sun)
      - month: int
      - expected_crowd: int (optional, default 0)
    """
    event_type = data.get("event_type", "unplanned")
    event_cause = resolve_event_cause(data)
    road_closure = int(data.get("requires_road_closure", 0))
    zone = data.get("zone", "Unknown")
    corridor = data.get("corridor", "Non-corridor")
    lat = float(data.get("latitude", 12.97))
    lon = float(data.get("longitude", 77.59))
    hour = int(data.get("hour", 12))
    day_of_week = int(data.get("day_of_week", 2))
    month = int(data.get("month", 6))

    # Derived time features
    is_peak_hour = 1 if hour in [8, 9, 10, 17, 18, 19, 20] else 0
    is_weekend = 1 if day_of_week >= 5 else 0
    is_night = 1 if (hour >= 22 or hour <= 6) else 0

    if 6 <= hour < 10:
        time_bucket = 0
    elif 10 <= hour < 16:
        time_bucket = 1
    elif 16 <= hour < 21:
        time_bucket = 2
    else:
        time_bucket = 3

    # Encode categoricals (handle unseen labels gracefully)
    def safe_encode(encoder_name, value):
        enc = encoders.get(encoder_name)
        if enc is None:
            return 0
        try:
            return int(enc.transform([value])[0])
        except (ValueError, KeyError):
            # Unseen label → use first class
            return 0

    event_type_enc = safe_encode("event_type", event_type)
    event_cause_enc = safe_encode("event_cause", event_cause)

    logger.debug("[event_cause] encoded value: %d (from %r)",
                 event_cause_enc, event_cause)
    zone_enc = safe_encode("zone", zone)
    corridor_enc = safe_encode("corridor", corridor)

    # Geo-cluster
    try:
        geo_cluster = int(
            models["geo_kmeans"].predict([[lat, lon]])[0]
        )
    except Exception:
        geo_cluster = 0

    # Density features (from training metadata)
    zone_density = 0.05  # default
    corridor_density = 0.05

    # Corridor importance
    corridor_importance = CORRIDOR_IMPORTANCE.get(corridor, 0.30)

    # Cluster density (approximate)
    cluster_density = 0.07

    # Cause severity
    severity_map = metadata.get("cause_severity_map", {})
    cause_severity = severity_map.get(event_cause, 0.30)

    logger.debug("[event_cause] final event_cause used in prediction: %r "
                 "(severity=%.2f)", event_cause, cause_severity)

    # Composite severity
    composite_severity = (
        cause_severity * (1 + 0.5 * road_closure) * corridor_importance
    )

    # Is planned
    is_planned = 1 if event_type == "planned" else 0

    # Build feature vector in EXACT order of FEATURE_COLUMNS
    features = [
        event_type_enc,       # event_type
        event_cause_enc,      # event_cause
        road_closure,         # requires_road_closure
        zone_enc,             # zone
        corridor_enc,         # corridor
        geo_cluster,          # geo_cluster
        hour,                 # hour
        day_of_week,          # day_of_week
        month,                # month
        is_peak_hour,         # is_peak_hour
        is_weekend,           # is_weekend
        is_night,             # is_night
        time_bucket,          # time_bucket
        zone_density,         # zone_density
        corridor_density,     # corridor_density
        corridor_importance,  # corridor_importance
        cluster_density,      # cluster_density
        cause_severity,       # cause_severity
        composite_severity,   # composite_severity
        is_planned,           # is_planned
    ]

    return np.array([features])


# ============================================================
# ROUTES
# ============================================================

@app.route("/")
def home():
    return jsonify({
        "name": "GridLock AI Engine",
        "version": "2.0",
        "status": "running",
        "endpoints": [
            "POST /predict",
            "GET /zones",
            "GET /health",
            "GET /model-info",
        ],
    })


@app.route("/health")
def health():
    return jsonify({
        "status": "healthy",
        "models_loaded": list(models.keys()),
        "encoders_loaded": list(encoders.keys()),
    })


@app.route("/zones")
def zones():
    """Return all known zones, corridors, junctions for dropdown menus."""
    return jsonify(lookups)


@app.route("/model-info")
def model_info():
    """Return model performance metrics and feature importance."""
    return jsonify({
        "models": {
            "congestion_classifier": {
                "accuracy": metadata.get("congestion_accuracy"),
                "cv_mean": metadata.get("congestion_cv_mean"),
                "type": "XGBClassifier",
                "classes": ["Low", "Medium", "High", "Very High"],
            },
            "delay_regressor": {
                "mae_minutes": metadata.get("delay_mae"),
                "r2_score": metadata.get("delay_r2"),
                "type": "XGBRegressor",
            },
            "risk_classifier": {
                "accuracy": metadata.get("risk_accuracy"),
                "type": "XGBClassifier",
                "classes": ["Low", "Medium", "High", "Critical"],
            },
            "priority_classifier": {
                "accuracy": metadata.get("priority_accuracy"),
                "type": "XGBClassifier",
                "classes": ["High", "Low"],
            },
        },
        "training_samples": metadata.get("training_samples"),
        "feature_importance": metadata.get("feature_importance"),
    })


@app.route("/predict", methods=["POST"])
def predict():
    """
    Main prediction endpoint.

    Input JSON:
    {
        "event_type": "planned",
        "event_cause": "public_event",
        "location": "MG Road",           // optional, for display
        "zone": "Central Zone 1",
        "corridor": "CBD 1",
        "latitude": 12.9716,
        "longitude": 77.5946,
        "requires_road_closure": true,
        "hour": 17,
        "day_of_week": 3,
        "month": 6,
        "expected_crowd": 12000          // optional, default 0
    }

    Output JSON:
    {
        "prediction": {
            "congestion_level": "Very High",
            "expected_delay_minutes": 28,
            "affected_radius_km": 3.0,
            "risk_score": 92
        },
        "recommendation": { ... }
    }
    """
    try:
        data = request.json
        if not data:
            return jsonify({"error": "No JSON data provided"}), 400

        # Build feature vector
        features = build_feature_vector(data)

        # ---- Predict Congestion Level ----
        congestion_pred = models["congestion"].predict(features)[0]
        congestion_label = encoders["congestion_level"].inverse_transform(
            [congestion_pred]
        )[0]

        # ---- Predict Expected Delay ----
        delay_pred = float(models["delay"].predict(features)[0])
        delay_pred = max(5, round(delay_pred))  # minimum 5 min

        # ---- Predict Risk Score ----
        # Use predict_proba to get calibrated risk
        risk_pred_class = models["risk"].predict(features)[0]
        risk_proba = models["risk"].predict_proba(features)[0]
        # Weighted risk score: sum of (class_prob × class_weight)
        # Map each class to the midpoint of its risk bin (data-driven from encoder)
        RISK_BIN_MIDPOINTS = {"Low": 12.5, "Medium": 37.5, "High": 62.5, "Critical": 87.5}
        risk_weights = [
            RISK_BIN_MIDPOINTS[cls]
            for cls in encoders["risk_level"].classes_
        ]
        risk_score = float(sum(
            p * w for p, w in zip(risk_proba, risk_weights)
        ))
        risk_score = round(min(100, max(0, risk_score)), 1)

        # ---- Predict Affected Radius ----
        event_cause = resolve_event_cause(data)
        road_closure = bool(data.get("requires_road_closure", False))
        hour = int(data.get("hour", 12))
        is_peak = hour in [8, 9, 10, 17, 18, 19, 20]
        corridor = data.get("corridor", "Non-corridor")

        base_rad = metadata.get("base_radius_map", {}).get(event_cause, 1.0)
        corridor_imp = CORRIDOR_IMPORTANCE.get(corridor, 0.3)
        radius = base_rad * (1.5 if road_closure else 1.0) * (
            1.3 if is_peak else 1.0
        ) * (1 + 0.2 * corridor_imp)
        radius = round(radius, 1)

        # ---- Priority (derived from risk_score) ----
        if risk_score >= 75:
            priority_label = "Critical"
        elif risk_score >= 50:
            priority_label = "High"
        elif risk_score >= 25:
            priority_label = "Medium"
        else:
            priority_label = "Low"

        # ---- Recommendation Engine ----
        expected_crowd = int(data.get("expected_crowd", 0))

        rec = recommend(
            congestion_level=congestion_label,
            risk_score=risk_score,
            event_cause=event_cause,
            requires_road_closure=road_closure,
            is_peak_hour=is_peak,
            corridor=corridor,
            expected_crowd=expected_crowd,
            affected_radius_km=radius,
            expected_delay_minutes=delay_pred,
        )

        response = {
            "prediction": {
                "congestion_level": congestion_label,
                "expected_delay_minutes": delay_pred,
                "affected_radius_km": radius,
                "risk_score": risk_score,
                "priority": priority_label,
            },
            "recommendation": rec,
            "input_summary": {
                "event_type": data.get("event_type", "unplanned"),
                "event_cause": event_cause,
                "location": data.get("location", "Unknown"),
                "corridor": corridor,
                "zone": data.get("zone", "Unknown"),
                "hour": hour,
            },
        }

        return jsonify(response)

    except Exception as e:
        import traceback
        return jsonify({
            "error": str(e),
            "traceback": traceback.format_exc(),
        }), 500


# ============================================================
# RUN
# ============================================================

if __name__ == "__main__":
    print("\n[START] GridLock AI Engine v2.0")
    print("   Endpoints:")
    print("   - POST /predict")
    print("   - GET  /zones")
    print("   - GET  /health")
    print("   - GET  /model-info")
    print()
    app.run(debug=True, host="0.0.0.0", port=5000)