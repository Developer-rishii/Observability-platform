import time
import requests
from datetime import datetime
from app.core.config import settings

class PrometheusUnavailableException(Exception):
    """Raised when Prometheus server cannot be reached."""
    pass

def _get_query_for_metric(metric: str) -> str:
    """Map telemetry metric names to genuine node_exporter and demo-app PromQL queries."""
    if metric == "cpu":
        # Live host CPU usage percent from node_exporter
        return '100 - (avg(rate(node_cpu_seconds_total{mode="idle"}[1m])) * 100)'
    elif metric == "memory":
        # Live host memory usage percent from node_exporter
        return '(1 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)) * 100'
    elif metric == "disk":
        # Live host disk usage percent from root or host mounted filesystem
        return '100 - (node_filesystem_avail_bytes{mountpoint="/rootfs"} / node_filesystem_size_bytes{mountpoint="/rootfs"} * 100)'
    elif metric in ("network", "network_ingress"):
        # Live network ingress rate in MB/s (excluding loopback)
        return 'sum(rate(node_network_receive_bytes_total{device!~"lo|veth.*"}[1m])) / 1024 / 1024'
    elif metric == "network_egress":
        # Live network egress rate in MB/s (excluding loopback)
        return 'sum(rate(node_network_transmit_bytes_total{device!~"lo|veth.*"}[1m])) / 1024 / 1024'
    elif metric == "uptime":
        # Host uptime in seconds
        return 'node_time_seconds - node_boot_time_seconds'
    elif metric == "load":
        # 1-minute load average
        return 'node_load1'
    elif metric == "container_count":
        # Number of live containers (returns None if no cadvisor)
        return 'count(container_last_seen)'
    elif metric in ("request_rate", "requests"):
        # HTTP request rate per second across all routes
        return 'sum(rate(http_requests_total[1m]))'
    elif metric in ("p95_latency", "latency_p95"):
        # p95 latency in seconds across all routes
        return 'histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket[1m])) by (le))'
    elif metric in ("error_rate", "errors"):
        # 5xx HTTP error share percentage (0-100%)
        return '(sum(rate(http_requests_total{status=~"5.."}[1m])) / clamp_min(sum(rate(http_requests_total[1m])), 0.0001)) * 100'
    elif metric == "demo_data_dir_bytes":
        # Disk usage in bytes of demo data directory
        return 'demo_data_dir_bytes'
    elif metric in ("demo_app_cpu", "process_cpu"):
        # Process CPU utilization (percent of 1 core)
        return 'rate(process_cpu_seconds_total{job="demo-app"}[1m]) * 100'
    elif metric in ("demo_app_memory", "process_memory"):
        # Process resident memory in bytes
        return 'process_resident_memory_bytes{job="demo-app"}'
    else:
        return metric

def query_instant(query_or_metric: str) -> float | None:
    """
    Execute an instant PromQL query or mapped metric name and return the float scalar/latest value.
    Returns None if no data is found or query fails.
    """
    prom_url = settings.PROMETHEUS_URL.rstrip('/')
    url = f"{prom_url}/api/v1/query"
    query = _get_query_for_metric(query_or_metric)
    try:
        resp = requests.get(url, params={"query": query}, timeout=4.0)
        resp.raise_for_status()
        data = resp.json()
        results = data.get("data", {}).get("result", [])
        if not results:
            return None
        val_str = results[0].get("value", [None, None])[1]
        return float(val_str) if val_str is not None else None
    except Exception as e:
        print(f"Prometheus query_instant error ({query_or_metric}): {e}")
        return None

def query_range(metric: str, minutes: int) -> list[dict]:
    """
    Query Prometheus for a given metric over the last `minutes`.
    Returns a list of points: [{'t': datetime, 'v': float}, ...]
    Raises PrometheusUnavailableException if Prometheus is unreachable.
    Returns an empty list if Prometheus is reachable but has no data.
    """
    prom_url = settings.PROMETHEUS_URL.rstrip('/')
    url = f"{prom_url}/api/v1/query_range"
    
    query = _get_query_for_metric(metric)
    
    end_time = int(time.time())
    start_time = end_time - (minutes * 60)
    step = max(15, (minutes * 60) // 100)  # max 100 points, minimum 15s step
    
    params = {
        "query": query,
        "start": start_time,
        "end": end_time,
        "step": step
    }
    
    try:
        resp = requests.get(url, params=params, timeout=5.0)
        resp.raise_for_status()
        data = resp.json()
        
        result = data.get("data", {}).get("result", [])
        if not result:
            return []
        
        # Take the first time series
        values = result[0].get("values", [])
        
        points = []
        for v in values:
            timestamp = float(v[0])
            value = float(v[1])
            points.append({
                "t": datetime.fromtimestamp(timestamp),
                "v": value
            })
        return points
        
    except (requests.RequestException, requests.ConnectionError, requests.Timeout) as e:
        print(f"Prometheus connection failed: {e}")
        raise PrometheusUnavailableException(str(e))
    except Exception as e:
        print(f"Prometheus query processing failed: {e}")
        return []

def check_health() -> bool:
    """Check if Prometheus is reachable and healthy."""
    prom_url = settings.PROMETHEUS_URL.rstrip('/')
    url = f"{prom_url}/-/healthy"
    try:
        resp = requests.get(url, timeout=2.0)
        return resp.status_code == 200
    except:
        return False

def get_targets() -> list[dict]:
    """Fetch active targets and their health status from Prometheus."""
    prom_url = settings.PROMETHEUS_URL.rstrip('/')
    url = f"{prom_url}/api/v1/targets"
    try:
        resp = requests.get(url, timeout=3.0)
        resp.raise_for_status()
        data = resp.json()
        active = data.get("data", {}).get("activeTargets", [])
        targets = []
        for t in active:
            targets.append({
                "job": t.get("labels", {}).get("job", "unknown"),
                "instance": t.get("labels", {}).get("instance", "unknown"),
                "health": t.get("health", "unknown"),
                "last_scrape": t.get("lastScrape"),
                "last_error": t.get("lastError", ""),
            })
        return targets
    except Exception as e:
        print(f"Failed to query Prometheus targets: {e}")
        return []

