from typing import Optional
from apscheduler.schedulers.background import BackgroundScheduler
from app.core.config import settings

DETECTION_INTERVAL_SECONDS = settings.DETECTION_INTERVAL_SECONDS
JOB_ID = "detection_job"


scheduler: Optional[BackgroundScheduler] = None


def detection_job():
    """Periodic detection job."""
    from app.services.ingestion.prometheus_client import query_range
    from app.services.detection.threshold_checker import is_breach
    from app.repositories.incident_repository import get_open_incident_for_metric, create_incident
    from app.core.database import SessionLocal
    
    # We will check CPU, memory, and disk
    metrics_to_check = [
        ("cpu", settings.CPU_THRESHOLD_PCT),
        ("memory", settings.MEM_THRESHOLD_PCT),
        ("disk", settings.DISK_THRESHOLD_PCT),
    ]
    
    db = SessionLocal()
    try:
        for metric, threshold in metrics_to_check:
            # Query last 1 minute to get the latest data points
            points = query_range(metric, minutes=1)
            if not points:
                continue
            
            # Use the latest point
            latest_point = points[-1]
            value = latest_point["v"]
            
            if is_breach(value, threshold):
                # Check if we already have an open incident for this metric
                existing = get_open_incident_for_metric(db, metric)
                if not existing:
                    create_incident(db, metric, value, threshold)
    except Exception as e:
        print(f"Error in detection_job: {e}")
    finally:
        db.close()


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
