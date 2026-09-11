from fastapi import APIRouter

router = APIRouter()

@router.get("/")
def get_rag_placeholder():
    return {"message": "RAG endpoint placeholder"}
