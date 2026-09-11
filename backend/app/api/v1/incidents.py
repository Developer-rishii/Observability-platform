from fastapi import APIRouter

router = APIRouter()

@router.get("/")
def get_incidents_placeholder():
    return {"message": "Incidents endpoint placeholder"}
