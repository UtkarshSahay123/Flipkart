import os
import urllib.request
import zipfile

def download_and_extract(url, target_path):
    print(f"--- Starting Direct Download from Research Mirror ---")
    os.makedirs(target_path, exist_ok=True)
    
    zip_file = os.path.join(target_path, "rdd_dataset.zip")
    
    # Using urllib to download directly
    try:
        print(f"Downloading from: {url}")
        print("Note: This might take a few minutes depending on your internet speed...")
        urllib.request.urlretrieve(url, zip_file)
        
        print("Extracting files...")
        with zipfile.ZipFile(zip_file, 'r') as zip_ref:
            zip_file_list = zip_ref.namelist()
            # Extract only images and labels we need
            zip_ref.extractall(target_path)
            
        print(f"Success! Data ready at {target_path}")
        os.remove(zip_file) # Clean up zip
        
    except Exception as e:
        print(f"Error during download: {e}")

if __name__ == "__main__":
    # This is a direct link to a public mirror of RDD Data
    # For demonstration, using a reliable research mirror link
    DATA_URL = "https://figshare.com/ndownloader/articles/21431547/versions/1"
    download_and_extract(DATA_URL, "ml_models/potholes/data")
