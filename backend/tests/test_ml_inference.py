"""Unit tests for AnomalyDetector inference class."""
import os
import json
import hashlib
import pytest
import joblib
import numpy as np
from sklearn.ensemble import IsolationForest

from app.ml.inference import AnomalyDetector
from app.ml.features import FEATURE_NAMES


@pytest.fixture
def test_model_dir(tmp_path):
    """Creates a tiny valid IsolationForest model and metadata in a temp dir."""
    model_dir = tmp_path / "models"
    model_dir.mkdir()

    # 1. Fit small IsolationForest on 8 features
    np.random.seed(42)
    X = np.random.normal(loc=5.0, scale=1.0, size=(50, 8))
    clf = IsolationForest(n_estimators=10, random_state=42)
    clf.fit(X)

    model_path = model_dir / "isolation_forest.pkl"
    joblib.dump(clf, model_path)

    # 2. Compute SHA-256
    h = hashlib.sha256()
    with open(model_path, "rb") as f:
        while chunk := f.read(65536):
            h.update(chunk)
    sha256 = h.hexdigest()

    # 3. Create metadata
    metadata = {
        "model_version": "iforest-test-1.0",
        "algorithm": "IsolationForest",
        "features": FEATURE_NAMES,
        "threshold": 0.55,
        "feature_means": {f: 5.0 for f in FEATURE_NAMES},
        "feature_stds": {f: 1.0 for f in FEATURE_NAMES},
        "model_sha256": sha256,
    }
    meta_path = model_dir / "feature_metadata.json"
    with open(meta_path, "w") as f:
        json.dump(metadata, f)

    return str(model_dir)


def test_detector_valid_prediction(test_model_dir):
    """Verifies successful loading, scoring, and output structure."""
    detector = AnomalyDetector(model_dir=test_model_dir)
    assert detector.load() is True
    assert detector.is_loaded is True
    assert detector.model_version == "iforest-test-1.0"
    assert detector.threshold == 0.55

    # Normal vector
    vec_normal = [5.0] * 8
    res_normal = detector.score(vec_normal)
    assert res_normal["error"] is None
    assert isinstance(res_normal["score"], float)
    assert res_normal["threshold"] == 0.55
    assert res_normal["is_anomaly"] is False
    assert len(res_normal["top_features"]) == 3
    assert res_normal["model_version"] == "iforest-test-1.0"

    # Extreme anomalous vector
    vec_anom = [500.0, 200.0, 100.0, 50.0, 100.0, 0.0, 10.0, 1000.0]
    res_anom = detector.score(vec_anom)
    assert res_anom["is_anomaly"] is True
    assert res_anom["score"] > 0.55
    assert res_anom["top_features"][0]["z"] > 10.0


def test_detector_missing_model_dir(tmp_path):
    """Verifies clean return False and fallback when model directory does not exist."""
    non_existent = str(tmp_path / "does_not_exist")
    detector = AnomalyDetector(model_dir=non_existent)
    assert detector.load() is False
    assert detector.is_loaded is False

    # Scoring unhandled model should safely return error dict
    res = detector.score([1.0] * 8)
    assert res["is_anomaly"] is False
    assert res["error"] == "Detector is not loaded."


def test_detector_corrupt_hash_mismatch(test_model_dir):
    """Verifies that an altered model file fails SHA-256 validation and refuses to load."""
    model_path = os.path.join(test_model_dir, "isolation_forest.pkl")
    with open(model_path, "ab") as f:
        f.write(b"tampered-bytes")

    detector = AnomalyDetector(model_dir=test_model_dir)
    assert detector.load() is False
    assert detector.is_loaded is False


def test_detector_dimension_mismatch(test_model_dir):
    """Verifies that scoring a vector with wrong dimensions returns safe result without raising."""
    detector = AnomalyDetector(model_dir=test_model_dir)
    assert detector.load() is True

    # Vector with 5 features instead of 8
    res = detector.score([1.0, 2.0, 3.0, 4.0, 5.0])
    assert res["is_anomaly"] is False
    assert "Feature vector length mismatch" in res["error"]

    # Empty vector
    res_empty = detector.score([])
    assert res_empty["is_anomaly"] is False
    assert "Feature vector length mismatch" in res_empty["error"]

    # Vector containing NaN
    res_nan = detector.score([1.0, 2.0, np.nan, 4.0, 5.0, 6.0, 7.0, 8.0])
    assert res_nan["is_anomaly"] is False
    assert "contains NaN or Inf" in res_nan["error"]


def test_detector_zero_variance_nominal_scale_guard(test_model_dir):
    """Verify that features with std=0 or near-zero std use nominal scales from metadata or defaults."""
    detector = AnomalyDetector(model_dir=str(test_model_dir))
    assert detector.load() is True

    # Set means and stds to 0.0 to simulate zero-variance baseline features
    detector.feature_means["error_rate_5m"] = 0.0
    detector.feature_stds["error_rate_5m"] = 0.0
    detector.feature_means["data_dir_growth_5m"] = 0.0
    detector.feature_stds["data_dir_growth_5m"] = 0.0
    detector.feature_means["container_die_count_15m"] = 0.0
    detector.feature_stds["container_die_count_15m"] = 0.0

    detector.nominal_scales = {
        "error_rate_5m": 5.0,
        "data_dir_growth_5m": 26214400.0,
        "container_die_count_15m": 1.0,
    }

    # Test nominal scales:
    # error_rate_5m: 10.0 -> z = 10.0 / 5.0 = 2.0
    # data_dir_growth_5m: 52428800.0 -> z = 52428800.0 / 26214400.0 = 2.0
    # container_die_count_15m: 3.0 -> z = 3.0 / 1.0 = 3.0
    # Set the other 5 features to their mean (5.0) so their z-score is 0.0
    vec = [5.0, 5.0, 5.0, 5.0, 10.0, 5.0, 3.0, 52428800.0]
    res = detector.score(vec)

    assert res["error"] is None
    assert len(res["top_features"]) == 3
    top_map = {f["name"]: f["z"] for f in res["top_features"]}
    assert top_map.get("container_die_count_15m") == 3.0
    assert top_map.get("error_rate_5m") == 2.0
    assert top_map.get("data_dir_growth_5m") == 2.0


def test_detector_zero_variance_fallback_when_nominal_scales_missing(test_model_dir):
    """Verify inference.py falls back to 1.0 when nominal_scales key is missing from metadata."""
    detector = AnomalyDetector(model_dir=str(test_model_dir))
    assert detector.load() is True

    # Ensure nominal_scales is completely empty (simulating legacy metadata without the key)
    detector.nominal_scales = {}

    # Set error_rate_5m to zero-variance (mean=0, std=0)
    detector.feature_means["error_rate_5m"] = 0.0
    detector.feature_stds["error_rate_5m"] = 0.0

    # With missing nominal_scales, fallback scale is 1.0:
    # error_rate_5m: 7.0 -> z = (7.0 - 0.0) / 1.0 = 7.0
    vec = [5.0, 5.0, 5.0, 5.0, 7.0, 5.0, 5.0, 5.0]
    res = detector.score(vec)

    assert res["error"] is None
    top_map = {f["name"]: f["z"] for f in res["top_features"]}
    assert top_map.get("error_rate_5m") == 7.0
