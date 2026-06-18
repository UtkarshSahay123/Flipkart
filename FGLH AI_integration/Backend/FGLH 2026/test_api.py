"""
GridLock AI — API Test Script

Sends sample requests to all endpoints and prints formatted results.
Useful for demos and validating predictions.
"""

import requests
import json
import sys

BASE_URL = "http://localhost:5000"


def pretty(data):
    """Pretty-print JSON response."""
    print(json.dumps(data, indent=2, ensure_ascii=False))


def test_health():
    print("=" * 60)
    print("TEST: GET /health")
    print("=" * 60)
    r = requests.get(f"{BASE_URL}/health")
    pretty(r.json())
    print()


def test_model_info():
    print("=" * 60)
    print("TEST: GET /model-info")
    print("=" * 60)
    r = requests.get(f"{BASE_URL}/model-info")
    data = r.json()
    print(f"Training samples: {data.get('training_samples')}")
    for model_name, info in data.get("models", {}).items():
        print(f"\n  {model_name}:")
        for k, v in info.items():
            print(f"    {k}: {v}")
    print()


def test_zones():
    print("=" * 60)
    print("TEST: GET /zones")
    print("=" * 60)
    r = requests.get(f"{BASE_URL}/zones")
    data = r.json()
    for key, values in data.items():
        print(f"  {key}: {len(values)} items -> {values[:5]}...")
    print()


def test_predict(name, payload):
    print("=" * 60)
    print(f"TEST: POST /predict — {name}")
    print("=" * 60)
    print("Input:")
    pretty(payload)
    print()

    r = requests.post(f"{BASE_URL}/predict", json=payload)
    data = r.json()

    if "error" in data:
        print(f"❌ Error: {data['error']}")
        return

    pred = data.get("prediction", {})
    rec = data.get("recommendation", {})

    print("[PREDICTION] Prediction:")
    print(f"  Congestion:    {pred.get('congestion_level')}")
    print(f"  Expected Delay: {pred.get('expected_delay_minutes')} min")
    print(f"  Affected Radius: {pred.get('affected_radius_km')} km")
    print(f"  Risk Score:    {pred.get('risk_score')}%")
    print(f"  Priority:      {pred.get('priority')}")

    print("\n[RECOMMENDATION] Recommendation:")
    print(f"  Police Officers:  {rec.get('police_officers')}")
    print(f"  Barricades:       {rec.get('barricades')}")
    print(f"  Ambulances:       {rec.get('ambulances')}")
    print(f"  Traffic Marshals: {rec.get('traffic_marshals')}")
    print(f"  Diversion:        {rec.get('diversion_route')}")
    print(f"  Priority:         {rec.get('priority')}")
    print(f"  Clearance:        {rec.get('estimated_clearance_hours')} hrs")
    print(f"\n  [REASONING] {rec.get('reasoning')}")
    print()


def main():
    print("\n[START] GridLock AI — API Test Suite\n")

    # 1. Health check
    try:
        test_health()
    except requests.ConnectionError:
        print("[ERROR] Cannot connect to server at", BASE_URL)
        print("   Start the server first: python app.py")
        sys.exit(1)

    # 2. Model info
    test_model_info()

    # 3. Zones
    test_zones()

    # 4. Prediction scenarios
    scenarios = [
        (
            "[Rally] Political Rally at MG Road (Peak Hours)",
            {
                "event_type": "planned",
                "event_cause": "public_event",
                "location": "MG Road",
                "zone": "Central Zone 1",
                "corridor": "CBD 1",
                "latitude": 12.9716,
                "longitude": 77.5946,
                "requires_road_closure": True,
                "hour": 17,
                "day_of_week": 3,
                "month": 6,
                "expected_crowd": 12000,
            },
        ),
        (
            "[VIP] VIP Movement on Bellary Road",
            {
                "event_type": "planned",
                "event_cause": "vip_movement",
                "location": "Bellary Road",
                "zone": "North Zone 1",
                "corridor": "Bellary Road 1",
                "latitude": 13.0070,
                "longitude": 77.5689,
                "requires_road_closure": True,
                "hour": 10,
                "day_of_week": 1,
                "month": 7,
                "expected_crowd": 5000,
            },
        ),
        (
            "[Breakdown] Vehicle Breakdown on ORR (Night)",
            {
                "event_type": "unplanned",
                "event_cause": "vehicle_breakdown",
                "location": "ORR East",
                "zone": "East Zone 1",
                "corridor": "ORR East 1",
                "latitude": 12.9352,
                "longitude": 77.6245,
                "requires_road_closure": False,
                "hour": 23,
                "day_of_week": 4,
                "month": 6,
            },
        ),
        (
            "[Accident] Major Accident on Hosur Road (Peak)",
            {
                "event_type": "unplanned",
                "event_cause": "accident",
                "location": "Silk Board Junction",
                "zone": "South Zone 1",
                "corridor": "Hosur Road",
                "latitude": 12.9177,
                "longitude": 77.6238,
                "requires_road_closure": True,
                "hour": 18,
                "day_of_week": 0,
                "month": 6,
                "expected_crowd": 0,
            },
        ),
        (
            "[Protest] Protest at CBD (Weekend Peak)",
            {
                "event_type": "planned",
                "event_cause": "protest",
                "location": "Town Hall, CBD",
                "zone": "Central Zone 2",
                "corridor": "CBD 2",
                "latitude": 12.9636,
                "longitude": 77.5780,
                "requires_road_closure": True,
                "hour": 17,
                "day_of_week": 6,
                "month": 8,
                "expected_crowd": 15000,
            },
        ),
        (
            "[Weather] Waterlogging on Mysore Road (Morning Rush)",
            {
                "event_type": "unplanned",
                "event_cause": "water_logging",
                "location": "Mysore Road Underpass",
                "zone": "West Zone 1",
                "corridor": "Mysore Road",
                "latitude": 12.9568,
                "longitude": 77.5409,
                "requires_road_closure": False,
                "hour": 9,
                "day_of_week": 2,
                "month": 7,
            },
        ),
    ]

    for name, payload in scenarios:
        test_predict(name, payload)

    print("=" * 60)
    print("[OK] All tests completed!")
    print("=" * 60)


if __name__ == "__main__":
    main()
