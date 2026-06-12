export type FeedbackIssue = {
  category: string;
  message: string;
  severity: string;
  span?: string | null;
};

export type FeedbackReport = {
  grammar_score: number;
  clarity_score: number;
  logic_score: number;
  structure_score: number;
  tone_score: number;
  overall_score: number;
  readability_score: number;
  issues: FeedbackIssue[];
  recommendations: string[];
};

export type ReaderSimulation = {
  role: string;
  questions: string[];
  confusions: string[];
  objections: string[];
  suggestions: string[];
};

export type UploadedSection = {
  label: string;
  content: string;
};

export type UploadedDocument = {
  id: string;
  title: string;
  filename: string;
  extension: string;
  size_bytes: number;
  word_count: number;
  content: string;
  sections: UploadedSection[];
};

export type FileIngestResponse = {
  total_files: number;
  total_bytes: number;
  max_total_bytes: number;
  documents: UploadedDocument[];
  warnings: string[];
};

export type AskSelectionResponse = {
  answer: string;
};

export type LiveCorrectionResponse = {
  corrected_text: string;
  corrections: number;
  changed: boolean;
};

export type ExplainSelectionResponse = {
  definition: string;
  meaning_in_context: string;
  usage_examples: string[];
  concise_explanation: string;
  detected_language: string;
  translation_to_english: string;
  math_interpretation: string;
  math_solution: string;
};

export type ExplainImageResponse = {
  concise_explanation: string;
  key_points: string[];
  detected_language: string;
  translated_text: string;
  math_solution: string;
};

export type ChapterSummary = {
  chapter: string;
  summary: string;
};

export type SummarizeBookResponse = {
  overall_summary: string;
  key_themes: string[];
  main_characters: string[];
  chapter_breakdown: ChapterSummary[];
};

export type TranslateSelectionResponse = {
  translated_text: string;
  detected_source_language: string;
  notes: string;
};

export type DocumentChatResponse = {
  answer: string;
  used_snippets: number;
};

export type LibraryIndexDocument = {
  book_id: string;
  title: string;
  text: string;
};

export type LibraryIndexResponse = {
  indexed_documents: number;
  indexed_chunks: number;
  skipped_documents: number;
};

export type SemanticSearchResult = {
  chunk_id: string;
  book_id: string;
  title: string;
  chunk_text: string;
  score: number;
};

export type SemanticSearchResponse = {
  results: SemanticSearchResult[];
  total: number;
};

export type GeminiKeyStatusResponse = {
  configured: boolean;
};

export type GeminiKeyUpdateResponse = {
  configured: boolean;
  persisted_to_env: boolean;
  message: string;
};
