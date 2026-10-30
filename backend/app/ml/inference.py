"""Anomaly detection inference engine.

Loads IsolationForest model and calibrated metadata from disk, validates
SHA-256 integrity and feature ordering, and scores incoming feature vectors.
Never raises unhandled exceptions to callers.
"""
import os
import json
import hashlib
import logging
from typing import Dict, Any, List, Optional
import joblib
import numpy as np

logger = logging.getLogger(__name__)


def compute_file_sha256(filepath: str) -> str:
    """Calculates SHA-256 hash of a file."""
    h = hashlib.sha256()
    with open(filepath, "rb") as f:
        while chunk := f.read(65536):
            h.update(chunk)
    return h.hexdigest()


class AnomalyDetector:
    """Production runtime anomaly detector using trained Isolation Forest."""

    def __init__(self, model_dir: str = "/models"):
        # If a path to the .pkl file itself was passed, use its parent directory
        if os.path.isfile(model_dir) or model_dir.endswith(".pkl"):
            self.model_dir = os.path.dirname(model_dir)
        else:
            self.model_dir = model_dir
        self.model_path = os.path.join(self.model_dir, "isolation_forest.pkl")
        self.meta_path = os.path.join(self.model_dir, "feature_metadata.json")

        self.model = None
        self.metadata: Optional[Dict[str, Any]] = None
        self.model_version: str = "unknown"
        self.threshold: float = 0.95
        self.feature_names: List[str] = []
        self.feature_means: Dict[str, float] = {}
        self.feature_stds: Dict[str, float] = {}
        self.nominal_scales: Dict[str, float] = {
            "error_rate_5m": 5.0,
            "data_dir_growth_5m": 26214400.0,
            "container_die_count_15m": 1.0,
        }
        self._is_loaded: bool = False

    @property
    def is_loaded(self) -> bool:
        """Returns True if model and metadata are loaded and verified."""
        return self._is_loaded

    def load(self) -> bool:
        """Loads and verifies model and metadata artifacts.

        Returns True on success, or False cleanly on any error without raising.
        """
        self._is_loaded = False
        try:
            if not os.path.exists(self.model_path):
                logger.warning(f"ML model file not found: {self.model_path}. Running in threshold-only mode.")
                return False

            if not os.path.exists(self.meta_path):
                logger.warning(f"ML metadata file not found: {self.meta_path}. Running in threshold-only mode.")
                return False

            # Load metadata JSON
            with open(self.meta_path, "r") as f:
                self.metadata = json.load(f)

            expected_sha = self.metadata.get("model_sha256")
            actual_sha = compute_file_sha256(self.model_path)
            if actual_sha != expected_sha:
                logger.error(
                    f"Model SHA-256 mismatch! Expected {expected_sha}, got {actual_sha}. "
                    "Refusing to load untrusted model artifact."
                )
                return False

            self.feature_names = self.metadata.get("features", [])
            if len(self.feature_names) != 8:
                logger.error(f"Metadata feature count must be exactly 8, got {len(self.feature_names)}.")
                return False

            self.threshold = float(self.metadata.get("threshold", 0.95))
            self.model_version = str(self.metadata.get("model_version", "iforest-v1.0"))
            self.feature_means = self.metadata.get("feature_means", {})
            self.feature_stds = self.metadata.get("feature_stds", {})
            self.nominal_scales = self.metadata.get("nominal_scales", {})

            # Load scikit-learn model artifact
            self.model = joblib.load(self.model_path)
            self._is_loaded = True
            logger.info(
                f"Successfully loaded Isolation Forest {self.model_version} "
                f"(threshold={self.threshold:.4f}, SHA-256={actual_sha[:8]}...)"
            )
            return True

        except Exception as e:
            logger.error(f"Failed to load ML anomaly detector from {self.model_dir}: {e}", exc_info=True)
            self._is_loaded = False
            return False

    def score(self, feature_vector: List[float]) -> Dict[str, Any]:
        """Scores a feature vector and returns diagnosis dictionary.

        Never raises exceptions to callers; returns safe defaults on error.
        """
        safe_default = {
            "score": None,
            "threshold": self.threshold,
            "is_anomaly": False,
            "top_features": [],
            "model_version": self.model_version,
            "error": None,
        }

        if not self._is_loaded or self.model is None:
            safe_default["error"] = "Detector is not loaded."
            return safe_default

        if not feature_vector or len(feature_vector) != len(self.feature_names):
            err_msg = f"Feature vector length mismatch: expected {len(self.feature_names)}, got {len(feature_vector) if feature_vector else 0}"
            logger.warning(err_msg)
            safe_default["error"] = err_msg
            return safe_default

        try:
            # Check for NaN / Inf
            clean_vec = np.array(feature_vector, dtype=np.float64)
            if np.isnan(clean_vec).any() or np.isinf(clean_vec).any():
                safe_default["error"] = "Feature vector contains NaN or Inf values."
                return safe_default

            # In scikit-learn, score_samples() returns negative anomaly scores.
            # We invert it: higher score = more anomalous.
            raw_scores = -self.model.score_samples([clean_vec])
            score_val = float(raw_scores[0])
            is_anomaly = bool(score_val >= self.threshold)

            # Compute top 3 contributing features by absolute z-score
            z_scores = []
            for name, val in zip(self.feature_names, clean_vec):
                mean = self.feature_means.get(name, 0.0)
                std = self.feature_stds.get(name, 1.0)
                if std < 1e-6:
                    scale = self.nominal_scales.get(name, 1.0)
                else:
                    scale = std
                z = float((val - mean) / scale)
                z_scores.append({"name": name, "z": round(z, 2), "abs_z": abs(z)})

            # Sort descending by |z| and pick top 3
            z_scores.sort(key=lambda x: x["abs_z"], reverse=True)
            top_features = [{"name": item["name"], "z": item["z"]} for item in z_scores[:3]]

            return {
                "score": round(score_val, 4),
                "threshold": round(self.threshold, 4),
                "is_anomaly": is_anomaly,
                "top_features": top_features,
                "model_version": self.model_version,
                "error": None,
            }

        except Exception as e:
            logger.error(f"Error scoring feature vector: {e}", exc_info=True)
            safe_default["error"] = str(e)
            return safe_default
