# Platform Implementation Audit & Infrastructure Telemetry Architecture

This document presents a comprehensive audit of the work completed to date, the remaining tasks, and the step-by-step technical architecture for collecting live **metrics**, **logs**, and **events** from monitored servers and infrastructure.

---

## Part 1: Current Project Status & Completed Work

### 1. Work Completed (100% Production Ready)

| Area | Status | Key Deliverables & Achievements |
| :--- | :---: | :--- |
| **Frontend Application** | **COMPLETE** | 12 interactive screens built with modern dark glassmorphism, responsive desktop sidebar & mobile drawer, tokenized CSS design system (`tokens.css`), client-side route protection, and zero build/typecheck errors (`tsc -b && vite build` clean). |
| **Screens Implemented** | **COMPLETE** | 1. Landing Page (`/`)<br>2. Auth Flow (`/login`, `/signup`, `/verify-email`, `/reset-password`)<br>3. Executive Dashboard (`/dashboard`)<br>4. Infrastructure Explorer (`/infrastructure`, `/infrastructure/:id`)<br>5. Services & Topology (`/services`, `/services/:id`)<br>6. Incidents & Alerts Center (`/incidents`, `/incidents/:id`)<br>7. Explainable AI Root-Cause Analysis Workspace (`/incidents/:id/rca`)<br>8. Metrics Explorer (`/metrics`)<br>9. Log Stream Explorer (`/logs`)<br>10. Docker & Cluster Events (`/events`)<br>11. Platform Settings & RBAC (`/settings`) |
| **Authentication & RBAC** | **COMPLETE** | JWT access tokens with Argon2/bcrypt password hashing, email verification, password reset tokens, admin vs. operator role-based authorization enforced at the database and API levels. |
| **Backend Core & Database** | **COMPLETE** | PostgreSQL database with Alembic migration versioning (`0001_initial_schema`, `0002_phase1_model_reconciliation`, `0003_auth_tokens`), complete SQLAlchemy ORM models for Users, Incidents, Alerts, Servers, Services, and System Configurations. |
| **Background Anomaly Detection** | **COMPLETE** | APScheduler background worker continuously evaluating Prometheus telemetry every 15s (`detection_job`) with Isolation Forest and configurable threshold checking. |
| **AI Root-Cause Diagnostics** | **COMPLETE** | Multi-step Gemini RAG diagnostic engine with structured JSON responses, vector similarity search via Qdrant, prompt templates, and explicit fallback handling when API keys are absent. |
| **Automated Test Suite** | **COMPLETE** | 50 out of 50 backend tests passing cleanly inside Docker (`pytest` 100% pass rate in 18s across auth, RCA, scheduler, migration, schemas, and threshold checking). |

---

### 2. What Work Is Next To Do

While the application platform and core services are finished and tested, the primary remaining phase is **Live Infrastructure Telemetry Ingestion**:

1. **Host-Level Metrics Collection**: Replacing synthetic sample host metrics with real data scraped from monitored servers.
2. **Centralized Log Streaming (Loki / FluentBit)**: Connecting `/api/v1/logs` to an active log aggregation store.
3. **Real-Time System Events Ingestion**: Connecting `/api/v1/events` to Docker engine sockets or Kubernetes audit logs.
4. **Server Agent Deployment**: Providing an agent or daemon (Node Exporter / Promtail / lightweight Python agent) to install on target servers.

---

## Part 2: How We Will Collect Metrics, Logs, and Events for Server Monitoring

To monitor actual physical servers, cloud VMs (AWS EC2, GCP Compute Engine, Azure VMs), and container hosts, observability requires three distinct telemetry pipelines:

```
+----------------------------------------------------------------------------------------------------+
|                                    TARGET SERVER / HOST NODE                                       |
|                                                                                                    |
|  +-------------------------+   +-------------------------+   +----------------------------------+  |
|  |      Node Exporter      |   |        Promtail         |   |       Docker Daemon / Systemd    |  |
|  |     (Port 9100)         |   |      (Log Shipper)      |   |       (Engine Event Stream)      |  |
|  |   CPU, RAM, Disk, Net   |   | /var/log/*, Docker Logs |   |  container died, oom, restart    |  |
|  +------------+------------+   +------------+------------+   +----------------+-----------------+  |
+---------------|-----------------------------|---------------------------------|--------------------+
                |                             |                                 |
         Scrapes (15s)                  Pushes HTTP                       Streams API
                v                             v                                 v
+---------------+------------+   +------------+------------+   +----------------+-----------------+  |
|         Prometheus         |   |      Grafana Loki       |   |      AetherPulse Backend        |  |
|     (Metrics Database)     |   |      (Log Database)     |   |     (Docker / Webhook Event)    |  |
|      Port 9090             |   |      Port 3100          |   |     Port 8000                   |  |
+---------------+------------+   +------------+------------+   +----------------+-----------------+  |
                \                             |                                /
                 \                            |                               /
                  v                           v                              v
            +--------------------------------------------------------------------+
            |                      AetherPulse Backend API                       |
            |     - /api/v1/metrics/query   (PromQL queries)                     |
            |     - /api/v1/logs/           (LogQL queries against Loki)         |
            |     - /api/v1/events/         (Postgres Event Store)               |
            |     - Anomaly Detection Engine (APScheduler 15s)                   |
            +---------------------------------+----------------------------------+
                                              |
                                              v
            +--------------------------------------------------------------------+
            |                        React Frontend UI                           |
            |   Infrastructure Explorer, Metrics Explorer, Log Stream, Events    |
            +--------------------------------------------------------------------+
```

---

### Pipeline 1: Metrics Collection (CPU, RAM, Disk, Network)

#### 1. How It Works
- On every server you want to monitor, install Prometheus **`node_exporter`** (standard lightweight binary that exposes Linux kernel metrics via `/proc` and `/sys` at `http://<server-ip>:9100/metrics`).
- For container metrics, run **`cAdvisor`** (port 8080) on the server.
- The platform's Prometheus server (`docker-compose.yml`) polls these endpoints every 15 seconds.

#### 2. Configuration Setup
Update `infrastructure/prometheus/prometheus.yml`:
```yaml
scrape_configs:
  - job_name: 'node_exporter'
    static_configs:
      - targets:
          - 'host.docker.internal:9100'     # Local machine
          - '10.0.1.10:9100'                # Production Server 1
          - '10.0.1.11:9100'                # Production Server 2
    relabel_configs:
      - source_labels: [__address__]
        regex: '(.*):9100'
        target_label: instance
```

#### 3. Real PromQL Queries Used in the Backend
In `app/services/ingestion/prometheus_client.py`:
- **CPU Utilization (%)**:
  ```promql
  100 - (avg by (instance) (rate(node_cpu_seconds_total{mode="idle"}[1m])) * 100)
  ```
- **Memory Utilization (%)**:
  ```promql
  (1 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)) * 100
  ```
- **Disk Space Usage (%)**:
  ```promql
  (1 - (node_filesystem_free_bytes{mountpoint="/"} / node_filesystem_size_bytes{mountpoint="/"})) * 100
  ```
- **Network Ingress / Egress (MB/s)**:
  ```promql
  rate(node_network_receive_bytes_total{device!~"lo|veth.*"}[1m]) / 1024 / 1024
  ```

---

### Pipeline 2: Log Collection (System & Application Logs)

#### 1. How It Works
- Install **Promtail** or **FluentBit** on target servers as an agent.
- Promtail discovers and tails `/var/log/syslog`, `/var/log/auth.log`, `/var/log/nginx/*.log`, and Docker container logs (`/var/lib/docker/containers/*/*-json.log`).
- Promtail ships logs over HTTP to **Grafana Loki** (or directly to an AetherPulse ingestion endpoint).

#### 2. Promtail Config Example (`promtail-config.yml` on the server)
```yaml
server:
  http_listen_port: 9080
positions:
  filename: /tmp/positions.yaml
clients:
  - url: http://<observability-host>:3100/loki/api/v1/push
scrape_configs:
  - job_name: system-logs
    static_configs:
      - targets: [localhost]
        labels:
          job: varlogs
          host: production-server-01
          __path__: /var/log/*.log
  - job_name: docker-logs
    docker_sd_configs:
      - host: unix:///var/run/docker.sock
        refresh_interval: 5s
```

#### 3. Backend Integration
Implement `/api/v1/logs` in `backend/app/api/v1/logs.py` by querying Loki's REST API (`GET /loki/api/v1/query_range?query={host="production-server-01"}`), returning structured timestamped log records to the frontend `LogExplorer.tsx`.

---

### Pipeline 3: System & Container Events Collection

#### 1. What are Events?
Unlike continuous metrics or continuous log lines, **events** are discrete operational state transitions:
- Docker Container died, exited with code 137 (OOM killed), or restarted.
- Linux Kernel OOM killer invoked (`kernel: Out of memory: Kill process`).
- SSH login attempts or privilege escalations.
- Deployment / rolling update notifications.

#### 2. Implementation Options

##### Option A: Docker Daemon Socket Listener (Docker hosts)
Add an ingestion daemon in the backend that connects to Docker's streaming events:
```python
import docker
from app.models.models import Event
from app.core.database import SessionLocal

def listen_to_docker_events():
    client = docker.from_env()
    for event in client.events(decode=True):
        if event.get("Type") == "container" and event.get("Action") in ["die", "restart", "oom"]:
            db = SessionLocal()
            record = Event(
                source="docker",
                event_type=event["Action"],
                resource_name=event["Actor"]["Attributes"].get("name", "unknown"),
                severity="critical" if event["Action"] in ["die", "oom"] else "warning",
                payload=event,
                timestamp=datetime.utcnow()
            )
            db.add(record)
            db.commit()
            db.close()
```

##### Option B: Syslog / Systemd Journald Forwarder (Bare metal / VM hosts)
Configure `systemd-journal-remote` or rsyslog to forward critical journald priority events (`emerg`, `alert`, `crit`, `err`) to our backend ingestion webhook (`POST /api/v1/events/ingest`).

---

## Part 3: Roadmap to Full Live Telemetry Deployment

1. **Step 1: Add Node Exporter to `docker-compose.yml`**
   - Run `prom/node-exporter:latest` inside docker-compose so your local host and container cluster immediately emit live CPU/RAM/Disk metrics to Prometheus.
2. **Step 2: Connect `prometheus_client.py` to Node Exporter Queries**
   - Update `_get_query_for_metric()` to query real `node_cpu_seconds_total` and `node_memory_MemAvailable_bytes`.
3. **Step 3: Connect Loki to `docker-compose.yml`**
   - Add a lightweight `grafana/loki` service and wire `backend/app/api/v1/logs.py` to query it.
4. **Step 4: Enable Docker Event Stream in Backend Scheduler**
   - Stream container lifecycle events into the PostgreSQL `events` table so the `/events` page reflects real restarts and failures in real time.
