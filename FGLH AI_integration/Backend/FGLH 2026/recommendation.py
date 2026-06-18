"""
GridLock AI — Data-Driven Recommendation Engine

Takes prediction outputs (congestion level, risk score, event details)
and generates actionable resource deployment recommendations.
"""

import math


# ============================================================
# RESOURCE PROFILES (base allocations by congestion level)
# ============================================================

BASE_RESOURCES = {
    "Low": {
        "police_officers": 2,
        "barricades": 0,
        "ambulances": 0,
        "traffic_marshals": 1,
    },
    "Medium": {
        "police_officers": 6,
        "barricades": 2,
        "ambulances": 0,
        "traffic_marshals": 2,
    },
    "High": {
        "police_officers": 12,
        "barricades": 4,
        "ambulances": 1,
        "traffic_marshals": 4,
    },
    "Very High": {
        "police_officers": 18,
        "barricades": 6,
        "ambulances": 2,
        "traffic_marshals": 6,
    },
}

# Event-cause-specific overrides (maximum deployment scenarios)
CAUSE_OVERRIDES = {
    "vip_movement": {
        "police_officers": 30,
        "barricades": 10,
        "ambulances": 2,
        "traffic_marshals": 8,
        "priority_label": "Critical",
    },
    "protest": {
        "police_officers": 25,
        "barricades": 8,
        "ambulances": 2,
        "traffic_marshals": 10,
        "priority_label": "Critical",
    },
    "procession": {
        "police_officers": 20,
        "barricades": 6,
        "ambulances": 1,
        "traffic_marshals": 8,
        "priority_label": "High",
    },
    "public_event": {
        "police_officers": 18,
        "barricades": 6,
        "ambulances": 1,
        "traffic_marshals": 6,
        "priority_label": "High",
    },
}

# Diversion routes by corridor (simulated adjacency graph)
DIVERSION_ROUTES = {
    "Hosur Road": "Route via Bannerghata Road -> Dairy Circle -> JP Nagar",
    "Bellary Road 1": "Route via Sankey Road -> Palace Road -> Seshadri Road",
    "Bellary Road 2": "Route via Hebbal Flyover -> ORR -> Hennur",
    "Mysore Road": "Route via Chord Road -> Magadi Road -> NICE Ring Road",
    "Old Madras Road": "Route via HAL Old Airport Road -> ORR East",
    "Tumkur Road": "Route via Magadi Road -> Chord Road -> Rajajinagar",
    "ORR East 1": "Route via Varthur Road -> Whitefield -> Old Madras Road",
    "ORR East 2": "Route via Sarjapur Road -> HSR Layout -> BTM Layout",
    "ORR North 1": "Route via Hennur Main Road -> Thanisandra -> Hebbal",
    "ORR North 2": "Route via Tumkur Road -> Yeshwanthpur -> Rajajinagar",
    "ORR West 1": "Route via Mysore Road -> NICE Ring Road -> Kanakapura Road",
    "Bannerghata Road": "Route via Hosur Road -> BTM Layout -> JP Nagar",
    "Magadi Road": "Route via Chord Road -> Tumkur Road -> Rajajinagar",
    "West of Chord Road": "Route via Magadi Road -> Rajajinagar Industrial Area",
    "Hennur Main Road": "Route via Kalyan Nagar -> Banaswadi -> ORR North",
    "Old Airport Road": "Route via HAL -> Domlur -> MG Road",
    "Airport New South Road": "Route via ORR North -> Hebbal -> Bellary Road",
    "Varthur Road": "Route via Marathahalli -> ORR East -> Whitefield",
    "IRR(Thanisandra road)": "Route via Hebbal -> Bellary Road -> ORR North",
    "CBD 1": "Route via MG Road -> Brigade Road -> Residency Road",
    "CBD 2": "Route via JC Road -> KR Road -> Mysore Road",
    "Non-corridor": "Route via nearest arterial road",
}


def _get_priority_label(risk_score: float) -> str:
    """Map risk score to a priority label."""
    if risk_score >= 75:
        return "Critical"
    elif risk_score >= 50:
        return "High"
    elif risk_score >= 25:
        return "Medium"
    else:
        return "Low"


def _scale_resources(base: dict, risk_score: float,
                     road_closure: bool, is_peak: bool,
                     expected_crowd: int = 0) -> dict:
    """
    Scale base resource allocation using multipliers.

    Multipliers:
    - Risk score → linear scaling (0.5x at risk=0 to 2.0x at risk=100)
    - Road closure → +50%
    - Peak hour → +30%
    - Expected crowd → logarithmic scaling above 1000
    """
    # Risk multiplier: 0.5 → 2.0
    risk_mult = 0.5 + (risk_score / 100) * 1.5

    # Road closure multiplier
    closure_mult = 1.5 if road_closure else 1.0

    # Peak hour multiplier
    peak_mult = 1.3 if is_peak else 1.0

    # Crowd multiplier (logarithmic above 1000)
    crowd_mult = 1.0
    if expected_crowd > 1000:
        crowd_mult = 1.0 + math.log10(expected_crowd / 1000) * 0.5

    total_mult = risk_mult * closure_mult * peak_mult * crowd_mult

    scaled = {}
    for key, val in base.items():
        scaled[key] = max(1, int(round(val * total_mult)))

    return scaled


def _build_reasoning(event_cause: str, congestion_level: str,
                     risk_score: float, road_closure: bool,
                     is_peak: bool, corridor: str,
                     expected_crowd: int = 0) -> str:
    """Build a human-readable reasoning string."""
    parts = []

    # Event cause description
    cause_labels = {
        "accident": "Road accident reported",
        "protest": "Protest/demonstration activity",
        "vip_movement": "VIP convoy movement",
        "public_event": "Public event/gathering",
        "procession": "Religious/cultural procession",
        "congestion": "Traffic congestion detected",
        "water_logging": "Water logging on road",
        "tree_fall": "Fallen tree blocking road",
        "construction": "Road construction/maintenance",
        "road_conditions": "Poor road conditions",
        "pot_holes": "Pothole hazard reported",
        "vehicle_breakdown": "Vehicle breakdown on road",
        "debris": "Road debris obstruction",
        "fog_low_visibility": "Fog/low visibility conditions",
    }
    parts.append(cause_labels.get(event_cause, f"Event: {event_cause}"))

    if congestion_level in ("High", "Very High"):
        parts.append(f"with {congestion_level.lower()} congestion expected")

    if road_closure:
        parts.append("requiring road closure")

    if is_peak:
        parts.append("during peak traffic hours")

    if corridor and corridor != "Non-corridor":
        parts.append(f"on {corridor} corridor")

    if expected_crowd > 0:
        parts.append(f"with ~{expected_crowd:,} expected crowd")

    parts.append(f"(Risk: {risk_score:.0f}%)")

    return ". ".join(parts) + "."


def recommend(
    congestion_level: str,
    risk_score: float,
    event_cause: str,
    requires_road_closure: bool,
    is_peak_hour: bool = False,
    corridor: str = "Non-corridor",
    expected_crowd: int = 0,
    affected_radius_km: float = 1.0,
    expected_delay_minutes: float = 15.0,
) -> dict:
    """
    Generate resource deployment recommendation.

    Args:
        congestion_level: "Low", "Medium", "High", or "Very High"
        risk_score: 0-100 float
        event_cause: type of event (accident, protest, etc.)
        requires_road_closure: boolean
        is_peak_hour: boolean
        corridor: road corridor name
        expected_crowd: estimated crowd size (0 if unknown)
        affected_radius_km: predicted affected radius
        expected_delay_minutes: predicted delay

    Returns:
        dict with resource recommendations and reasoning
    """
    event_cause_lower = event_cause.lower().strip()

    # Check for cause-specific overrides (high-priority events)
    if event_cause_lower in CAUSE_OVERRIDES:
        override = CAUSE_OVERRIDES[event_cause_lower]
        resources = _scale_resources(
            {k: v for k, v in override.items() if k != "priority_label"},
            risk_score,
            requires_road_closure,
            is_peak_hour,
            expected_crowd,
        )
        priority_label = override.get("priority_label", "Critical")
    else:
        # Use congestion-level based allocation
        cong = congestion_level if congestion_level in BASE_RESOURCES else "Medium"
        base = BASE_RESOURCES[cong]
        resources = _scale_resources(
            base,
            risk_score,
            requires_road_closure,
            is_peak_hour,
            expected_crowd,
        )
        priority_label = _get_priority_label(risk_score)

    # Diversion route
    diversion = DIVERSION_ROUTES.get(
        corridor,
        "Route via nearest alternative arterial road"
    )

    # If road closure, always suggest diversion
    if requires_road_closure:
        diversion = "[ROAD CLOSURE] " + diversion

    # Build reasoning
    reasoning = _build_reasoning(
        event_cause_lower,
        congestion_level,
        risk_score,
        requires_road_closure,
        is_peak_hour,
        corridor,
        expected_crowd,
    )

    return {
        "police_officers": resources["police_officers"],
        "barricades": resources["barricades"],
        "ambulances": resources["ambulances"],
        "traffic_marshals": resources["traffic_marshals"],
        "diversion_route": diversion,
        "priority": priority_label,
        "reasoning": reasoning,
        "estimated_clearance_hours": round(expected_delay_minutes / 60, 1),
        "alert_radius_km": affected_radius_km,
    }


if __name__ == "__main__":
    # Quick test
    print("=== Test 1: VIP Movement ===")
    result = recommend(
        congestion_level="Very High",
        risk_score=92,
        event_cause="vip_movement",
        requires_road_closure=True,
        is_peak_hour=True,
        corridor="Bellary Road 1",
        expected_crowd=5000,
    )
    for k, v in result.items():
        print(f"  {k}: {v}")

    print("\n=== Test 2: Vehicle Breakdown ===")
    result = recommend(
        congestion_level="Medium",
        risk_score=35,
        event_cause="vehicle_breakdown",
        requires_road_closure=False,
        is_peak_hour=False,
        corridor="ORR East 1",
    )
    for k, v in result.items():
        print(f"  {k}: {v}")

    print("\n=== Test 3: Protest during Peak ===")
    result = recommend(
        congestion_level="Very High",
        risk_score=88,
        event_cause="protest",
        requires_road_closure=True,
        is_peak_hour=True,
        corridor="CBD 1",
        expected_crowd=12000,
    )
    for k, v in result.items():
        print(f"  {k}: {v}")