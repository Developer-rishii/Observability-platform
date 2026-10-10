from fastapi import APIRouter, Query, HTTPException
from app.services.ingestion.prometheus_client import query_range
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
    points_data = query_range(metric, minutes)
    
    # Map raw dicts to MetricPoint schemas
    points = [MetricPoint(t=p["t"], v=p["v"]) for p in points_data]
    
    # Default metadata based on metric type
    unit = "%" if metric == "cpu" else "MB"
    label = "CPU Usage" if metric == "cpu" else "Memory Usage"
    
    from app.core.config import settings
    threshold = settings.CPU_THRESHOLD_PCT if metric == "cpu" else settings.MEM_THRESHOLD_PCT
    
    return MetricSeries(
        metric=metric,
        label=label,
        unit=unit,
        points=points,
        threshold=threshold
    )
