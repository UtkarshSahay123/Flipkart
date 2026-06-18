import os
from ultralytics import YOLO

# Path Configuration for Fallen Trees
BASE_DIR = r"e:\flipkart\ml_models\fallen_trees"
DATASET_PATH = os.path.join(BASE_DIR, 'data') 
YAML_PATH = os.path.join(DATASET_PATH, 'fallen_tree.yaml')

# YOLO Dataset Config
yaml_content = f"""
path: {DATASET_PATH}
train: train/images
val: val/images

names:
  0: Fallen Tree
"""

def prepare_env():
    os.makedirs(os.path.join(DATASET_PATH, 'train', 'images'), exist_ok=True)
    os.makedirs(os.path.join(DATASET_PATH, 'train', 'labels'), exist_ok=True)
    os.makedirs(os.path.join(DATASET_PATH, 'val', 'images'), exist_ok=True)
    os.makedirs(os.path.join(DATASET_PATH, 'val', 'labels'), exist_ok=True)
    
    with open(YAML_PATH, 'w') as f:
        f.write(yaml_content.strip())

def train_fallen_tree_model():
    print("--- Training Fallen Tree Detection Model ---")
    
    # Using YOLOv11 small
    try:
        model = YOLO('yolo11s.pt') 
    except:
        model = YOLO('yolov8s.pt')

    model.train(
        data=YAML_PATH,
        epochs=100,
        imgsz=640,
        batch=16,
        name='fallen_tree_v1',
        augment=True,
        device='cpu' # Change to 0 for GPU
    )

if __name__ == "__main__":
    prepare_env()
    train_img_path = os.path.join(DATASET_PATH, 'train', 'images')
    if len(os.listdir(train_img_path)) == 0:
        print(f"No images found. Download a 'Fallen Tree' dataset from Roboflow and place here: {train_img_path}")
    else:
        train_fallen_tree_model()
