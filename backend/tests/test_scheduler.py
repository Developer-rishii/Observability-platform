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
    """
    sched = get_scheduler()
    job_executed = threading.Event()
    execution_counter = 0

    def on_job_executed(event):
        nonlocal execution_counter
        if event.job_id == JOB_ID:
            execution_counter += 1
            job_executed.set()

    sched.add_listener(on_job_executed, EVENT_JOB_EXECUTED)
    try:
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
