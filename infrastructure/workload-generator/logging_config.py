import json
import logging
import sys
from datetime import datetime, timezone

# Configure standard logger to output raw json messages to stdout
logger = logging.getLogger("demo_app")
logger.setLevel(logging.INFO)

if not logger.handlers:
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(logging.Formatter("%(message)s"))
    logger.addHandler(handler)
    logger.propagate = False

def log_request(level: str, path: str, status: int, duration_ms: float, error_detail: str | None = None) -> None:
    """Emit a single structured JSON log record for an API request."""
    now_utc = datetime.now(timezone.utc).isoformat()
    record = {
        "time": now_utc,
        "level": level.upper(),
        "path": path,
        "status": status,
        "duration_ms": round(duration_ms, 2)
    }
    if error_detail:
        record["error"] = error_detail

    # Write as a single line JSON
    json_str = json.dumps(record)
    if level.upper() == "ERROR":
        logger.error(json_str)
    elif level.upper() == "WARNING":
        logger.warning(json_str)
    else:
        logger.info(json_str)
