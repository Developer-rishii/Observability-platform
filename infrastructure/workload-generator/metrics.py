import os
from prometheus_client import Counter, Gauge, Histogram
from config import DEMO_DATA_DIR

# 1. Existing metrics (preserved)
SPIKE_REQUESTS = Counter('spike_requests_total', 'Total number of spike requests')
CPU_SIMULATOR = Gauge('simulated_cpu_usage', 'Simulated CPU usage percentage')
CPU_SIMULATOR.set(5.0)

# 2. Application metrics
HTTP_REQUESTS_TOTAL = Counter(
    'http_requests_total',
    'Total count of HTTP requests processed by demo application',
    ['path', 'status']
)

HTTP_REQUEST_DURATION_SECONDS = Histogram(
    'http_request_duration_seconds',
    'HTTP request duration in seconds',
    ['path', 'status'],
    buckets=[0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.0, 3.5, 5.0, 10.0]
)

DEMO_DATA_DIR_BYTES = Gauge(
    'demo_data_dir_bytes',
    'Actual size in bytes of files within the demo application data directory'
)

def measure_data_dir_bytes(dir_path: str = DEMO_DATA_DIR) -> float:
    """Measure total disk bytes consumed in the designated data directory."""
    total_bytes = 0
    if os.path.exists(dir_path):
        try:
            for root, _, files in os.walk(dir_path):
                for f in files:
                    file_path = os.path.join(root, f)
                    try:
                        total_bytes += os.path.getsize(file_path)
                    except OSError:
                        pass
        except OSError:
            pass
    DEMO_DATA_DIR_BYTES.set(float(total_bytes))
    return float(total_bytes)

# Initialize data dir gauge on import
measure_data_dir_bytes()
