import os
import subprocess

def download_from_kaggle(dataset_slug, target_dir, username, key):
    """
    Automated Kaggle Dataset Downloader using environment variables
    """
    print(f"--- Starting automated download for {dataset_slug} ---")
    
    # Set environment variables for Kaggle API
    os.environ['KAGGLE_USERNAME'] = username
    os.environ['KAGGLE_KEY'] = key
    
    # 1. Install kaggle library if not present
    subprocess.run(["pip", "install", "kaggle", "--quiet"])

    # 2. Ensure target directory exists
    os.makedirs(target_dir, exist_ok=True)

    # 3. Download and Unzip
    try:
        from kaggle.api.kaggle_api_extended import KaggleApi
        api = KaggleApi()
        api.authenticate()
        print("Authenticated successfully!")
        
        api.dataset_download_files(dataset_slug, path=target_dir, unzip=True)
        print(f"Successfully downloaded and extracted to {target_dir}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    # RDD 2022 Pothole Dataset
    MY_USERNAME = "utkarshsahay1509" 
    MY_KEY = "KGAT_c99494e135f62f3afbe67a626b8c840c"
    
    download_from_kaggle("aliabdelmenam/rdd-2022", "ml_models/potholes/data", MY_USERNAME, MY_KEY)
