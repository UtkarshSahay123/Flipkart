# 🚦 GridLock AI Engine v2.0

**AI-Powered Event-Driven Traffic Management System for Bengaluru**

Built for the **Flipkart Gridlock Hackathon 2.0** — in collaboration with Bengaluru Traffic Police (ASTraM) and MapmyIndia.

---

## 🎯 What It Does

GridLock AI predicts the **impact of traffic events** (accidents, VIP movements, protests, construction, etc.) and generates **actionable resource deployment recommendations** for traffic authorities — **before** congestion becomes critical.

### Input
Traffic officers enter event details:
- Event type & cause (accident, VIP movement, protest, etc.)
- Location (zone, corridor, lat/lon)
- Time (hour, day, month)
- Expected crowd (for planned events)

### AI Predicts
| Output | Description |
|---|---|
| **Congestion Level** | Low / Medium / High / Very High |
| **Expected Delay** | Minutes of traffic disruption |
| **Affected Radius** | Kilometers of impact area |
| **Risk Score** | 0-100% severity assessment |

### Recommendation Engine Outputs
| Resource | Auto-calculated |
|---|---|
| 🚔 Police Officers | Scaled by risk × congestion × peak hour |
| 🚧 Barricades | Based on road closure + corridor type |
| 🚑 Ambulances | Severity-driven allocation |
| 👮 Traffic Marshals | Crowd and congestion based |
| 🔄 Diversion Route | Corridor-aware alternate routes |

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    USER / DASHBOARD                      │
│              (Event Details Input)                        │
└────────────────────┬────────────────────────────────────┘
                     │ POST /predict
                     ▼
┌─────────────────────────────────────────────────────────┐
│                  FLASK REST API (app.py)                  │
│   /predict  /zones  /health  /model-info                 │
└────────┬───────────┬───────────┬────────────────────────┘
         │           │           │
         ▼           ▼           ▼
  ┌──────────┐ ┌──────────┐ ┌──────────┐
  │Congestion│ │  Delay   │ │   Risk   │
  │Classifier│ │Regressor │ │Classifier│
  │(XGBoost) │ │(XGBoost) │ │(XGBoost) │
  └──────────┘ └──────────┘ └──────────┘
         │           │           │
         ▼           ▼           ▼
┌─────────────────────────────────────────────────────────┐
│          RECOMMENDATION ENGINE (recommendation.py)       │
│   Parametric scaling × Event overrides × Route graph     │
└─────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────┐
│                    JSON RESPONSE                         │
│  { prediction: {...}, recommendation: {...} }            │
└─────────────────────────────────────────────────────────┘
```

---

## 📊 Model Performance

| Model | Metric | Score |
|---|---|---|
| Congestion Classifier | Accuracy (5-fold CV) | ~85%+ |
| Delay Regressor | MAE | ~X min |
| Risk Classifier | Accuracy | ~85%+ |
| Priority Classifier | Accuracy | ~85%+ |

*Exact metrics printed during training. Run `python train_model.py` to see latest.*

---

## 🛠️ Tech Stack

- **ML**: XGBoost, scikit-learn, imbalanced-learn (SMOTE)
- **API**: Flask + Flask-CORS
- **Data**: pandas, numpy
- **Explainability**: SHAP
- **Dataset**: ASTraM (Bengaluru Traffic Police) — 8,173 events

---

## 📁 Project Structure

```
FGLH 2026/
├── app.py                    # Flask REST API (4 endpoints)
├── train_model.py            # Multi-model training pipeline
├── feature_engineering.py    # Feature engineering + target derivation
├── recommendation.py         # Data-driven recommendation engine
├── test_api.py               # API test suite (6 scenarios)
├── requirements.txt          # Python dependencies
├── data/                     # ASTraM event dataset
├── models/                   # Trained models (.pkl)
│   ├── congestion_model.pkl
│   ├── delay_model.pkl
│   ├── risk_model.pkl
│   ├── priority_model.pkl
│   ├── geo_kmeans.pkl
│   ├── training_metadata.pkl
│   └── lookups.pkl
└── encoders/                 # Label encoders (.pkl)
```

---

## 🚀 Quick Start

### 1. Install Dependencies
```bash
pip install -r requirements.txt
```

### 2. Train Models
```bash
python train_model.py
```

### 3. Start API Server
```bash
python app.py
```

### 4. Test Predictions
```bash
python test_api.py
```

### 5. Sample API Call
```bash
curl -X POST http://localhost:5000/predict \
  -H "Content-Type: application/json" \
  -d '{
    "event_type": "planned",
    "event_cause": "public_event",
    "location": "MG Road",
    "zone": "Central Zone 1",
    "corridor": "CBD 1",
    "latitude": 12.9716,
    "longitude": 77.5946,
    "requires_road_closure": true,
    "hour": 17,
    "day_of_week": 3,
    "month": 6,
    "expected_crowd": 12000
  }'
```

---

## 📡 API Reference

### `POST /predict`
Main prediction + recommendation endpoint.

**Request Body:**
```json
{
  "event_type": "planned|unplanned",
  "event_cause": "accident|protest|vip_movement|public_event|...",
  "location": "Human-readable location name",
  "zone": "Central Zone 1",
  "corridor": "CBD 1",
  "latitude": 12.9716,
  "longitude": 77.5946,
  "requires_road_closure": true,
  "hour": 17,
  "day_of_week": 3,
  "month": 6,
  "expected_crowd": 12000
}
```

**Response:**
```json
{
  "prediction": {
    "congestion_level": "Very High",
    "expected_delay_minutes": 28,
    "affected_radius_km": 3.0,
    "risk_score": 92,
    "priority": "High"
  },
  "recommendation": {
    "police_officers": 18,
    "barricades": 4,
    "ambulances": 1,
    "traffic_marshals": 6,
    "diversion_route": "Route via MG Road → Brigade Road → Residency Road",
    "priority": "Critical",
    "reasoning": "Public event/gathering with very high congestion expected...",
    "estimated_clearance_hours": 0.5,
    "alert_radius_km": 3.0
  }
}
```

### `GET /zones`
Returns all known zones, corridors, junctions, event causes, and event types for populating dashboard dropdowns.

### `GET /health`
API health check — returns loaded models and encoders.

### `GET /model-info`
Returns model accuracy metrics, feature importance, and training metadata.

---

## 👥 Team

**Part A** — AI Prediction Engine & Recommendation System (this repo)

---

## 📄 License

Built for Flipkart Gridlock Hackathon 2.0 — June/July 2026