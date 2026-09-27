from fastapi import APIRouter, HTTPException

router = APIRouter()

@router.get("/")
def get_auth_placeholder():
    return {"message": "Auth endpoint placeholder"}

@router.post("/login")
def login_stub():
    # TODO: Implement real authentication logic in Day 2
    raise HTTPException(status_code=501, detail="Not Implemented - Day 1 stub")

