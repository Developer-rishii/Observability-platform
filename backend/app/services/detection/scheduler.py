import logging
import math
from typing import Optional, Dict, Tuple, Any, List
from apscheduler.schedulers.background import BackgroundScheduler
from app.core.config import settings
from app.services.detection.threshold_checker import is_breach, calculate_severity

logger = logging.getLogger(__name__)

DETECTION_INTERVAL_SECONDS = settings.DETECTION_INTERVAL_SECONDS
JOB_ID = "detection_job"

scheduler: Optional[BackgroundScheduler] = None

# In-memory counter state across scheduler executions:
# Key: (server_id: Optional[int], metric_name: str)
# Value: {"breach_count": int, "recovery_count": int}
_consecutive_state: Dict[Tuple[Optional[int], str], Dict[str, int]] = {}


def get_consecutive_state() -> Dict[Tuple[Optional[int], str], Dict[str, int]]:
    """Return the global consecutive breach/recovery state tracker."""
    return _consecutive_state


def reset_consecutive_state() -> None:
    """Reset the global consecutive state tracker (used by tests or on shutdown)."""
    global _consecutive_state
    _consecutive_state.clear()


def evaluate_signal_check(
    state: Dict[str, int],
    value: Optional[float],
    threshold: float,
    has_open_incident: bool,
    n_required: int,
    m_required: int,
    inverse: bool = False,
    is_count: bool = False,
) -> Tuple[bool, bool, str]:
    """Pure logic evaluation for a single signal check.

    Returns:
        (should_open, should_resolve, action)
        where action is one of:
            - "missing" (value is None or invalid float, counters untouched)
            - "breach_increment" (breach occurred, breach counter incremented)
            - "open" (Nth consecutive breach, incident should be opened)
            - "breach_duplicate_prevented" (breach occurred while incident already open)
            - "normal_increment" (normal reading while incident open, recovery counter incremented)
            - "resolve" (Mth consecutive normal check, incident should be resolved)
            - "normal_idle" (normal reading with no open incident, breach counter reset)
    """
    if value is None or not isinstance(value, (int, float)) or math.isnan(value) or math.isinf(value):
        return False, False, "missing"

    breached = is_breach(value, threshold, inverse=inverse)

    if breached:
        state["recovery_count"] = 0
        state["breach_count"] = state.get("breach_count", 0) + 1

        if not has_open_incident:
            if state["breach_count"] >= n_required:
                return True, False, "open"
            return False, False, "breach_increment"
        else:
            return False, False, "breach_duplicate_prevented"
    else:
        state["breach_count"] = 0

        if has_open_incident:
            state["recovery_count"] = state.get("recovery_count", 0) + 1
            if state["recovery_count"] >= m_required:
                return False, True, "resolve"
            return False, False, "normal_increment"
        else:
            state["recovery_count"] = 0
            return False, False, "normal_idle"


def _query_container_restarts(db: Any, server_id: Optional[int], window_minutes: int) -> Optional[float]:
    """Query container restart event count from the events table within the observation window."""
    from datetime import datetime, timedelta
    from app.models.models import Event

    try:
        cutoff = datetime.utcnow() - timedelta(minutes=window_minutes)
        query = db.query(Event).filter(
            Event.timestamp >= cutoff,
            Event.event_type == "container.restart",
        )
        if server_id is not None:
            query = query.filter(Event.server_id == server_id)
        return float(query.count())
    except Exception as e:
        logger.warning(f"Failed to query container restart events from DB: {e}")
        return None


def _get_metric_reading(db: Any, metric: str, server_id: Optional[int]) -> Optional[float]:
    """Fetch the latest scalar reading for a metric from Prometheus or Postgres events table."""
    from app.services.ingestion.prometheus_client import query_range

    if metric == "container_restart":
        window_min = getattr(settings, "CONTAINER_RESTART_WINDOW_MINUTES", 15)
        return _query_container_restarts(db, server_id, window_min)

    points = query_range(metric, minutes=1)
    if not points:
        return None
    val = points[-1].get("v")
    if val is None or not isinstance(val, (int, float)) or math.isnan(val) or math.isinf(val):
        return None
    return float(val)


def detection_job():
    """Periodic detection job evaluating all signals with consecutive-check logic."""
    from app.repositories.incident_repository import (
        get_open_incident_for_metric,
        create_incident,
        resolve_incident,
    )
    from app.core.database import SessionLocal

    n_breaches = getattr(settings, "DETECTION_CONSECUTIVE_BREACHES", 3)
    m_recovery = getattr(settings, "DETECTION_RECOVERY_CHECKS", 3)

    # Configured signals: (metric_name, threshold, inverse, is_count, default_server_id, affected_service)
    signals = [
        ("cpu", settings.CPU_THRESHOLD_PCT, False, False, None, "primary-host"),
        ("memory", settings.MEM_THRESHOLD_PCT, False, False, None, "primary-host"),
        ("disk", settings.DISK_THRESHOLD_PCT, False, False, None, "primary-host"),
        ("latency_p95", getattr(settings, "LATENCY_P95_THRESHOLD_SECONDS", 0.5), False, False, None, "workload-generator"),
        ("error_rate", getattr(settings, "ERROR_RATE_THRESHOLD_PCT", 5.0), False, False, None, "workload-generator"),
        ("container_restart", float(getattr(settings, "CONTAINER_RESTART_THRESHOLD", 1)), False, True, None, "docker-daemon"),
        ("demo_data_dir_bytes", getattr(settings, "DEMO_DATA_DIR_BYTES_THRESHOLD", 104857600.0), False, False, None, "workload-generator"),
    ]

    db = SessionLocal()
    try:
        for metric, threshold, inverse, is_count, server_id, affected_service in signals:
            state_key = (server_id, metric)
            if state_key not in _consecutive_state:
                _consecutive_state[state_key] = {"breach_count": 0, "recovery_count": 0}
            state = _consecutive_state[state_key]

            # 1. Check existing open incident
            open_inc = get_open_incident_for_metric(db, metric, server_id=server_id)
            has_open_incident = open_inc is not None

            # 2. Get reading
            value = _get_metric_reading(db, metric, server_id)
            if value is None or math.isnan(value) or math.isinf(value):
                logger.warning(
                    f"Detection check: missing or invalid data for metric '{metric}' (server: {server_id}). Skipping check."
                )
                continue

            # 3. Evaluate logic
            should_open, should_resolve, action = evaluate_signal_check(
                state=state,
                value=value,
                threshold=threshold,
                has_open_incident=has_open_incident,
                n_required=n_breaches,
                m_required=m_recovery,
                inverse=inverse,
                is_count=is_count,
            )

            # 4. Enact actions
            if should_open and not has_open_incident:
                severity = calculate_severity(value, threshold, inverse=inverse, is_count=is_count)
                create_incident(
                    db=db,
                    metric_name=metric,
                    metric_value=value,
                    threshold=threshold,
                    server_id=server_id,
                    affected_service=affected_service,
                    severity=severity,
                )
                logger.info(
                    f"Opened incident for {metric} (server: {server_id}): observed {value:.2f} > threshold {threshold:.2f} "
                    f"after {n_breaches} consecutive breaches. Severity: {severity}"
                )
            elif should_resolve and open_inc:
                resolve_incident(db, open_inc)
                logger.info(
                    f"Resolved incident {open_inc.id} for {metric} (server: {server_id}) after {m_recovery} "
                    f"consecutive normal checks."
                )
    except Exception as e:
        logger.error(f"Error in detection_job: {e}", exc_info=True)
    finally:
        db.close()


def _register_job(sched: BackgroundScheduler) -> None:
    """Register the periodic detection job on the scheduler if not present."""
    if not sched.get_job(JOB_ID):
        sched.add_job(
            detection_job,
            trigger="interval",
            seconds=DETECTION_INTERVAL_SECONDS,
            id=JOB_ID,
            replace_existing=True,
        )


def get_scheduler() -> BackgroundScheduler:
    """Return the active BackgroundScheduler, initializing one if none exists."""
    global scheduler
    if scheduler is None:
        scheduler = BackgroundScheduler()
        _register_job(scheduler)
    return scheduler


def start_scheduler() -> BackgroundScheduler:
    """Start the detection scheduler and register the periodic detection job."""
    sched = get_scheduler()
    _register_job(sched)
    if not sched.running:
        sched.start()
    return sched


def stop_scheduler(wait: bool = False) -> None:
    """Stop the detection scheduler cleanly if running and reset state."""
    global scheduler
    if scheduler is not None:
        if scheduler.running:
            scheduler.shutdown(wait=wait)
        scheduler = None
