#!/usr/bin/env python3
"""Isolation Forest model trainer.

Trains an IsolationForest model on normal baseline telemetry (normal_train.csv)
using scikit-learn and exports the binary artifact to ml/models/isolation_forest.pkl.
"""
import sys
import os
import argparse
import joblib
import pandas as pd
from sklearn.ensemble import IsolationForest

# Import feature definitions
from ml.features import FEATURE_NAMES


def train_model(train_csv: str, model_out: str):
    """Fits IsolationForest on training features and exports to joblib."""
    print(f"Loading training data from {train_csv}...")
    df = pd.read_csv(train_csv)

    missing_cols = [c for c in FEATURE_NAMES if c not in df.columns]
    if missing_cols:
        raise ValueError(f"Training dataset is missing required features: {missing_cols}")

    # Extract ordered feature matrix
    X = df[FEATURE_NAMES].values
    print(f"Training IsolationForest on {X.shape[0]} samples with {X.shape[1]} features...")

    # Exact hyperparameters from plan
    clf = IsolationForest(
        n_estimators=150,
        max_samples="auto",
        contamination="auto",
        random_state=42,
    )
    clf.fit(X)

    os.makedirs(os.path.dirname(os.path.abspath(model_out)), exist_ok=True)
    joblib.dump(clf, model_out)
    print(f"[SUCCESS] Model saved to {model_out}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Isolation Forest Trainer")
    parser.add_argument("--train-csv", default="ml/data/normal_train.csv", help="Path to normal_train.csv")
    parser.add_argument("--model-out", default="ml/models/isolation_forest.pkl", help="Output path for .pkl file")
    args = parser.parse_args()

    train_model(args.train_csv, args.model_out)
