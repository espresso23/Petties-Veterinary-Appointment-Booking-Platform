"""
Organize downloaded images by disease using Label Studio annotations.
"""

import os
import json
import shutil
from pathlib import Path
from collections import defaultdict

# Source and destination directories
SOURCE_DIR = Path("./vision_model/data/upload")
OUTPUT_DIR = Path("./vision_model/data")

# API config
LABEL_STUDIO_URL = "http://localhost:9090"
LABEL_STUDIO_API_KEY = "9fce823657575389dd122c6ce7196b3c28023dc7"
PROJECT_ID = 14

# Disease mapping from Label Studio Vietnamese names to folder names
DISEASE_MAPPING = {
    "Da khỏe mạnh": "healthy",
    "Viêm da do vi khuẩn": "bacterial_dermatosis",
    "Nhiễm trùng mắt ở mèo": "eye_infection_cat",
    "Nhiễm trùng mắt ở chó": "eye_infection_dog",
    "Nhiễm nấm ở mèo": "fungal_infection_cat",
    "Nhiễm nấm ở chó": "fungal_infection_dog",
    "Hắc lào / Nấm da ở mèo": "ringworm_cat",
    "Bệnh ghẻ ở chó": "mange_dog",
    "Ghẻ Sarcoptes ở mèo": "scabies_cat",
    "Ve tai ở mèo": "ear_mites_cat",
    "Nhiễm ve ký sinh ở chó": "tick_infestation",
    "Viêm da dị ứng do quá mẫn": "hypersensitivity_allergic",
    "Mảng bạch cầu ái toan": "eosinophilic_plaque",
    "Viêm da": "dermatitis",
    "Rụng lông / Hói lông": "alopecia",
    "Bệnh răng miệng ở mèo": "dental_disease_cat",
    "Bệnh ghẻ Demodex": "demodicosis",
    "Bệnh Care ở chó": "distemper_dog",
    "Ho cũi chó": "kennel_cough",
}


def get_session():
    import requests

    session = requests.Session()
    session.headers.update({"Authorization": f"Token {LABEL_STUDIO_API_KEY}"})
    return session


def export_annotations():
    session = get_session()
    url = f"{LABEL_STUDIO_URL}/api/projects/{PROJECT_ID}/export"
    response = session.get(url, params={"export_type": "JSON"}, timeout=120)
    response.raise_for_status()
    return response.json()


def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    SOURCE_DIR.mkdir(parents=True, exist_ok=True)

    # Create disease directories
    for disease in DISEASE_MAPPING.values():
        (OUTPUT_DIR / disease).mkdir(parents=True, exist_ok=True)

    # Get annotations
    print("Exporting annotations...")
    annotations = export_annotations()

    # Map file_upload (filename) to disease
    file_to_disease = {}
    for task in annotations:
        file_upload = task.get("file_upload", "")

        # Get annotation
        for annotation in task.get("annotations", []):
            for result in annotation.get("result", []):
                choices = result.get("value", {}).get("choices", [])
                if choices:
                    disease_name_vi = choices[0]  # Vietnamese name from Label Studio
                    disease_folder = DISEASE_MAPPING.get(
                        disease_name_vi, disease_name_vi
                    )
                    file_to_disease[file_upload] = disease_folder
                    break

    # Organize images
    stats = defaultdict(int)
    matched = 0
    unmatched = 0

    for image_file in SOURCE_DIR.iterdir():
        if not image_file.is_file():
            continue

        disease_folder = file_to_disease.get(image_file.name)

        if disease_folder:
            dest = OUTPUT_DIR / disease_folder
            dest.mkdir(parents=True, exist_ok=True)
            dest_file = dest / image_file.name
            try:
                shutil.copy2(image_file, dest_file)
                stats[disease_folder] += 1
                matched += 1
            except Exception as e:
                print(f"Error copying {image_file.name}: {e}")
        else:
            unmatched += 1

    # Print stats
    print(f"\nImages organized: {matched} matched, {unmatched} unmatched")
    print("\nBy disease:")
    for disease, count in sorted(stats.items(), key=lambda x: -x[1]):
        print(f"  {disease}: {count}")


if __name__ == "__main__":
    main()
