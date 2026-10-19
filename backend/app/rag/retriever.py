import logging
import os
from typing import Any, Dict, List, Optional
from qdrant_client import QdrantClient
from sentence_transformers import SentenceTransformer

logger = logging.getLogger(__name__)

COLLECTION_NAME = "incident_knowledge_base"
DEFAULT_MODEL_NAME = "all-MiniLM-L6-v2"

# Global lazy-loaded singletons
_embedding_model: Optional[SentenceTransformer] = None
_qdrant_client: Optional[QdrantClient] = None


def get_qdrant_url() -> str:
    """Retrieve Qdrant endpoint from settings or environment variables."""
    try:
        from app.core.config import settings
        return getattr(settings, "QDRANT_URL", "http://qdrant:6333")
    except Exception:
        return os.getenv("QDRANT_URL", "http://localhost:6333")


def get_embedding_model() -> SentenceTransformer:
    """Get or initialize cached SentenceTransformer instance."""
    global _embedding_model
    if _embedding_model is None:
        try:
            from app.core.config import settings
            model_name = getattr(settings, "EMBEDDING_MODEL_NAME", DEFAULT_MODEL_NAME)
        except Exception:
            model_name = os.getenv("EMBEDDING_MODEL_NAME", DEFAULT_MODEL_NAME)

        logger.info(f"Loading embedding model: {model_name}")
        _embedding_model = SentenceTransformer(model_name)
    return _embedding_model


def get_qdrant_client() -> QdrantClient:
    """Get or initialize cached QdrantClient instance."""
    global _qdrant_client
    if _qdrant_client is None:
        url = get_qdrant_url()
        logger.info(f"Connecting to Qdrant at: {url}")
        _qdrant_client = QdrantClient(url=url, timeout=10.0)
    return _qdrant_client


def search(
    query: str,
    k: int = 5,
    min_score: float = 0.0,
    collection_name: str = COLLECTION_NAME,
) -> List[Dict[str, Any]]:
    """
    Search incident knowledge base in Qdrant using vector similarity.

    Args:
        query: Diagnostic query string (e.g. error message, metric breach symptoms).
        k: Maximum number of top matching chunks to return (default 5).
        min_score: Minimum cosine similarity score threshold (default 0.0).
        collection_name: Qdrant collection name to search.

    Returns:
        List of matching chunks with source, title, section, content, and similarity score.
        Drops any results below min_score.
    """
    if not query or not query.strip():
        return []

    try:
        client = get_qdrant_client()
        model = get_embedding_model()

        # Compute query vector
        query_vector = model.encode(query.strip()).tolist()

        # Support both query_points (qdrant-client >= 1.10) and legacy search API
        if hasattr(client, "query_points"):
            query_kwargs = {
                "collection_name": collection_name,
                "query": query_vector,
                "limit": k,
            }
            if min_score > 0.0:
                query_kwargs["score_threshold"] = min_score
            response = client.query_points(**query_kwargs)
            raw_results = getattr(response, "points", response)
        else:
            search_params = {
                "collection_name": collection_name,
                "query_vector": query_vector,
                "limit": k,
            }
            if min_score > 0.0:
                search_params["score_threshold"] = min_score
            raw_results = client.search(**search_params)

        results: List[Dict[str, Any]] = []
        for hit in raw_results:
            score = float(hit.score)
            if min_score > 0.0 and score < min_score:
                continue

            payload = hit.payload or {}
            results.append({
                "id": str(hit.id),
                "score": round(score, 4),
                "title": payload.get("title", ""),
                "section": payload.get("section", ""),
                "content": payload.get("content", ""),
                "source_file": payload.get("source_file", ""),
                "metadata": payload,
            })

        logger.info(f"Qdrant RAG search for '{query[:40]}...' returned {len(results)} hits (k={k}, min_score={min_score})")
        return results

    except Exception as exc:
        logger.warning(f"Qdrant RAG search failed: {exc}")
        return []
