# Part A — AI Prediction & Recommendation Engine
### AI-Powered Event-Driven Traffic Management System

---

## What You're Building

A trained ML model exposed as an API that takes an event as input and returns:
- Congestion level, delay, affected radius, risk score
- Exact resource deployment numbers (police, barricades, ambulance, marshals)
- Recommended diversion route

The dashboard (Part B) and officer assistant (Part D) both call your API. Your work is the brain of the entire system.

---

## Project Structure

```
part_a/
├── data/
│   ├── raw/                  # Original dataset files
│   └── processed/            # Cleaned, feature-engineered data
├── notebooks/
│   ├── 01_eda.ipynb          # Exploratory data analysis
│   ├── 02_feature_eng.ipynb  # Feature engineering experiments
│   └── 03_model_train.ipynb  # Model training and evaluation
├── src/
│   ├── data_prep.py          # Dataset loading and preprocessing
│   ├── features.py           # Feature engineering functions
│   ├── train.py              # Model training script
│   ├── predict.py            # Prediction logic
│   └── rules.py              # Rule-based recommendation logic
├── models/
│   └── model.pkl             # Saved trained model
├── api/
│   └── main.py               # FastAPI endpoint
├── tests/
│   └── test_api.py           # Basic API tests
├── requirements.txt
└── README.md
```

---

## Phase 1 — Dataset (Day 1–2)

**Goal:** Have a clean CSV with at least 200–300 rows ready for training.

### Option A — Find a real dataset
Search Kaggle, UCI ML Repository, or government traffic open data portals for datasets containing event + traffic impact data.

### Option B — Build a synthetic dataset (recommended for now)
Create `data/raw/traffic_events.csv` with these columns:

| Column | Type | Example |
|---|---|---|
| `event_type` | category | Political Rally, Festival, Sports, Construction, Concert |
| `location` | category | MG Road, Silk Board, Indiranagar, Whitefield |
| `hour_of_day` | int (0–23) | 17 |
| `day_of_week` | int (0–6) | 2 |
| `is_weekend` | bool | False |
| `expected_crowd` | int | 12000 |
| `congestion_level` | category | Low, Medium, High, Very High |
| `delay_minutes` | int | 28 |
| `affected_radius_km` | float | 3.0 |
| `risk_score` | int (0–100) | 92 |

**Synthetic data rules to follow:**
- Rallies + crowds > 10,000 + peak hours (5–8 PM) → Very High congestion, 25–40 min delay
- Festivals on weekends → High congestion
- Construction during weekday morning (8–10 AM) → Medium congestion
- Small concerts on weekday afternoons → Low/Medium
- Add some noise — not every rally should be 92% risk

**Deliverable:** `data/raw/traffic_events.csv` with 250+ rows

---

## Phase 2 — Feature Engineering (Day 3)

**Goal:** Convert raw columns into model-ready numeric features.

Create `src/features.py`:

```python
import pandas as pd
from sklearn.preprocessing import LabelEncoder

def engineer_features(df):
    df = df.copy()

    # Encode categorical columns
    le_event = LabelEncoder()
    le_location = LabelEncoder()
    df['event_type_enc'] = le_event.fit_transform(df['event_type'])
    df['location_enc'] = le_location.fit_transform(df['location'])

    # Time features
    df['is_peak_hour'] = df['hour_of_day'].apply(
        lambda h: 1 if (8 <= h <= 10 or 17 <= h <= 20) else 0
    )
    df['is_morning_peak'] = df['hour_of_day'].apply(
        lambda h: 1 if 8 <= h <= 10 else 0
    )
    df['is_evening_peak'] = df['hour_of_day'].apply(
        lambda h: 1 if 17 <= h <= 20 else 0
    )

    # Normalize crowd size
    df['crowd_normalized'] = df['expected_crowd'] / df['expected_crowd'].max()

    return df, le_event, le_location
```

**Feature columns your model will use:**
```
event_type_enc, location_enc, hour_of_day, day_of_week,
is_weekend, is_peak_hour, crowd_normalized
```

**Target columns your model will predict:**
```
congestion_level  → classification (4 classes)
delay_minutes     → regression
affected_radius_km → regression
risk_score        → regression
```

**Deliverable:** `src/features.py` working and tested in `notebooks/02_feature_eng.ipynb`

---

## Phase 3 — Model Training (Day 4–5)

**Goal:** Train, evaluate, and save a model for each prediction target.

### Approach
Use separate models for each target (simpler to debug and explain):

```python
# src/train.py

from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, mean_absolute_error
import joblib
import pandas as pd
from features import engineer_features

# Load data
df = pd.read_csv('data/raw/traffic_events.csv')
df, le_event, le_location = engineer_features(df)

FEATURE_COLS = [
    'event_type_enc', 'location_enc', 'hour_of_day',
    'day_of_week', 'is_weekend', 'is_peak_hour', 'crowd_normalized'
]

X = df[FEATURE_COLS]
X_train, X_test = train_test_split(X, test_size=0.2, random_state=42)

# --- Congestion level (classification) ---
y_clf = df['congestion_level']
y_train_clf, y_test_clf = train_test_split(y_clf, test_size=0.2, random_state=42)
clf = RandomForestClassifier(n_estimators=100, random_state=42)
clf.fit(X_train, y_train_clf)
print("Congestion accuracy:", accuracy_score(y_test_clf, clf.predict(X_test)))

# --- Delay (regression) ---
y_delay = df['delay_minutes']
y_train_d, y_test_d = train_test_split(y_delay, test_size=0.2, random_state=42)
reg_delay = RandomForestRegressor(n_estimators=100, random_state=42)
reg_delay.fit(X_train, y_train_d)
print("Delay MAE:", mean_absolute_error(y_test_d, reg_delay.predict(X_test)))

# --- Risk score (regression) ---
y_risk = df['risk_score']
y_train_r, y_test_r = train_test_split(y_risk, test_size=0.2, random_state=42)
reg_risk = RandomForestRegressor(n_estimators=100, random_state=42)
reg_risk.fit(X_train, y_train_r)
print("Risk MAE:", mean_absolute_error(y_test_r, reg_risk.predict(X_test)))

# Save everything
joblib.dump({
    'classifier': clf,
    'regressor_delay': reg_delay,
    'regressor_risk': reg_risk,
    'le_event': le_event,
    'le_location': le_location
}, 'models/model.pkl')
print("Model saved.")
```

### Evaluation targets to aim for
| Metric | Target |
|---|---|
| Congestion level accuracy | > 75% |
| Delay prediction MAE | < 5 minutes |
| Risk score MAE | < 8 points |

If below target — go back to Phase 2 and add more features or more training rows.

**Deliverable:** `models/model.pkl` saved and metrics logged in `notebooks/03_model_train.ipynb`

---

## Phase 4 — Recommendation Rules (Day 5)

**Goal:** Convert the model's risk score into a concrete resource deployment plan.

Create `src/rules.py`:

```python
def get_resources(risk_score: int, congestion_level: str) -> dict:
    if risk_score >= 85 or congestion_level == "Very High":
        return {
            "police": 18,
            "barricades": 4,
            "ambulance": 1,
            "marshals": 6,
            "diversion": "Route B"
        }
    elif risk_score >= 65 or congestion_level == "High":
        return {
            "police": 12,
            "barricades": 3,
            "ambulance": 1,
            "marshals": 4,
            "diversion": "Route C"
        }
    elif risk_score >= 40 or congestion_level == "Medium":
        return {
            "police": 6,
            "barricades": 2,
            "ambulance": 0,
            "marshals": 2,
            "diversion": "Route D"
        }
    else:
        return {
            "police": 2,
            "barricades": 0,
            "ambulance": 0,
            "marshals": 1,
            "diversion": "None"
        }
```

You can adjust the thresholds and numbers later based on feedback from the team.

**Deliverable:** `src/rules.py` working and manually tested with sample inputs

---

## Phase 5 — FastAPI Endpoint (Day 6)

**Goal:** Wrap everything in an API the dashboard team can call.

Install: `pip install fastapi uvicorn`

Create `api/main.py`:

```python
from fastapi import FastAPI
from pydantic import BaseModel
import joblib
import pandas as pd
import sys
sys.path.append('../src')
from rules import get_resources

app = FastAPI()
bundle = joblib.load('../models/model.pkl')

clf = bundle['classifier']
reg_delay = bundle['regressor_delay']
reg_risk = bundle['regressor_risk']
le_event = bundle['le_event']
le_location = bundle['le_location']

class EventInput(BaseModel):
    event_type: str        # e.g. "Political Rally"
    location: str          # e.g. "MG Road"
    hour_of_day: int       # 0–23
    day_of_week: int       # 0=Monday, 6=Sunday
    is_weekend: int        # 0 or 1
    expected_crowd: int    # e.g. 12000

@app.post("/predict")
def predict(event: EventInput):
    try:
        event_enc = le_event.transform([event.event_type])[0]
        location_enc = le_location.transform([event.location])[0]
    except ValueError as e:
        return {"error": f"Unknown category: {str(e)}"}

    is_peak = 1 if (8 <= event.hour_of_day <= 10 or 17 <= event.hour_of_day <= 20) else 0
    crowd_norm = event.expected_crowd / 50000  # normalize against max expected crowd

    features = pd.DataFrame([{
        'event_type_enc': event_enc,
        'location_enc': location_enc,
        'hour_of_day': event.hour_of_day,
        'day_of_week': event.day_of_week,
        'is_weekend': event.is_weekend,
        'is_peak_hour': is_peak,
        'crowd_normalized': crowd_norm
    }])

    congestion = clf.predict(features)[0]
    delay = int(reg_delay.predict(features)[0])
    risk = int(reg_risk.predict(features)[0])
    affected_radius = round(risk / 30, 1)  # simple heuristic: risk → radius

    resources = get_resources(risk, congestion)

    return {
        "congestion_level": congestion,
        "delay_minutes": delay,
        "affected_radius_km": affected_radius,
        "risk_score": risk,
        "resources": resources
    }

@app.get("/health")
def health():
    return {"status": "ok"}
```

**Run it:**
```bash
cd api
uvicorn main:app --reload --port 8000
```

**Test it (Postman or curl):**
```bash
curl -X POST http://localhost:8000/predict \
  -H "Content-Type: application/json" \
  -d '{
    "event_type": "Political Rally",
    "location": "MG Road",
    "hour_of_day": 17,
    "day_of_week": 2,
    "is_weekend": 0,
    "expected_crowd": 12000
  }'
```

**Expected response:**
```json
{
  "congestion_level": "Very High",
  "delay_minutes": 28,
  "affected_radius_km": 3.0,
  "risk_score": 92,
  "resources": {
    "police": 18,
    "barricades": 4,
    "ambulance": 1,
    "marshals": 6,
    "diversion": "Route B"
  }
}
```

**Deliverable:** API running locally, tested with at least 5 different event inputs, all returning sensible outputs

---

## Phase 6 — Polish & Handoff (Day 7)

**Goal:** Make your work usable by the rest of the team.

### Checklist
- [ ] `requirements.txt` is complete (`pip freeze > requirements.txt`)
- [ ] `README.md` documents how to run the API
- [ ] API handles unknown event types or locations gracefully (returns error message, not crash)
- [ ] At least 5 test cases in `tests/test_api.py`
- [ ] Model metrics are logged in the training notebook
- [ ] Share your API base URL or localhost port with the Part B team

### README template for your module
```markdown
## Part A — Prediction API

### Setup
pip install -r requirements.txt

### Train the model
python src/train.py

### Run the API
cd api && uvicorn main:app --reload --port 8000

### Endpoint
POST /predict
Input: event_type, location, hour_of_day, day_of_week, is_weekend, expected_crowd
Output: congestion_level, delay_minutes, affected_radius_km, risk_score, resources
```

---

## Full Timeline

| Day | Task | Deliverable |
|---|---|---|
| 1 | Understand dataset requirements, start building synthetic CSV | `data/raw/traffic_events.csv` (100 rows) |
| 2 | Complete dataset to 250+ rows, basic EDA in notebook | Completed CSV + `01_eda.ipynb` |
| 3 | Feature engineering | `src/features.py` + `02_feature_eng.ipynb` |
| 4 | Train models, evaluate, iterate | `models/model.pkl` + `03_model_train.ipynb` |
| 5 | Recommendation rules, local testing | `src/rules.py` tested |
| 6 | FastAPI endpoint, full local test | `api/main.py` running |
| 7 | Polish, README, handoff to Part B team | Clean repo, shared URL |

---

## Tech Stack

| Tool | Purpose |
|---|---|
| `pandas`, `numpy` | Data loading and manipulation |
| `scikit-learn` | Random Forest classifier and regressors |
| `joblib` | Save and load trained models |
| `FastAPI` | REST API framework |
| `uvicorn` | ASGI server to run FastAPI |
| `pydantic` | Input validation for the API |

Install all:
```bash
pip install pandas numpy scikit-learn joblib fastapi uvicorn pydantic
```

---

## Key Decisions to Document

As you build, note down:
1. Why you chose Random Forest over other models
2. What your final feature set is and why
3. What the rule thresholds in `rules.py` are based on
4. What the model's accuracy and MAE are on the test set

These answers will come up during your showcase presentation.

---

*Part A feeds Part B (dashboard map), Part C (citizen report classification also uses ML), and Part D (the chat assistant calls your `/predict` endpoint). Build it solid.*
