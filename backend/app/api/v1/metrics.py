from fastapi import APIRouter

router = APIRouter()

@router.get("/")
def get_metrics_placeholder():
    return {"message": "Metrics endpoint placeholder"}
