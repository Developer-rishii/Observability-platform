#!/usr/bin/env python3
"""Anomaly threshold calibration and metadata generator.

Scores validation data (normal_validate.csv) against the trained model,
determines the empirical decision threshold (P99.5 + 0.02), computes SHA-256
hash of isolation_forest.pkl, and writes feature_metadata.json.
Guards zero-variance features by storing std as 1.0 (with explicit comment).
"""
import sys
import os
import json
import hashlib
import argparse
import joblib
import pandas as pd
import numpy as np

from ml.features import FEATURE_NAMES


def compute_sha256(filepath: str) -> str:
    """Calculates SHA-256 hash of a file."""
    h = hashlib.sha256()
    with open(filepath, "rb") as f:
        while chunk := f.read(65536):
            h.update(chunk)
    return h.hexdigest()


def calibrate(
    train_csv: str,
    val_csv: str,
    model_path: str,
    metadata_out: str,
):
    """Calibrates threshold and writes metadata."""
    print(f"Loading trained model from {model_path}...")
    if not os.path.exists(model_path):
        raise FileNotFoundError(f"Model file not found: {model_path}. Run ml/train.py first.")
    clf = joblib.load(model_path)

    # 1. Feature statistics from training set
    print(f"Reading training set {train_csv} for baseline statistics...")
    train_df = pd.read_csv(train_csv)
    feature_means = {}
    feature_stds = {}

    for feat in FEATURE_NAMES:
        col = train_df[feat].values
        mean_val = float(np.mean(col))
        std_val = float(np.std(col))

        # ZERO-VARIANCE GUARD:
        # If standard deviation is 0.0 or near zero (< 1e-6) (e.g. error_rate or container_die_count
        # during completely clean normal operation), store std as 1.0 so that runtime z-score
        # calculation: (x - mean) / std never divides by zero and produces 0.0 deviation when x == mean.
        if std_val < 1e-6:
            std_val = 1.0

        feature_means[feat] = mean_val
        feature_stds[feat] = std_val

    # 2. Validation scores and threshold calibration
    print(f"Scoring validation set {val_csv}...")
    val_df = pd.read_csv(val_csv)
    X_val = val_df[FEATURE_NAMES].values

    # In scikit-learn, score_samples() returns negative anomaly scores.
    # We take the negative so higher score = more abnormal.
    val_scores = -clf.score_samples(X_val)
    train_scores = -clf.score_samples(train_df[FEATURE_NAMES].values)

    p99_5 = float(np.percentile(val_scores, 99.5))
    calibrated_threshold = float(p99_5 + 0.02)

    # Calculate validation false alarm rate
    false_alarms = np.sum(val_scores >= calibrated_threshold)
    false_alarm_rate = float((false_alarms / len(val_scores)) * 100.0)

    # 3. Model SHA-256 hash
    model_sha256 = compute_sha256(model_path)

    nominal_scales = {
        "error_rate_5m": 5.0,
        "data_dir_growth_5m": 26214400.0,
        "container_die_count_15m": 1.0,
    }

    metadata = {
        "model_version": "iforest-v1.0",
        "algorithm": "IsolationForest",
        "n_estimators": 150,
        "features": FEATURE_NAMES,
        "threshold": round(calibrated_threshold, 4),
        "threshold_p99_5": round(p99_5, 4),
        "feature_means": feature_means,
        "feature_stds": feature_stds,
        "nominal_scales": nominal_scales,
        "model_sha256": model_sha256,
        "validation_samples": int(len(val_scores)),
        "false_alarm_rate_pct": round(false_alarm_rate, 2),
    }

    os.makedirs(os.path.dirname(os.path.abspath(metadata_out)), exist_ok=True)
    with open(metadata_out, "w") as f:
        json.dump(metadata, f, indent=2)

    print("\n--- Calibration Results ---")
    print(f"Validation Score Range : [{np.min(val_scores):.4f}, {np.max(val_scores):.4f}]")
    print(f"Validation 99.5th Pct  : {p99_5:.4f}")
    print(f"Calibrated Threshold   : {calibrated_threshold:.4f} (P99.5 + 0.02)")
    print(f"Validation False Alarms: {false_alarms}/{len(val_scores)} ({false_alarm_rate:.2f}%)")
    print(f"Model SHA-256          : {model_sha256}")
    print(f"[SUCCESS] Metadata saved to {metadata_out}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Model Calibrator")
    parser.add_argument("--train-csv", default="ml/data/normal_train.csv", help="Path to normal_train.csv")
    parser.add_argument("--val-csv", default="ml/data/normal_validate.csv", help="Path to normal_validate.csv")
    parser.add_argument("--model", default="ml/models/isolation_forest.pkl", help="Path to model .pkl")
    parser.add_argument("--out-meta", default="ml/models/feature_metadata.json", help="Path to output metadata JSON")
    args = parser.parse_args()

    calibrate(args.train_csv, args.val_csv, args.model, args.out_meta)
