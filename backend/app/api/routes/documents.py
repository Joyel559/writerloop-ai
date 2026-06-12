from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.deps import get_current_user, get_db
from app.models import Document, DocumentVersion, User
from app.schemas.document import DocumentContentResponse, DocumentCreateRequest, DocumentResponse
from app.services.ingestion import chunk_text, clean_text, extract_text_from_bytes

router = APIRouter(prefix="/documents", tags=["documents"])


@router.post("", response_model=DocumentResponse)
def create_document(
    payload: DocumentCreateRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> DocumentResponse:
    content = clean_text(payload.content)
    document = Document(
        user_id=user.id,
        title=payload.title,
        content=content,
        word_count=len(content.split()),
        status="draft",
    )
    db.add(document)
    db.commit()
    db.refresh(document)

    version = DocumentVersion(document_id=document.id, version_number=1, content=document.content)
    db.add(version)
    db.commit()

    return DocumentResponse(
        id=document.id,
        title=document.title,
        status=document.status,
        word_count=document.word_count,
        created_at=document.created_at,
        updated_at=document.updated_at,
    )


@router.post("/upload", response_model=DocumentResponse)
async def upload_document(
    file: UploadFile = File(...),
    title: str | None = Form(default=None),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> DocumentResponse:
    try:
        binary = await file.read()
        max_bytes = get_settings().max_upload_bytes
        if len(binary) > max_bytes:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"File is too large ({len(binary)} bytes). Max allowed is {max_bytes} bytes.",
            )
        extracted = extract_text_from_bytes(file.filename or "upload.txt", binary)
        content = clean_text(extracted.text)
        if not content:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No readable content extracted from the uploaded file.",
            )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    document = Document(
        user_id=user.id,
        title=title or (file.filename or "Untitled Document"),
        content=content,
        word_count=len(content.split()),
        status="processed",
        mime_type=file.content_type,
        original_filename=file.filename,
    )
    db.add(document)
    db.commit()
    db.refresh(document)

    chunks = chunk_text(document.content)
    version = DocumentVersion(
        document_id=document.id,
        version_number=1,
        content=document.content,
        diff={"chunks": len(chunks), "sections": len(extracted.sections)},
    )
    db.add(version)
    db.commit()

    return DocumentResponse(
        id=document.id,
        title=document.title,
        status=document.status,
        word_count=document.word_count,
        created_at=document.created_at,
        updated_at=document.updated_at,
    )


@router.get("", response_model=list[DocumentResponse])
def list_documents(db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> list[DocumentResponse]:
    docs = db.scalars(select(Document).where(Document.user_id == user.id).order_by(Document.updated_at.desc())).all()
    return [
        DocumentResponse(
            id=doc.id,
            title=doc.title,
            status=doc.status,
            word_count=doc.word_count,
            created_at=doc.created_at,
            updated_at=doc.updated_at,
        )
        for doc in docs
    ]


@router.get("/{document_id}", response_model=DocumentContentResponse)
def get_document(
    document_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> DocumentContentResponse:
    doc = db.scalar(
        select(Document).where(Document.id == document_id, Document.user_id == user.id)
    )

    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    return DocumentContentResponse(
        id=doc.id,
        title=doc.title,
        status=doc.status,
        content=doc.content,
        word_count=doc.word_count,
        created_at=doc.created_at,
        updated_at=doc.updated_at,
    )
