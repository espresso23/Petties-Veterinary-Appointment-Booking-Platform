"""
Download images from Label Studio and organize by disease for training.
"""

import os
import json
import logging
import requests
from pathlib import Path
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed
import time

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

LABEL_STUDIO_URL = "http://label-studio:8080"
LABEL_STUDIO_API_KEY = "9fce823657575389dd122c6ce7196b3c28023dc7"
PROJECT_ID = 14
OUTPUT_DIR = Path("./vision_model/data")
MAX_WORKERS = 10
MAX_PER_DISEASE = 60

DISEASE_MAPPING = {
    # Vietnamese name -> folder code
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
}


def get_session():
    session = requests.Session()
    session.headers.update({"Authorization": f"Token {LABEL_STUDIO_API_KEY}"})
    return session


def export_annotations(project_id):
    session = get_session()
    url = f"{LABEL_STUDIO_URL}/api/projects/{project_id}/export"
    logger.info(f"Exporting from {url}")
    response = session.get(url, params={"export_type": "JSON"}, timeout=120)
    response.raise_for_status()
    return response.json()


def download_image(image_url, output_file):
    """Download a single image with auth."""
    try:
        response = requests.get(
            image_url,
            timeout=30,
            headers={"Authorization": f"Token {LABEL_STUDIO_API_KEY}"},
        )
        if response.status_code == 200:
            output_file.parent.mkdir(parents=True, exist_ok=True)
            with open(output_file, "wb") as f:
                f.write(response.content)
            return True
        else:
            logger.warning(f"Failed {image_url}: {response.status_code}")
            return False
    except Exception as e:
        logger.warning(f"Error {image_url}: {e}")
        return False


def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    logger.info("Exporting annotations...")
    annotations = export_annotations(PROJECT_ID)
    logger.info(f"Got {len(annotations)} annotations")

    # Group images by disease
    disease_images = defaultdict(list)

    for task in annotations:
        image_path = task.get("data", {}).get("image", "")
        if not image_path:
            continue

        # Get annotation label
        for annotation in task.get("annotations", []):
            for result in annotation.get("result", []):
                choices = result.get("value", {}).get("choices", [])
                if choices:
                    disease_name_vi = choices[0]  # Vietnamese name from Label Studio
                    disease_folder = DISEASE_MAPPING.get(
                        disease_name_vi, disease_name_vi
                    )
                    disease_images[disease_folder].append(image_path)
                    break

    # Limit images per disease
    for disease in disease_images:
        disease_images[disease] = disease_images[disease][:MAX_PER_DISEASE]

    # Download images
    total_downloaded = 0

    for disease_name, image_paths in disease_images.items():
        disease_dir = OUTPUT_DIR / disease_name
        disease_dir.mkdir(parents=True, exist_ok=True)

        logger.info(f"Downloading {len(image_paths)} images for {disease_name}...")

        for i, image_path in enumerate(image_paths):
            # Handle relative paths
            if image_path.startswith("/"):
                image_url = f"{LABEL_STUDIO_URL}{image_path}"
            else:
                image_url = f"{LABEL_STUDIO_URL}/{image_path}"

            filename = Path(image_path).name
            output_file = disease_dir / filename

            if output_file.exists():
                continue

            if download_image(image_url, output_file):
                total_downloaded += 1

            if (i + 1) % 10 == 0:
                logger.info(f"  Downloaded {i + 1}/{len(image_paths)}")

        actual = len(list(disease_dir.glob("*.jpg"))) + len(
            list(disease_dir.glob("*.png"))
        )
        logger.info(f"  {disease_name}: {actual} images")

    logger.info(f"Total downloaded: {total_downloaded}")


if __name__ == "__main__":
    main()
