from fastapi.testclient import TestClient

from part_a.api import main as api_main
from part_a.api.main import app
from part_a.src.config import RAW_DATA_PATH
from part_a.src.pipeline import train_from_dataset
from part_a.src.predict import load_bundle
from part_a.src.rules import get_resources

client = TestClient(app)


def test_health_endpoint_returns_ok():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_predict_endpoint_returns_service_unavailable_without_model():
    original_bundle = api_main.MODEL_BUNDLE
    api_main.MODEL_BUNDLE = None
    response = client.post(
        "/predict",
        json={
            "event_type": "Political Rally",
            "location": "MG Road",
            "road_issue": "Potholes",
            "hour_of_day": 17,
            "day_of_week": 2,
            "is_weekend": 0,
            "expected_crowd": 12000,
        },
    )
    api_main.MODEL_BUNDLE = original_bundle
    assert response.status_code == 503


def test_get_resources_very_high():
    resources = get_resources(92, "Very High")
    assert resources["police"] == 18
    assert resources["diversion"] == "Route B"


def test_get_resources_medium():
    resources = get_resources(50, "Medium")
    assert resources["police"] == 6
    assert resources["diversion"] == "Route D"


def test_get_resources_low():
    resources = get_resources(10, "Low")
    assert resources["police"] == 2
    assert resources["diversion"] == "None"


def test_training_pipeline_can_retrain_from_dataset(tmp_path):
    model_path = tmp_path / "model.pkl"
    processed_path = tmp_path / "processed.csv"
    metrics_path = tmp_path / "metrics.json"

    bundle = train_from_dataset(
        data_path=RAW_DATA_PATH,
        model_path=model_path,
        processed_path=processed_path,
        metrics_path=metrics_path,
    )

    assert model_path.exists()
    assert processed_path.exists()
    assert metrics_path.exists()
    assert bundle["metrics"]["rows"] > 0

    loaded_bundle = load_bundle(model_path)
    assert loaded_bundle is not None
    assert "classifier" in loaded_bundle
