"""
Logs API endpoints.
Provides real-time, time-bounded query access to Grafana Loki logs.
"""

from __future__ import annotations

import re
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Query, HTTPException, status
from app.services.ingestion.loki_client import query_logs, check_loki_health, ALLOWED_LEVELS
from app.schemas import LogLine

router = APIRouter()

SERVICE_REGEX = re.compile(r"^[a-zA-Z0-9_\-\.]+$")


def _parse_iso_datetime(dt_str: str, field_name: str) -> datetime:
    """Parse an ISO 8601 datetime string. Naive datetimes are assumed to be UTC."""
    try:
        # Standard fromisoformat supports YYYY-MM-DDTHH:MM:SS with optional offset or Z
        clean_str = dt_str.replace("Z", "+00:00") if dt_str.endswith("Z") else dt_str
        dt = datetime.fromisoformat(clean_str)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid ISO 8601 datetime format for '{field_name}': {dt_str}",
        )


@router.get("", response_model=List[LogLine])
@router.get("/", response_model=List[LogLine])
def list_logs(
    q: Optional[str] = Query(None, description="Free text search pattern"),
    level: Optional[str] = Query(None, description="Filter by severity level (DEBUG, INFO, WARN, WARNING, ERROR, CRITICAL, FATAL)"),
    service: Optional[str] = Query(None, description="Filter by service name or job"),
    minutes: int = Query(60, ge=1, le=1440, description="Time window in minutes (1 to 1440)"),
    start: Optional[str] = Query(None, description="Start timestamp in ISO 8601 format"),
    end: Optional[str] = Query(None, description="End timestamp in ISO 8601 format"),
    limit: int = Query(100, ge=1, le=500, description="Max log lines to return (1 to 500)"),
):
    """
    Query real logs from Grafana Loki with optional text search, severity filters, and time bounds.
    """
    # 1. Validate service
    if service is not None:
        trimmed_service = service.strip()
        if trimmed_service.lower() != "all" and trimmed_service != "":
            if not SERVICE_REGEX.match(trimmed_service):
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail=f"Invalid service name: '{service}'. Only alphanumeric characters, '.', '_', and '-' are allowed.",
                )

    # 2. Validate level
    if level is not None:
        trimmed_level = level.strip().upper()
        if trimmed_level not in ("ALL", "") and trimmed_level not in ALLOWED_LEVELS:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Invalid log level: '{level}'. Allowed values: {', '.join(sorted(ALLOWED_LEVELS))}.",
            )

    # 3. Parse and validate start / end timestamps
    start_dt: Optional[datetime] = None
    end_dt: Optional[datetime] = None

    if start is not None or end is not None:
        now_utc = datetime.now(timezone.utc)
        if start is not None:
            start_dt = _parse_iso_datetime(start, "start")
        if end is not None:
            end_dt = _parse_iso_datetime(end, "end")
        else:
            end_dt = now_utc

        if start_dt is None:
            # If only end was provided, default start to minutes before end
            start_dt = end_dt - (datetime.fromtimestamp(minutes * 60, timezone.utc) - datetime.fromtimestamp(0, timezone.utc))

        if start_dt >= end_dt:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Invalid time range: start timestamp ({start_dt.isoformat()}) must be earlier than end timestamp ({end_dt.isoformat()}).",
            )

        duration_seconds = (end_dt - start_dt).total_seconds()
        if duration_seconds > 86400:  # 24 hours
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Time range exceeds maximum allowed window of 24 hours (requested: {duration_seconds / 3600:.1f} hours).",
            )

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
        start_dt=start_dt,
        end_dt=end_dt,
        limit=limit,
    )


@router.get("/health")
def loki_health():
    """Check connection status to Loki backend."""
    healthy = check_loki_health()
    return {"status": "ok" if healthy else "unreachable", "healthy": healthy}
