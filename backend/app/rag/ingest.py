import glob
import logging
import os
import re
import sys
import uuid
from pathlib import Path
from typing import Any, Dict, List, Optional

from qdrant_client import QdrantClient
from qdrant_client.http import models
from sentence_transformers import SentenceTransformer

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("rag-ingest")

COLLECTION_NAME = "incident_knowledge_base"
DEFAULT_MODEL_NAME = "all-MiniLM-L6-v2"
VECTOR_DIMENSION = 384  # Dimension for all-MiniLM-L6-v2


def get_qdrant_url() -> str:
    """Resolve Qdrant URL from configuration or environment."""
    try:
        from app.core.config import settings
        return getattr(settings, "QDRANT_URL", "http://qdrant:6333")
    except Exception:
        return os.getenv("QDRANT_URL", "http://localhost:6333")


def get_embedding_model() -> SentenceTransformer:
    """Initialize SentenceTransformer model."""
    try:
        from app.core.config import settings
        model_name = getattr(settings, "EMBEDDING_MODEL_NAME", DEFAULT_MODEL_NAME)
    except Exception:
        model_name = os.getenv("EMBEDDING_MODEL_NAME", DEFAULT_MODEL_NAME)

    logger.info(f"Loading embedding model: {model_name}")
    return SentenceTransformer(model_name)


def locate_knowledge_base_dir() -> Path:
    """Find the directory containing the markdown runbooks."""
    candidates = [
        # Relative to backend/app/rag/
        Path(__file__).resolve().parent.parent.parent.parent / "rag" / "knowledge_base",
        # Working directory relative paths
        Path("rag/knowledge_base").resolve(),
        Path("../rag/knowledge_base").resolve(),
        Path("/app/rag/knowledge_base"),
        Path("/rag/knowledge_base"),
    ]
    for candidate in candidates:
        if candidate.exists() and candidate.is_dir():
            md_files = list(candidate.glob("*.md"))
            if md_files:
                logger.info(f"Located knowledge base at {candidate} with {len(md_files)} files")
                return candidate

    raise FileNotFoundError("Could not locate rag/knowledge_base/ containing Markdown files")


def split_text_with_overlap(text: str, chunk_words: int = 300, overlap_words: int = 45) -> List[str]:
    """
    Split text into chunks of approximately 300-500 tokens (approx 225-375 words)
    with about 15% overlap.
    """
    words = text.split()
    if len(words) <= chunk_words:
        return [text]

    chunks = []
    step = chunk_words - overlap_words
    for i in range(0, len(words), step):
        chunk_slice = words[i : i + chunk_words]
        chunks.append(" ".join(chunk_slice))
        if i + chunk_words >= len(words):
            break
    return chunks


def parse_and_chunk_markdown(file_path: Path) -> List[Dict[str, Any]]:
    """
    Parse a knowledge base markdown file into semantic chunks preserving
    the document title and section headings.
    """
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()

    lines = content.splitlines()
    doc_title = file_path.stem.replace("-", " ").title()

    # Extract top-level Markdown title (# Title)
    for line in lines:
        if line.startswith("# "):
            doc_title = line.replace("# ", "").strip()
            break

    # Split by section headings (## Heading)
    sections: List[Dict[str, str]] = []
    current_section = "Overview"
    current_body: List[str] = []

    for line in lines:
        if line.startswith("## "):
            if current_body:
                body_str = "\n".join(current_body).strip()
                if body_str:
                    sections.append({"section": current_section, "body": body_str})
                current_body = []
            current_section = line.replace("## ", "").strip()
        else:
            current_body.append(line)

    if current_body:
        body_str = "\n".join(current_body).strip()
        if body_str:
            sections.append({"section": current_section, "body": body_str})

    chunks: List[Dict[str, Any]] = []
    for sec in sections:
        section_name = sec["section"]
        sub_chunks = split_text_with_overlap(sec["body"], chunk_words=280, overlap_words=42)

        for idx, sub in enumerate(sub_chunks):
            # Keep document title and section heading with each chunk
            formatted_content = (
                f"Document: {doc_title}\n"
                f"Section: {section_name}\n"
                f"Source: {file_path.name}\n\n"
                f"{sub}"
            )

            chunks.append({
                "title": doc_title,
                "section": section_name,
                "source_file": file_path.name,
                "content": formatted_content,
                "chunk_index": idx,
                "word_count": len(sub.split()),
            })

    return chunks


def ingest_knowledge_base(
    kb_dir: Optional[Path] = None,
    qdrant_url: Optional[str] = None,
    recreate_collection: bool = True,
) -> int:
    """
    Ingest all knowledge base runbooks into Qdrant collection.

    Returns:
        Total number of chunks ingested.
    """
    if kb_dir is None:
        kb_dir = locate_knowledge_base_dir()

    if qdrant_url is None:
        qdrant_url = get_qdrant_url()

    md_files = sorted(list(kb_dir.glob("*.md")))
    if not md_files:
        raise ValueError(f"No markdown documents found in {kb_dir}")

    logger.info(f"Found {len(md_files)} knowledge base documents to process.")

    # 1. Parse and chunk all markdown files
    all_chunks: List[Dict[str, Any]] = []
    for md_file in md_files:
        file_chunks = parse_and_chunk_markdown(md_file)
        logger.info(f"  Processed {md_file.name}: {len(file_chunks)} chunks")
        all_chunks.extend(file_chunks)

    logger.info(f"Total chunks created: {len(all_chunks)}")

    # 2. Embed chunks with SentenceTransformer
    model = get_embedding_model()
    texts_to_embed = [chunk["content"] for chunk in all_chunks]
    logger.info(f"Encoding {len(texts_to_embed)} chunks with model...")
    embeddings = model.encode(texts_to_embed, show_progress_bar=True, batch_size=32)

    # 3. Connect to Qdrant and prepare collection
    logger.info(f"Connecting to Qdrant at {qdrant_url}...")
    client = QdrantClient(url=qdrant_url, timeout=30.0)

    # Check and create/recreate collection
    collections = [c.name for c in client.get_collections().collections]
    if COLLECTION_NAME in collections:
        if recreate_collection:
            logger.info(f"Recreating collection '{COLLECTION_NAME}'...")
            client.delete_collection(COLLECTION_NAME)
            client.create_collection(
                collection_name=COLLECTION_NAME,
                vectors_config=models.VectorParams(
                    size=VECTOR_DIMENSION,
                    distance=models.Distance.COSINE,
                ),
            )
    else:
        logger.info(f"Creating collection '{COLLECTION_NAME}'...")
        client.create_collection(
            collection_name=COLLECTION_NAME,
            vectors_config=models.VectorParams(
                size=VECTOR_DIMENSION,
                distance=models.Distance.COSINE,
            ),
        )

    # 4. Upsert points into Qdrant
    points: List[models.PointStruct] = []
    for chunk, embedding in zip(all_chunks, embeddings):
        points.append(
            models.PointStruct(
                id=str(uuid.uuid4()),
                vector=embedding.tolist(),
                payload=chunk,
            )
        )

    logger.info(f"Upserting {len(points)} vector points into Qdrant...")
    client.upsert(
        collection_name=COLLECTION_NAME,
        points=points,
        wait=True,
    )

    count_info = client.count(collection_name=COLLECTION_NAME)
    logger.info(f"Successfully ingested {count_info.count} points into '{COLLECTION_NAME}'.")
    return count_info.count


if __name__ == "__main__":
    try:
        total = ingest_knowledge_base()
        print(f"\n[SUCCESS] Ingested {total} knowledge chunks into Qdrant collection '{COLLECTION_NAME}'.")
    except Exception as e:
        logger.error(f"Ingestion failed: {e}", exc_info=True)
        sys.exit(1)
