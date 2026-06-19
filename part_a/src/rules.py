from __future__ import annotations


def get_resources(risk_score: int, congestion_level: str) -> dict:
    if risk_score >= 85 or congestion_level == "Very High":
        return {
            "police": 18,
            "barricades": 4,
            "ambulance": 1,
            "marshals": 6,
            "diversion": "Route B",
        }
    if risk_score >= 65 or congestion_level == "High":
        return {
            "police": 12,
            "barricades": 3,
            "ambulance": 1,
            "marshals": 4,
            "diversion": "Route C",
        }
    if risk_score >= 40 or congestion_level == "Medium":
        return {
            "police": 6,
            "barricades": 2,
            "ambulance": 0,
            "marshals": 2,
            "diversion": "Route D",
        }
    return {
        "police": 2,
        "barricades": 0,
        "ambulance": 0,
        "marshals": 1,
        "diversion": "None",
    }
