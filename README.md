# WriterLoop AI

WriterLoop AI is a reading + writing workspace with:
- Reader (`/reader`): custom document reading (PDF/EPUB/DOCX/TXT/MD), highlights, selection-to-AI, translation, and semantic search.
- Editor (`/editor`): Gemini-powered grammar/spelling correction, rewrites, and analysis.

## Architecture

### Default mode (recommended)
Runs **4 containers**:
1. `frontend`
2. `backend`
3. `postgres`
4. `qdrant`

This is the default production architecture for local/dev use.

### Full mode (scaled queue mode)
Runs **6 containers**:
1. `frontend`
2. `backend`
3. `postgres`
4. `qdrant`
5. `redis`
6. `worker`

Use this when you want Celery workers and Redis queues.

Qdrant is always enabled by default (core dependency for semantic search/document chat).

## Ports
- Frontend: `3000`
- Backend API: `8000`
- PostgreSQL: `5432`
- Qdrant: `6333`
- Redis (full mode only): `6379`

## Quick Start (Docker)

```bash
cp .env.example .env
bash scripts/dev-up-detached.sh
```

Open:
- `http://localhost:3000`
- `http://localhost:8000/docs`

Check status:

```bash
docker compose ps
```

Stream logs:

```bash
docker compose logs -f frontend backend
```

Stop:

```bash
bash scripts/dev-down.sh
```

## Full Mode (Docker)

```bash
cp .env.example .env
bash scripts/dev-up-full-detached.sh
```

Stop full mode:

```bash
bash scripts/dev-down.sh
```

## Cleanup Commands

Remove build cache + dangling images:

```bash
bash scripts/docker-clean.sh
```

Full project reset (containers + volumes + local images):

```bash
bash scripts/dev-reset.sh
```

## Local Run (without Docker)

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

### Frontend

```bash
cd frontend
npm ci
npm run dev
```

Open `http://localhost:3000`.

## Environment Variables

Copy and edit:

```bash
cp .env.example .env
```

Important variables:
- `APP_ENV` (`development`, `staging`, `production`)
- `GEMINI_API_KEY`
- `JWT_SECRET`
- `CORS_ORIGINS`
- `DATABASE_URL`
- `QDRANT_URL`
- `TASK_EXECUTION_MODE` (`background`, `inline`, `celery`)
- `SETUP_ACCESS_TOKEN` (recommended for key setup endpoint protection)

## Security Notes

- Gemini key is handled by backend endpoint `POST /api/v1/settings/gemini-key` and stored in backend runtime env file.
- In non-dev environments, set a strong `JWT_SECRET` (app will fail startup if left default).
- Restrict `CORS_ORIGINS` to trusted domains only.
- For public deployment, use HTTPS and set `APP_ENV=production`.
- Set `SETUP_ACCESS_TOKEN` to protect runtime key setup endpoint (non-loopback setup requests require it).
- Put backend behind an API gateway/reverse proxy with rate limiting and authentication for AI-heavy endpoints.
- `.env` is ignored by git and must never be committed.

## Production Deployment Shapes

### Development / single machine
- `frontend`, `backend`, `postgres`, `qdrant`

### Small VPS
- `frontend`, `backend`, `qdrant`
- external managed PostgreSQL (Supabase/Neon/Railway)

### Scaled
- `frontend`, `backend`, `qdrant`, `redis`, `worker`
- external managed PostgreSQL

## Quality Checks

```bash
cd frontend && npm run lint && npm run build
```

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
pytest ../tests/backend -q
```

## Documentation
- [Architecture](docs/architecture.html)
- [Deployment](docs/deployment.md)
- [API](docs/api.md)
# writerloop-ai
