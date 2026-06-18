import os
import sys
from pathlib import Path

try:
    import torch
except ImportError:
    torch = None

from ultralytics import YOLO

BASE_DIR = Path(__file__).resolve().parent
DATASET_DIR = BASE_DIR / "data"
YAML_PATH = BASE_DIR / "data.yaml"

VEHICLE_CLASSES = ["car", "motorcycle", "bus", "truck", "bicycle"]


def prepare_data_yaml():
    DATASET_DIR.mkdir(parents=True, exist_ok=True)
    for split in ["train", "val"]:
        (DATASET_DIR / split / "images").mkdir(parents=True, exist_ok=True)
        (DATASET_DIR / split / "labels").mkdir(parents=True, exist_ok=True)

    yaml_content = [
        f"path: {DATASET_DIR}",
        "train: train/images",
        "val: val/images",
        "",
        "names:",
    ]
    yaml_content += [f"  {idx}: {name}" for idx, name in enumerate(VEHICLE_CLASSES)]
    YAML_PATH.write_text("\n".join(yaml_content), encoding="utf-8")
    print(f"Created YOLO data config: {YAML_PATH}")


def validate_dataset():
    missing_labels = 0
    total_images = 0
    total_labels = 0

    for split in ["train", "val"]:
        images_dir = DATASET_DIR / split / "images"
        labels_dir = DATASET_DIR / split / "labels"
        image_files = [f for f in images_dir.iterdir() if f.suffix.lower() in {".jpg", ".jpeg", ".png"}]
        total_images += len(image_files)
        print(f"Found {len(image_files)} images in {split} split.")

        for image_path in image_files:
            label_path = labels_dir / (image_path.stem + ".txt")
            if not label_path.exists():
                print(f"WARNING: missing label for image {image_path.name}")
                missing_labels += 1

        label_files = [f for f in labels_dir.iterdir() if f.suffix.lower() == ".txt"]
        total_labels += len(label_files)

    print(f"Total images: {total_images}, total label files: {total_labels}")
    return total_images, total_labels, missing_labels


def get_device():
    if torch is not None and torch.cuda.is_available():
        return "0"
    return "cpu"


def train_vehicle_counting():
    print("=== Vehicle Counting Model Training ===")
    prepare_data_yaml()

    total_images, total_labels, missing_labels = validate_dataset()
    if total_images == 0:
        print("ERROR: No training images found. Add images under data/train/images and data/val/images before training.")
        return
    if missing_labels > 0:
        print("ERROR: Some images are missing label files. Fix missing annotations before training.")
        return

    # Use YOLOv8 small as the training backbone.
    # If you have a local YOLOv8 weights file, replace this with its path.
    model = YOLO("yolov8s.pt")

    device = get_device()
    print(f"Training device: {device}")

    model.train(
        data=str(YAML_PATH),
        epochs=80,
        imgsz=640,
        batch=16,
        device=device,
        name="vehicle_counting_v1",
        augment=True,
        save=True,
        patience=30,
        rect=True,
        cos_lr=True,
    )

    print("Training finished. Check runs/detect/vehicle_counting_v1 for saved weights.")


if __name__ == "__main__":
    train_vehicle_counting()
