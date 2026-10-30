import os
import json
import logging
import math
import time
from datetime import datetime, timedelta
from logging.handlers import RotatingFileHandler
from typing import Optional, Dict, Tuple, Any, List

from apscheduler.schedulers.background import BackgroundScheduler
from app.core.config import settings
from app.services.detection.threshold_checker import is_breach, calculate_severity
from app.ml.inference import AnomalyDetector
from app.ml.features import (
    FEATURE_NAMES,
    get_feature_queries,
    build_feature_vector,
)

logger = logging.getLogger(__name__)

DETECTION_INTERVAL_SECONDS = settings.DETECTION_INTERVAL_SECONDS
JOB_ID = "detection_job"

scheduler: Optional[BackgroundScheduler] = None

# Human-readable labels for top anomalous ML features
FEATURE_TITLES: Dict[str, str] = {
    "latency_p95_std_5m": "Latency Spike (P95 Variance)",
    "latency_p95_mean_5m": "High Latency (P95 Mean)",
    "cpu_pct_mean_5m": "CPU Stress (High Utilization)",
    "cpu_pct_std_5m": "CPU Fluctuation (High Variance)",
    "error_rate_5m": "HTTP Error Storm (5xx Rate)",
    "request_rate_mean_5m": "Traffic Anomaly (Unusual Request Rate)",
    "container_die_count_15m": "Container Restarts / Crashes",
    "data_dir_growth_5m": "Rapid Storage Growth (Disk Fill)",
}

# Initialize ML Anomaly Detector
detector: AnomalyDetector = AnomalyDetector(model_dir=getattr(settings, "MODEL_PATH", "/models"))
_ml_initialized: bool = False
_ml_init_logged: bool = False

# Setup trace logger for ML detections
TRACE_LOGGER_NAME = "ml_detection_trace"
_trace_logger: Optional[logging.Logger] = None


def get_trace_logger() -> logging.Logger:
    """Return a rotating file logger dedicated to ml/traces/detection_trace.jsonl."""
    global _trace_logger
    if _trace_logger is not None:
        return _trace_logger

    trace_log = logging.getLogger(TRACE_LOGGER_NAME)
    trace_log.setLevel(logging.INFO)
    trace_log.propagate = False  # Do not pollute root logger

    # Resolve trace file location (container: /traces/detection_trace.jsonl or local: ml/traces/...)
    trace_dir = "/traces" if os.path.exists("/traces") else os.path.join(os.getcwd(), "ml", "traces")
    os.makedirs(trace_dir, exist_ok=True)
    trace_file = os.path.join(trace_dir, "detection_trace.jsonl")

    # Rotating handler: 5MB max, 3 backups
    handler = RotatingFileHandler(trace_file, maxBytes=5 * 1024 * 1024, backupCount=3, encoding="utf-8")
    handler.setFormatter(logging.Formatter("%(message)s"))
    trace_log.addHandler(handler)
    _trace_logger = trace_log
    return _trace_logger


def init_detector() -> bool:
    """Attempt to load the AnomalyDetector if DETECTION_MODE == 'ml'."""
    global _ml_initialized, _ml_init_logged
    mode = getattr(settings, "DETECTION_MODE", "ml").lower()

    if mode == "ml":
        if not detector.is_loaded:
            loaded = detector.load()
            if loaded:
                if not _ml_init_logged:
                    logger.info(
                        f"ML AnomalyDetector initialized and loaded successfully from {detector.model_dir} "
                        f"(version: {detector.model_version}, threshold: {detector.threshold:.4f})"
                    )
                    _ml_init_logged = True
                _ml_initialized = True
                return True
            else:
                if not _ml_init_logged:
                    logger.warning(
                        f"DETECTION_MODE is 'ml' but AnomalyDetector failed to load from {detector.model_dir}. "
                        f"Falling back cleanly to static threshold detection."
                    )
                    _ml_init_logged = True
                _ml_initialized = False
                return False
        return True
    else:
        if not _ml_init_logged:
            logger.info(f"DETECTION_MODE is set to '{mode}'. Using static threshold detection path.")
            _ml_init_logged = True
        return False


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
    """Pure logic evaluation for a single signal check."""
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


def _query_prometheus_series(query: str, start_ts: int, end_ts: int, step: str = "15s") -> List[float]:
    """Query Prometheus range directly returning float values for the series."""
    import urllib.request
    import urllib.parse

    prom_url = settings.PROMETHEUS_URL.rstrip('/')
    url = f"{prom_url}/api/v1/query_range?query={urllib.parse.quote(query)}&start={start_ts}&end={end_ts}&step={step}"
    req = urllib.request.Request(url, headers={"User-Agent": "Observability-Detector/1.0"})
    with urllib.request.urlopen(req, timeout=5.0) as resp:
        data = json.loads(resp.read().decode("utf-8"))
        results = data.get("data", {}).get("result", [])
        if not results:
            return []
        values = results[0].get("values", [])
        return [float(v[1]) for v in values if v[1] is not None]


def _query_container_events(db: Any, start_dt: datetime, end_dt: datetime) -> float:
    """Query container.die and container.oom counts from PostgreSQL events table."""
    from app.models.models import Event
    try:
        count = db.query(Event).filter(
            Event.timestamp >= start_dt,
            Event.timestamp <= end_dt,
            Event.event_type.in_(["container.die", "container.oom"]),
        ).count()
        return float(count)
    except Exception as exc:
        logger.warning(f"Error querying container die/oom events: {exc}")
        return 0.0


# In-memory watermark tracking for container die/oom events
_last_seen_event_id: Optional[int] = None


def get_last_seen_event_id() -> Optional[int]:
    """Return the current watermark event ID for rule guard container tracking."""
    return _last_seen_event_id


def set_last_seen_event_id(val: Optional[int]) -> None:
    """Set the watermark event ID (used on init or testing)."""
    global _last_seen_event_id
    _last_seen_event_id = val


def _init_event_watermark_if_needed(db: Any) -> None:
    """Initialise the last-seen watermark at startup to the latest existing event."""
    global _last_seen_event_id
    if _last_seen_event_id is None:
        try:
            from app.models.models import Event
            from sqlalchemy import func
            max_id = db.query(func.max(Event.id)).scalar()
            _last_seen_event_id = max_id if max_id is not None else 0
            logger.info(f"Initialized container event watermark at startup: event_id={_last_seen_event_id}")
        except Exception as exc:
            logger.warning(f"Failed to initialize container event watermark: {exc}")
            _last_seen_event_id = 0


def _evaluate_rule_guards(
    db: Any,
    features: Optional[List[float]],
    n_breaches: int,
    m_recovery: int,
) -> None:
    """Evaluate deterministic rule guards (detection_source='rule').
    
    Guards:
    1. error_rate_5m > settings.ERROR_RATE_THRESHOLD_PCT for 3 consecutive cycles.
       Auto-resolve: 3 consecutive cycles under threshold.
    2. data_dir_growth_5m >= 26214400 bytes (positive growth only).
       Auto-resolve: 3 consecutive cycles under growth threshold.
    3. container.die/container.oom: fire once per new event above the startup watermark.
       Auto-resolve: immediate acknowledgment on creation (closed/resolved) to prevent stale open states.
    """
    from app.repositories.incident_repository import (
        get_open_incident_for_metric,
        create_incident,
        resolve_incident,
    )
    from app.models.models import Event

    _init_event_watermark_if_needed(db)

    # ------------------------------------------------------------------
    # Guard 1: error_rate_5m (index 4 in FEATURE_NAMES)
    # ------------------------------------------------------------------
    error_threshold = float(getattr(settings, "ERROR_RATE_THRESHOLD_PCT", 5.0))
    error_metric = "error_rate_5m"
    state_key_err = (None, error_metric)
    if state_key_err not in _consecutive_state:
        _consecutive_state[state_key_err] = {"breach_count": 0, "recovery_count": 0}
    state_err = _consecutive_state[state_key_err]
    open_inc_err = get_open_incident_for_metric(db, error_metric, server_id=None)

    if features is not None:
        error_val = features[4]
        if error_val > error_threshold:
            state_err["recovery_count"] = 0
            state_err["breach_count"] = state_err.get("breach_count", 0) + 1
            if state_err["breach_count"] >= n_breaches and not open_inc_err:
                create_incident(
                    db=db,
                    metric_name=error_metric,
                    metric_value=error_val,
                    threshold=error_threshold,
                    server_id=None,
                    affected_service="demo-app",
                    severity="high",
                    description=(
                        f"Rule Guard: error rate {error_val:.2f}% exceeded "
                        f"threshold {error_threshold:.2f}% for {n_breaches} consecutive cycles."
                    ),
                    detection_source="rule",
                    anomaly_score=None,
                    affected_metrics=[error_metric],
                    title=f"Rule Guard: High Error Rate ({error_val:.1f}%) on demo-app",
                )
                logger.info(f"Opened Rule Guard incident for {error_metric}: {error_val:.2f}% > {error_threshold:.2f}%")
        else:
            state_err["breach_count"] = 0
            if open_inc_err:
                state_err["recovery_count"] = state_err.get("recovery_count", 0) + 1
                if state_err["recovery_count"] >= m_recovery:
                    resolve_incident(db, open_inc_err)
                    logger.info(f"Resolved Rule Guard incident for {error_metric} after {m_recovery} normal cycles.")
            else:
                state_err["recovery_count"] = 0

    # ------------------------------------------------------------------
    # Guard 2: data_dir_growth_5m (index 7 in FEATURE_NAMES) >= 26214400 bytes
    # ------------------------------------------------------------------
    disk_growth_threshold = 26214400.0  # 25MB
    growth_metric = "data_dir_growth_5m"
    state_key_growth = (None, growth_metric)
    if state_key_growth not in _consecutive_state:
        _consecutive_state[state_key_growth] = {"breach_count": 0, "recovery_count": 0}
    state_growth = _consecutive_state[state_key_growth]
    open_inc_growth = get_open_incident_for_metric(db, growth_metric, server_id=None)

    if features is not None:
        growth_val = features[7]
        # Positive growth only
        if growth_val >= disk_growth_threshold:
            state_growth["recovery_count"] = 0
            state_growth["breach_count"] = state_growth.get("breach_count", 0) + 1
            if not open_inc_growth:
                create_incident(
                    db=db,
                    metric_name=growth_metric,
                    metric_value=growth_val,
                    threshold=disk_growth_threshold,
                    server_id=None,
                    affected_service="demo-app",
                    severity="critical" if growth_val >= 52428800.0 else "high",
                    description=(
                        f"Rule Guard: data directory growth of {growth_val / (1024 * 1024):.1f}MB "
                        f"in 5m exceeded threshold {disk_growth_threshold / (1024 * 1024):.1f}MB."
                    ),
                    detection_source="rule",
                    anomaly_score=None,
                    affected_metrics=[growth_metric],
                    title=f"Rule Guard: Rapid Storage Growth ({growth_val / (1024 * 1024):.1f}MB / 5m)",
                )
                logger.info(f"Opened Rule Guard incident for {growth_metric}: {growth_val} bytes")
        else:
            state_growth["breach_count"] = 0
            if open_inc_growth:
                state_growth["recovery_count"] = state_growth.get("recovery_count", 0) + 1
                if state_growth["recovery_count"] >= m_recovery:
                    resolve_incident(db, open_inc_growth)
                    logger.info(f"Resolved Rule Guard incident for {growth_metric} after {m_recovery} normal cycles.")
            else:
                state_growth["recovery_count"] = 0

    # ------------------------------------------------------------------
    # Guard 3: container.die / container.oom events
    # ------------------------------------------------------------------
    global _last_seen_event_id
    if _last_seen_event_id is not None:
        try:
            new_events = db.query(Event).filter(
                Event.id > _last_seen_event_id,
                Event.event_type.in_(["container.die", "container.oom"]),
            ).order_by(Event.id.asc()).all()

            for ev in new_events:
                payload = ev.payload or {}
                c_name = payload.get("container_name") or payload.get("Actor", {}).get("Attributes", {}).get("name") or "unknown"
                desc = (
                    f"Rule Guard: {ev.event_type} event detected for container '{c_name}' "
                    f"(event_id: {ev.id})."
                )
                inc = create_incident(
                    db=db,
                    metric_name=ev.event_type,
                    metric_value=1.0,
                    threshold=1.0,
                    server_id=ev.server_id,
                    affected_service=c_name,
                    severity="critical" if ev.event_type == "container.oom" else "high",
                    description=desc,
                    detection_source="rule",
                    anomaly_score=None,
                    affected_metrics=[ev.event_type],
                    title=f"Rule Guard: Container Crash ({ev.event_type}) on {c_name}",
                )
                # Auto-resolve definition: Event-based incidents represent point-in-time state transitions;
                # auto-resolve after 3 consecutive normal cycles (m_recovery) where no new die/oom events occur.
                # Initialize state for this event type
                event_state_key = (ev.server_id, ev.event_type)
                _consecutive_state[event_state_key] = {"breach_count": 0, "recovery_count": 0}
                _last_seen_event_id = ev.id
                logger.info(f"Opened Rule Guard incident #{inc.id} for {ev.event_type} on container {c_name}")
            
            if not new_events:
                # Check for open container event incidents and resolve them after m_recovery normal cycles
                for ev_type in ["container.die", "container.oom"]:
                    open_ev_inc = get_open_incident_for_metric(db, ev_type, server_id=None)
                    if open_ev_inc:
                        ev_key = (None, ev_type)
                        if ev_key not in _consecutive_state:
                            _consecutive_state[ev_key] = {"breach_count": 0, "recovery_count": 0}
                        ev_st = _consecutive_state[ev_key]
                        ev_st["recovery_count"] = ev_st.get("recovery_count", 0) + 1
                        if ev_st["recovery_count"] >= m_recovery:
                            resolve_incident(db, open_ev_inc)
                            logger.info(f"Resolved Rule Guard incident for {ev_type} after {m_recovery} quiet cycles.")

        except Exception as exc:
            logger.warning(f"Error checking new container die/oom events for rule guard: {exc}")


def _run_ml_detection_cycle(db: Any, n_breaches: int, m_recovery: int) -> bool:
    """Execute one 15s ML anomaly detection cycle with integrated Rule Guards.
    
    Returns True if cycle executed successfully (or gracefully skipped),
    or False if an unrecoverable failure occurred.
    """
    from app.repositories.incident_repository import (
        get_open_incident_for_metric,
        create_incident,
        resolve_incident,
    )

    state_key = (None, "anomaly_score")
    if state_key not in _consecutive_state:
        _consecutive_state[state_key] = {"breach_count": 0, "recovery_count": 0}
    state = _consecutive_state[state_key]

    open_inc = get_open_incident_for_metric(db, "anomaly_score", server_id=None)
    has_open_incident = open_inc is not None

    now_dt = datetime.utcnow()
    end_ts = int(time.time())
    start_ts = end_ts - 300  # 5-minute rolling window
    start_dt = now_dt - timedelta(minutes=5)

    # 1. Query Prometheus queries from features.py
    queries = get_feature_queries()
    try:
        cpu_series = _query_prometheus_series(queries["cpu"], start_ts, end_ts)
        latency_series = _query_prometheus_series(queries["latency_p95"], start_ts, end_ts)
        req_total_series = _query_prometheus_series(queries["requests_total"], start_ts, end_ts)
        req_5xx_series = _query_prometheus_series(queries["requests_5xx"], start_ts, end_ts)
        data_dir_series = _query_prometheus_series(queries["data_dir_bytes"], start_ts, end_ts)
    except Exception as exc:
        logger.warning(f"Failed to query Prometheus for ML features: {exc}")
        # Reset breach counter on skipped cycle
        state["breach_count"] = 0
        return False

    # 2. Container die/oom count over 15 minutes
    events_15m_dt = now_dt - timedelta(minutes=15)
    container_dies = _query_container_events(db, events_15m_dt, now_dt)

    # 3. Build 8-feature vector
    features = build_feature_vector(
        cpu_series=cpu_series,
        latency_series=latency_series,
        requests_5xx_series=req_5xx_series,
        requests_total_series=req_total_series,
        data_dir_series=data_dir_series,
        container_die_count_15m=container_dies,
    )

    # 4. Evaluate Rule Guards (hybrid deterministic detection)
    _evaluate_rule_guards(db, features, n_breaches, m_recovery)

    trace_log = get_trace_logger()
    timestamp_iso = now_dt.isoformat() + "Z"

    if features is None:
        # Incomplete feature window (< 12 points) -> reset breach count per plan
        state["breach_count"] = 0
        trace_record = {
            "timestamp": timestamp_iso,
            "features": None,
            "score": None,
            "threshold": detector.threshold,
            "breach_count": state["breach_count"],
            "decision": "skip_insufficient_points",
        }
        trace_log.info(json.dumps(trace_record))
        return True

    # 5. Score via AnomalyDetector
    result = detector.score(features)
    score = result.get("score", 0.0)
    threshold = detector.threshold
    is_anomaly = result.get("is_anomaly", False)
    top_features = result.get("top_features", [])

    # 6. Evaluate consecutive-breach / recovery logic
    decision = "normal"
    if is_anomaly:
        state["recovery_count"] = 0
        state["breach_count"] = state.get("breach_count", 0) + 1

        if not has_open_incident:
            if state["breach_count"] >= n_breaches:
                severity = "critical" if score > (threshold + 0.1) else "high"
                affected_names = [f["name"] for f in top_features]
                top_signal_name = affected_names[0] if affected_names else "telemetry"
                signal_label = FEATURE_TITLES.get(top_signal_name)
                if not signal_label:
                    signal_label = f"{top_signal_name.replace('_', ' ').title()} Deviation"
                inc_title = f"High Anomaly: {signal_label}"
                desc = (
                    f"ML Anomaly detected (score: {score:.4f} >= threshold: {threshold:.4f}). "
                    f"Top contributing signals: {', '.join(affected_names)}."
                )
                create_incident(
                    db=db,
                    metric_name="anomaly_score",
                    metric_value=score,
                    threshold=threshold,
                    server_id=None,
                    affected_service="demo-app",
                    severity=severity,
                    description=desc,
                    detection_source="ml",
                    anomaly_score=score,
                    affected_metrics=affected_names,
                    title=inc_title,
                )
                decision = "opened_incident"
                logger.info(
                    f"Opened ML Anomaly incident (score: {score:.4f} >= threshold: {threshold:.4f}, "
                    f"severity: {severity}) after {n_breaches} consecutive breaches."
                )
            else:
                decision = f"breach_count_{state['breach_count']}"
        else:
            decision = "breach_duplicate_prevented"
    else:
        # Non-breach: reset breach counter
        state["breach_count"] = 0

        if has_open_incident:
            state["recovery_count"] = state.get("recovery_count", 0) + 1
            if state["recovery_count"] >= m_recovery:
                resolve_incident(db, open_inc)
                decision = "resolved_incident"
                logger.info(
                    f"Resolved ML Anomaly incident {open_inc.id} after {m_recovery} consecutive normal checks."
                )
            else:
                decision = f"recovery_count_{state['recovery_count']}"
        else:
            state["recovery_count"] = 0
            decision = "normal_idle"

    # 7. Log trace record to detection_trace.jsonl and normal logger at DEBUG
    feature_dict = {FEATURE_NAMES[i]: features[i] for i in range(len(features))}
    trace_record = {
        "timestamp": timestamp_iso,
        "features": feature_dict,
        "score": round(score, 4),
        "threshold": round(threshold, 4),
        "breach_count": state["breach_count"],
        "decision": decision,
        "top_features": top_features,
    }
    trace_log.info(json.dumps(trace_record))
    logger.debug(
        f"ML Detection Cycle: score={score:.4f}, threshold={threshold:.4f}, "
        f"breach_count={state['breach_count']}, decision='{decision}'"
    )
    return True


def _run_static_detection_cycle(db: Any, n_breaches: int, m_recovery: int) -> None:
    """Run standard static threshold detection across configured signals."""
    from app.repositories.incident_repository import (
        get_open_incident_for_metric,
        create_incident,
        resolve_incident,
    )

    signals = [
        ("cpu", settings.CPU_THRESHOLD_PCT, False, False, None, "primary-host"),
        ("memory", settings.MEM_THRESHOLD_PCT, False, False, None, "primary-host"),
        ("disk", settings.DISK_THRESHOLD_PCT, False, False, None, "primary-host"),
        ("latency_p95", getattr(settings, "LATENCY_P95_THRESHOLD_SECONDS", 0.5), False, False, None, "workload-generator"),
        ("error_rate", getattr(settings, "ERROR_RATE_THRESHOLD_PCT", 5.0), False, False, None, "workload-generator"),
        ("container_restart", float(getattr(settings, "CONTAINER_RESTART_THRESHOLD", 1)), False, True, None, "docker-daemon"),
        ("demo_data_dir_bytes", getattr(settings, "DEMO_DATA_DIR_BYTES_THRESHOLD", 104857600.0), False, False, None, "workload-generator"),
    ]

    for metric, threshold, inverse, is_count, server_id, affected_service in signals:
        state_key = (server_id, metric)
        if state_key not in _consecutive_state:
            _consecutive_state[state_key] = {"breach_count": 0, "recovery_count": 0}
        state = _consecutive_state[state_key]

        open_inc = get_open_incident_for_metric(db, metric, server_id=server_id)
        has_open_incident = open_inc is not None

        value = _get_metric_reading(db, metric, server_id)
        if value is None or math.isnan(value) or math.isinf(value):
            logger.warning(
                f"Detection check: missing or invalid data for metric '{metric}' (server: {server_id}). Skipping check."
            )
            continue

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

        if should_open and not has_open_incident:
            severity = calculate_severity(value, threshold, inverse=inverse, is_count=is_count)
            STATIC_TITLES = {
                "cpu": "High CPU Utilization Breach",
                "memory": "High Memory Utilization Breach",
                "disk": "High Disk Space Breach",
                "latency_p95": "High Latency (P95) Breach",
                "error_rate": "High HTTP Error Rate Breach",
                "container_restart": "Container Restart Breach",
                "demo_data_dir_bytes": "Data Directory Storage Breach",
            }
            s_title = STATIC_TITLES.get(metric, f"High {metric} breach")
            if server_id:
                s_title += f" on server {server_id}"
            create_incident(
                db=db,
                metric_name=metric,
                metric_value=value,
                threshold=threshold,
                server_id=server_id,
                affected_service=affected_service,
                severity=severity,
                detection_source="threshold",
                affected_metrics=[metric],
                title=s_title,
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


def detection_job():
    """Periodic detection job evaluating signals with consecutive-check logic."""
    from app.core.database import SessionLocal

    n_breaches = getattr(settings, "DETECTION_CONSECUTIVE_BREACHES", 3)
    m_recovery = getattr(settings, "DETECTION_RECOVERY_CHECKS", 3)

    db = SessionLocal()
    try:
        use_ml = init_detector()
        if use_ml:
            _run_ml_detection_cycle(db, n_breaches, m_recovery)
        else:
            _run_static_detection_cycle(db, n_breaches, m_recovery)
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
