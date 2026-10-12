from fastapi import APIRouter
from app.core.database import SessionLocal
from app.services.ingestion.prometheus_client import (
    check_health as check_prometheus_health,
    get_targets as get_prometheus_targets,
)

router = APIRouter()

@router.get("/health")
def system_health():
    """
    Check the reachability of downstream systems (Database, Prometheus)
    and Prometheus target scrape status.
    """
    db_status = "ok"
    try:
        from sqlalchemy import text
        db = SessionLocal()
        db.execute(text("SELECT 1"))
        db.close()
    except Exception as e:
        print(f"DB Health check failed: {e}")
        db_status = "error"
        
    prom_healthy = check_prometheus_health()
    prom_status = "ok" if prom_healthy else "error"
    prom_targets = get_prometheus_targets() if prom_healthy else []
    
    return {
        "db": db_status,
        "prometheus": prom_status,
        "prometheus_targets": prom_targets,
    }
