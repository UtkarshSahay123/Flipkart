"""
Feature Engineering Module for GridLock AI Engine.

Transforms raw ASTraM event data into rich features and derives
multi-output targets (congestion, delay, radius, risk) from the
available columns.
"""

import pandas as pd
import numpy as np
from sklearn.cluster import KMeans


# ============================================================
# SEVERITY MAPPINGS (domain-knowledge based)
# ============================================================

EVENT_CAUSE_SEVERITY = {
    "accident": 0.95,
    "protest": 0.90,
    "vip_movement": 0.85,
    "public_event": 0.80,
    "procession": 0.75,
    "congestion": 0.70,
    "water_logging": 0.65,
    "tree_fall": 0.60,
    "construction": 0.55,
    "road_conditions": 0.50,
    "pot_holes": 0.45,
    "vehicle_breakdown": 0.40,
    "Debris": 0.35,
    "debris": 0.35,
    "Fog / Low Visibility": 0.55,
    "others": 0.30,
    "test_demo": 0.10,
}

# Corridors ranked by traffic importance (major arterials higher)
CORRIDOR_IMPORTANCE = {
    "Hosur Road": 0.95,
    "Bellary Road 1": 0.90,
    "Bellary Road 2": 0.85,
    "Mysore Road": 0.85,
    "Old Madras Road": 0.80,
    "Tumkur Road": 0.80,
    "ORR East 1": 0.75,
    "ORR East 2": 0.75,
    "ORR North 1": 0.75,
    "ORR North 2": 0.70,
    "ORR West 1": 0.70,
    "Bannerghata Road": 0.70,
    "Magadi Road": 0.65,
    "West of Chord Road": 0.65,
    "Hennur Main Road": 0.60,
    "Old Airport Road": 0.60,
    "Airport New South Road": 0.60,
    "Varthur Road": 0.55,
    "IRR(Thanisandra road)": 0.55,
    "CBD 1": 0.90,
    "CBD 2": 0.85,
    "Non-corridor": 0.30,
}

# Affected radius estimates by event cause (in km)
BASE_RADIUS = {
    "accident": 2.0,
    "protest": 3.5,
    "vip_movement": 5.0,
    "public_event": 3.0,
    "procession": 4.0,
    "congestion": 2.5,
    "water_logging": 1.5,
    "tree_fall": 1.0,
    "construction": 1.5,
    "road_conditions": 1.0,
    "pot_holes": 0.5,
    "vehicle_breakdown": 1.0,
    "Debris": 0.8,
    "debris": 0.8,
    "Fog / Low Visibility": 3.0,
    "others": 1.0,
    "test_demo": 0.1,
}


def load_and_clean(filepath: str) -> pd.DataFrame:
    """Load CSV and perform basic cleaning."""
    df = pd.read_csv(filepath)

    # Normalize event_cause
    df["event_cause"] = df["event_cause"].str.strip().str.lower()
    df.loc[df["event_cause"] == "fog / low visibility", "event_cause"] = (
        "fog_low_visibility"
    )

    # Parse datetimes
    df["start_datetime"] = pd.to_datetime(
        df["start_datetime"], format="mixed", errors="coerce", utc=True
    )
    df["closed_datetime"] = pd.to_datetime(
        df["closed_datetime"], format="mixed", errors="coerce", utc=True
    )
    df["end_datetime"] = pd.to_datetime(
        df["end_datetime"], format="mixed", errors="coerce", utc=True
    )

    # Normalize boolean
    df["requires_road_closure"] = (
        df["requires_road_closure"]
        .astype(str)
        .str.strip()
        .str.upper()
        .map({"TRUE": 1, "FALSE": 0})
        .fillna(0)
        .astype(int)
    )

    # Fill missing categoricals
    df["zone"] = df["zone"].fillna("Unknown")
    df["junction"] = df["junction"].fillna("Unknown")
    df["corridor"] = df["corridor"].fillna("Non-corridor")
    df["police_station"] = df["police_station"].fillna("Unknown")
    df["veh_type"] = df["veh_type"].fillna("unknown")
    df["event_type"] = df["event_type"].fillna("unplanned")

    return df


def add_time_features(df: pd.DataFrame) -> pd.DataFrame:
    """Extract temporal features from start_datetime."""
    df["hour"] = df["start_datetime"].dt.hour
    df["day_of_week"] = df["start_datetime"].dt.dayofweek
    df["month"] = df["start_datetime"].dt.month

    # Peak hours: morning rush (8-10) + evening rush (17-20)
    df["is_peak_hour"] = df["hour"].apply(
        lambda x: 1 if x in [8, 9, 10, 17, 18, 19, 20] else 0
    )

    # Weekend
    df["is_weekend"] = df["day_of_week"].apply(lambda x: 1 if x >= 5 else 0)

    # Night (10 PM - 6 AM)
    df["is_night"] = df["hour"].apply(
        lambda x: 1 if (x >= 22 or x <= 6) else 0
    )

    # Time of day bucket (more granular)
    def time_bucket(h):
        if 6 <= h < 10:
            return 0  # morning rush
        elif 10 <= h < 16:
            return 1  # midday
        elif 16 <= h < 21:
            return 2  # evening rush
        else:
            return 3  # night

    df["time_bucket"] = df["hour"].apply(time_bucket)

    return df


def add_location_features(df: pd.DataFrame) -> pd.DataFrame:
    """Add location-based features."""
    # Event density per zone (historical hot-spot score)
    zone_counts = df["zone"].value_counts().to_dict()
    total = len(df)
    df["zone_density"] = df["zone"].map(zone_counts) / total

    # Event density per corridor
    corridor_counts = df["corridor"].value_counts().to_dict()
    df["corridor_density"] = df["corridor"].map(corridor_counts) / total

    # Corridor importance score
    df["corridor_importance"] = (
        df["corridor"]
        .map(CORRIDOR_IMPORTANCE)
        .fillna(0.30)
    )

    # Geo-clustering: create micro-zones from lat/lon
    coords = df[["latitude", "longitude"]].values
    kmeans = KMeans(n_clusters=15, random_state=42, n_init=10)
    df["geo_cluster"] = kmeans.fit_predict(coords)

    # Cluster density
    cluster_counts = df["geo_cluster"].value_counts().to_dict()
    df["cluster_density"] = df["geo_cluster"].map(cluster_counts) / total

    return df, kmeans


def add_severity_features(df: pd.DataFrame) -> pd.DataFrame:
    """Add event severity-based features."""
    # Event cause severity score
    # Build lowercase mapping
    severity_map = {}
    for k, v in EVENT_CAUSE_SEVERITY.items():
        severity_map[k.lower()] = v

    df["cause_severity"] = (
        df["event_cause"].str.lower().map(severity_map).fillna(0.30)
    )

    # Composite severity: cause × road_closure boost × corridor importance
    df["composite_severity"] = (
        df["cause_severity"]
        * (1 + 0.5 * df["requires_road_closure"])
        * df["corridor_importance"]
    )

    # Event type score (planned events are slightly less disruptive)
    df["is_planned"] = (df["event_type"] == "planned").astype(int)

    return df


def compute_duration(df: pd.DataFrame) -> pd.DataFrame:
    """Compute actual event duration where both timestamps exist."""
    mask = df["start_datetime"].notna() & df["closed_datetime"].notna()
    df["duration_minutes"] = np.nan

    df.loc[mask, "duration_minutes"] = (
        (df.loc[mask, "closed_datetime"] - df.loc[mask, "start_datetime"])
        .dt.total_seconds() / 60
    )

    # Clean: remove negative durations and extreme outliers (> 48 hours)
    df.loc[df["duration_minutes"] < 0, "duration_minutes"] = np.nan
    df.loc[df["duration_minutes"] > 2880, "duration_minutes"] = np.nan

    return df


def derive_congestion_level(df: pd.DataFrame) -> pd.DataFrame:
    """
    Derive congestion level (4 classes) from composite features.

    Uses a weighted scoring approach combining:
    - Event cause severity
    - Road closure requirement
    - Corridor importance
    - Peak hour status
    - Zone density
    """
    score = (
        df["cause_severity"] * 0.35
        + df["requires_road_closure"] * 0.20
        + df["corridor_importance"] * 0.15
        + df["is_peak_hour"] * 0.15
        + df["zone_density"] * 0.10
        + df["cluster_density"] * 0.05
    )

    # Normalize to 0-1
    score = (score - score.min()) / (score.max() - score.min() + 1e-8)

    # Map to 4 levels using quantile-based thresholds
    df["congestion_level"] = pd.cut(
        score,
        bins=[-0.01, 0.25, 0.50, 0.75, 1.01],
        labels=["Low", "Medium", "High", "Very High"],
    )

    df["congestion_score"] = score

    return df


def derive_risk_score(df: pd.DataFrame) -> pd.DataFrame:
    """
    Derive risk score (0-100) combining severity, location, and time.
    """
    raw_risk = (
        df["cause_severity"] * 40
        + df["requires_road_closure"] * 15
        + df["corridor_importance"] * 15
        + df["is_peak_hour"] * 10
        + df["zone_density"] * 10
        + df["is_planned"].apply(lambda x: -5 if x else 0)  # planned = less risky
        + df["is_night"] * 5
    )

    # Add noise for realistic distribution, clip to 0-100
    np.random.seed(42)
    noise = np.random.normal(0, 5, len(df))
    raw_risk = (raw_risk + noise).clip(0, 100)

    df["risk_score"] = raw_risk.round(1)

    return df


def derive_affected_radius(df: pd.DataFrame) -> pd.DataFrame:
    """
    Derive affected radius in km based on event cause and modifiers.
    """
    radius_map = {}
    for k, v in BASE_RADIUS.items():
        radius_map[k.lower()] = v

    base = df["event_cause"].str.lower().map(radius_map).fillna(1.0)

    # Modifiers
    road_closure_mult = 1 + 0.5 * df["requires_road_closure"]
    peak_mult = 1 + 0.3 * df["is_peak_hour"]
    corridor_mult = 1 + 0.2 * df["corridor_importance"]

    df["affected_radius_km"] = (
        base * road_closure_mult * peak_mult * corridor_mult
    ).round(1)

    return df


def derive_expected_delay(df: pd.DataFrame) -> pd.DataFrame:
    """
    Derive expected delay. Uses actual duration where available,
    otherwise estimates from severity features.
    """
    # Where actual duration exists, use it (capped at reasonable range)
    df["expected_delay_minutes"] = df["duration_minutes"].copy()

    # For missing values, estimate from features
    mask = df["expected_delay_minutes"].isna()
    estimated = (
        df.loc[mask, "cause_severity"] * 30
        + df.loc[mask, "requires_road_closure"] * 20
        + df.loc[mask, "corridor_importance"] * 15
        + df.loc[mask, "is_peak_hour"] * 10
    )

    np.random.seed(123)
    noise = np.random.normal(0, 8, mask.sum())
    estimated = (estimated + noise).clip(5, 180)

    df.loc[mask, "expected_delay_minutes"] = estimated.round(0)

    return df


def build_features(filepath: str, verbose: bool = True):
    """
    Main pipeline: load data → engineer features → derive targets.

    Returns:
        df: Full DataFrame with all features and targets
        kmeans: Fitted KMeans model for geo-clustering (needed at inference)
    """
    if verbose:
        print("=" * 60)
        print("GRIDLOCK AI — Feature Engineering Pipeline")
        print("=" * 60)

    # Step 1: Load and clean
    df = load_and_clean(filepath)
    if verbose:
        print(f"\n[1/7] Loaded data: {df.shape[0]} rows, {df.shape[1]} columns")

    # Step 2: Time features
    df = add_time_features(df)
    if verbose:
        print("[2/7] Time features added")

    # Step 3: Location features
    df, kmeans = add_location_features(df)
    if verbose:
        print(f"[3/7] Location features added ({15} geo-clusters)")

    # Step 4: Severity features
    df = add_severity_features(df)
    if verbose:
        print("[4/7] Severity features added")

    # Step 5: Duration
    df = compute_duration(df)
    valid_dur = df["duration_minutes"].notna().sum()
    if verbose:
        print(f"[5/7] Duration computed ({valid_dur} events with actual times)")

    # Step 6: Derive targets
    df = derive_congestion_level(df)
    df = derive_risk_score(df)
    df = derive_affected_radius(df)
    df = derive_expected_delay(df)
    if verbose:
        print("[6/7] Multi-output targets derived")
        print(f"       Congestion: {df['congestion_level'].value_counts().to_dict()}")
        print(f"       Risk score: mean={df['risk_score'].mean():.1f}, "
              f"std={df['risk_score'].std():.1f}")
        print(f"       Radius: mean={df['affected_radius_km'].mean():.1f} km")
        print(f"       Delay: mean={df['expected_delay_minutes'].mean():.0f} min")

    # Step 7: Drop rows with missing target
    df = df.dropna(subset=["priority"])
    df = df.dropna(subset=["hour"])  # need valid datetime
    if verbose:
        print(f"[7/7] Final dataset: {df.shape[0]} rows")

    return df, kmeans


# ============================================================
# FEATURE COLUMNS used for training
# ============================================================

FEATURE_COLUMNS = [
    "event_type",          # categorical → encoded
    "event_cause",         # categorical → encoded
    "requires_road_closure",  # binary
    "zone",                # categorical → encoded
    "corridor",            # categorical → encoded
    "geo_cluster",         # int
    "hour",                # int
    "day_of_week",         # int
    "month",               # int
    "is_peak_hour",        # binary
    "is_weekend",          # binary
    "is_night",            # binary
    "time_bucket",         # int
    "zone_density",        # float
    "corridor_density",    # float
    "corridor_importance", # float
    "cluster_density",     # float
    "cause_severity",      # float
    "composite_severity",  # float
    "is_planned",          # binary
]

CATEGORICAL_COLUMNS = [
    "event_type",
    "event_cause",
    "zone",
    "corridor",
]


if __name__ == "__main__":
    DATA_PATH = (
        "data/Astram event data_anonymized - "
        "Astram event data_anonymizedb40ac87.csv"
    )
    df, kmeans = build_features(DATA_PATH)
    print("\n[OK] Feature engineering complete!")
    print(f"\nFeature columns ({len(FEATURE_COLUMNS)}):")
    for c in FEATURE_COLUMNS:
        print(f"  - {c}")
