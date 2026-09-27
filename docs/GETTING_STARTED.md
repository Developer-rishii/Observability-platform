# Getting Started — Observability Platform

## 1. What This Project Is

The Observability Platform is an AI-powered cloud monitoring system that ingests events from a custom monitoring agent, detects anomalies using machine learning, correlates them into incidents, and generates automated Root Cause Analyses (RCA) using Google Gemini and a RAG pipeline backed by Qdrant. It is **not** a developer marketplace or e-commerce application.

---

## 2. Repository Map

| Folder | Status | Description |
|---|---|---|
| `backend/` | ✅ Implemented (partial) | FastAPI backend — auth, event ingestion, routers, DB schema |
| `frontend/` | ✅ Implemented (partial) | Next.js dashboard — skeleton screens, design system |
| `docs/` | ✅ Maintained | Architecture, roadmap, and workflow documentation |
| `agent/` | 🔴 Empty — not started | Monitoring agent (Prometheus/Loki/Docker event collector). Owner: Rushikesh |
| `ml/` | 🔴 Empty — not started | Isolation Forest anomaly detection model. Owner: Sayali |
| `rag/` | 🔴 Empty — not started | Qdrant ingestion, chunking, and retrieval pipeline. Owner: Pooja |
| `infrastructure/` | 🔴 Empty — placeholder | Terraform / Kubernetes configs for production deployment |
| `tests/` | 🔴 Empty — not started | Integration and end-to-end test suite |
| `.github/` | ✅ Configured | CI/CD workflow (backend lint, frontend build, Docker build) |

---

## 3. Local Setup (Step by Step)

### Prerequisites
- Docker Desktop running
- Python 3.11+
- Node.js 20+
- Alembic installed globally or via venv

### Steps

```bash
# 1. Clone the repository
git clone <repo-url>
cd observability-platform

# 2. Copy the example env file and fill in real values
cp .env.example .env
# Open .env and set: JWT_SECRET, GEMINI_API_KEY, AGENT_SHARED_SECRET

# 3. Start the database, Qdrant, and backend services
docker compose up --build

# 4. Run database migrations (in a new terminal)
cd backend
alembic upgrade head

# 5. Start the frontend
cd ../frontend
npm install
npm run dev
```

### Expected URLs
| Service | URL |
|---|---|
| FastAPI (Swagger UI) | http://localhost:8000/docs |
| FastAPI (Health Check) | http://localhost:8000/api/v1/health |
| Frontend (Next.js) | http://localhost:3000 |
| Qdrant Web UI | http://localhost:6333 |
| PostgreSQL | localhost:5432 |

---

## 4. How Config Works

All configuration is managed by the `Settings` class in [`backend/app/core/config.py`](file:///d:/Projects/observability-platform/backend/app/core/config.py). It uses `pydantic-settings` with `model_config = SettingsConfigDict(env_file=".env", ...)`, which means **`.env` is loaded automatically** — no manual `os.getenv()` calls are needed. Add new config variables to `Settings` and `.env.example` together.

---

## 5. Branching & Commit Rules

See [`docs/16-developer-workflow.md`](file:///d:/Projects/observability-platform/docs/16-developer-workflow.md) for the full branching strategy, naming conventions, and quality checklist. Do not duplicate it here.

---

## 6. Ownership Map

Each person owns a full vertical slice: backend module + the frontend screens that consume it + tests for that slice. This keeps merge conflicts low and gives each person a demoable piece of ownership at any point.

| Area | Owner |
|---|---|
| Monitoring agent, Prometheus/Loki/Alloy, Docker events | Rushikesh |
| Ingestion API (`events.py`, `metrics.py`, `logs.py`), auth (`auth.py`), core DB schema, CI/CD, deployment | Rushikesh |
| Frontend: Servers, Events, Logs, Alerts, Settings screens | Rushikesh |
| ML anomaly detection (features, model, evaluation, fault-injection dataset) | Sayali |
| Incident Correlation Engine, Incidents API/lifecycle (`incidents.py`, `alerts.py`) | Sayali |
| Frontend: Incidents list, Incident Detail (evidence side), System Health | Sayali |
| RAG pipeline (ingestion, chunking, embeddings, Qdrant, retrieval), Gemini integration + prompt builder (`ai.py`, `rag.py`) | Pooja |
| Overall frontend architecture/design system | Pooja |
| Frontend: Login, Overview, Metrics view, AI RCA panel, Settings shell | Pooja |

**Shared / reviewed, not solely owned:**
- **Database schema**: Rushikesh drafts; Sayali reviews any incident-table changes.
- **`frontend/src/components/`** (shared design-system atoms): Pooja owns/reviews for consistency; Rushikesh and Sayali may add via PR.
- **Cross-track contracts**:
  - Any change to the `incident_context` JSON shape (Sayali's output, consumed by Pooja's prompt builder) **must be flagged to Pooja before merge**.
  - Any change to the Gemini response JSON schema (Pooja's output, consumed by Sayali's correlation view and the frontend) **must be flagged to both Sayali and Rushikesh before merge**.
  - These are the two boundaries most likely to drift silently.

---

## 7. The One Rule That Matters Most Right Now

> **Nothing gets built in `ml/`, `rag/`, or `agent/` until the layer it depends on is real.**

- `ml/` depends on real events flowing through `/api/v1/events` and stored in the DB.
- `rag/` depends on a working Qdrant connection and the `knowledge_documents` table being populated.
- `agent/` depends on the ingestion API (`/api/v1/events`) being auth-protected and accepting the expected payload shape.

Building against APIs or data structures that don't exist yet produces integration debt that costs more to undo than it would have cost to wait. See the full dependency order in [`docs/11-development-roadmap.md`](file:///d:/Projects/observability-platform/docs/11-development-roadmap.md).
