import hashlib
import math
import re
import uuid
from dataclasses import dataclass

from qdrant_client import QdrantClient
from qdrant_client.http import models

from app.core.config import get_settings
from app.services.ingestion import chunk_text

COLLECTION_NAME = "writerloop_library_chunks_v1"
VECTOR_SIZE = 384
MAX_DOCUMENT_CHARS = 180_000
MAX_CHUNKS_PER_DOCUMENT = 160
QDRANT_INDEXING_THRESHOLD = 20_000


@dataclass
class LibraryDocumentInput:
    book_id: str
    title: str
    text: str


@dataclass
class SemanticSearchHit:
    chunk_id: str
    book_id: str
    title: str
    chunk_text: str
    score: float


def _build_client() -> QdrantClient:
    settings = get_settings()
    return QdrantClient(url=settings.qdrant_url, timeout=20.0)


def _ensure_collection(client: QdrantClient) -> None:
    try:
        client.get_collection(COLLECTION_NAME)
        return
    except Exception:
        pass

    try:
        client.create_collection(
            collection_name=COLLECTION_NAME,
            vectors_config=models.VectorParams(
                size=VECTOR_SIZE,
                distance=models.Distance.COSINE,
            ),
            optimizers_config=models.OptimizersConfigDiff(
                indexing_threshold=QDRANT_INDEXING_THRESHOLD,
            ),
            on_disk_payload=True,
        )
    except TypeError:
        # Backward compatibility for older qdrant-client signatures.
        client.create_collection(
            collection_name=COLLECTION_NAME,
            vectors_config=models.VectorParams(
                size=VECTOR_SIZE,
                distance=models.Distance.COSINE,
            ),
        )


def _tokenize(text: str) -> list[str]:
    return re.findall(r"[a-z0-9]+", text.lower())


def _hash_embedding(text: str) -> list[float]:
    vector = [0.0] * VECTOR_SIZE
    tokens = _tokenize(text)

    if not tokens:
        tokens = [text.strip().lower()[:64] or "empty"]

    for token in tokens:
        digest = hashlib.sha256(token.encode("utf-8", errors="ignore")).digest()
        idx = int.from_bytes(digest[:4], "big") % VECTOR_SIZE
        sign = 1.0 if (digest[4] % 2 == 0) else -1.0
        weight = 1.0 + (digest[5] % 7) * 0.1
        vector[idx] += sign * weight

    magnitude = math.sqrt(sum(value * value for value in vector))
    if magnitude > 0:
        vector = [value / magnitude for value in vector]

    return vector


def index_library_documents(documents: list[LibraryDocumentInput]) -> dict[str, int]:
    client = _build_client()
    _ensure_collection(client)

    indexed_documents = 0
    indexed_chunks = 0
    skipped_documents = 0

    for document in documents:
        source_text = (document.text or "").strip()
        if not source_text:
            skipped_documents += 1
            continue

        trimmed = source_text[:MAX_DOCUMENT_CHARS]
        chunks = [
            chunk.strip()
            for chunk in chunk_text(trimmed, chunk_size=1000, overlap=180)
            if chunk.strip()
        ][:MAX_CHUNKS_PER_DOCUMENT]

        if not chunks:
            skipped_documents += 1
            continue

        indexed_documents += 1

        # Replace previously indexed chunks for this book.
        try:
            client.delete(
                collection_name=COLLECTION_NAME,
                points_selector=models.FilterSelector(
                    filter=models.Filter(
                        must=[
                            models.FieldCondition(
                                key="book_id",
                                match=models.MatchValue(value=document.book_id),
                            )
                        ]
                    )
                ),
            )
        except Exception:
            # Deletion failure should not block fresh upserts.
            pass

        points: list[models.PointStruct] = []
        for chunk_index, chunk in enumerate(chunks):
            points.append(
                models.PointStruct(
                    id=f"{document.book_id}:{chunk_index}:{uuid.uuid4().hex[:10]}",
                    vector=_hash_embedding(chunk),
                    payload={
                        "book_id": document.book_id,
                        "title": document.title,
                        "chunk_index": chunk_index,
                        "chunk_text": chunk,
                    },
                )
            )

        if points:
            client.upsert(collection_name=COLLECTION_NAME, points=points, wait=True)
            indexed_chunks += len(points)

    return {
        "indexed_documents": indexed_documents,
        "indexed_chunks": indexed_chunks,
        "skipped_documents": skipped_documents,
    }


def search_library_documents(
    query: str,
    *,
    limit: int = 8,
    book_id: str | None = None,
) -> list[SemanticSearchHit]:
    normalized_query = query.strip()
    if not normalized_query:
        return []

    client = _build_client()
    try:
        _ensure_collection(client)
    except Exception:
        return []

    filters: list[object] = []
    if book_id:
        filters.append(
            models.FieldCondition(
                key="book_id",
                match=models.MatchValue(value=book_id),
            )
        )

    query_filter = models.Filter(must=filters) if filters else None

    try:
        hits = client.search(
            collection_name=COLLECTION_NAME,
            query_vector=_hash_embedding(normalized_query),
            query_filter=query_filter,
            limit=max(1, min(limit, 20)),
            with_payload=True,
        )
    except Exception:
        return []

    results: list[SemanticSearchHit] = []
    for hit in hits:
        payload = hit.payload or {}
        results.append(
            SemanticSearchHit(
                chunk_id=str(getattr(hit, "id", "")),
                book_id=str(payload.get("book_id", "")),
                title=str(payload.get("title", "Untitled")),
                chunk_text=str(payload.get("chunk_text", "")),
                score=float(getattr(hit, "score", 0.0) or 0.0),
            )
        )

    return results
