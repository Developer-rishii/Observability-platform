from fastapi import APIRouter
from app.core.database import SessionLocal
from app.services.ingestion.prometheus_client import check_health as check_prometheus_health

router = APIRouter()

@router.get("/health")
def system_health():
    """
    Check the reachability of downstream systems (Database, Prometheus).
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
        
    prom_status = "ok" if check_prometheus_health() else "error"
    
    return {
        "db": db_status,
        "prometheus": prom_status
    }
