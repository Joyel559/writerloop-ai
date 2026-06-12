from pydantic import BaseModel, Field


class FeedbackIssue(BaseModel):
    category: str
    message: str
    severity: str = "medium"
    span: str | None = None


class FeedbackReportResponse(BaseModel):
    grammar_score: int
    clarity_score: int
    logic_score: int
    structure_score: int
    tone_score: int
    overall_score: int
    readability_score: float
    issues: list[FeedbackIssue] = Field(default_factory=list)
    recommendations: list[str] = Field(default_factory=list)


class QuickAnalysisRequest(BaseModel):
    text: str


class RewriteRequest(BaseModel):
    text: str
    mode: str


class RewriteResponse(BaseModel):
    rewritten_text: str


class LiveCorrectionRequest(BaseModel):
    text: str
    previous_text: str | None = None


class LiveCorrectionResponse(BaseModel):
    corrected_text: str
    corrections: int = 0
    changed: bool = False


class ReaderSimulationRequest(BaseModel):
    text: str
    role: str


class ReaderSimulationResponse(BaseModel):
    role: str
    questions: list[str]
    confusions: list[str]
    objections: list[str]
    suggestions: list[str]


class UploadedSection(BaseModel):
    label: str
    content: str


class UploadedDocument(BaseModel):
    id: str
    title: str
    filename: str
    extension: str
    size_bytes: int
    word_count: int
    content: str
    sections: list[UploadedSection] = Field(default_factory=list)


class FileIngestResponse(BaseModel):
    total_files: int
    total_bytes: int
    max_total_bytes: int
    documents: list[UploadedDocument] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)


class AskSelectionRequest(BaseModel):
    text: str
    question: str = "Explain this in simple words."
    context: str | None = None


class AskSelectionResponse(BaseModel):
    answer: str


class ExplainSelectionRequest(BaseModel):
    selected_text: str
    surrounding_context: str | None = None


class ExplainSelectionResponse(BaseModel):
    definition: str
    meaning_in_context: str
    usage_examples: list[str] = Field(default_factory=list)
    concise_explanation: str
    detected_language: str = ""
    translation_to_english: str = ""
    math_interpretation: str = ""
    math_solution: str = ""


class ExplainImageRequest(BaseModel):
    image_url: str
    prompt: str = "Explain this image."
    surrounding_context: str | None = None


class ExplainImageResponse(BaseModel):
    concise_explanation: str
    key_points: list[str] = Field(default_factory=list)
    detected_language: str = ""
    translated_text: str = ""
    math_solution: str = ""


class ChapterSummary(BaseModel):
    chapter: str
    summary: str


class SummarizeBookRequest(BaseModel):
    text: str
    title: str | None = None


class SummarizeBookResponse(BaseModel):
    overall_summary: str
    key_themes: list[str] = Field(default_factory=list)
    main_characters: list[str] = Field(default_factory=list)
    chapter_breakdown: list[ChapterSummary] = Field(default_factory=list)


class TranslateSelectionRequest(BaseModel):
    selected_text: str
    target_language: str = "English"
    surrounding_context: str | None = None


class TranslateSelectionResponse(BaseModel):
    translated_text: str
    detected_source_language: str = ""
    notes: str = ""


class DocumentChatRequest(BaseModel):
    question: str
    book_title: str | None = None
    snippets: list[str] = Field(default_factory=list)


class DocumentChatResponse(BaseModel):
    answer: str
    used_snippets: int = 0


class LibraryIndexDocument(BaseModel):
    book_id: str
    title: str
    text: str


class LibraryIndexRequest(BaseModel):
    documents: list[LibraryIndexDocument] = Field(default_factory=list)


class LibraryIndexResponse(BaseModel):
    indexed_documents: int
    indexed_chunks: int
    skipped_documents: int


class SemanticSearchRequest(BaseModel):
    query: str
    limit: int = 8
    book_id: str | None = None


class SemanticSearchResult(BaseModel):
    chunk_id: str
    book_id: str
    title: str
    chunk_text: str
    score: float


class SemanticSearchResponse(BaseModel):
    results: list[SemanticSearchResult] = Field(default_factory=list)
    total: int = 0


class AnalysisJobEnqueueResponse(BaseModel):
    job_id: str
    status: str
    execution_mode: str
    message: str


class AnalysisJobStatusResponse(BaseModel):
    job_id: str
    document_id: str
    status: str
    progress: int
    result: dict | None = None
    error_message: str | None = None
