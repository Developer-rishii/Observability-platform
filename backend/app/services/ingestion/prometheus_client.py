import time
import requests
from datetime import datetime
from app.core.config import settings

def _get_query_for_metric(metric: str) -> str:
    """Map frontend metric names to actual PromQL queries."""
    if metric == "cpu":
        # Simulating CPU % from the workload generator's CPU gauge or similar
        return "rate(process_cpu_seconds_total[1m]) * 100"
    elif metric == "memory":
        return "process_resident_memory_bytes / 1024 / 1024"
    else:
        # fallback, just return the metric
        return metric

def query_range(metric: str, minutes: int) -> list[dict]:
    """
    Query Prometheus for a given metric over the last `minutes`.
    Returns a list of points: [{'t': datetime, 'v': float}, ...]
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
        
    except Exception as e:
        print(f"Prometheus query failed: {e}")
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

