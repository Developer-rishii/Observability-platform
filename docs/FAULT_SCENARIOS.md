# Demo Application & Controlled Fault Scenarios (S1)

This document provides complete instructions for starting, verifying, and executing fault scenarios on the **S1 Demo Application and Isolated PostgreSQL Database**.

---

## 1. Prerequisites and Environment Setup

- **Docker Desktop** installed and running on Windows.
- **PowerShell** 5.1+ or PowerShell 7+.
- **Python 3.11+** (for running local unit tests).

### Environment Configuration

The demo environment configuration is managed via `.env` (derived from `.env.example`). The following demo stack environment variables are supported:

| Environment Variable | Default Value | Description |
|---|---|---|
| `DEMO_DB_USER` | `demouser` | PostgreSQL user for the demo database |
| `DEMO_DB_PASSWORD` | `demopassword` | PostgreSQL password for the demo database |
| `DEMO_DB_NAME` | `demodb` | Database name for the demo application |
| `DEMO_DB_HOST_PORT` | `5434` | Host port mapped to `demo-db:5432` (avoids platform DB port 5433) |
| `WORKLOAD_HOST_PORT` | `8081` | Host port mapped to demo app container port 8080 |
| `FAULT_TOKEN` | `demo-fault-secret-key` | Shared administrative authentication token for `/admin/fault/*` |
| `DEMO_DATA_DIR` | `/data/fill` | Dedicated container volume path for disk fault generation |

> [!NOTE]
> Never commit real secrets or `.env` files to git. In PowerShell, you can set the token in your session:
> ```powershell
> $env:FAULT_TOKEN = "demo-fault-secret-key"
> ```

---

## 2. Starting the Demo Stack

Start the unified demo stack (platform services + isolated demo database + demo application) using the documented Compose command:

```powershell
docker compose -f docker-compose.yml -f docker-compose.demo.yml up --build
```

To run in the background (detached):

```powershell
docker compose -f docker-compose.yml -f docker-compose.demo.yml up -d --build
```

### Architecture of Demo Services

- **`demo-db`**: Isolated PostgreSQL 15 container listening internally on port 5432 (and host port 5434). Contains seeded `products` table (~50 cloud/tech products) and `orders` table. Persistent volume: `demo_postgres_data`. Completely isolated from platform DB `db`.
- **`demo-app`** (service `workload-generator`): Container with `restart: unless-stopped` and label `monitor=true`. Listens on container port 8080, mapped to host port 8081. Handles real SQL transactions, Prometheus metrics, structured JSON logging, and controlled administrative faults.
- **`prometheus`**: Scrapes demo application metrics under job `demo-app` targeting `demo-app:8080/metrics`.

---

## 3. Verification & Telemetry Inspection

### A. Health & Database Connectivity

Verify that the demo application and its database are healthy:

```powershell
Invoke-RestMethod -Uri "http://localhost:8081/health"
```

**Expected Response (HTTP 200):**
```json
{
  "status": "healthy",
  "database": "connected"
}
```

### B. Verify Products Seeded in PostgreSQL

```powershell
Invoke-RestMethod -Uri "http://localhost:8081/api/products"
```

Returns a list of 50 seeded products (e.g., `Compute Instance General Purpose`, `Managed PostgreSQL HA Cluster`, etc.).

### C. Verify Order Creation Transaction

```powershell
$orderPayload = @{
    product_id = 1
    quantity = 2
    customer_name = "Jane Doe"
    customer_email = "jane@example.com"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:8081/api/orders" -Method Post -ContentType "application/json" -Body $orderPayload
```

**Expected Response (HTTP 201):**
```json
{
  "id": 1,
  "product_id": 1,
  "quantity": 2,
  "total_price": 49.98,
  "customer_name": "Jane Doe",
  "customer_email": "jane@example.com",
  "status": "completed",
  "created_at": "..."
}
```

### D. Verify Structured JSON Request Logs

Inspect logs emitted by the demo application container:

```powershell
docker logs --tail 20 demo-app
```

**Format:**
```json
{"time": "2026-10-13T17:40:02.124890+00:00", "level": "INFO", "path": "/api/products", "status": 200, "duration_ms": 4.12}
{"time": "2026-10-13T17:40:05.891230+00:00", "level": "INFO", "path": "/api/orders", "status": 201, "duration_ms": 8.75}
```
Every request produces exactly one structured log line. Internal database failures produce `level: "ERROR"`.

### E. Verify Prometheus Metrics

Inspect metrics scraped by Prometheus:

```powershell
(Invoke-WebRequest -Uri "http://localhost:8081/metrics").Content
```

Includes:
- `http_requests_total{path="/api/products",status="200"}`
- `http_request_duration_seconds_bucket{path="/api/products",status="200",le="..."}`
- `demo_data_dir_bytes` (measured bytes in `/data/fill`)
- `simulated_cpu_usage` (simulated gauge)
- `spike_requests_total` (counter)

---

## 4. Controlled Fault Scenarios

All administrative fault endpoints are protected by the `X-Fault-Token` header. Five PowerShell automation scripts are provided in `infrastructure/scripts/`.

### Scenario 1: CPU Stress Fault

**Script:** `.\infrastructure\scripts\cpu-stress.ps1 -Duration 30`

- **Endpoint:** `POST /admin/fault/cpu`
- **Payload:** `{"duration": 30}`
- **Safety Limits:** Maximum duration is **120 seconds**. Rejects <= 0 or > 120 with HTTP 400.
- **Expected Symptoms:**
  - `simulated_cpu_usage` metric jumps to `95.0%`.
  - Background CPU worker executes intensive calculations for the specified duration.
  - Platform detection engine flags high CPU breach (threshold 80%).
- **Recovery:** Automatically stops when duration expires; `simulated_cpu_usage` resets to `5.0%`.

---

### Scenario 2: Container Crash Fault

**Script:** `.\infrastructure\scripts\container-crash.ps1`

- **Mechanism:** Executes `docker kill demo-app`.
- **Expected Symptoms:**
  - Container abruptly exits with non-zero exit code.
  - Endpoints (`/health`, `/api/products`) immediately fail with connection refused.
  - Prometheus scrape target `demo-app:8080` transitions to `DOWN`.
- **Recovery Mechanism:**
  - `restart: unless-stopped` is defined on `demo-app` in `docker-compose.demo.yml`.
  - **Important Docker behavior note:** When using `docker kill <container>`, the Docker daemon marks the container as manually stopped/killed by the user via the Docker client API, and some versions/configurations of Docker Desktop do not automatically restart containers manually stopped or killed via client command until the daemon restarts or `docker start` is executed. In contrast, an internal process crash (e.g., fatal unhandled exception or exit code 1) triggers the Docker daemon's `unless-stopped` supervisor restart automatically.
  - If `docker kill` leaves the container in an `Exited` state, run `docker start demo-app` to bring it back up, or test application-level fatal crash.
  - Database connections and `/metrics` resume automatically on container restart.

---

### Scenario 3: Database Outage Fault

**Script:** `.\infrastructure\scripts\db-stop.ps1 -PauseSeconds 15`

- **Mechanism:** Stops the isolated `demo-db` container (`docker stop demo-db`). The platform database `db` remains running.
- **Expected Symptoms:**
  - `GET /health` returns HTTP **503 Service Unavailable** with:
    `{"status": "unhealthy", "database": "disconnected", "error": "Database unavailable"}`.
  - `GET /api/products` and `POST /api/orders` return HTTP **500 Internal Server Error** with:
    `{"detail": "Internal database error..."}`.
  - Container log emits `level: "ERROR"` with database error details.
  - No fake success or cached product data is returned.
- **Recovery:** The script restarts `demo-db` (`docker start demo-db`). Healthcheck passes and `/health` returns HTTP 200 again.

---

### Scenario 4: Latency Spike Fault

**Script:** `.\infrastructure\scripts\latency-spike.ps1 -LatencyMs 2000 -Duration 30`

- **Endpoint:** `POST /admin/fault/latency`
- **Payload:** `{"latency_ms": 2000, "duration": 30}`
- **Safety Limits:**
  - Maximum latency: **3,000 milliseconds** (3.0s).
  - Maximum duration: **120 seconds**.
- **Expected Symptoms:**
  - Live requests to `/api/products` take >= 2000 ms.
  - Structured logs record `duration_ms` >= 2000.
  - Prometheus histogram `http_request_duration_seconds` shifts into higher buckets.
- **Recovery:** Automatically expires and returns to 0 ms after `duration` seconds. Can also be reset immediately via `POST /admin/fault/latency/reset`.

---

### Scenario 5: Bounded Disk Fill Fault

**Script:** `.\infrastructure\scripts\disk-fill.ps1 -SizeMb 100 -Clear`

- **Endpoint:** `POST /admin/fault/disk/fill`
- **Payload:** `{"size_mb": 100}`
- **Safety Limits:**
  - Maximum generated data: **500 MB** total. Server rejects requests exceeding 500 MB total with HTTP 400.
  - Path traversal is strictly prevented: writes only directly inside `/data/fill`.
- **Expected Symptoms:**
  - `demo_data_dir_bytes` metric increases by the exact byte size written.
- **Cleanup / Recovery:**
  - Call `POST /admin/fault/disk/clear` (or pass `-Clear` flag to the script).
  - Removes only `fill_*.dat` fault files generated in `/data/fill`.
  - Updates `demo_data_dir_bytes` metric back to 0.
  - Never deletes database data or project files.

---

## 5. Troubleshooting & FAQ

1. **Port conflict on 8081 or 5434:**
   - Override via environment variables: `WORKLOAD_HOST_PORT=8082`, `DEMO_DB_HOST_PORT=5435`.
2. **Invalid Token Error (HTTP 401):**
   - Ensure you pass the header `-H "X-Fault-Token: demo-fault-secret-key"`.
3. **Database not ready on startup:**
   - `demo-app` uses `depends_on: demo-db: condition: service_healthy` so it waits for PostgreSQL `pg_isready` before starting.
4. **Where to see active fault status:**
   - Call authenticated `GET http://localhost:8081/admin/fault/status`.
