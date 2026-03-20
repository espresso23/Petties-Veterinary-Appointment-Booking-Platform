#!/usr/bin/env python3
"""Train vision model."""

import os
import numpy as np
from pathlib import Path
from PIL import Image
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, f1_score
from sklearn.preprocessing import LabelEncoder
from skl2onnx import convert_sklearn
from skl2onnx.common.data_types import FloatTensorType
import pickle
import json
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

DATA_DIR = Path("./vision_model/data")
OUTPUT_DIR = Path("./vision_model/output")
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
IMAGE_SIZE = (64, 64)


def extract_features(image_path):
    try:
        img = Image.open(image_path).convert("RGB")
        img = img.resize(IMAGE_SIZE)
        pixels = np.array(img).flatten() / 255.0
        img_array = np.array(img)
        hist_r = np.histogram(img_array[:, :, 0], bins=16, range=(0, 256))[0]
        hist_g = np.histogram(img_array[:, :, 1], bins=16, range=(0, 256))[0]
        hist_b = np.histogram(img_array[:, :, 2], bins=16, range=(0, 256))[0]
        hist_r = hist_r / (hist_r.sum() + 1e-6)
        hist_g = hist_g / (hist_g.sum() + 1e-6)
        hist_b = hist_b / (hist_b.sum() + 1e-6)
        return np.concatenate([pixels, hist_r, hist_g, hist_b])
    except Exception as e:
        logger.warning(f"Error {image_path}: {e}")
        return None


def main():
    X, y = [], []
    for d in DATA_DIR.iterdir():
        if d.is_dir() and d.name not in ["upload"]:
            imgs = (
                list(d.glob("*.jpg")) + list(d.glob("*.png")) + list(d.glob("*.jpeg"))
            )
            logger.info(f"{d.name}: {len(imgs)}")
            for img in imgs:
                f = extract_features(str(img))
                if f is not None:
                    X.append(f)
                    y.append(d.name)

    X, y = np.array(X), np.array(y)
    logger.info(f"Loaded {len(X)} samples, {len(np.unique(y))} classes")

    le = LabelEncoder()
    y_enc = le.fit_transform(y)

    X_train, X_test, y_train, y_test = train_test_split(
        X, y_enc, test_size=0.2, random_state=42, stratify=y_enc
    )

    logger.info("Training...")
    model = RandomForestClassifier(
        n_estimators=200, max_depth=30, n_jobs=-1, random_state=42
    )
    model.fit(X_train, y_train)

    y_pred = model.predict(X_test)
    acc = accuracy_score(y_test, y_pred)
    f1 = f1_score(y_test, y_pred, average="weighted")
    logger.info(f"Accuracy: {acc:.3f}, F1: {f1:.3f}")

    with open(OUTPUT_DIR / "model.pkl", "wb") as f:
        pickle.dump(model, f)
    with open(OUTPUT_DIR / "label_encoder.pkl", "wb") as f:
        pickle.dump(le, f)

    logger.info("Exporting ONNX...")
    onnx_model = convert_sklearn(
        model, initial_types=[("x", FloatTensorType([None, X.shape[1]]))]
    )
    with open(OUTPUT_DIR / "model.onnx", "wb") as f:
        f.write(onnx_model.SerializeToString())

    meta = {
        "accuracy": float(acc),
        "f1": float(f1),
        "n_classes": len(le.classes_),
        "classes": list(le.classes_),
    }
    with open(OUTPUT_DIR / "metadata.json", "w") as f:
        json.dump(meta, f)

    logger.info("Done!")
    print(json.dumps(meta, indent=2))


if __name__ == "__main__":
    main()
