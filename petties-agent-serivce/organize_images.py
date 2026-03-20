"""
Organize downloaded images by disease based on filename patterns.
"""

import os
import shutil
from pathlib import Path
from collections import defaultdict
import re

# Source and destination directories
SOURCE_DIR = Path("./vision_model/data/upload")
OUTPUT_DIR = Path("./vision_model/data")

# Disease name patterns in filenames
DISEASE_PATTERNS = {
    "healthy": ["healthy", "normal", "da_khoe"],
    "bacterial_dermatosis": ["bacterial", "viem_da_bacteria", "viêm_da_vi_khuẩn"],
    "eye_infection_cat": ["eye_infection_cat", "mắt_mèo", "nhiễm_trùng_mắt_mèo"],
    "eye_infection_dog": ["eye_infection_dog", "mắt_chó", "nhiễm_trùng_mắt_chó"],
    "fungal_infection_cat": ["fungal_infection_cat", "nấm_mèo"],
    "fungal_infection_dog": ["fungal_infection_dog", "nấm_chó"],
    "ringworm_cat": ["ringworm_cat", "hắc_lào", "nấm_da_mèo"],
    "mange_dog": ["mange_dog", "ghẻ_chó", "bệnh_ghẻ_ở_chó"],
    "scabies_cat": ["scabies_cat", "sarcoptes_mèo"],
    "ear_mites_cat": ["ear_mites_cat", "ve_tai_mèo"],
    "tick_infestation": ["tick", "ve", "nhiễm_ve"],
    "hypersensitivity_allergic": [
        "hypersensitivity",
        "allergic",
        "dị_ứng",
        "viêm_da_dị_ứng",
    ],
    "eosinophilic_plaque": ["eosinophilic", "mảng_bạch_cầu"],
    "dermatitis": ["dermatitis", "viêm_da"],
    "alopecia": ["alopecia", "rụng_lông", "hói_lông", "hair_loss"],
    "dental_disease_cat": ["dental", "răng_miệng", "tooth"],
    "demodicosis": ["demodicosis", "demodex", "ghẻ_demodex"],
    "kennel_cough": ["kennel_cough", "ho_cũi", "cough"],
    "distemper_dog": ["distemper", "care", "bệnh_care"],
}


def extract_disease_from_filename(filename):
    """Extract disease from filename based on patterns."""
    filename_lower = filename.lower()

    # Check each disease pattern
    for disease, patterns in DISEASE_PATTERNS.items():
        for pattern in patterns:
            if pattern.lower() in filename_lower:
                return disease

    return None


def main():
    # Create disease directories
    for disease in DISEASE_PATTERNS:
        (OUTPUT_DIR / disease).mkdir(parents=True, exist_ok=True)

    # Count images
    stats = defaultdict(int)
    unmatched = []

    # Process each image
    for image_file in SOURCE_DIR.iterdir():
        if not image_file.is_file():
            continue

        disease = extract_disease_from_filename(image_file.name)

        if disease:
            dest = OUTPUT_DIR / disease / image_file.name
            shutil.copy2(image_file, dest)
            stats[disease] += 1
        else:
            unmatched.append(image_file.name)

    # Print stats
    print("Images organized by disease:")
    for disease, count in sorted(stats.items(), key=lambda x: -x[1]):
        print(f"  {disease}: {count}")

    print(f"\nUnmatched images: {len(unmatched)}")
    if unmatched:
        print("Sample unmatched:")
        for f in unmatched[:10]:
            print(f"  {f}")


if __name__ == "__main__":
    main()
