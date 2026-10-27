import threading
import pytest
from apscheduler.events import EVENT_JOB_EXECUTED
from app.services.detection.scheduler import (
    DETECTION_INTERVAL_SECONDS,
    JOB_ID,
    detection_job,
    get_scheduler,
    start_scheduler,
    stop_scheduler,
)


@pytest.fixture(autouse=True)
def clean_scheduler_state():
    """Ensure the scheduler is cleanly stopped before and after every test."""
    stop_scheduler(wait=False)
    yield
    stop_scheduler(wait=False)


def test_job_is_registered():
    """Verify that the 15-second detection job is properly registered."""
    sched = get_scheduler()
    job = sched.get_job(JOB_ID)
    assert job is not None, f"Job with ID '{JOB_ID}' should be registered"
    assert job.trigger.interval.total_seconds() == 15.0
    assert DETECTION_INTERVAL_SECONDS == 15
    assert job.func is detection_job


def test_scheduler_starts_and_stops_cleanly():
    """Verify that the scheduler can start and stop cleanly."""
    sched = start_scheduler()
    try:
        assert sched.running is True
        job = sched.get_job(JOB_ID)
        assert job is not None
    finally:
        stop_scheduler(wait=False)
        assert sched.running is False


def test_job_executes_at_least_once_within_20_seconds():
    """Verify that the scheduled job executes at least once within 20 seconds.

    A deterministic threading.Event is triggered via APScheduler's
    EVENT_JOB_EXECUTED listener when the 15-second job runs.
    The Prometheus client and DB session are mocked so this works without
    a live Prometheus instance.
    """
    from unittest.mock import patch, MagicMock

    sched = get_scheduler()
    job_executed = threading.Event()
    execution_counter = 0

    def on_job_executed(event):
        nonlocal execution_counter
        if event.job_id == JOB_ID:
            execution_counter += 1
            job_executed.set()

    sched.add_listener(on_job_executed, EVENT_JOB_EXECUTED)

    mock_db = MagicMock()
    mock_session_cls = MagicMock(return_value=mock_db)

    try:
        with (
            patch(
                "app.services.ingestion.prometheus_client.query_range",
                return_value=[],  # no data → no incident created
            ),
            patch(
                "app.core.database.SessionLocal",
                mock_session_cls,
            ),
        ):
            start_scheduler()
            assert sched.running is True

            # Wait up to 20 seconds for the 15-second interval job to fire
            fired = job_executed.wait(timeout=20)
            assert fired is True, "Expected detection job to fire at least once within 20 seconds"
            assert execution_counter >= 1, "Execution counter should be at least 1"
    finally:
        sched.remove_listener(on_job_executed)
        stop_scheduler(wait=False)
        assert sched.running is False


# ---------------------------------------------------------------------------
# Phase 5: Pure-Logic Consecutive Breach, Recovery, and Signal Tests
# ---------------------------------------------------------------------------

def test_consecutive_breach_counting_and_opening():
    """1. Fewer than N breaches do not open an incident; the Nth consecutive breach does."""
    from app.services.detection.scheduler import evaluate_signal_check

    state = {"breach_count": 0, "recovery_count": 0}
    n = 3
    m = 3

    # Check 1: 1st breach -> breach_count becomes 1, do not open
    should_open, should_resolve, action = evaluate_signal_check(
        state, value=85.0, threshold=80.0, has_open_incident=False, n_required=n, m_required=m
    )
    assert should_open is False
    assert should_resolve is False
    assert action == "breach_increment"
    assert state["breach_count"] == 1

    # Check 2: 2nd breach -> breach_count becomes 2, do not open
    should_open, should_resolve, action = evaluate_signal_check(
        state, value=86.0, threshold=80.0, has_open_incident=False, n_required=n, m_required=m
    )
    assert should_open is False
    assert should_resolve is False
    assert action == "breach_increment"
    assert state["breach_count"] == 2

    # Check 3: 3rd breach -> breach_count reaches N=3, triggers open
    should_open, should_resolve, action = evaluate_signal_check(
        state, value=88.0, threshold=80.0, has_open_incident=False, n_required=n, m_required=m
    )
    assert should_open is True
    assert should_resolve is False
    assert action == "open"
    assert state["breach_count"] == 3


def test_counter_reset_on_normal_check():
    """2. A normal check breaks a breach sequence and resets breach counter."""
    from app.services.detection.scheduler import evaluate_signal_check

    state = {"breach_count": 2, "recovery_count": 0}
    n = 3
    m = 3

    # Normal reading (70 <= 80)
    should_open, should_resolve, action = evaluate_signal_check(
        state, value=70.0, threshold=80.0, has_open_incident=False, n_required=n, m_required=m
    )
    assert should_open is False
    assert should_resolve is False
    assert action == "normal_idle"
    assert state["breach_count"] == 0

    # Next breach starts back from 1
    should_open, _, _ = evaluate_signal_check(
        state, value=85.0, threshold=80.0, has_open_incident=False, n_required=n, m_required=m
    )
    assert should_open is False
    assert state["breach_count"] == 1


def test_consecutive_recovery_and_resolution():
    """3. Fewer than M normal checks do not resolve an incident; the Mth consecutive normal check resolves it."""
    from app.services.detection.scheduler import evaluate_signal_check

    state = {"breach_count": 3, "recovery_count": 0}
    n = 3
    m = 3

    # Normal check 1: recovery_count = 1
    should_open, should_resolve, action = evaluate_signal_check(
        state, value=75.0, threshold=80.0, has_open_incident=True, n_required=n, m_required=m
    )
    assert should_open is False
    assert should_resolve is False
    assert action == "normal_increment"
    assert state["recovery_count"] == 1

    # Normal check 2: recovery_count = 2
    should_open, should_resolve, action = evaluate_signal_check(
        state, value=74.0, threshold=80.0, has_open_incident=True, n_required=n, m_required=m
    )
    assert should_open is False
    assert should_resolve is False
    assert action == "normal_increment"
    assert state["recovery_count"] == 2

    # Normal check 3: recovery_count = 3 -> triggers resolve
    should_open, should_resolve, action = evaluate_signal_check(
        state, value=72.0, threshold=80.0, has_open_incident=True, n_required=n, m_required=m
    )
    assert should_open is False
    assert should_resolve is True
    assert action == "resolve"
    assert state["recovery_count"] == 3


def test_recovery_counter_reset_on_breach():
    """4. Recovery counter resets to 0 when a breach occurs while incident is open."""
    from app.services.detection.scheduler import evaluate_signal_check

    state = {"breach_count": 0, "recovery_count": 2}
    n = 3
    m = 3

    # Breach occurs while incident is open
    should_open, should_resolve, action = evaluate_signal_check(
        state, value=90.0, threshold=80.0, has_open_incident=True, n_required=n, m_required=m
    )
    assert should_open is False
    assert should_resolve is False
    assert action == "breach_duplicate_prevented"
    assert state["recovery_count"] == 0


def test_missing_data_handling():
    """5. Missing data (None, NaN, inf) logged and skipped without incrementing counters or creating/resolving incidents."""
    import math
    from app.services.detection.scheduler import evaluate_signal_check

    state = {"breach_count": 2, "recovery_count": 1}

    for invalid_val in [None, float("nan"), float("inf"), float("-inf")]:
        should_open, should_resolve, action = evaluate_signal_check(
            state, value=invalid_val, threshold=80.0, has_open_incident=False, n_required=3, m_required=3
        )
        assert should_open is False
        assert should_resolve is False
        assert action == "missing"
        # Counters must remain untouched
        assert state["breach_count"] == 2
        assert state["recovery_count"] == 1


def test_duplicate_prevention_while_incident_open():
    """6. Repeated breaches while an incident is open create no additional incident."""
    from app.services.detection.scheduler import evaluate_signal_check

    state = {"breach_count": 3, "recovery_count": 0}

    for _ in range(5):
        should_open, should_resolve, action = evaluate_signal_check(
            state, value=95.0, threshold=80.0, has_open_incident=True, n_required=3, m_required=3
        )
        assert should_open is False
        assert should_resolve is False
        assert action == "breach_duplicate_prevented"


def test_server_and_metric_isolation():
    """7. Server + metric combinations remain independent in state tracking."""
    from app.services.detection.scheduler import get_consecutive_state, reset_consecutive_state, evaluate_signal_check

    reset_consecutive_state()
    global_state = get_consecutive_state()

    s1_cpu = (1, "cpu")
    s2_cpu = (2, "cpu")
    s1_mem = (1, "memory")

    global_state[s1_cpu] = {"breach_count": 0, "recovery_count": 0}
    global_state[s2_cpu] = {"breach_count": 0, "recovery_count": 0}
    global_state[s1_mem] = {"breach_count": 0, "recovery_count": 0}

    # Breach only s1_cpu
    evaluate_signal_check(global_state[s1_cpu], 85.0, 80.0, False, 3, 3)
    evaluate_signal_check(global_state[s1_cpu], 85.0, 80.0, False, 3, 3)

    assert global_state[s1_cpu]["breach_count"] == 2
    assert global_state[s2_cpu]["breach_count"] == 0
    assert global_state[s1_mem]["breach_count"] == 0


def test_container_restart_threshold_boundaries():
    """Verify restart threshold semantics: strict > behavior.
    With threshold = 1.0:
    - 0 restarts: normal (not breach)
    - 1 restart: at threshold (not breach)
    - 2 restarts: strictly > 1 (breach)
    """
    from app.services.detection.scheduler import evaluate_signal_check

    state = {"breach_count": 0, "recovery_count": 0}
    threshold = 1.0

    # 1 restart does NOT breach
    _, _, action1 = evaluate_signal_check(
        state, value=1.0, threshold=threshold, has_open_incident=False, n_required=3, m_required=3, is_count=True
    )
    assert action1 == "normal_idle"
    assert state["breach_count"] == 0

    # 2 restarts strictly breaches
    _, _, action2 = evaluate_signal_check(
        state, value=2.0, threshold=threshold, has_open_incident=False, n_required=3, m_required=3, is_count=True
    )
    assert action2 == "breach_increment"
    assert state["breach_count"] == 1


def test_container_restart_event_query():
    """9. Container restart count sourced from the events table using container.restart only."""
    from unittest.mock import MagicMock
    from app.services.detection.scheduler import _query_container_restarts

    mock_db = MagicMock()
    mock_query = MagicMock()
    mock_filter = MagicMock()
    mock_db.query.return_value = mock_query
    mock_query.filter.return_value = mock_filter
    mock_filter.filter.return_value = mock_filter
    mock_filter.count.return_value = 5

    count = _query_container_restarts(mock_db, server_id=1, window_minutes=15)
    assert count == 5.0
    mock_db.query.assert_called_once()


def test_all_detection_signals_in_detection_job():
    """10. Correct behavior for all newly added detection signals and existing CPU, memory, and disk signals."""
    from unittest.mock import patch, MagicMock
    from app.services.detection.scheduler import detection_job, reset_consecutive_state

    reset_consecutive_state()

    mock_db = MagicMock()
    mock_session_cls = MagicMock(return_value=mock_db)

    # All metrics return normal readings
    def fake_query_range(metric, minutes=1):
        normal_values = {
            "cpu": [{"v": 30.0}],
            "memory": [{"v": 40.0}],
            "disk": [{"v": 50.0}],
            "latency_p95": [{"v": 0.1}],
            "error_rate": [{"v": 0.0}],
            "demo_data_dir_bytes": [{"v": 1000.0}],
        }
        return normal_values.get(metric, [])

    with (
        patch("app.core.database.SessionLocal", mock_session_cls),
        patch("app.services.ingestion.prometheus_client.query_range", side_effect=fake_query_range),
        patch("app.services.detection.scheduler._query_container_restarts", return_value=0.0),
        patch("app.repositories.incident_repository.get_open_incident_for_metric", return_value=None),
        patch("app.repositories.incident_repository.create_incident") as mock_create,
    ):
        detection_job()
        # No breach -> no incident opened
        mock_create.assert_not_called()


def test_sustained_fault_lifecycle_integration_flow():
    """Verify acceptance criteria:
    - One CPU fault sustained long enough to meet N creates exactly one incident.
    - Repeating the CPU fault while that incident remains open creates no duplicate.
    - Once CPU readings return to normal for M consecutive checks, the incident resolves automatically.
    """
    from unittest.mock import patch, MagicMock
    from app.services.detection.scheduler import detection_job, reset_consecutive_state
    from app.models.incident import Incident

    reset_consecutive_state()

    mock_db = MagicMock()
    mock_session_cls = MagicMock(return_value=mock_db)

    open_incidents: dict = {}

    def mock_get_open(db, metric, server_id=None):
        return open_incidents.get((server_id, metric))

    def mock_create(db, metric_name, metric_value, threshold, server_id=None, **kwargs):
        inc = Incident(
            id=101,
            metric_name=metric_name,
            metric_value=metric_value,
            threshold=threshold,
            server_id=server_id,
            status="open",
        )
        open_incidents[(server_id, metric_name)] = inc
        return inc

    def mock_resolve(db, inc):
        inc.status = "resolved"
        open_incidents.pop((inc.server_id, inc.metric_name), None)
        return inc

    # Setup environment with N=3 and M=3
    cpu_value = 95.0  # breach value (> 80.0)

    def current_cpu_query(metric, minutes=1):
        if metric == "cpu":
            return [{"v": cpu_value}]
        elif metric == "latency_p95":
            return [{"v": 0.05}]  # threshold is 0.5s
        elif metric == "error_rate":
            return [{"v": 0.0}]   # threshold is 5%
        return [{"v": 10.0}]

    with (
        patch("app.core.database.SessionLocal", mock_session_cls),
        patch("app.services.detection.scheduler.init_detector", return_value=False),
        patch("app.services.ingestion.prometheus_client.query_range", side_effect=current_cpu_query),
        patch("app.services.detection.scheduler._query_container_restarts", return_value=0.0),
        patch("app.repositories.incident_repository.get_open_incident_for_metric", side_effect=mock_get_open),
        patch("app.repositories.incident_repository.create_incident", side_effect=mock_create) as patch_create,
        patch("app.repositories.incident_repository.resolve_incident", side_effect=mock_resolve) as patch_resolve,
    ):
        # 1st execution: 1st breach -> no incident opened yet
        detection_job()
        assert patch_create.call_count == 0

        # 2nd execution: 2nd breach -> no incident opened yet
        detection_job()
        assert patch_create.call_count == 0

        # 3rd execution: 3rd breach -> incident opened!
        detection_job()
        assert patch_create.call_count == 1
        assert (None, "cpu") in open_incidents

        # 4th & 5th executions: repeating CPU fault while incident remains open -> no duplicate incidents
        detection_job()
        detection_job()
        assert patch_create.call_count == 1  # STILL 1, no duplicate

        # Return CPU readings to normal (50.0 < 80.0)
        cpu_value = 50.0

        # 6th execution: 1st normal check -> recovery count 1, not resolved yet
        detection_job()
        assert patch_resolve.call_count == 0

        # 7th execution: 2nd normal check -> recovery count 2, not resolved yet
        detection_job()
        assert patch_resolve.call_count == 0

        # 8th execution: 3rd normal check -> resolved automatically!
        detection_job()
        assert patch_resolve.call_count == 1
        assert (None, "cpu") not in open_incidents


def test_cpu_query_prefers_simulated_and_falls_back():
    """Verify that CPU metric query prefers simulated_cpu_usage when present, and falls back to Node Exporter."""
    from unittest.mock import patch, MagicMock
    from app.services.ingestion.prometheus_client import query_instant, _get_query_for_metric

    query = _get_query_for_metric("cpu")
    assert "max(simulated_cpu_usage)" in query
    assert "node_cpu_seconds_total" in query

    # 1. simulated_cpu_usage = 5 -> normal reading
    mock_resp_5 = MagicMock()
    mock_resp_5.raise_for_status = MagicMock()
    mock_resp_5.json.return_value = {
        "status": "success",
        "data": {"result": [{"value": [1234567890, "5.0"]}]}
    }
    with patch("requests.get", return_value=mock_resp_5):
        val = query_instant("cpu")
        assert val == 5.0
        # Normal reading against 80.0 threshold
        from app.services.detection.threshold_checker import is_breach
        assert is_breach(val, 80.0) is False

    # 2. simulated_cpu_usage = 95 -> breach-capable reading
    mock_resp_95 = MagicMock()
    mock_resp_95.raise_for_status = MagicMock()
    mock_resp_95.json.return_value = {
        "status": "success",
        "data": {"result": [{"value": [1234567890, "95.0"]}]}
    }
    with patch("requests.get", return_value=mock_resp_95):
        val = query_instant("cpu")
        assert val == 95.0
        # Breach reading against 80.0 threshold
        assert is_breach(val, 80.0) is True

    # 3. Missing simulated_cpu_usage falls back to Node Exporter CPU (e.g. 15.5%)
    mock_resp_fallback = MagicMock()
    mock_resp_fallback.raise_for_status = MagicMock()
    mock_resp_fallback.json.return_value = {
        "status": "success",
        "data": {"result": [{"value": [1234567890, "15.5"]}]}
    }
    with patch("requests.get", return_value=mock_resp_fallback):
        val = query_instant("cpu")
        assert val == 15.5
        assert is_breach(val, 80.0) is False


def test_rule_guard_error_rate_consecutive_breach():
    """Verify error_rate_5m guard opens an incident with detection_source='rule' after 3 consecutive breaches."""
    from unittest.mock import MagicMock
    from app.services.detection.scheduler import (
        _evaluate_rule_guards,
        reset_consecutive_state,
        set_last_seen_event_id,
    )

    reset_consecutive_state()
    set_last_seen_event_id(100)

    mock_db = MagicMock()
    # No existing open incident (get_open_incident_for_metric chains two filter() calls)
    mock_db.query.return_value.filter.return_value.first.return_value = None
    mock_db.query.return_value.filter.return_value.filter.return_value.first.return_value = None

    # Base features: error_rate is index 4 (12.0% > 5.0%)
    features_breach = [5.0, 1.0, 0.05, 0.01, 12.0, 5.0, 0.0, 0.0]

    # Cycle 1: breach count 1 -> no incident yet
    _evaluate_rule_guards(mock_db, features_breach, n_breaches=3, m_recovery=3)
    assert not any(call[0][0].__class__.__name__ == "Incident" for call in mock_db.add.call_args_list)

    # Cycle 2: breach count 2 -> no incident yet
    _evaluate_rule_guards(mock_db, features_breach, n_breaches=3, m_recovery=3)
    assert not any(call[0][0].__class__.__name__ == "Incident" for call in mock_db.add.call_args_list)

    # Cycle 3: breach count 3 -> incident created
    _evaluate_rule_guards(mock_db, features_breach, n_breaches=3, m_recovery=3)
    created_incidents = [call[0][0] for call in mock_db.add.call_args_list if call[0][0].__class__.__name__ == "Incident"]
    assert len(created_incidents) == 1
    inc = created_incidents[0]
    assert inc.metric_name == "error_rate_5m"
    assert inc.detection_source == "rule"
    assert inc.metric_value == 12.0


def test_rule_guard_data_dir_growth():
    """Verify data_dir_growth_5m guard triggers immediately when growth >= 26214400 bytes."""
    from unittest.mock import MagicMock
    from app.services.detection.scheduler import (
        _evaluate_rule_guards,
        reset_consecutive_state,
        set_last_seen_event_id,
    )

    reset_consecutive_state()
    set_last_seen_event_id(100)

    mock_db = MagicMock()
    mock_db.query.return_value.filter.return_value.first.return_value = None
    mock_db.query.return_value.filter.return_value.filter.return_value.first.return_value = None

    # 30MB growth (>= 26214400 bytes)
    features_growth = [5.0, 1.0, 0.05, 0.01, 0.0, 5.0, 0.0, 31457280.0]

    _evaluate_rule_guards(mock_db, features_growth, n_breaches=3, m_recovery=3)
    created_incidents = [call[0][0] for call in mock_db.add.call_args_list if call[0][0].__class__.__name__ == "Incident"]
    assert len(created_incidents) == 1
    inc = created_incidents[0]
    assert inc.metric_name == "data_dir_growth_5m"
    assert inc.detection_source == "rule"
    assert inc.metric_value == 31457280.0


def test_rule_guard_container_die_oom_watermark():
    """Verify container die/oom guard fires once per new event above the startup watermark."""
    from unittest.mock import MagicMock
    from app.services.detection.scheduler import (
        _evaluate_rule_guards,
        reset_consecutive_state,
        set_last_seen_event_id,
        get_last_seen_event_id,
    )
    from app.models.models import Event

    reset_consecutive_state()
    # Startup watermark at event 50
    set_last_seen_event_id(50)

    mock_db = MagicMock()
    mock_db.query.return_value.filter.return_value.first.return_value = None

    ev1 = MagicMock(spec=Event)
    ev1.id = 51
    ev1.event_type = "container.die"
    ev1.server_id = 1
    ev1.payload = {"container_name": "demo-app"}

    mock_db.query.return_value.filter.return_value.order_by.return_value.all.return_value = [ev1]

    # Evaluate guard with normal features
    features_normal = [5.0, 1.0, 0.05, 0.01, 0.0, 5.0, 0.0, 0.0]
    _evaluate_rule_guards(mock_db, features_normal, n_breaches=3, m_recovery=3)

    created_incidents = [call[0][0] for call in mock_db.add.call_args_list if call[0][0].__class__.__name__ == "Incident"]
    assert len(created_incidents) == 1
    inc = created_incidents[0]
    assert inc.metric_name == "container.die"
    assert inc.detection_source == "rule"
    assert inc.affected_service == "demo-app"

    # Watermark advanced to 51
    assert get_last_seen_event_id() == 51
