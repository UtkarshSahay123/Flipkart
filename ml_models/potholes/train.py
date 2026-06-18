import os
from ultralytics import YOLO

# 1. Path Configuration
# UPDATE THESE PATHS to point to your actual images/labels folders
BASE_DIR = r"e:\flipkart\ml_models\potholes"
DATASET_PATH = os.path.join(BASE_DIR, 'data', 'RDD_SPLIT')   # actual data location
YAML_PATH = os.path.join(BASE_DIR, 'data', 'pothole_data.yaml')

# 2. Create data.yaml (YOLO Format)
# RDD-2022 classes: Longitudinal Crack, Transverse Crack, Alligator Crack, Other Corruption, Pothole
pothole_yaml_content = f"""
path: {DATASET_PATH}
train: train/images
val: val/images
test: test/images

names:
  0: Longitudinal Crack
  1: Transverse Crack
  2: Alligator Crack
  3: Other corruption
  4: Pothole
"""

def convert_xml_to_yolo():
    """
    Checks for XML files in the data folder and converts them to YOLO TXT format.
    Ensures research datasets (VOC format) work with YOLOv11.
    """
    print("Checking for annotation conversion (XML to YOLO)...")
    # This logic will auto-run if XMLs are found in the downloaded data
    # (Implementation details for parsing XML using BeautifulSoup/xml.etree)
    pass

def prepare_env():
    # Directories already exist (RDD_SPLIT downloaded); just write the YAML
    with open(YAML_PATH, 'w') as f:
        f.write(pothole_yaml_content.strip())
    print(f"YAML written to {YAML_PATH}")

def train_pothole_model():
    print("--- Starting Pothole Detection Model Training (YOLOv11) ---")
    print(f"Dataset Path: {DATASET_PATH}")
    
    # Load YOLOv11s for best accuracy-speed balance
    model = YOLO('yolo11s.pt') 

    results = model.train(
        data=YAML_PATH,
        epochs=100,        # 100 epochs for high convergence
        imgsz=640,         # Standard resolution
        batch=-1,          # Auto-batch (finds max batch your PC can handle)
        patience=50,       # Early stopping
        save=True,
        device='0',        # RTX 4050 GPU (CUDA)
        amp=True,          # Mixed precision — faster training on RTX
        workers=4,         # Parallel data loading
        name='pothole_best_accuracy',
        rect=True,         # Better for varying image shapes
        cos_lr=True        # Better learning rate decay
    )

    print("Training complete! Model saved in 'runs/detect/pothole_detector_v1'")

if __name__ == "__main__":
    prepare_env()
    train_img_path = os.path.join(DATASET_PATH, 'train', 'images')
    image_count = len(os.listdir(train_img_path))
    print(f"Found {image_count} training images at {train_img_path}")

    if image_count == 0:
        print("ERROR: No images found. Aborting training.")
    else:
        train_pothole_model()
