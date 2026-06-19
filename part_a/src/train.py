from __future__ import annotations

import argparse
from pathlib import Path

from part_a.src.config import MODEL_PATH, PROCESSED_DATA_PATH, RAW_DATA_PATH
from part_a.src.pipeline import train_from_dataset


def train_models(
    data_path: str | Path = RAW_DATA_PATH,
    model_path: str | Path = MODEL_PATH,
    processed_path: str | Path = PROCESSED_DATA_PATH,
):
    bundle = train_from_dataset(
        data_path=data_path,
        model_path=model_path,
        processed_path=processed_path,
    )
    metrics = bundle["metrics"]
    return {
        "congestion_accuracy": metrics["congestion_accuracy"],
        "delay_mae": metrics["delay_mae"],
        "radius_mae": metrics["radius_mae"],
        "risk_mae": metrics["risk_mae"],
        "model_path": str(model_path),
    }


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Train the Part A traffic prediction models.")
    parser.add_argument("--data-path", type=Path, default=RAW_DATA_PATH, help="Path to traffic_events.csv")
    parser.add_argument("--model-path", type=Path, default=MODEL_PATH, help="Where to save model.pkl")
    parser.add_argument(
        "--processed-path",
        type=Path,
        default=PROCESSED_DATA_PATH,
        help="Where to save the processed dataset",
    )
    return parser


def main() -> None:
    args = build_parser().parse_args()
    results = train_models(args.data_path, args.model_path, args.processed_path)
    print(results)


if __name__ == "__main__":
    main()
