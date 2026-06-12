import uuid

from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.deps import get_current_user, get_db
from app.models import AnalysisJob, Document, FeedbackReport, User
from app.schemas.analysis import (
    AnalysisJobEnqueueResponse,
    AnalysisJobStatusResponse,
    AskSelectionRequest,
    AskSelectionResponse,
    DocumentChatRequest,
    DocumentChatResponse,
    ExplainImageRequest,
    ExplainImageResponse,
    ExplainSelectionRequest,
    ExplainSelectionResponse,
    FileIngestResponse,
    FeedbackReportResponse,
    LibraryIndexRequest,
    LibraryIndexResponse,
    LiveCorrectionRequest,
    LiveCorrectionResponse,
    QuickAnalysisRequest,
    ReaderSimulationRequest,
    ReaderSimulationResponse,
    RewriteRequest,
    RewriteResponse,
    SemanticSearchRequest,
    SemanticSearchResponse,
    SemanticSearchResult,
    SummarizeBookRequest,
    SummarizeBookResponse,
    TranslateSelectionRequest,
    TranslateSelectionResponse,
    UploadedDocument,
    UploadedSection,
)
from app.services.analysis import AIProviderError
from app.services.analysis import (
    analyze_text,
    answer_question_about_text,
    chat_with_document_context,
    explain_selection_with_gemini,
    explain_image_with_gemini,
    live_correct_text,
    rewrite_text,
    summarize_book_with_gemini,
    simulate_reader,
    translate_selection_with_gemini,
)
from app.services.ingestion import extract_text_from_bytes
from app.services.semantic_store import (
    LibraryDocumentInput,
    index_library_documents,
    search_library_documents,
)
from app.services.execution import enqueue_document_analysis

router = APIRouter(prefix="/analysis", tags=["analysis"])

MAX_TOTAL_UPLOAD_BYTES = 20 * 1024 * 1024


def _map_ai_error_status(detail: str) -> int:
    lower = detail.lower()
    if "quota" in lower or "resource_exhausted" in lower or "rate limit" in lower:
        return status.HTTP_429_TOO_MANY_REQUESTS
    if "authentication" in lower or "api key" in lower or "unauthorized" in lower:
        return status.HTTP_401_UNAUTHORIZED
    return status.HTTP_502_BAD_GATEWAY


@router.post("/quick", response_model=FeedbackReportResponse)
def quick_analysis(payload: QuickAnalysisRequest) -> FeedbackReportResponse:
    try:
        return analyze_text(payload.text)
    except AIProviderError as exc:
        detail = str(exc)
        raise HTTPException(status_code=_map_ai_error_status(detail), detail=detail) from exc


@router.post("/rewrite", response_model=RewriteResponse)
def rewrite(payload: RewriteRequest) -> RewriteResponse:
    try:
        rewritten = rewrite_text(payload.text, payload.mode)
        return RewriteResponse(rewritten_text=rewritten)
    except AIProviderError as exc:
        detail = str(exc)
        raise HTTPException(status_code=_map_ai_error_status(detail), detail=detail) from exc


@router.post("/live-correct", response_model=LiveCorrectionResponse)
def live_correct(payload: LiveCorrectionRequest) -> LiveCorrectionResponse:
    try:
        corrected_text, corrections = live_correct_text(payload.text, payload.previous_text)
        return LiveCorrectionResponse(
            corrected_text=corrected_text,
            corrections=corrections,
            changed=corrected_text != payload.text,
        )
    except AIProviderError as exc:
        detail = str(exc)
        raise HTTPException(status_code=_map_ai_error_status(detail), detail=detail) from exc


@router.post("/simulate-reader", response_model=ReaderSimulationResponse)
def reader_simulation(payload: ReaderSimulationRequest) -> ReaderSimulationResponse:
    try:
        return simulate_reader(payload.text, payload.role)
    except AIProviderError as exc:
        detail = str(exc)
        raise HTTPException(status_code=_map_ai_error_status(detail), detail=detail) from exc


@router.post("/ingest-files", response_model=FileIngestResponse)
async def ingest_files(files: list[UploadFile] = File(...)) -> FileIngestResponse:
    if not files:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No files were uploaded.")

    total_bytes = 0
    uploaded_docs: list[UploadedDocument] = []
    warnings: list[str] = []

    for file in files:
        binary = await file.read()
        file_size = len(binary)
        total_bytes += file_size

        if total_bytes > MAX_TOTAL_UPLOAD_BYTES:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=(
                    f"Total upload exceeds 20MB. "
                    f"Current total: {total_bytes} bytes, max: {MAX_TOTAL_UPLOAD_BYTES} bytes."
                ),
            )

        try:
            extracted = extract_text_from_bytes(file.filename or "upload.txt", binary)
        except ValueError as exc:
            warnings.append(f"{file.filename or 'Unknown file'} skipped: {exc}")
            continue

        content = extracted.text.strip()
        if not content:
            warnings.append(f"{file.filename or 'Unknown file'} skipped: no readable text extracted.")
            continue

        uploaded_docs.append(
            UploadedDocument(
                id=str(uuid.uuid4()),
                title=(file.filename or "Untitled").rsplit(".", 1)[0],
                filename=file.filename or "upload",
                extension=extracted.extension,
                size_bytes=file_size,
                word_count=len(content.split()),
                content=content,
                sections=[
                    UploadedSection(label=section.label, content=section.content)
                    for section in extracted.sections
                ],
            )
        )

    if not uploaded_docs:
        detail = "No supported files could be processed."
        if warnings:
            detail = f"{detail} " + " | ".join(warnings)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=detail)

    return FileIngestResponse(
        total_files=len(uploaded_docs),
        total_bytes=total_bytes,
        max_total_bytes=MAX_TOTAL_UPLOAD_BYTES,
        documents=uploaded_docs,
        warnings=warnings,
    )


@router.post("/ask-selection", response_model=AskSelectionResponse)
def ask_selection(payload: AskSelectionRequest) -> AskSelectionResponse:
    try:
        answer = answer_question_about_text(
            text=payload.text,
            question=payload.question,
            context=payload.context,
        )
    except AIProviderError as exc:
        detail = str(exc)
        raise HTTPException(status_code=_map_ai_error_status(detail), detail=detail) from exc
    return AskSelectionResponse(answer=answer)


@router.post("/explain-selection", response_model=ExplainSelectionResponse)
def explain_selection(payload: ExplainSelectionRequest) -> ExplainSelectionResponse:
    try:
        return explain_selection_with_gemini(
            selected_text=payload.selected_text,
            surrounding_context=payload.surrounding_context,
        )
    except AIProviderError as exc:
        detail = str(exc)
        raise HTTPException(status_code=_map_ai_error_status(detail), detail=detail) from exc


@router.post("/explain-image", response_model=ExplainImageResponse)
def explain_image(payload: ExplainImageRequest) -> ExplainImageResponse:
    try:
        return explain_image_with_gemini(
            image_url=payload.image_url,
            prompt=payload.prompt,
            surrounding_context=payload.surrounding_context,
        )
    except AIProviderError as exc:
        detail = str(exc)
        raise HTTPException(status_code=_map_ai_error_status(detail), detail=detail) from exc


@router.post("/summarize-book", response_model=SummarizeBookResponse)
def summarize_book(payload: SummarizeBookRequest) -> SummarizeBookResponse:
    try:
        return summarize_book_with_gemini(
            text=payload.text,
            title=payload.title,
        )
    except AIProviderError as exc:
        detail = str(exc)
        raise HTTPException(status_code=_map_ai_error_status(detail), detail=detail) from exc


@router.post("/translate-selection", response_model=TranslateSelectionResponse)
def translate_selection(payload: TranslateSelectionRequest) -> TranslateSelectionResponse:
    try:
        return translate_selection_with_gemini(
            selected_text=payload.selected_text,
            target_language=payload.target_language,
            surrounding_context=payload.surrounding_context,
        )
    except AIProviderError as exc:
        detail = str(exc)
        raise HTTPException(status_code=_map_ai_error_status(detail), detail=detail) from exc


@router.post("/chat-document", response_model=DocumentChatResponse)
def chat_document(payload: DocumentChatRequest) -> DocumentChatResponse:
    try:
        return chat_with_document_context(
            question=payload.question,
            snippets=payload.snippets,
            book_title=payload.book_title,
        )
    except AIProviderError as exc:
        detail = str(exc)
        raise HTTPException(status_code=_map_ai_error_status(detail), detail=detail) from exc


@router.post("/index-library", response_model=LibraryIndexResponse)
def index_library(payload: LibraryIndexRequest) -> LibraryIndexResponse:
    normalized_documents = [
        LibraryDocumentInput(
            book_id=document.book_id,
            title=document.title,
            text=document.text,
        )
        for document in payload.documents
    ]

    try:
        summary = index_library_documents(normalized_documents)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Vector indexing failed: {exc}",
        ) from exc

    return LibraryIndexResponse(**summary)


@router.post("/search-library", response_model=SemanticSearchResponse)
def search_library(payload: SemanticSearchRequest) -> SemanticSearchResponse:
    try:
        matches = search_library_documents(
            query=payload.query,
            limit=payload.limit,
            book_id=payload.book_id,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Semantic search failed: {exc}",
        ) from exc

    return SemanticSearchResponse(
        results=[
            SemanticSearchResult(
                chunk_id=item.chunk_id,
                book_id=item.book_id,
                title=item.title,
                chunk_text=item.chunk_text,
                score=item.score,
            )
            for item in matches
        ],
        total=len(matches),
    )


@router.post("/{document_id}/jobs", response_model=AnalysisJobEnqueueResponse)
def enqueue_document_analysis_job(
    document_id: str,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> AnalysisJobEnqueueResponse:
    document = db.scalar(
        select(Document).where(Document.id == document_id, Document.user_id == user.id)
    )
    if not document:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    job = AnalysisJob(
        user_id=user.id,
        document_id=document.id,
        status="queued",
        progress=0,
    )
    db.add(job)
    db.commit()
    db.refresh(job)

    execution_mode, message = enqueue_document_analysis(job.id, background_tasks=background_tasks)
    db.refresh(job)

    return AnalysisJobEnqueueResponse(
        job_id=job.id,
        status=job.status,
        execution_mode=execution_mode,
        message=message,
    )


@router.get("/jobs/{job_id}", response_model=AnalysisJobStatusResponse)
def get_analysis_job_status(
    job_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> AnalysisJobStatusResponse:
    job = db.scalar(
        select(AnalysisJob).where(AnalysisJob.id == job_id, AnalysisJob.user_id == user.id)
    )
    if not job:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Analysis job not found")

    return AnalysisJobStatusResponse(
        job_id=job.id,
        document_id=job.document_id,
        status=job.status,
        progress=job.progress,
        result=job.result,
        error_message=job.error_message,
    )


@router.post("/{document_id}", response_model=FeedbackReportResponse)
def analyze_document(
    document_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> FeedbackReportResponse:
    document = db.scalar(
        select(Document).where(Document.id == document_id, Document.user_id == user.id)
    )
    if not document:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    try:
        report = analyze_text(document.content)
    except AIProviderError as exc:
        detail = str(exc)
        raise HTTPException(status_code=_map_ai_error_status(detail), detail=detail) from exc

    saved = FeedbackReport(
        user_id=user.id,
        document_id=document.id,
        grammar_score=report.grammar_score,
        clarity_score=report.clarity_score,
        logic_score=report.logic_score,
        structure_score=report.structure_score,
        tone_score=report.tone_score,
        overall_score=report.overall_score,
        readability_score=report.readability_score,
        issues=[issue.model_dump() for issue in report.issues],
        recommendations=report.recommendations,
    )
    db.add(saved)
    db.commit()

    return report
