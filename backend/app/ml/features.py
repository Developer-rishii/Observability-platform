"""Telemetry feature calculations and PromQL query builders.

Shared single source of truth for both offline training/evaluation
and online scheduler anomaly detection. Uses pure NumPy only.
"""
from typing import List, Optional, Tuple, Dict, Any
import numpy as np

# Exact feature order required across training, metadata, and inference
FEATURE_NAMES: List[str] = [
    "cpu_pct_mean_5m",
    "cpu_pct_std_5m",
    "latency_p95_mean_5m",
    "latency_p95_std_5m",
    "error_rate_5m",
    "request_rate_mean_5m",
    "container_die_count_15m",
    "data_dir_growth_5m",
]

# Minimum number of 15s points in a 5-minute window required to compute features
MIN_POINTS_REQUIRED: int = 12


def get_feature_queries() -> Dict[str, str]:
    """Returns the PromQL query templates for metric extraction."""
    return {
        "cpu": 'rate(process_cpu_seconds_total{job="demo-app"}[1m]) * 100',
        "latency_p95": 'histogram_quantile(0.95, sum by (le) (rate(http_request_duration_seconds_bucket{job="demo-app"}[1m])))',
        "requests_total": 'sum(rate(http_requests_total{job="demo-app"}[1m]))',
        "requests_5xx": 'sum(rate(http_requests_total{job="demo-app", status=~"5.."}[1m]))',
        "data_dir_bytes": 'demo_data_dir_bytes{job="demo-app"}',
    }


def calc_mean_std(values: List[float]) -> Tuple[Optional[float], Optional[float]]:
    """Calculates mean and standard deviation over valid values with a min-point guard."""
    if not values:
        return None, None

    # Filter out None and NaN
    clean_vals = [v for v in values if v is not None and not np.isnan(v) and not np.isinf(v)]
    if len(clean_vals) < MIN_POINTS_REQUIRED:
        return None, None

    arr = np.array(clean_vals, dtype=np.float64)
    mean_val = float(np.mean(arr))
    std_val = float(np.std(arr))
    return mean_val, std_val


def calc_error_rate(requests_5xx: List[float], requests_total: List[float]) -> Optional[float]:
    """Calculates average error percentage over the window, guarding zero traffic."""
    if not requests_total or len(requests_total) < MIN_POINTS_REQUIRED:
        return None

    clean_total = [t for t in requests_total if t is not None and not np.isnan(t)]
    if len(clean_total) < MIN_POINTS_REQUIRED:
        return None

    total_sum = np.sum(clean_total)
    if total_sum <= 0.0:
        return 0.0  # Zero traffic = zero error rate

    clean_5xx = [e for e in requests_5xx if e is not None and not np.isnan(e)]
    err_sum = np.sum(clean_5xx) if clean_5xx else 0.0

    err_rate = (err_sum / total_sum) * 100.0
    return float(np.clip(err_rate, 0.0, 100.0))


def calc_rate_mean(requests_total: List[float]) -> Optional[float]:
    """Calculates average request throughput (requests/sec) over the window."""
    if not requests_total or len(requests_total) < MIN_POINTS_REQUIRED:
        return None
    clean = [r for r in requests_total if r is not None and not np.isnan(r)]
    if len(clean) < MIN_POINTS_REQUIRED:
        return None
    return float(np.mean(clean))


def calc_delta(values: List[float]) -> Optional[float]:
    """Calculates net change (delta) between the end and start of a window."""
    if not values:
        return None
    clean = [v for v in values if v is not None and not np.isnan(v)]
    if len(clean) < MIN_POINTS_REQUIRED:
        return None
    return float(clean[-1] - clean[0])


def build_feature_vector(
    cpu_series: List[float],
    latency_series: List[float],
    requests_5xx_series: List[float],
    requests_total_series: List[float],
    data_dir_series: List[float],
    container_die_count_15m: float,
) -> Optional[List[float]]:
    """Builds the 8 ordered features from the telemetry series.

    Returns None if any feature cannot be computed (e.g. fewer than 12 valid points).
    """
    cpu_mean, cpu_std = calc_mean_std(cpu_series)
    if cpu_mean is None or cpu_std is None:
        return None

    lat_mean, lat_std = calc_mean_std(latency_series)
    if lat_mean is None or lat_std is None:
        return None

    error_rate = calc_error_rate(requests_5xx_series, requests_total_series)
    if error_rate is None:
        return None

    req_rate = calc_rate_mean(requests_total_series)
    if req_rate is None:
        return None

    data_dir_growth = calc_delta(data_dir_series)
    if data_dir_growth is None:
        return None

    # Construct feature vector in strict contract order
    return [
        float(cpu_mean),
        float(cpu_std),
        float(lat_mean),
        float(lat_std),
        float(error_rate),
        float(req_rate),
        float(container_die_count_15m),
        float(data_dir_growth),
    ]
