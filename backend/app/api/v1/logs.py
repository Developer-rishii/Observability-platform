"""
Logs API endpoints.
Provides real-time, time-bounded query access to Grafana Loki logs.
"""

from __future__ import annotations

from typing import List, Optional
from fastapi import APIRouter, Query, HTTPException, status
from app.services.ingestion.loki_client import query_logs, check_loki_health
from app.schemas import LogLine

router = APIRouter()

@router.get("", response_model=List[LogLine])
@router.get("/", response_model=List[LogLine])
def list_logs(
    q: Optional[str] = Query(None, description="Free text or regex search pattern"),
    level: Optional[str] = Query(None, description="Filter by severity level (INFO, WARN, ERROR, DEBUG, etc.)"),
    service: Optional[str] = Query(None, description="Filter by service name or job"),
    minutes: int = Query(60, ge=1, le=1440, description="Time window in minutes (1 to 1440)"),
    limit: int = Query(100, ge=1, le=500, description="Max log lines to return"),
):
    """
    Query real logs from Grafana Loki with optional text search and severity filters.
    """
    if not check_loki_health():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Log storage service (Loki) is currently unreachable.",
        )

    return query_logs(
        query_str=q,
        level=level,
        service=service,
        minutes=minutes,
        limit=limit,
    )

@router.get("/health")
def loki_health():
    """Check connection status to Loki backend."""
    healthy = check_loki_health()
    return {"status": "ok" if healthy else "unreachable", "healthy": healthy}
