from __future__ import annotations

import pandas as pd
from sklearn.preprocessing import LabelEncoder

FEATURE_COLS = [
    "event_type_enc",
    "location_enc",
    "road_issue_enc",
    "hour_of_day",
    "day_of_week",
    "is_weekend",
    "is_peak_hour",
    "crowd_normalized",
]


def engineer_features(df: pd.DataFrame):
    required_columns = ["event_type", "location", "road_issue", "hour_of_day", "expected_crowd"]
    missing = [column for column in required_columns if column not in df.columns]
    if missing:
        raise ValueError(f"Missing required columns: {', '.join(missing)}")

    df = df.copy()

    le_event = LabelEncoder()
    le_location = LabelEncoder()
    le_road_issue = LabelEncoder()
    df["event_type_enc"] = le_event.fit_transform(df["event_type"].astype(str))
    df["location_enc"] = le_location.fit_transform(df["location"].astype(str))
    df["road_issue_enc"] = le_road_issue.fit_transform(df["road_issue"].astype(str))

    df["is_peak_hour"] = df["hour_of_day"].apply(
        lambda hour: 1 if (8 <= hour <= 10 or 17 <= hour <= 20) else 0
    )
    df["is_morning_peak"] = df["hour_of_day"].apply(lambda hour: 1 if 8 <= hour <= 10 else 0)
    df["is_evening_peak"] = df["hour_of_day"].apply(lambda hour: 1 if 17 <= hour <= 20 else 0)

    max_crowd = max(float(df["expected_crowd"].max()), 1.0)
    df["crowd_normalized"] = df["expected_crowd"] / max_crowd

    return df, le_event, le_location, le_road_issue
