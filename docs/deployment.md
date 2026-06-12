# WriterLoop AI Deployment Guide

## Profiles

### 1) Development (default)
Services:
- frontend
- backend
- postgres
- qdrant

Run:

```bash
cd /home/john/Documents/funproject/writerloop-ai
bash scripts/dev-up-detached.sh
```

### 2) Production Small VPS
Services:
- frontend
- backend
- qdrant
- external managed PostgreSQL

Set `.env`:

```bash
DATABASE_URL=postgresql+psycopg://USER:PASSWORD@HOST:5432/DBNAME
```

Start selected services:

```bash
docker compose up -d frontend backend qdrant
```

### 3) Production Scaled
Services:
- frontend
- backend
- qdrant
- redis
- worker
- external managed PostgreSQL

Start full stack:

```bash
cd /home/john/Documents/funproject/writerloop-ai
bash scripts/dev-up-full-detached.sh
```

Set queue mode for scaled profile:

```bash
TASK_EXECUTION_MODE=celery
```

## Managed PostgreSQL Providers

Compatible options:
- Supabase Postgres
- Neon Postgres
- Railway Postgres

All use the same `DATABASE_URL` format supported by SQLAlchemy + psycopg.

## Qdrant

Qdrant is required and enabled in default profile.

Persistence:
- Docker volume: `qdrant_data:/qdrant/storage`

Memory/disk optimization:
- `QDRANT__STORAGE__ON_DISK_PAYLOAD=true` is enabled in compose.

## Celery and Redis

- Celery/Redis are optional for scale and asynchronous queue workloads.
- Default runtime uses lightweight execution without Redis:
  - `TASK_EXECUTION_MODE=background` (FastAPI BackgroundTasks)

Modes:
- `background`: no Redis/Celery required
- `inline`: execute in API process
- `celery`: enqueue to worker (requires Redis + worker service)

## Operations

Status:

```bash
docker compose ps
```

Logs:

```bash
docker compose logs -f frontend backend
```

Stop:

```bash
bash scripts/dev-down.sh
```

Reset project containers/volumes/images:

```bash
bash scripts/dev-reset.sh
```

Cleanup build cache and dangling images:

```bash
bash scripts/docker-clean.sh
```
