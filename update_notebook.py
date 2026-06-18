import json

notebook_path = r"i:\flipkart\ml_models\potholes\pothole_colab_training.ipynb"
with open(notebook_path, 'r', encoding='utf-8') as f:
    nb = json.load(f)

# Find the cell that has "Upload your kaggle.json"
found = False
for cell in nb['cells']:
    if cell['cell_type'] == 'code':
        source = cell.get('source', [])
        if any('Upload your kaggle.json' in line for line in source):
            cell['source'] = [
                "# Configure Kaggle credentials automatically\n",
                "import os\n",
                "import json\n",
                "\n",
                "os.makedirs('/root/.kaggle', exist_ok=True)\n",
                "kaggle_creds = {\n",
                "    \"username\": \"utkarshsahay1509\",\n",
                "    \"key\": \"KGAT_c99494e135f62f3afbe67a626b8c840c\"\n",
                "}\n",
                "with open('/root/.kaggle/kaggle.json', 'w') as f:\n",
                "    json.dump(kaggle_creds, f)\n",
                "\n",
                "os.chmod('/root/.kaggle/kaggle.json', 0o600)\n",
                "print('Kaggle API configured successfully with credentials!')"
            ]
            found = True
            break

if found:
    with open(notebook_path, 'w', encoding='utf-8') as f:
        json.dump(nb, f, indent=1)
    print("Successfully updated notebook credentials!")
else:
    print("Cell not found!")
