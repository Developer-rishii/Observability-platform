from fastapi import APIRouter

router = APIRouter()

@router.get("/")
def get_servers_placeholder():
    return {"message": "Servers endpoint placeholder"}
