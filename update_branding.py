import os

files_to_update = [
    r'i:/flipkart/about.html',
    r'i:/flipkart/technology.html',
    r'i:/flipkart/index.html',
    r'i:/flipkart/command.html',
    r'i:/flipkart/backend/app.py'
]

for file_path in files_to_update:
    if not os.path.exists(file_path): continue
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # 1. Update footer text
    content = content.replace("all rights reserved to SUVS", "© 2024 SUVS. All rights reserved.")
    
    # 2. Update branding (cascading from longest to shortest to avoid partial replacements)
    content = content.replace("Aegis Traffic Management", "Road Guard")
    content = content.replace("Aegis Traffic Control", "Road Guard")
    content = content.replace("Aegis Traffic", "Road Guard")
    content = content.replace("Aegis ", "Road Guard ")
    content = content.replace(">Aegis<", ">Road Guard<")
    content = content.replace("\"Aegis\"", "\"Road Guard\"")
    
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)

print("Branding update complete")
