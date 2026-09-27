# 15. Sprint Plan — Observability Platform Setup & Delivery
---

## Day-by-Day Plan (Detailed)

### DAY 1: Auth Foundation, Incident Schema & Frontend Shell

#### Rushikesh — Task: Docker Infra, Auth Model & Login API (`Module: Platform Foundation`)
* **Branch**: `feature/rushikesh-day1-infra-auth`
* **Database Model (`backend/app/models/user.py`)**: Define `User` model — `id`, `email`, `password_hash`, `role` (default `"engineer"`), `created_at`.
* **Backend Files**:
  * `backend/app/core/config.py` — Settings class loading `.env` (DB URL, JWT secret).
  * `backend/app/core/database.py` — SQLAlchemy engine + session setup.
  * `backend/app/core/security.py` — password hashing (bcrypt) + JWT create/verify helpers.
  * `backend/app/api/v1/auth.py` — stub only today (`POST /api/v1/auth/login` — logic tomorrow).
* **Infra Files**:
  * `docker-compose.yml` — services: `db` (Postgres), `prometheus`, `workload-generator`.
  * `infrastructure/prometheus/prometheus.yml` — scrape config targeting `workload-generator`.
  * `infrastructure/workload-generator/Dockerfile` + `app.py` — a tiny Flask/FastAPI app exposing `POST /spike` that burns CPU for N seconds so we have something real to monitor.
* **Command to run**: `docker compose up --build -d` then `alembic revision --autogenerate -m "init users table"` → `alembic upgrade head`.

#### Sayali — Task: Incident & Alert Schema + Threshold Logic (`Module: Detection Foundation`)
* **Branch**: `feature/sayali-day1-incident-schema`
* **Database Model (`backend/app/models/incident.py`)**: Define `Incident` model — `id`, `metric_name`, `metric_value` (Float), `threshold` (Float), `severity` (`"warning"`/`"critical"`), `status` (default `"open"`), `triggered_at`, `resolved_at` (nullable). Define `Alert` model — `id`, `incident_id` (FK), `message`, `created_at`.
* **Backend Files**:
  * `backend/app/api/v1/incidents.py` — stub router, `GET /api/v1/incidents` returns `[]` for now.
  * `backend/app/services/detection/threshold_checker.py` — **pure function**: `def is_breach(value: float, threshold: float) -> bool`. No live data wiring yet — this is deliberately isolated so it's testable today without Rushikesh's API existing.
* **Test File**: `backend/tests/test_threshold_checker.py` — assert `is_breach(85, 80) == True`, `is_breach(50, 80) == False`.
* **Command to run**: `alembic revision --autogenerate -m "add incidents and alerts tables"` → `alembic upgrade head`, then `pytest backend/tests/test_threshold_checker.py`.

#### Pooja — Task: Frontend Scaffold & AI Skeleton (`Module: Dashboard Shell`)
* **Branch**: `feature/pooja-day1-frontend-shell`
* **Frontend Setup**: `npm create vite@latest frontend -- --template react-ts`, install `axios`, `react-router-dom`, `recharts`.
* **Frontend Files**:
  * `frontend/src/routes/AppRoutes.tsx` — route table: `/login`, `/dashboard`, `/incidents`, `/incidents/:id`.
  * `frontend/src/layouts/DashboardLayout.tsx` — sidebar + header shell (no real data yet).
  * `frontend/src/pages/LoginPage.tsx` — placeholder form (wired to real API tomorrow).
  * `frontend/src/styles/tokens.css` — color palette + spacing variables so all screens look consistent from day one.
* **Backend Files** (skeleton only, no logic):
  * `backend/app/services/ai/prompt_builder.py` — empty `def build_prompt(...): pass`.
  * `backend/app/services/ai/llm_client.py` — empty `def call_llm(prompt: str): pass`.
* **Command to run**: `cd frontend && npm install && npm run dev` — confirm it loads at `localhost:5173`.

---

### DAY 2: Real Auth, Metrics Proxy & Login Wiring

#### Rushikesh — Task: Real Login API & Metrics Proxy (`Module: Auth + Ingestion`)
* **Branch**: `feature/rushikesh-day2-auth-metrics`
* **Backend Files**:
  * `backend/app/api/v1/auth.py` — implement `POST /api/v1/auth/login` (verify password, return JWT).
  * `backend/app/services/ingestion/prometheus_client.py` — `def query_range(metric: str, minutes: int) -> list[dict]` calling Prometheus's HTTP API.
  * `backend/app/api/v1/metrics.py` — `GET /api/v1/metrics/query?metric=cpu&range=5m`, returns real data via `prometheus_client.py`.
* **Command to run**: `uvicorn app.main:app --reload`, then `curl http://localhost:8000/api/v1/metrics/query?metric=cpu&range=5m` — confirm real numbers come back, not a placeholder.

#### Sayali — Task: Scheduler Skeleton (`Module: Detection Foundation`)
* **Branch**: `feature/sayali-day2-scheduler-skeleton`
* **Backend Files**:
  * `backend/app/services/detection/scheduler.py` — set up `APScheduler`, register a job that runs every 15s (job body is a `pass` stub today — wired to real data tomorrow).
* **Test File**: `backend/tests/test_scheduler.py` — confirm the scheduler starts and the job fires at least once within 20s.
* **Command to run**: `pytest backend/tests/test_scheduler.py`.

#### Pooja — Task: Login Screen Wired to Real API (`Module: Auth UI`)
* **Branch**: `feature/pooja-day2-login-wiring`
* **Frontend Files**:
  * `frontend/src/pages/LoginPage.tsx` — real form calling `POST /api/v1/auth/login`.
  * `frontend/src/context/AuthContext.tsx` — stores JWT in memory, exposes `login()`/`logout()`.
  * `frontend/src/components/ProtectedRoute.tsx` — redirects to `/login` if no token.
* **Command to run**: `npm run dev` — log in with the seeded user, confirm redirect to `/dashboard`.

---

### DAY 3: Metrics on the Dashboard + Detection Goes Live

#### Rushikesh — Task: Metrics Range Support & Health Check (`Module: Ingestion Polish`)
* **Branch**: `feature/rushikesh-day3-metrics-range-health`
* **Backend Files**:
  * `backend/app/api/v1/metrics.py` — add configurable time-range query param (`5m`, `15m`, `1h`).
  * `backend/app/api/v1/health.py` — `GET /api/v1/system/health` checks DB + Prometheus reachability, returns `{"db": "ok", "prometheus": "ok"}`.
* **Command to run**: `curl http://localhost:8000/api/v1/system/health`.

#### Sayali — Task: Wire Detection to Real Metrics (`Module: Live Threshold Detection`)
* **Branch**: `feature/sayali-day3-live-detection`
* **Backend Files**:
  * `backend/app/services/detection/threshold_checker.py` — now calls Rushikesh's `metrics.py` service, uses `is_breach()` from Day 1, and on breach creates a real `Incident` + `Alert` row.
  * `backend/app/repositories/incident_repository.py` — `create_incident(...)`, `get_open_incident_for_metric(...)` (prevents duplicate spam).
* **Command to run**: hit `POST /spike` on the workload-generator, watch a real row appear: `psql` or `SELECT * FROM incidents;`.

#### Pooja — Task: Live Dashboard Chart (`Module: Dashboard`)
* **Branch**: `feature/pooja-day3-dashboard-chart`
* **Frontend Files**:
  * `frontend/src/pages/DashboardPage.tsx` — page layout.
  * `frontend/src/components/MetricChart.tsx` — Recharts line chart, polls `/api/v1/metrics/query` every 5s.
  * `frontend/src/api/metricsApi.ts` — `getMetrics(metric, range)` fetch wrapper.
* **Command to run**: `npm run dev` — trigger a spike, watch the chart move live.

---

### DAY 4: Incidents API & Incidents UI

#### Rushikesh — Task: Stabilize + Documentation (`Module: Support`)
* **Branch**: `feature/rushikesh-day4-stabilize-docs`
* **Files**: `README.md` — write the exact local setup steps (clone → `.env` → `docker compose up --build` → `alembic upgrade head` → `npm run dev`).
* **Command to run**: `docker compose down -v && docker compose up --build` — confirm a truly clean start works, following your own README.

#### Sayali — Task: Incidents List & Detail API (`Module: Incidents API`)
* **Branch**: `feature/sayali-day4-incidents-api`
* **Backend Files**:
  * `backend/app/schemas/incident.py` — Pydantic `IncidentOut` schema (`id`, `metric_name`, `metric_value`, `threshold`, `severity`, `status`, `triggered_at`).
  * `backend/app/api/v1/incidents.py` — implement `GET /api/v1/incidents` (list, optional `?status=open`) and `GET /api/v1/incidents/{id}`.
* **Command to run**: `pytest backend/tests/test_incidents_api.py`.

#### Pooja — Task: Incidents List & Detail Screens (`Module: Incidents UI`)
* **Branch**: `feature/pooja-day4-incidents-ui`
* **Frontend Files**:
  * `frontend/src/pages/IncidentsListPage.tsx` — table of incidents (severity badge, timestamp).
  * `frontend/src/pages/IncidentDetailPage.tsx` — shows the real evidence (metric, value, threshold).
  * `frontend/src/api/incidentsApi.ts` — `getIncidents()`, `getIncidentById(id)`.
* **Command to run**: `npm run dev` — click into a real incident, confirm evidence matches the DB row.

---

### DAY 5: Minimal AI Root Cause Analysis

#### Rushikesh — Task: LLM Call Infrastructure (`Module: AI Infra Support`)
* **Branch**: `feature/rushikesh-day5-llm-infra`
* **Backend Files**:
  * `backend/app/core/config.py` — add `LLM_API_KEY`, `LLM_TIMEOUT_SECONDS`.
  * `backend/app/services/ai/llm_client.py` — implement `call_llm(prompt: str) -> dict` with a timeout + one retry, raising a clear `LLMUnavailableError` on failure (never a silent crash).
* **Command to run**: `pytest backend/tests/test_llm_client.py` (mock the API call).

#### Sayali — Task: Build the `incident_context` Contract (`Module: Correlation Foundation`)
* **Branch**: `feature/sayali-day5-incident-context`
* **Backend Files**:
  * `backend/app/services/correlation/incident_context.py` — `def build_incident_context(incident) -> dict`, returning `{"metric_name", "metric_value", "threshold", "triggered_at", "service": "workload-generator"}`.
* **Test File**: `backend/tests/test_incident_context.py`.
* **Command to run**: `pytest backend/tests/test_incident_context.py`.

#### Pooja — Task: Prompt Builder & Analyze Endpoint (`Module: AI RCA`)
* **Branch**: `feature/pooja-day5-ai-analyze-endpoint`
* **Backend Files**:
  * `backend/app/services/ai/prompt_builder.py` — `build_prompt(incident_context: dict) -> str`.
  * `backend/app/schemas/rca.py` — Pydantic `RCAOut` (`summary`, `probable_cause`, `confidence`, `next_steps`).
  * `backend/app/api/v1/ai.py` — `POST /api/v1/incidents/{id}/analyze` — builds context → builds prompt → calls LLM → validates against `RCAOut` → returns it.
* **Command to run**: `curl -X POST http://localhost:8000/api/v1/incidents/1/analyze` — confirm a real, structured JSON response.

---

### DAY 6: Wire AI RCA into the UI + System Status

#### Rushikesh — Task: README Finalization & System Health Screen Support (`Module: Support`)
* **Branch**: `feature/rushikesh-day6-readme-health`
* **Files**: `README.md` — add troubleshooting section; `backend/app/api/v1/health.py` — expand response to include Prometheus target status.
* **Command to run**: fresh clone in a new folder, follow the README exactly, confirm zero manual fixes needed.

#### Sayali — Task: Incident Status Transitions (`Module: Incidents Polish`)
* **Branch**: `feature/sayali-day6-incident-status`
* **Backend Files**: `backend/app/api/v1/incidents.py` — add `PATCH /api/v1/incidents/{id}/status` (`open` → `resolved`).
* **Command to run**: `pytest backend/tests/test_incidents_api.py`.

#### Pooja — Task: AI RCA Panel UI (`Module: AI RCA UI`)
* **Branch**: `feature/pooja-day6-ai-rca-panel`
* **Frontend Files**:
  * `frontend/src/components/AiRcaPanel.tsx` — "Analyze" button, loading spinner, renders `summary`/`probable_cause`/`confidence`/`next_steps`.
  * `frontend/src/api/aiApi.ts` — `analyzeIncident(id)`.
  * Handle the failure case explicitly: if the call fails, show **"AI analysis unavailable"** — never a blank screen or crash.
* **Command to run**: `npm run dev` — click Analyze on a real incident, confirm the panel renders; then temporarily break the LLM key and confirm the graceful fallback shows instead of crashing.

---

### DAY 7: Bug Bash & Demo Rehearsal

#### All Three — Task: Full Flow Verification
* **Branch naming for any fixes**: `feature/<name>-day7-bugfix-<short-description>`
* **Activity**: Run the full demo (Section 8) at least 3 times, in front of each other. Fix anything flaky (duplicate incidents, chart not updating, AI panel hanging).
* **Command to run (final check)**: `docker compose down -v && docker compose up --build` → `npm run dev` → run the full spike → dashboard → incident → analyze flow end-to-end, twice, timed.

---
