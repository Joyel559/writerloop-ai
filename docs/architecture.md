# WriterLoop AI Architecture (v1 Scaffold)

## Overview

WriterLoop AI is organized as a split frontend/backend architecture with asynchronous job support.

- Frontend: Next.js 15, TypeScript, Tailwind, custom Reader + Editor shells
- Backend: FastAPI, SQLAlchemy, JWT auth, ingestion + analysis services
- Worker: Celery with Redis broker
- Datastores: PostgreSQL (relational), Qdrant (vector), Redis (queue/cache)

## Data Flow

1. User writes or uploads content.
2. Backend extracts and cleans text.
3. Text is analyzed via Gemini API (or fallback heuristics when key is absent).
4. Feedback report is returned and can be persisted.
5. Optional async analysis can run through Celery tasks.

## Core Tables

- `users`
- `documents`
- `document_versions`
- `feedback_reports`
- `ai_conversations`
- `analysis_jobs`
- `settings`
- `notifications`

## Security Notes

- API key remains backend-only (`GEMINI_API_KEY` env var via settings endpoint or env).
- JWT tokens are signed server-side.
- File extension validation exists for upload path.
- Add antivirus scanning + request-level rate limiting in next phase.
