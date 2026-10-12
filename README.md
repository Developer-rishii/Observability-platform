# AI-Powered Cloud Monitoring & Observability Platform

A full-stack, AI-powered cloud observability platform featuring metric collection, threshold breach detection, automated incident tracking, and LLM-assisted Root Cause Analysis (RCA).

---

## 1. Architecture Overview

```
                                      +-------------------------+
                                      |    React / Next.js UI   |
                                      |     (Port 3000)         |
                                      +------------+------------+
                                                   |
                                                   v
+-------------------------+           +------------+------------+
|   Prometheus (9090)     | <-------- |    FastAPI Backend      |
|  - Workload metrics     |           |     (Port 8000)         |
+------------^------------+           +------------+------------+
             |                                     |
+------------+------------+           +------------v------------+
|   Workload Generator    |           |    PostgreSQL (5433)    |
| (Host: 8081 / Cnt: 8080)|           |  - Users, Incidents,    |
+-------------------------+           |    Alerts, AI Analyses  |
                                      +-------------------------+
```

* **FastAPI Backend (Port 8000)**: Serves REST API (`/api/v1`), manages background threshold detection (APScheduler, 15s interval), correlates metric anomalies into incidents, and generates structured root cause analysis via Google Gemini.
* **PostgreSQL (Host port 5433, container port 5432)**: Stores users, incidents, alerts, and AI analysis records.
* **Prometheus (Port 9090)**: Scrapes metrics from simulated workload generators or system exporters.
* **Workload Generator (Port 8081 / 8080)**: Generates synthetic CPU, memory, and error workload profiles.
* **Frontend UI (Port 3000)**: Interactive dashboard for metrics, live incident tracking, and AI RCA insights.

---

## 2. Prerequisites

* **Docker & Docker Desktop** (with Docker Compose v2)
* **Python 3.11+** (for running backend or tests locally)
* **Node.js 20+** (for frontend development)
* **PowerShell** (Windows) or **Bash** (macOS/Linux)

---

## 3. Quickstart & Local Setup

### Step 1: Clone the repository
```bash
git clone https://github.com/Developer-rishii/Observability-platform.git
cd Observability-platform
```

### Step 2: Configure Environment Variables
Copy `.env.example` to `.env`:
```powershell
cp .env.example .env
```
Key variables to check in `.env`:
- `POSTGRES_USER=user`
- `POSTGRES_PASSWORD=password`
- `POSTGRES_DB=observability`
- `DATABASE_URL=postgresql://user:password@db:5432/observability`
- `WORKLOAD_HOST_PORT=8081` *(avoids port 8080 conflicts)*
- `GEMINI_API_KEY=your_gemini_api_key` *(optional: mock fallback available in tests)*

### Step 3: Start Services with Docker Compose
```bash
docker compose up --build -d
```
Verify that all containers are healthy:
```bash
docker compose ps
```

### Step 4: Run Migrations & Seed Admin User
```bash
# Apply database migrations
docker compose exec backend alembic upgrade head

# Seed initial admin user
docker compose exec backend python scripts/seed_admin.py
```

### Step 5: Start the Frontend
```bash
cd frontend
npm install
npm run dev
```
Access the dashboard at: `http://localhost:3000`

---

## 4. Key Endpoints

| Endpoint | Method | Description |
|---|---|---|
| `/` | `GET` | Health / root status message |
| `/api/v1/system/health` | `GET` | Downstream health (`db`, `prometheus`, `prometheus_targets`) |
| `/api/v1/auth/login` | `POST` | Authenticate user & issue JWT bearer token |
| `/api/v1/auth/me` | `GET` | Current authenticated user profile |
| `/api/v1/metrics/query-range` | `GET` | Proxy Prometheus range metrics (`?metric=cpu&minutes=15`) |
| `/api/v1/incidents` | `GET` | List incidents (filter by `?status=open`) |
| `/api/v1/incidents/{id}` | `GET` | Incident detail with metric evidence |
| `/api/v1/incidents/{id}/status` | `PATCH` | Transition status (`open` -> `investigating` -> `resolved`) |
| `/api/v1/ai/incidents/{id}/analyze` | `POST` | Generate structured AI RCA for incident |

Interactive Swagger docs available at: `http://localhost:8000/docs`

---

## 5. Running Tests

### Local Test Execution
Ensure `db` and `prometheus` are running (e.g. via Docker):
```powershell
$env:DATABASE_URL="postgresql://user:password@localhost:5433/observability"
$env:PYTHONPATH="backend"
pytest backend/tests
```

### Inside Docker Container
```bash
docker compose exec backend pytest tests
```

---

## 6. Troubleshooting

### Port Conflicts (8080 or 5432 already in use)
* **Workload Generator**: If host port `8080` is taken by cAdvisor, Jenkins, or an existing service, set `WORKLOAD_HOST_PORT=8081` (or another free port) in your `.env`.
* **PostgreSQL**: PostgreSQL on the host maps to port `5433` (`5433:5432`) to prevent conflicts with any local Postgres instances running on port `5432`. If connecting locally outside Docker, use `localhost:5433`.

### Docker Desktop on Windows
* Ensure the Docker Desktop engine is running before executing `docker compose` or tests.
* Note that Node Exporter inside Docker Desktop reports metrics from the Docker VM rather than the Windows host.

### Database Connection Refused
If running tests locally outside Docker, ensure the Postgres container is running and that `DATABASE_URL` targets `localhost:5433` (not `db:5432` which is an internal container hostname).

### AI RCA Fallback / Missing API Key
If `GEMINI_API_KEY` is not provided or Gemini is unreachable, `POST /api/v1/ai/incidents/{id}/analyze` responds with `503 Service Unavailable` with a descriptive message rather than crashing the server.
