from fastapi import APIRouter, Query, HTTPException, status
from fastapi.responses import JSONResponse
from app.core.config import settings
from app.services.ingestion.prometheus_client import query_range, PrometheusUnavailableException
from app.schemas import MetricSeries, MetricPoint

router = APIRouter()

def parse_range(range_str: str) -> int:
    if range_str.endswith("m"):
        return int(range_str[:-1])
    elif range_str.endswith("h"):
        return int(range_str[:-1]) * 60
    return 5  # default 5m

@router.get("/query", response_model=MetricSeries)
def get_metrics_query(
    metric: str = Query(..., description="Metric name, e.g. cpu or memory"),
    range: str = Query("5m", description="Time range, e.g. 5m, 1h")
):
    minutes = parse_range(range)
    try:
        points_data = query_range(metric, minutes)
    except PrometheusUnavailableException as exc:
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={
                "detail": f"Prometheus server unavailable: {exc}",
                "code": "prometheus_unavailable"
            }
        )
    
    # Map raw dicts to MetricPoint schemas
    points = [MetricPoint(t=p["t"], v=p["v"]) for p in points_data]
    
    # Metadata map for metrics
    metadata_map = {
        "cpu": ("%", "Host CPU Utilization", settings.CPU_THRESHOLD_PCT),
        "memory": ("%", "Host Memory Utilization", settings.MEM_THRESHOLD_PCT),
        "disk": ("%", "Host Disk Storage Usage", settings.DISK_THRESHOLD_PCT),
        "network": ("MB/s", "Host Network Throughput", 100.0),
        "request_rate": ("req/s", "Demo App Request Rate", None),
        "requests": ("req/s", "Demo App Request Rate", None),
        "p95_latency": ("s", "Demo App p95 Latency", 1.0),
        "latency_p95": ("s", "Demo App p95 Latency", 1.0),
        "error_rate": ("%", "Demo App 5xx Error Rate", 5.0),
        "errors": ("%", "Demo App 5xx Error Rate", 5.0),
        "demo_data_dir_bytes": ("bytes", "Demo Data Storage Usage", None),
        "demo_app_cpu": ("%", "Demo App Process CPU", 80.0),
        "process_cpu": ("%", "Demo App Process CPU", 80.0),
        "demo_app_memory": ("bytes", "Demo App Process Resident Memory", None),
        "process_memory": ("bytes", "Demo App Process Resident Memory", None),
    }
    unit, label, threshold = metadata_map.get(
        metric, 
        ("%", f"{metric.upper()} Telemetry", settings.CPU_THRESHOLD_PCT)
    )
    
    return MetricSeries(
        metric=metric,
        label=label,
        unit=unit,
        points=points,
        threshold=threshold
    )
