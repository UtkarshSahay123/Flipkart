from __future__ import annotations

import json
from pathlib import Path

import joblib
import pandas as pd
from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
from sklearn.metrics import accuracy_score, mean_absolute_error
from sklearn.model_selection import train_test_split

from part_a.src.config import (
    DEFAULT_RANDOM_STATE,
    DEFAULT_TEST_SIZE,
    METRICS_PATH,
    MODEL_PATH,
    PROCESSED_DATA_PATH,
    RAW_DATA_PATH,
)
from part_a.src.data_prep import load_raw_data, save_processed_data, validate_schema
from part_a.src.features import FEATURE_COLS, engineer_features


def _split_train_test(df: pd.DataFrame, test_size: float, random_state: int):
    train_index, test_index = train_test_split(
        df.index.to_numpy(), test_size=test_size, random_state=random_state
    )
    return df.loc[train_index], df.loc[test_index]


def train_from_dataset(
    data_path: str | Path = RAW_DATA_PATH,
    model_path: str | Path = MODEL_PATH,
    processed_path: str | Path = PROCESSED_DATA_PATH,
    metrics_path: str | Path = METRICS_PATH,
    test_size: float = DEFAULT_TEST_SIZE,
    random_state: int = DEFAULT_RANDOM_STATE,
):
    data_path = Path(data_path)
    model_path = Path(model_path)
    processed_path = Path(processed_path)
    metrics_path = Path(metrics_path)

    df = load_raw_data(data_path)
    validate_schema(df)
    df, le_event, le_location, le_road_issue = engineer_features(df)
    save_processed_data(df, processed_path)

    feature_frame = df[FEATURE_COLS]
    target_frame = df[["congestion_level", "delay_minutes", "affected_radius_km", "risk_score"]]
    X_train, X_test = _split_train_test(feature_frame, test_size=test_size, random_state=random_state)
    y_train, y_test = _split_train_test(target_frame, test_size=test_size, random_state=random_state)

    classifier = RandomForestClassifier(n_estimators=200, random_state=random_state)
    classifier.fit(X_train, y_train["congestion_level"])
    congestion_accuracy = accuracy_score(y_test["congestion_level"], classifier.predict(X_test))

    regressor_delay = RandomForestRegressor(n_estimators=200, random_state=random_state)
    regressor_delay.fit(X_train, y_train["delay_minutes"])
    delay_mae = mean_absolute_error(y_test["delay_minutes"], regressor_delay.predict(X_test))

    regressor_radius = RandomForestRegressor(n_estimators=200, random_state=random_state)
    regressor_radius.fit(X_train, y_train["affected_radius_km"])
    radius_mae = mean_absolute_error(y_test["affected_radius_km"], regressor_radius.predict(X_test))

    regressor_risk = RandomForestRegressor(n_estimators=200, random_state=random_state)
    regressor_risk.fit(X_train, y_train["risk_score"])
    risk_mae = mean_absolute_error(y_test["risk_score"], regressor_risk.predict(X_test))

    metrics = {
        "rows": int(len(df)),
        "columns": list(df.columns),
        "feature_columns": FEATURE_COLS,
        "congestion_accuracy": float(congestion_accuracy),
        "delay_mae": float(delay_mae),
        "radius_mae": float(radius_mae),
        "risk_mae": float(risk_mae),
        "raw_data_path": str(data_path),
        "processed_path": str(processed_path),
    }

    bundle = {
        "classifier": classifier,
        "regressor_delay": regressor_delay,
        "regressor_radius": regressor_radius,
        "regressor_risk": regressor_risk,
        "le_event": le_event,
        "le_location": le_location,
        "le_road_issue": le_road_issue,
        "feature_columns": FEATURE_COLS,
        "event_categories": list(le_event.classes_),
        "location_categories": list(le_location.classes_),
        "road_issue_categories": list(le_road_issue.classes_),
        "crowd_scale": max(float(df["expected_crowd"].max()), 1.0),
        "metrics": metrics,
    }

    model_path.parent.mkdir(parents=True, exist_ok=True)
    metrics_path.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(bundle, model_path)
    metrics_path.write_text(json.dumps(metrics, indent=2), encoding="utf-8")

    return bundle