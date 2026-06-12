import {
  AskSelectionResponse,
  DocumentChatResponse,
  ExplainSelectionResponse,
  ExplainImageResponse,
  FeedbackReport,
  FileIngestResponse,
  GeminiKeyStatusResponse,
  GeminiKeyUpdateResponse,
  LibraryIndexDocument,
  LibraryIndexResponse,
  LiveCorrectionResponse,
  ReaderSimulation,
  SemanticSearchResponse,
  SummarizeBookResponse,
  TranslateSelectionResponse
} from "@/lib/types";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000/api/v1";

type RewriteMode =
  | "Make Shorter"
  | "Make Longer"
  | "Make Professional"
  | "Make Technical"
  | "Make Academic"
  | "Make Beginner Friendly"
  | "Make Persuasive"
  | "Make Concise";

async function safeJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const raw = await response.text();
    let message = raw || "Request failed";
    try {
      const parsed = JSON.parse(raw) as { detail?: string };
      if (parsed.detail && typeof parsed.detail === "string") {
        message = parsed.detail;
      }
    } catch {}
    throw new Error(message);
  }
  return response.json() as Promise<T>;
}

export async function quickAnalyze(text: string): Promise<FeedbackReport> {
  const response = await fetch(`${API_BASE}/analysis/quick`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text })
  });
  return safeJson<FeedbackReport>(response);
}

export async function rewriteContent(text: string, mode: RewriteMode): Promise<string> {
  const response = await fetch(`${API_BASE}/analysis/rewrite`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, mode })
  });
  const data = await safeJson<{ rewritten_text: string }>(response);
  return data.rewritten_text;
}

export async function simulateReader(text: string, role: string): Promise<ReaderSimulation> {
  const response = await fetch(`${API_BASE}/analysis/simulate-reader`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, role })
  });
  return safeJson<ReaderSimulation>(response);
}

export async function ingestFiles(files: File[]): Promise<FileIngestResponse> {
  const formData = new FormData();
  files.forEach((file) => {
    formData.append("files", file);
  });

  const response = await fetch(`${API_BASE}/analysis/ingest-files`, {
    method: "POST",
    body: formData
  });
  return safeJson<FileIngestResponse>(response);
}

export async function askSelection(
  text: string,
  question: string,
  context?: string
): Promise<AskSelectionResponse> {
  const response = await fetch(`${API_BASE}/analysis/ask-selection`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, question, context })
  });
  return safeJson<AskSelectionResponse>(response);
}

export async function liveCorrectText(
  text: string,
  previousText?: string,
  signal?: AbortSignal
): Promise<LiveCorrectionResponse> {
  const response = await fetch(`${API_BASE}/analysis/live-correct`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, previous_text: previousText }),
    signal
  });
  return safeJson<LiveCorrectionResponse>(response);
}

export async function explainSelectionWithGemini(
  selectedText: string,
  surroundingContext?: string
): Promise<ExplainSelectionResponse> {
  const response = await fetch(`${API_BASE}/analysis/explain-selection`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      selected_text: selectedText,
      surrounding_context: surroundingContext
    })
  });
  return safeJson<ExplainSelectionResponse>(response);
}

export async function explainImageWithGemini(
  imageUrl: string,
  prompt = "Explain this image.",
  surroundingContext?: string
): Promise<ExplainImageResponse> {
  const response = await fetch(`${API_BASE}/analysis/explain-image`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      image_url: imageUrl,
      prompt,
      surrounding_context: surroundingContext
    })
  });
  return safeJson<ExplainImageResponse>(response);
}

export async function summarizeBookWithGemini(
  text: string,
  title?: string
): Promise<SummarizeBookResponse> {
  const response = await fetch(`${API_BASE}/analysis/summarize-book`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, title })
  });
  return safeJson<SummarizeBookResponse>(response);
}

export async function translateSelectionWithGemini(
  selectedText: string,
  targetLanguage: string,
  surroundingContext?: string
): Promise<TranslateSelectionResponse> {
  const response = await fetch(`${API_BASE}/analysis/translate-selection`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      selected_text: selectedText,
      target_language: targetLanguage,
      surrounding_context: surroundingContext
    })
  });
  return safeJson<TranslateSelectionResponse>(response);
}

export async function chatDocumentWithGemini(
  question: string,
  snippets: string[],
  bookTitle?: string
): Promise<DocumentChatResponse> {
  const response = await fetch(`${API_BASE}/analysis/chat-document`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      question,
      snippets,
      book_title: bookTitle
    })
  });
  return safeJson<DocumentChatResponse>(response);
}

export async function indexLibraryDocuments(
  documents: LibraryIndexDocument[]
): Promise<LibraryIndexResponse> {
  const response = await fetch(`${API_BASE}/analysis/index-library`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ documents })
  });
  return safeJson<LibraryIndexResponse>(response);
}

export async function semanticSearchLibrary(
  query: string,
  limit = 8,
  bookId?: string
): Promise<SemanticSearchResponse> {
  const response = await fetch(`${API_BASE}/analysis/search-library`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query,
      limit,
      book_id: bookId
    })
  });
  return safeJson<SemanticSearchResponse>(response);
}

export async function getGeminiKeyStatus(): Promise<GeminiKeyStatusResponse> {
  const response = await fetch(`${API_BASE}/settings/gemini-key/status`);
  return safeJson<GeminiKeyStatusResponse>(response);
}

export async function saveGeminiKey(geminiApiKey: string): Promise<GeminiKeyUpdateResponse> {
  const response = await fetch(`${API_BASE}/settings/gemini-key`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ gemini_api_key: geminiApiKey })
  });
  return safeJson<GeminiKeyUpdateResponse>(response);
}
