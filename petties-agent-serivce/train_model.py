"""
Train vision model using scikit-learn with image features.
"""

import os
import sys
import json
import logging
import numpy as np
from pathlib import Path
from PIL import Image
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, f1_score, classification_report
from sklearn.preprocessing import LabelEncoder
from skl2onnx import convert_sklearn
from skl2onnx.common.data_types import FloatTensorType
import pickle

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(message)s")
logger = logging.getLogger(__name__)

# Config
DATA_DIR = Path("./vision_model/data")
OUTPUT_DIR = Path("./vision_model/output")
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

# Image settings
IMAGE_SIZE = (64, 64)  # Small for fast training


def extract_features(image_path: str) -> np.ndarray:
    """Extract features from an image."""
    try:
        img = Image.open(image_path).convert("RGB")
        img = img.resize(IMAGE_SIZE)

        # Flatten pixels
        pixels = np.array(img).flatten() / 255.0

        # Color histogram
        img_array = np.array(img)
        hist_r = np.histogram(img_array[:, :, 0], bins=16, range=(0, 256))[0]
        hist_g = np.histogram(img_array[:, :, 1], bins=16, range=(0, 256))[0]
        hist_b = np.histogram(img_array[:, :, 2], bins=16, range=(0, 256))[0]

        # Normalize histograms
        hist_r = hist_r / (hist_r.sum() + 1e-6)
        hist_g = hist_g / (hist_g.sum() + 1e-6)
        hist_b = hist_b / (hist_b.sum() + 1e-6)

        # Combine features
        features = np.concatenate([pixels, hist_r, hist_g, hist_b])

        return features
    except Exception as e:
        logger.warning(f"Error processing {image_path}: {e}")
        return None


def load_dataset() -> tuple:
    """Load dataset from directory structure."""
    X = []
    y = []

    for disease_dir in DATA_DIR.iterdir():
        if not disease_dir.is_dir():
            continue

        disease_name = disease_dir.name
        images = (
            list(disease_dir.glob("*.jpg"))
            + list(disease_dir.glob("*.png"))
            + list(disease_dir.glob("*.jpeg"))
        )

        logger.info(f"Loading {len(images)} images for {disease_name}")

        for img_path in images:
            features = extract_features(str(img_path))
            if features is not None:
                X.append(features)
                y.append(disease_name)

    return np.array(X), np.array(y)


def train_model():
    """Train the model."""
    logger.info("Loading dataset...")
    X, y = load_dataset()

    if len(X) == 0:
        logger.error("No training data found!")
        return None

    logger.info(f"Loaded {len(X)} samples, {len(np.unique(y))} classes")

    # Encode labels
    le = LabelEncoder()
    y_encoded = le.fit_transform(y)

    # Save label encoder
    le_path = OUTPUT_DIR / "label_encoder.pkl"
    with open(le_path, "wb") as f:
        pickle.dump(le, f)
    logger.info(f"Label encoder saved to {le_path}")

    # Split data
    X_train, X_test, y_train, y_test = train_test_split(
        X, y_encoded, test_size=0.2, random_state=42, stratify=y_encoded
    )

    logger.info(f"Train: {len(X_train)}, Test: {len(X_test)}")

    # Train Random Forest
    logger.info("Training Random Forest...")
    model = RandomForestClassifier(
        n_estimators=200,
        max_depth=30,
        min_samples_split=5,
        min_samples_leaf=2,
        n_jobs=-1,
        random_state=42,
    )

    model.fit(X_train, y_train)

    # Evaluate
    y_pred = model.predict(X_test)
    accuracy = accuracy_score(y_test, y_pred)
    f1 = f1_score(y_test, y_pred, average="weighted")

    logger.info(f"Accuracy: {accuracy:.3f}")
    logger.info(f"F1 Score: {f1:.3f}")

    # Per-class report
    class_names = le.classes_
    logger.info("\nClassification Report:")
    print(classification_report(y_test, y_pred, target_names=class_names))

    # Save model
    model_path = OUTPUT_DIR / "model.pkl"
    with open(model_path, "wb") as f:
        pickle.dump(model, f)
    logger.info(f"Model saved to {model_path}")

    # Export to ONNX
    try:
        logger.info("Exporting to ONNX...")
        initial_type = [("float_input", FloatTensorType([None, X.shape[1]]))]
        onnx_path = OUTPUT_DIR / "model.onnx"

        onnx_model = convert_sklearn(model, initial_types=initial_type)
        with open(onnx_path, "wb") as f:
            f.write(onnx_model.SerializeToString())

        logger.info(f"ONNX model saved to {onnx_path}")
    except Exception as e:
        logger.error(f"ONNX export failed: {e}")
        onnx_path = None

    # Save metadata
    metadata = {
        "model_type": "RandomForest",
        "n_classes": len(le.classes_),
        "classes": list(le.classes_),
        "accuracy": float(accuracy),
        "f1_score": float(f1),
        "n_train": len(X_train),
        "n_test": len(X_test),
        "image_size": IMAGE_SIZE,
        "feature_dim": X.shape[1],
        "model_path": str(model_path),
        "onnx_path": str(onnx_path) if onnx_path else None,
    }

    metadata_path = OUTPUT_DIR / "metadata.json"
    with open(metadata_path, "w") as f:
        json.dump(metadata, f, indent=2)

    logger.info(f"Metadata saved to {metadata_path}")

    return metadata


if __name__ == "__main__":
    result = train_model()
    if result:
        print("\n=== Training Complete ===")
        print(json.dumps(result, indent=2))
