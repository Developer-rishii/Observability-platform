"""
Loki log query client and helper service.
Queries Grafana Loki REST API (GET /loki/api/v1/query_range)
and parses stream records into structured log lines.
"""

from __future__ import annotations

import re
import time
import requests
from datetime import datetime, timezone
from typing import List, Optional
from app.core.config import settings
from app.schemas import LogLine

_LEVEL_REGEX = re.compile(r"\b(DEBUG|INFO|WARN|WARNING|ERROR|CRITICAL|FATAL)\b", re.IGNORECASE)

ALLOWED_LEVELS = {"DEBUG", "INFO", "WARN", "WARNING", "ERROR", "CRITICAL", "FATAL"}


def escape_logql_regex_string(val: str) -> str:
    r"""
    Escape a free text string for safe interpolation into a LogQL regex filter:
    1. Escape regex metacharacters so the text is matched literally (without escaping whitespace).
    2. Escape backslashes and double quotes for the surrounding LogQL double-quoted string.
    """
    # 1. Regex metacharacters escaping (only true regex metacharacters, never space/alphanumerics)
    regex_metachars = set(r".^$*+?{}[]\|()")
    escaped_chars = []
    for c in val:
        if c in regex_metachars:
            escaped_chars.append("\\" + c)
        else:
            escaped_chars.append(c)
    regex_str = "".join(escaped_chars)

    # 2. String literal escaping for LogQL double-quoted string
    # In LogQL string syntax, backslashes must be doubled (`\\`) and double quotes escaped (`\"`)
    logql_escaped = regex_str.replace("\\", "\\\\").replace('"', '\\"')
    return logql_escaped


def build_logql_query(
    query_str: Optional[str] = None,
    level: Optional[str] = None,
    service: Optional[str] = None,
) -> str:
    """Build a validated, safe LogQL query string."""
    # Base stream selector
    if service and service.strip() and service.strip().lower() != "all":
        clean_service = re.sub(r"[^a-zA-Z0-9_\-\.]", "", service.strip())
        base_selector = f'{{service="{clean_service}"}}'
    else:
        # Default selector matches any service stream in Loki
        base_selector = '{service=~".+"}'

    logql = base_selector

    # Append case-insensitive regex text filter if provided
    if query_str and query_str.strip():
        safe_q = escape_logql_regex_string(query_str.strip())
        logql += f' |~ "(?i){safe_q}"'

    # Append log level line filter if specified
    if level and level.strip():
        clean_level = level.strip().upper()
        if clean_level not in ("ALL", "") and clean_level in ALLOWED_LEVELS:
            if clean_level in ("WARN", "WARNING"):
                logql += ' |~ "(?i)\\\\b(WARN|WARNING)\\\\b"'
            elif clean_level in ("CRITICAL", "FATAL", "ERROR"):
                logql += f' |~ "(?i)\\\\b{clean_level}\\\\b"'
            else:
                logql += f' |~ "(?i)\\\\b{clean_level}\\\\b"'

    return logql


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
    start_dt: Optional[datetime] = None,
    end_dt: Optional[datetime] = None,
    limit: int = 100,
) -> List[LogLine]:
    """
    Execute a bounded query against Loki and return structured LogLine schemas.
    Safely sanitizes text filters and maps stream records.
    Supports either relative `minutes` (from now) or explicit [start_dt, end_dt] window.
    """
    loki_url = settings.LOKI_URL.rstrip('/')
    url = f"{loki_url}/loki/api/v1/query_range"

    logql = build_logql_query(query_str=query_str, level=level, service=service)

    # Time boundaries (in nanoseconds)
    if start_dt is not None and end_dt is not None:
        s = start_dt if start_dt.tzinfo is not None else start_dt.replace(tzinfo=timezone.utc)
        e = end_dt if end_dt.tzinfo is not None else end_dt.replace(tzinfo=timezone.utc)
        start_ns = int(s.timestamp() * 1e9)
        end_ns = int(e.timestamp() * 1e9)
    else:
        now_ts = time.time()
        end_ns = int(now_ts * 1e9)
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
                dt = datetime.fromtimestamp(ts_sec, timezone.utc)

                # Detect severity level: prioritize stream label if present; fallback to regex
                detected_level = stream_labels.get("level")
                if not detected_level:
                    match = _LEVEL_REGEX.search(line_text)
                    if match:
                        raw_lvl = match.group(1).upper()
                        if raw_lvl in ("WARN", "WARNING"):
                            detected_level = "WARN"
                        elif raw_lvl in ("CRITICAL", "FATAL"):
                            detected_level = "ERROR"
                        else:
                            detected_level = raw_lvl
                    else:
                        detected_level = "INFO"
                else:
                    detected_level = detected_level.upper()
                    if detected_level == "WARNING":
                        detected_level = "WARN"

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
