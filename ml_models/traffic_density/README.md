# Vehicle Counting Training

This module provides a YOLO-based training pipeline for vehicle counting from traffic camera frames.

## Dataset layout

Prepare your dataset in YOLO format inside `ml_models/traffic_density/data`:

- `data/train/images/`
- `data/train/labels/`
- `data/val/images/`
- `data/val/labels/`

Label files must be `.txt` files with YOLO format annotations matching the vehicle class IDs.

## Classes

The default classes are:

- `0: car`
- `1: motorcycle`
- `2: bus`
- `3: truck`
- `4: bicycle`

Update `VEHICLE_CLASSES` in `train.py` if you want a different class set.

## Train the model

Run:

```bash
python ml_models/traffic_density/train.py
```

The script creates `data.yaml` automatically and starts training with YOLOv8. The output model is saved under `runs/detect/vehicle_counting_v1`.

## Use the trained model for counting

The existing `ml_models/traffic_density/counter.py` uses a pre-trained COCO model by default.
To use the new custom-trained model, update the model path in `counter.py` to:

```python
model = YOLO('runs/detect/vehicle_counting_v1/weights/best.pt')
```

Then run:

```bash
python ml_models/traffic_density/counter.py
```

## Notes

- If `yolo11s.pt` is not available, the script falls back to `yolov8s.pt`.
- For best results, annotate a balanced vehicle dataset and include both `train` and `val` splits.
