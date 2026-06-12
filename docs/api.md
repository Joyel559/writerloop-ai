# API Summary

Base URL: `/api/v1`

## Health

- `GET /health` -> service status

## Auth

- `POST /auth/signup`
- `POST /auth/login`
- `GET /auth/me`

## Documents

- `POST /documents` (create from text)
- `POST /documents/upload` (PDF/DOCX/TXT/MD/EPUB/HTML)
- `GET /documents`
- `GET /documents/{document_id}`

## Analysis

- `POST /analysis/quick`
- `POST /analysis/rewrite`
- `POST /analysis/live-correct` (Gemini spell/grammar correction for live editor typing)
- `POST /analysis/simulate-reader`
- `POST /analysis/ingest-files` (public reader upload, max total 20MB per request)
- `POST /analysis/ask-selection` (explain selected text, word meaning, or scoped range)
- `POST /analysis/explain-selection`
- `POST /analysis/translate-selection`
- `POST /analysis/summarize-book`
- `POST /analysis/chat-document`
- `POST /analysis/index-library` (chunk + vector index for semantic retrieval)
- `POST /analysis/search-library`
- `POST /analysis/{document_id}/jobs` (queue analysis via inline/background/celery mode)
- `GET /analysis/jobs/{job_id}` (poll async analysis job status/result)
- `POST /analysis/{document_id}`

## Settings

- `GET /settings/gemini-key/status`
- `POST /settings/gemini-key`
