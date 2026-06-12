# WriterLoop AI

[![FastAPI](https://img.shields.io/badge/FastAPI-005571?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![Next.js](https://img.shields.io/badge/next.js-000000?style=for-the-badge&logo=nextdotjs&logoColor=white)](https://nextjs.org/)
[![Qdrant](https://img.shields.io/badge/Qdrant-neutral?style=for-the-badge&logo=qdrant&logoColor=red)](https://qdrant.tech/)
[![Docker](https://img.shields.io/badge/docker-%230db7ed.svg?style=for-the-badge&logo=docker&logoColor=white)](https://www.docker.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)

WriterLoop AI is an intelligent reading and writing workspace powered by Google Gemini, PostgreSQL, and the Qdrant Vector Database. It is designed to create a continuous feedback loop that helps authors, researchers, and professionals refine their text through interactive, AI-assisted tools.

---

## Visual Showcase

### Workspace Homepage
The central hub to setup your API keys, navigate to the apps, and check current system statuses.

<p align="center">
  <img src="assets/home.png" width="100%" alt="WriterLoop AI Homepage" style="border-radius: 12px; box-shadow: 0 4px 30px rgba(0,0,0,0.15);" />
</p>

---

### Reader Workspace (/reader)
Render your files (PDF, EPUB, DOCX, TXT, MD) in a clean, visual layout. Highlight text, query AI on-demand, translate sections, and perform deep semantic vector search on your document library.

<p align="center">
  <img src="assets/read.png" width="100%" alt="Reader App Interface" style="border-radius: 12px; box-shadow: 0 4px 30px rgba(0,0,0,0.15);" />
</p>

---

### Live AI Editor Correction (/editor)
Type with real-time AI intervention. Watch as Gemini automatically highlights structural and spelling mistakes, and refines them instantly.

<table width="100%" border="0" cellspacing="0" cellpadding="0">
  <tr>
    <td width="50%" align="center" style="border: none;">
      <h4>Mistake Detected</h4>
      <img src="assets/writermis.png" width="96%" alt="Mistake" style="border-radius: 8px; box-shadow: 0 4px 15px rgba(0,0,0,0.1);" />
    </td>
    <td width="50%" align="center" style="border: none;">
      <h4>AI Corrected</h4>
      <img src="assets/writer.png" width="96%" alt="Corrected" style="border-radius: 8px; box-shadow: 0 4px 15px rgba(0,0,0,0.1);" />
    </td>
  </tr>
</table>

---

### Document Generation Examples
Transform brief outlines and raw text into expanded, rich, and formatted long-form articles.

<table width="100%" border="0" cellspacing="0" cellpadding="0">
  <tr>
    <td width="50%" align="center" style="border: none;">
      <h4>Original Text / Outline</h4>
      <img src="assets/duck.png" width="96%" alt="Duck Example" style="border-radius: 8px; box-shadow: 0 4px 15px rgba(0,0,0,0.1);" />
    </td>
    <td width="50%" align="center" style="border: none;">
      <h4>Expanded Long-Form Article</h4>
      <img src="assets/ducklonger.png" width="96%" alt="Ducker Long Example" style="border-radius: 8px; box-shadow: 0 4px 15px rgba(0,0,0,0.1);" />
    </td>
  </tr>
</table>

---

## Key Features

- **Visual Reader & Highlighter:** Upload documents in PDF, EPUB, DOCX, TXT, or MD format, view them styled, highlight critical sentences, and run targeted AI actions.
- **Live Assistant Editor:** A distraction-free markdown/text editor integrated with a Gemini-powered correction model to clean up grammar, syntax, style, or generate rewrites.
- **Semantic Vector Search:** Built-in Qdrant database indexes all uploaded documents to enable instantaneous conceptual search across your entire workspace library.
- **Unified Dashboard:** Overview of system health, database connections, active background tasks, and direct environment configuration.

---

## Tech Stack

* **Frontend:** Next.js (React), Tailwind CSS, Lucide Icons, Fetch API
* **Backend:** FastAPI, Python, SQLModel (SQLAlchemy)
* **Databases:** PostgreSQL (Relational Data), Qdrant (Vector Engine)
* **AI Engine:** Google Gemini SDK

---

## Quick Start (Docker Compose - Recommended)

Run the entire suite locally with four orchestrated services (frontend, backend, postgres, qdrant).

### 1. Initialize Configuration
```bash
cp .env.example .env
```

### 2. Launch Stack
Launch services in background mode:
```bash
docker compose up --build -d
```
*Or use the pre-built script:*
```bash
bash scripts/dev-up-detached.sh
```

### 3. Access Services
- **Frontend Dashboard:** [http://localhost:3000](http://localhost:3000)
- **API Documentation (Swagger):** [http://localhost:8000/docs](http://localhost:8000/docs)

### 4. Monitor Health
```bash
docker compose ps
docker compose logs -f backend frontend
```

### 5. Stop Stack
```bash
docker compose down --remove-orphans
```

---

## Manual Local Development (Without Docker)

### Prerequisites
- Python 3.10+
- Node.js 18+
- Active PostgreSQL instance
- Active Qdrant instance

### Backend Setup
```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

### Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

---

## Environment Variables

Copy `.env.example` to `.env` and configure key variables:

| Variable | Description | Default / Example |
| :--- | :--- | :--- |
| `APP_ENV` | Mode of operation (`development`, `production`) | `development` |
| `GEMINI_API_KEY` | Gemini AI Developer Key | `AIzaSy...` |
| `JWT_SECRET` | Secret key for hashing tokens | *Set a secure string* |
| `DATABASE_URL` | SQLAlchemy Connection String | `postgresql://writerloop:writerloop@postgres/writerloop` |
| `QDRANT_URL` | Qdrant DB Endpoint | `http://qdrant:6333` |
| `SETUP_ACCESS_TOKEN`| Token protection for setting Gemini key | *Recommended in prod* |

---

## Production & Security Considerations

1. **API Key Setup Protection:** Keep your `SETUP_ACCESS_TOKEN` set and secure to limit runtime configurations to authorized local administrators.
2. **Reverse Proxy / API Gateway:** Put the backend FastAPI application behind Nginx, Caddy, or Cloudflare with rate limits on token generation and LLM query endpoints.
3. **Database Security:** In production, use managed databases (e.g., Supabase, Neon) with SSL connection parameters instead of host-mapped Docker volumes.
4. **Environment Sanitation:** `.env` is ignored by default. Never commit it to version control.

---

## Testing & Validation

Run quality checks and backend unit tests to ensure everything is correct:

```bash
# Frontend Lints and Builds
cd frontend && npm run lint && npm run build

# Backend Unit and Integration Tests
cd backend
source .venv/bin/activate
pytest ../tests/backend -v
```

---

*Made by the WriterLoop AI team.*
