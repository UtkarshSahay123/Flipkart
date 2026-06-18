"""
GridLock AI — Multi-Model Training Pipeline

Trains 3 models on ASTraM event data:
  1. Congestion Classifier (XGBoost) → Low/Medium/High/Very High
  2. Delay Regressor (XGBoost) → Expected delay in minutes
  3. Risk Classifier (XGBoost) → Risk score via calibrated probabilities

Also trains a secondary priority model for backward compatibility.
"""

import os
import warnings
import joblib
import numpy as np
import pandas as pd

from sklearn.model_selection import (
    train_test_split,
    StratifiedKFold,
    cross_val_score,
)
from sklearn.preprocessing import LabelEncoder
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    mean_absolute_error,
    r2_score,
)
from xgboost import XGBClassifier, XGBRegressor
from imblearn.over_sampling import SMOTE

from feature_engineering import (
    build_features,
    FEATURE_COLUMNS,
    CATEGORICAL_COLUMNS,
    CORRIDOR_IMPORTANCE,
    EVENT_CAUSE_SEVERITY,
    BASE_RADIUS,
)

warnings.filterwarnings("ignore")

# ============================================================
# CONFIG
# ============================================================

DATA_PATH = (
    "data/Astram event data_anonymized - "
    "Astram event data_anonymizedb40ac87.csv"
)
MODELS_DIR = "models"
ENCODERS_DIR = "encoders"
RANDOM_STATE = 42
TEST_SIZE = 0.20


def train_all():
    """Main training pipeline."""

    print("=" * 60)
    print("  GRIDLOCK AI — Training Pipeline")
    print("=" * 60)

    # --------------------------------------------------------
    # 1. FEATURE ENGINEERING
    # --------------------------------------------------------
    df, kmeans_model = build_features(DATA_PATH, verbose=True)

    # --------------------------------------------------------
    # 2. ENCODE CATEGORICALS
    # --------------------------------------------------------
    print("\n" + "=" * 60)
    print("ENCODING CATEGORICAL FEATURES")
    print("=" * 60)

    encoders = {}
    for col in CATEGORICAL_COLUMNS:
        le = LabelEncoder()
        df[col] = le.fit_transform(df[col].astype(str))
        encoders[col] = le
        print(f"  {col}: {len(le.classes_)} classes")

    # Priority encoder (original target)
    priority_encoder = LabelEncoder()
    df["priority"] = priority_encoder.fit_transform(df["priority"])
    encoders["priority"] = priority_encoder

    # Congestion level encoder
    congestion_encoder = LabelEncoder()
    df["congestion_level"] = congestion_encoder.fit_transform(
        df["congestion_level"].astype(str)
    )
    encoders["congestion_level"] = congestion_encoder
    print(f"  congestion_level: {list(congestion_encoder.classes_)}")

    # --------------------------------------------------------
    # 3. PREPARE FEATURE MATRIX
    # --------------------------------------------------------
    print("\n" + "=" * 60)
    print("PREPARING FEATURES")
    print("=" * 60)

    # Drop rows where any feature is NaN
    df_clean = df[FEATURE_COLUMNS + [
        "priority",
        "congestion_level",
        "risk_score",
        "expected_delay_minutes",
        "affected_radius_km",
    ]].dropna()

    X = df_clean[FEATURE_COLUMNS].values
    feature_names = FEATURE_COLUMNS

    print(f"  Training samples: {len(df_clean)}")
    print(f"  Features: {len(feature_names)}")

    # --------------------------------------------------------
    # 4. TRAIN CONGESTION MODEL
    # --------------------------------------------------------
    print("\n" + "=" * 60)
    print("MODEL 1: CONGESTION LEVEL CLASSIFIER")
    print("=" * 60)

    y_congestion = df_clean["congestion_level"].values

    X_train, X_test, y_train, y_test = train_test_split(
        X, y_congestion,
        test_size=TEST_SIZE,
        random_state=RANDOM_STATE,
        stratify=y_congestion,
    )

    # Apply SMOTE for class balance
    try:
        smote = SMOTE(random_state=RANDOM_STATE)
        X_train_sm, y_train_sm = smote.fit_resample(X_train, y_train)
        print(f"  SMOTE: {len(X_train)} → {len(X_train_sm)} samples")
    except Exception:
        X_train_sm, y_train_sm = X_train, y_train
        print("  SMOTE skipped (not enough minority samples)")

    congestion_model = XGBClassifier(
        n_estimators=300,
        max_depth=6,
        learning_rate=0.1,
        subsample=0.8,
        colsample_bytree=0.8,
        random_state=RANDOM_STATE,
        n_jobs=-1,
        eval_metric="mlogloss",
    )
    congestion_model.fit(X_train_sm, y_train_sm)

    # Evaluate
    train_pred = congestion_model.predict(X_train)
    test_pred = congestion_model.predict(X_test)
    print(f"\n  Train Accuracy: {accuracy_score(y_train, train_pred):.4f}")
    print(f"  Test  Accuracy: {accuracy_score(y_test, test_pred):.4f}")

    # Cross-validation
    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=RANDOM_STATE)
    cv_scores = cross_val_score(
        congestion_model, X, y_congestion, cv=cv, scoring="accuracy"
    )
    print(f"  5-Fold CV: {cv_scores.mean():.4f} ± {cv_scores.std():.4f}")

    print("\n  Classification Report:")
    target_names = [str(c) for c in congestion_encoder.classes_]
    print(classification_report(y_test, test_pred, target_names=target_names))

    # --------------------------------------------------------
    # 5. TRAIN DELAY REGRESSOR
    # --------------------------------------------------------
    print("=" * 60)
    print("MODEL 2: EXPECTED DELAY REGRESSOR")
    print("=" * 60)

    y_delay = df_clean["expected_delay_minutes"].values

    X_tr_d, X_te_d, y_tr_d, y_te_d = train_test_split(
        X, y_delay,
        test_size=TEST_SIZE,
        random_state=RANDOM_STATE,
    )

    delay_model = XGBRegressor(
        n_estimators=300,
        max_depth=6,
        learning_rate=0.1,
        subsample=0.8,
        colsample_bytree=0.8,
        random_state=RANDOM_STATE,
        n_jobs=-1,
    )
    delay_model.fit(X_tr_d, y_tr_d)

    delay_pred_train = delay_model.predict(X_tr_d)
    delay_pred_test = delay_model.predict(X_te_d)

    print(f"\n  Train MAE: {mean_absolute_error(y_tr_d, delay_pred_train):.2f} min")
    print(f"  Test  MAE: {mean_absolute_error(y_te_d, delay_pred_test):.2f} min")
    print(f"  Test  R²:  {r2_score(y_te_d, delay_pred_test):.4f}")

    # --------------------------------------------------------
    # 6. TRAIN RISK MODEL
    # --------------------------------------------------------
    print("\n" + "=" * 60)
    print("MODEL 3: RISK SCORE CLASSIFIER")
    print("=" * 60)

    # Bin risk score into classes for classification
    risk_bins = pd.cut(
        df_clean["risk_score"],
        bins=[0, 25, 50, 75, 100],
        labels=["Low", "Medium", "High", "Critical"],
    )
    risk_encoder = LabelEncoder()
    y_risk = risk_encoder.fit_transform(risk_bins.astype(str))
    encoders["risk_level"] = risk_encoder

    X_tr_r, X_te_r, y_tr_r, y_te_r = train_test_split(
        X, y_risk,
        test_size=TEST_SIZE,
        random_state=RANDOM_STATE,
        stratify=y_risk,
    )

    try:
        smote_r = SMOTE(random_state=RANDOM_STATE)
        X_tr_r_sm, y_tr_r_sm = smote_r.fit_resample(X_tr_r, y_tr_r)
    except Exception:
        X_tr_r_sm, y_tr_r_sm = X_tr_r, y_tr_r

    risk_model = XGBClassifier(
        n_estimators=300,
        max_depth=6,
        learning_rate=0.1,
        subsample=0.8,
        colsample_bytree=0.8,
        random_state=RANDOM_STATE,
        n_jobs=-1,
        eval_metric="mlogloss",
    )
    risk_model.fit(X_tr_r_sm, y_tr_r_sm)

    risk_train_pred = risk_model.predict(X_tr_r)
    risk_test_pred = risk_model.predict(X_te_r)
    print(f"\n  Train Accuracy: {accuracy_score(y_tr_r, risk_train_pred):.4f}")
    print(f"  Test  Accuracy: {accuracy_score(y_te_r, risk_test_pred):.4f}")

    risk_names = [str(c) for c in risk_encoder.classes_]
    print("\n  Classification Report:")
    print(classification_report(y_te_r, risk_test_pred, target_names=risk_names))

    # --------------------------------------------------------
    # 7. TRAIN PRIORITY MODEL (backward compat)
    # --------------------------------------------------------
    print("=" * 60)
    print("MODEL 4: PRIORITY CLASSIFIER (legacy)")
    print("=" * 60)

    y_priority = df_clean["priority"].values

    X_tr_p, X_te_p, y_tr_p, y_te_p = train_test_split(
        X, y_priority,
        test_size=TEST_SIZE,
        random_state=RANDOM_STATE,
        stratify=y_priority,
    )

    priority_model = XGBClassifier(
        n_estimators=300,
        max_depth=6,
        learning_rate=0.1,
        subsample=0.8,
        colsample_bytree=0.8,
        random_state=RANDOM_STATE,
        n_jobs=-1,
        eval_metric="logloss",
    )
    priority_model.fit(X_tr_p, y_tr_p)

    pri_train_pred = priority_model.predict(X_tr_p)
    pri_test_pred = priority_model.predict(X_te_p)
    print(f"\n  Train Accuracy: {accuracy_score(y_tr_p, pri_train_pred):.4f}")
    print(f"  Test  Accuracy: {accuracy_score(y_te_p, pri_test_pred):.4f}")

    pri_names = [str(c) for c in priority_encoder.classes_]
    print("\n  Classification Report:")
    print(classification_report(y_te_p, pri_test_pred, target_names=pri_names))

    # --------------------------------------------------------
    # 8. FEATURE IMPORTANCE
    # --------------------------------------------------------
    print("=" * 60)
    print("FEATURE IMPORTANCE (Congestion Model)")
    print("=" * 60)

    importance = pd.DataFrame({
        "Feature": feature_names,
        "Importance": congestion_model.feature_importances_,
    }).sort_values("Importance", ascending=False)

    for _, row in importance.iterrows():
        bar = "*" * int(row["Importance"] * 50)
        print(f"  {row['Feature']:25s} {row['Importance']:.4f} {bar}")

    # --------------------------------------------------------
    # 9. SAVE EVERYTHING
    # --------------------------------------------------------
    print("\n" + "=" * 60)
    print("SAVING MODELS & ENCODERS")
    print("=" * 60)

    os.makedirs(MODELS_DIR, exist_ok=True)
    os.makedirs(ENCODERS_DIR, exist_ok=True)

    # Models
    joblib.dump(congestion_model, f"{MODELS_DIR}/congestion_model.pkl")
    joblib.dump(delay_model, f"{MODELS_DIR}/delay_model.pkl")
    joblib.dump(risk_model, f"{MODELS_DIR}/risk_model.pkl")
    joblib.dump(priority_model, f"{MODELS_DIR}/priority_model.pkl")
    joblib.dump(kmeans_model, f"{MODELS_DIR}/geo_kmeans.pkl")
    print("  [OK] Models saved to models/")

    # Encoders
    for name, enc in encoders.items():
        joblib.dump(enc, f"{ENCODERS_DIR}/{name}_encoder.pkl")
    print("  [OK] Encoders saved to encoders/")

    # Training metadata
    metadata = {
        "feature_columns": feature_names,
        "categorical_columns": list(CATEGORICAL_COLUMNS),
        "congestion_accuracy": float(accuracy_score(y_test, test_pred)),
        "congestion_cv_mean": float(cv_scores.mean()),
        "delay_mae": float(mean_absolute_error(y_te_d, delay_pred_test)),
        "delay_r2": float(r2_score(y_te_d, delay_pred_test)),
        "risk_accuracy": float(accuracy_score(y_te_r, risk_test_pred)),
        "priority_accuracy": float(accuracy_score(y_te_p, pri_test_pred)),
        "training_samples": len(df_clean),
        "feature_importance": importance.set_index("Feature")[
            "Importance"
        ].to_dict(),
        "corridor_importance_map": CORRIDOR_IMPORTANCE,
        "cause_severity_map": {
            k.lower(): v for k, v in EVENT_CAUSE_SEVERITY.items()
        },
        "base_radius_map": {
            k.lower(): v for k, v in BASE_RADIUS.items()
        },
    }
    joblib.dump(metadata, f"{MODELS_DIR}/training_metadata.pkl")
    print("  [OK] Metadata saved")

    # Zone/corridor/junction lookup for API
    df_full, _ = build_features(DATA_PATH, verbose=False)
    lookups = {
        "zones": sorted(df_full["zone"].dropna().unique().tolist()),
        "corridors": sorted(df_full["corridor"].dropna().unique().tolist()),
        "junctions": sorted(
            df_full["junction"].dropna().unique().tolist()
        )[:100],  # top 100
        "event_causes": sorted(
            df_full["event_cause"].dropna().unique().tolist()
        ),
        "event_types": sorted(
            df_full["event_type"].dropna().unique().tolist()
        ),
        "police_stations": sorted(
            df_full["police_station"].dropna().unique().tolist()
        )[:50],
    }
    joblib.dump(lookups, f"{MODELS_DIR}/lookups.pkl")
    print("  [OK] Lookups saved")

    print("\n" + "=" * 60)
    print("  [OK] ALL MODELS TRAINED SUCCESSFULLY!")
    print("=" * 60)
    print(f"\n  Congestion Accuracy:  {accuracy_score(y_test, test_pred):.1%}")
    print(f"  Delay MAE:            {mean_absolute_error(y_te_d, delay_pred_test):.1f} min")
    print(f"  Risk Accuracy:        {accuracy_score(y_te_r, risk_test_pred):.1%}")
    print(f"  Priority Accuracy:    {accuracy_score(y_te_p, pri_test_pred):.1%}")


if __name__ == "__main__":
    train_all()