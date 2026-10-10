from typing import Optional
from apscheduler.schedulers.background import BackgroundScheduler
from app.core.config import settings

DETECTION_INTERVAL_SECONDS = settings.DETECTION_INTERVAL_SECONDS
JOB_ID = "detection_job"


scheduler: Optional[BackgroundScheduler] = None


def detection_job():
    """Periodic detection job stub.

    Stub for Day 2; will be wired to real metrics querying and threshold
    checking in Day 3.
    """
    pass


def _register_job(sched: BackgroundScheduler) -> None:
    """Register the periodic 15-second detection job on the scheduler if not present."""
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
