"""
Loki log query client and helper service.
Queries Grafana Loki REST API (GET /loki/api/v1/query_range)
and parses stream records into structured log lines.
"""

from __future__ import annotations

import re
import time
import requests
from datetime import datetime
from typing import List, Optional
from app.core.config import settings
from app.schemas import LogLine

_LEVEL_REGEX = re.compile(r"\b(DEBUG|INFO|WARN|WARNING|ERROR|CRITICAL|FATAL)\b", re.IGNORECASE)

def check_loki_health() -> bool:
    """Verify if Loki is reachable and in ready state."""
    loki_url = settings.LOKI_URL.rstrip('/')
    try:
        resp = requests.get(f"{loki_url}/ready", timeout=3.0)
        return resp.status_code == 200
    except Exception:
        return False

def query_logs(
    query_str: Optional[str] = None,
    level: Optional[str] = None,
    service: Optional[str] = None,
    minutes: int = 60,
    limit: int = 100,
) -> List[LogLine]:
    """
    Execute a bounded query against Loki and return structured LogLine schemas.
    Safely sanitizes text filters and maps stream records.
    """
    loki_url = settings.LOKI_URL.rstrip('/')
    url = f"{loki_url}/loki/api/v1/query_range"

    # Base stream selector
    if service and service.lower() != "all":
        # sanitize service name
        clean_service = re.sub(r"[^a-zA-Z0-9_\-\.]", "", service)
        base_selector = f'{{service="{clean_service}"}}'
    else:
        base_selector = '{job=~".+"}'

    logql = base_selector

    # Append case-insensitive regex text filter if provided
    if query_str and query_str.strip():
        # Sanitize query string to prevent LogQL injection
        escaped_query = re.escape(query_str.strip())
        logql += f' |~ "(?i){escaped_query}"'

    # Append log level line filter if specified
    if level and level.upper() not in ("ALL", ""):
        clean_level = re.escape(level.upper())
        logql += f' |~ "(?i)\\b{clean_level}\\b"'

    end_ns = int(time.time() * 1e9)
    start_ns = end_ns - int(minutes * 60 * 1e9)

    params = {
        "query": logql,
        "start": start_ns,
        "end": end_ns,
        "limit": min(limit, 500),
        "direction": "backward",
    }

    try:
        resp = requests.get(url, params=params, timeout=5.0)
        resp.raise_for_status()
        data = resp.json()

        streams = data.get("data", {}).get("result", [])
        log_lines: List[LogLine] = []

        for stream in streams:
            stream_labels = stream.get("stream", {})
            svc = stream_labels.get("service") or stream_labels.get("job") or "system"
            container = stream_labels.get("container") or stream_labels.get("filename")

            for entry in stream.get("values", []):
                ts_ns_str, line_text = entry[0], entry[1]
                ts_sec = float(ts_ns_str) / 1e9
                dt = datetime.utcfromtimestamp(ts_sec)

                # Detect severity level from text if not labeled
                detected_level = "INFO"
                match = _LEVEL_REGEX.search(line_text)
                if match:
                    raw_lvl = match.group(1).upper()
                    if raw_lvl in ("WARN", "WARNING"):
                        detected_level = "WARN"
                    elif raw_lvl in ("CRITICAL", "FATAL"):
                        detected_level = "ERROR"
                    else:
                        detected_level = raw_lvl

                # Generate deterministic record id
                record_id = f"log-{ts_ns_str[:16]}"

                log_lines.append(LogLine(
                    id=record_id,
                    timestamp=dt,
                    level=detected_level,
                    service=svc,
                    container=container,
                    message=line_text.strip(),
                ))

        # Sort newest first
        log_lines.sort(key=lambda x: x.timestamp, reverse=True)
        return log_lines[:limit]

    except Exception as e:
        print(f"Loki query_logs error: {e}")
        return []
