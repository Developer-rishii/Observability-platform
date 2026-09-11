from fastapi import APIRouter

router = APIRouter()

@router.get("/")
def get_ai_placeholder():
    return {"message": "AI endpoint placeholder"}
