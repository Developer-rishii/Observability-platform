from fastapi import APIRouter

router = APIRouter()

@router.get("/")
def get_alerts_placeholder():
    return {"message": "Alerts endpoint placeholder"}
