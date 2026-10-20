# AI-Powered Cloud Monitoring & Observability Platform

A full-stack, enterprise-grade cloud observability platform featuring real-time Prometheus & Loki telemetry, custom Docker event auditing, automated incident correlation, Qdrant vector retrieval for engineering runbooks (RAG), and Google Gemini AI Root Cause Analysis (RCA).

---

## 1. System Architecture

```
                                      +------------------------------------+
                                      |        React + Vite Frontend       |
                                      |         (Host Port: 5173)          |
                                      +-----------------+------------------+
                                                        |
                                                        v
+-----------------------+             +-----------------+------------------+             +-----------------------+
|  Prometheus (9090)    | <---------- |       FastAPI Backend API          | ----------> |     Qdrant Vector DB  |
| - demo-app:8080       |             |        (Host Port: 8000)           |             |    (Host Port: 6333)  |
| - node-exporter:9100  |             |  - APScheduler Detection (15s)     |             |  - 60 runbook chunks  |
| - cadvisor:8080       |             |  - Incident Correlation Engine     |             +-----------------------+
+-----------^-----------+             |  - Dynamic Gemini AI Diagnostics   |
            |                         +--------+------------------+--------+
+-----------+-----------+                      |                  |
|   Monitored Demo App  |                      v                  v
|  (Host Port: 8081)    |             +--------+--------+  +------+--------+             +-----------------------+
| - Products & Orders   |             | Platform DB     |  | Loki Engine   | <---------- |     Events Agent      |
| - Controlled Faults   |             | (Postgres: 5433)|  | (Port: 3100)  |             | (docker.sock listener)|
+-----------^-----------+             +-----------------+  +---------------+             +-----------------------+
            |                                                      ^
+-----------+-----------+                                          |
|    Traffic Generator  |                                          |
|  (Synthetic Workload) |                                          |
+-----------------------+                                          |
            |                                                      |
+-----------v-----------+                                          |
|   Isolated Demo DB    | -----------------------------------------+
| (Internal Postgres)   |
+-----------------------+
```

---

## 2. Verified Host Port Mapping

| Service | Container Port | Host Port | Purpose | Health Endpoint |
|---|---|---:|---|---|
| **Frontend** | 5173 | **5173** | React/Vite Telemetry Dashboard | `http://localhost:5173` |
| **Backend API** | 8000 | **8000** | FastAPI Application & AI Diagnostics | `http://localhost:8000/api/v1/system/health` |
| **Prometheus** | 9090 | **9090** | TSDB Scrape Engine | `http://localhost:9090/-/healthy` |
| **Loki** | 3100 | **3100** | Centralized Log Aggregation Storage | `http://localhost:3100/ready` |
| **Qdrant** | 6333 | **6333** | Vector Knowledge Base (`incident_knowledge_base`) | `http://localhost:6333/readyz` |
| **Platform DB** | 5432 | **5433** | PostgreSQL (Users, Incidents, Alerts, AI Analyses)| `pg_isready -p 5433 -U user` |
| **Node Exporter** | 9100 | **9100** | Host Resource Metrics Exporter | `http://localhost:9100/` |
| **Demo Application**| 8080 | **8081** | E-commerce Workload & Fault Target | `http://localhost:8081/health` |
| **cAdvisor** | 8080 | **8085** | Container Metrics Scrape Exporter | `http://localhost:8085/healthz` |
| **Demo DB** | 5432 | *Internal Only* | Isolated PostgreSQL for Demo Store (not published) | `pg_isready -U demouser -d demodb` |

> [!NOTE]
> - Host port `8080` is reserved and must not be claimed. The demo application is mapped to host port **8081** (`${WORKLOAD_HOST_PORT:-8081}:8080`).
> - The demo database `demo-db` runs strictly on the internal Docker network to prevent port collisions with the platform database on host port `5433`.

---

## 3. Run the Demo (One-Command Packaging)

### Step 1: Prerequisites
- **Docker Desktop** installed and running on Windows with WSL2 backend.
- **Node.js 20+** (for frontend live development, or use build preview).
- **PowerShell 5.1+** or **PowerShell 7+**.

### Step 2: Clone and Navigate
```powershell
git clone https://github.com/Developer-rishii/Observability-platform.git
cd Observability-platform
```

### Step 3: Configure Environment Variables
Copy `.env.example` to create your local `.env`:
```powershell
Copy-Item .env.example .env
```
Ensure your `.env` contains:
- `GEMINI_API_KEY`: Your Google Gemini API Key.
- `GEMINI_MODEL=gemini-3.5-flash` (Primary model).
- `GEMINI_FALLBACK_MODEL=gemini-3.1-flash-lite` (Automatic fallback model when primary encounters 429 quota or 503 load).
- `JWT_SECRET`: Random 32+ character string.
- `AGENT_SHARED_SECRET`: Secret token for Docker event ingestion.
- `FAULT_TOKEN`: Shared secret for demo fault endpoints (default: `demo-fault-secret-key`).

### Step 4: Launch Entire Stack with One Command
Execute the unified Compose configuration:
```powershell
docker compose -f docker-compose.yml -f docker-compose.demo.yml up --build -d
```
All containers will build and start with strict readiness health conditions and memory limits.

Verify that all containers are healthy:
```powershell
docker compose -f docker-compose.yml -f docker-compose.demo.yml ps
```

### Step 5: Initialize Database & Seed Admin User
Apply schema migrations and initialize the vector knowledge base:
```powershell
# Run database migrations
docker compose exec backend alembic upgrade head

# Ingest engineering runbooks into Qdrant (60 points)
docker compose exec backend python -m app.rag.ingest

# Seed or update the demo administrator account
docker compose exec backend python scripts/seed_admin.py admin@example.com AdminPass123! --update
```

### Step 6: Start the Frontend UI
```powershell
cd frontend
npm install
npm run dev
```
Open **[http://localhost:5173](http://localhost:5173)** in your browser and sign in with:
- **Email**: `admin@example.com`
- **Password**: `AdminPass123!`

---

## 4. Controlled Fault Scenarios & Verification

The demo application (`http://localhost:8081`) includes 5 automated fault injection scripts located in `infrastructure/scripts/`.

### Fault 1: CPU Saturation Breach
Triggers compute-intensive factorials, elevating CPU usage to 95% (exceeding the 80% threshold):
```powershell
powershell -ExecutionPolicy Bypass -File infrastructure/scripts/cpu-stress.ps1 -Duration 30
```
- **Detection**: APScheduler opens an incident after 3 consecutive breach intervals (45s).
- **Recovery**: Resets automatically after the specified duration.

### Fault 2: Downstream Database Outage
Stops `demo-db` while keeping platform DB `db` running:
```powershell
powershell -ExecutionPolicy Bypass -File infrastructure/scripts/db-stop.ps1 -PauseSeconds 15
```
- **Symptoms**: `demo-app` `/health` returns HTTP 503; `/api/products` returns HTTP 500.
- **Evidence**: Structured error logs stream to Loki; `demo-db` stop event recorded in PostgreSQL.

### Fault 3: Container Crash & Restart Event
Kills `demo-app` to audit the Docker events pipeline:
```powershell
powershell -ExecutionPolicy Bypass -File infrastructure/scripts/container-crash.ps1
```
- **Events**: Events agent captures `kill` and `die` Docker daemon events, sending them securely to `/api/v1/events/ingest`.
- **Restart**: Recover with `docker start demo-app`.

### Fault 4: Latency Spike
Injects 800ms of artificial server latency:
```powershell
powershell -ExecutionPolicy Bypass -File infrastructure/scripts/latency-spike.ps1 -LatencyMs 800 -Duration 30
```
- **Metrics**: High duration observations in `http_request_duration_seconds` histogram.
- **Reset**: Resets automatically after duration or via `/admin/fault/latency/reset`.

### Fault 5: Disk Volume Exhaustion
Simulates container disk growth by writing test files into `/data/fill`:
```powershell
# Generate 50 MB of test data
powershell -ExecutionPolicy Bypass -File infrastructure/scripts/disk-fill.ps1 -SizeMB 50

# Safely clear the test data
powershell -ExecutionPolicy Bypass -File infrastructure/scripts/disk-fill.ps1 -Clear -SizeMb 1
```

---

## 5. RAG Retrieval & AI Root Cause Analysis

1. Navigate to **Incidents & RCA** in the frontend dashboard ([http://localhost:5173/incidents](http://localhost:5173/incidents)).
2. Select any open or resolved incident (e.g. `#233 High cpu breach`) and click **"Run AI Analysis"**.
3. **Pipeline Workflow**:
   - The backend builds a contextual semantic query from the breach telemetry.
   - Searches Qdrant collection `incident_knowledge_base` with $k=5$ and cosine similarity threshold $\ge 0.45$.
   - Constructs a grounded prompt appending relevant runbook sections.
   - Invokes Google Gemini (`gemini-3.5-flash`). If the primary model encounters HTTP 429 quota limits or HTTP 503 high load, the backend **automatically switches to `gemini-3.1-flash-lite`**.
   - Validates the structured JSON response and displays probable cause, supporting evidence, impact radius, and retrieved **Knowledge Sources** with similarity scores.

---

## 6. WSL2 & Docker Desktop Memory Guidance

Running multiple containers alongside AI embeddings and vector indexing in Docker Desktop requires adequate WSL2 resource sizing.

### Configuring WSL2 Memory
Create or edit the global WSL configuration file on Windows at:
```text
C:\Users\<YourUsername>\.wslconfig
```

Example recommended configuration for machines with 16GB–32GB RAM:
```ini
[wsl2]
# Allocate 6GB to 8GB of memory to the WSL2 virtual machine
memory=8GB

# Assign 4 processor cores
processors=4

# Configure swap space on disk
swap=4GB

# Enable reclaim of unused memory
autoMemoryReclaim=gradual
```

### Applying WSL Changes
After creating or modifying `.wslconfig`, you must restart WSL from an administrative PowerShell terminal:
```powershell
wsl --shutdown
```
Then reopen Docker Desktop to restart the virtualization engine.

---

## 7. Stopping the Stack & Cleanup

To stop all demo services and preserve persistent database volumes:
```powershell
docker compose -f docker-compose.yml -f docker-compose.demo.yml stop
```

To tear down all containers and networks:
```powershell
docker compose -f docker-compose.yml -f docker-compose.demo.yml down
```

> [!CAUTION]
> Never run `docker compose down -v` unless you explicitly intend to purge all persistent platform database records, Qdrant vectors, and Prometheus TSDB data.

---

## 8. Backup Demo Video

A backup recording workflow is provided for evaluating the platform end-to-end:
- **Location**: `docs/recordings/demo-walkthrough.mp4` *(or see instructions below if recording in your environment)*.
- **Recording Procedure**:
  1. Open PowerShell and run: `docker compose -f docker-compose.yml -f docker-compose.demo.yml up -d`
  2. Launch frontend: `cd frontend; npm run dev`
  3. Open browser screen recorder (e.g. OBS, Windows Game Bar `Win + G`, or Chrome Screen Recorder).
  4. Log in at `http://localhost:5173` (`admin@example.com` / `AdminPass123!`).
  5. Show **Overview** dashboard and active **Traffic Generator** metrics.
  6. Execute `infrastructure/scripts/cpu-stress.ps1 -Duration 20` in a split terminal.
  7. Show incident creation in **Incidents & RCA**.
  8. Click **Run AI Analysis** to showcase RAG runbook retrieval and Gemini root cause diagnosis.
  9. Save recording to `docs/recordings/demo-walkthrough.mp4`.
