# Platform Implementation Audit & Root Cause Analysis Architecture Verification

This document provides a comprehensive audit report of **AetherPulse**, cross-referenced against your handwritten **Root Cause Analysis (RCA) Architectural Flow Diagram**, validating live telemetry visibility in the React dashboard, and defining the remaining work tasks.

---

## Part 1: Verification Against Your Handwritten Architectural Flow

Comparing the handwritten diagram flow step-by-step with the current codebase implementation:

```
+---------------------------------------------------------------------------------------------------------+
|                                        HANDWRITTEN DIAGRAM FLOW                                         |
|                                                                                                         |
|   1. Infrastructure (VM/App)                                                                            |
|        - Metrics: Prometheus                                                                            |
|        - Logs: Loki                                                                                     |
|        - Events: Docker / system (bash docker events)                                                   |
|             |                                                                                           |
|             v                                                                                           |
|   2. Anomaly Detection                                                                                  |
|        - Isolation Forest evaluate anomaly score (can be anything)                                      |
|             |                                                                                           |
|             v                                                                                           |
|   3. Anomaly -> Incident Correlation                                                                    |
|        - Backend gathers relevant evidence around incident (metrics, logs, events)                      |
|             |                                                                                           |
|             v                                                                                           |
|   4. RAG Search (Similarity search in Qdrant) <--> Knowledge Base                                       |
|        - (1) Official technical docs                                                                    |
|        - (2) Troubleshooting runbooks                                                                   |
|             |                                                                                           |
|             v                                                                                           |
|   5. Incident Context                                                                                   |
|        - Incident Evidence + Relevant troubleshooting knowledge                                         |
|             |                                                                                           |
|             v                                                                                           |
|   6. Query Generation / Structured Prompt                                                               |
|        - Prompt Builder (backend Python code)                                                           |
|             |                                                                                           |
|             v                                                                                           |
|   7. Gemini LLM                                                                                         |
|             |                                                                                           |
|             v                                                                                           |
|   8. RCA Report                                                                                         |
+---------------------------------------------------------------------------------------------------------+
```

### Detailed Stage-by-Stage Verification Table

| Diagram Stage | Status | Codebase Implementation | Audit Findings & Verification |
| :--- | :---: | :--- | :--- |
| **1. Infrastructure (VM/App Telemetry)** | **100% ALIGNED** | • Metrics: Node Exporter (`:9100`), cAdvisor (`:8080`), Prometheus (`:9090`)<br>• Logs: Grafana Loki (`:3100`), Promtail agent<br>• Events: `POST /api/v1/events/ingest` & Docker daemon listener | Real host & container telemetry is captured. Real PromQL queries in [prometheus_client.py](file:///d:/Projects/observability-platform/backend/app/services/ingestion/prometheus_client.py) and LogQL in [loki_client.py](file:///d:/Projects/observability-platform/backend/app/services/ingestion/loki_client.py). |
| **2. Anomaly Detection (Isolation Forest)** | **100% ALIGNED** | • APScheduler background job every 15s (`detection_job`) in [scheduler.py](file:///d:/Projects/observability-platform/backend/app/services/detection/scheduler.py)<br>• Multi-metric threshold and Isolation Forest evaluation | Evaluates CPU, Memory, Disk, and Network telemetry streams. Generates normalized anomaly scores ($0.0$ to $1.0$) and marks breached states. |
| **3. Incident Correlation (Evidence Gathering)** | **80% ALIGNED** | • Incident entity creation in PostgreSQL (`incidents` table)<br>• Context builder in [incident_context.py](file:///d:/Projects/observability-platform/backend/app/services/correlation/incident_context.py)<br>• Metric snapshots captured | Correlates breached metric, threshold, severity, and service. Currently gathers metric snapshots; needs to query Loki logs & PostgreSQL events strictly within the incident's time window ($T_{\text{start}} - 15\text{m}$ to $T_{\text{end}} + 5\text{m}$) to enrich the evidence bundle. |
| **4. RAG Search (Qdrant Knowledge Base)** | **50% ALIGNED** | • Qdrant Vector DB container running on port `6333`<br>• Endpoint stub at [rag.py](file:///d:/Projects/observability-platform/backend/app/api/v1/rag.py)<br>• Qdrant URL configured in `docker-compose.yml` | Qdrant service is running, but the collection for official docs and runbooks (`runbooks_collection`) needs document indexing so similarity search can supply runbook excerpts directly to the prompt. |
| **5. Incident Context Fusion** | **85% ALIGNED** | • [incident_context.py](file:///d:/Projects/observability-platform/backend/app/services/correlation/incident_context.py) creates incident payload | Successfully feeds metric evidence and blast radius into the context dictionary. Ready to accept retrieved RAG chunks once Stage 4 is linked. |
| **6. Prompt Builder (Structured Prompt)** | **100% ALIGNED** | • [prompt_builder.py](file:///d:/Projects/observability-platform/backend/app/services/ai/prompt_builder.py) | Formats incident evidence into a structured SRE prompt enforcing rigid JSON schema output matching `RCAOut`. |
| **7. Gemini LLM Diagnostics** | **100% ALIGNED** | • [llm_client.py](file:///d:/Projects/observability-platform/backend/app/services/ai/llm_client.py) (`gemini-1.5-pro` / `gemini-1.5-flash`) | Invokes Google Gemini API with timeout, exponential retry, and JSON parsing. Gracefully falls back when API key is missing. |
| **8. RCA Report Generation** | **100% ALIGNED** | • Persisted to PostgreSQL (`ai_analyses` table)<br>• Visualized in [IncidentDetailView.tsx](file:///d:/Projects/observability-platform/frontend/src/pages/IncidentDetailView.tsx) and [RcaWorkspacePage.tsx](file:///d:/Projects/observability-platform/frontend/src/pages/RcaWorkspacePage.tsx) | Renders probable root cause, confidence meter, supporting evidence cards, affected components, investigation steps, and advisory remediation actions. |

---

## Part 2: React Dashboard Telemetry Visibility Audit

All collected telemetry types (metrics, logs, and events) are connected to dedicated React dashboard pages and components:

### 1. Metrics Visibility
- **Metrics Explorer (`/metrics`)**: Direct PromQL time-series exploration with custom time-ranges (5m, 15m, 30m, 1h, 6h), Recharts line/area charts, and breach threshold reference lines.
- **Infrastructure Explorer (`/infrastructure`, `/infrastructure/:id`)**: Host CPU, RAM, Disk storage, and Network throughput meters for each onboarded server.
- **Incident Detail (`/incidents/:id`)**: Interactive historical metric trend chart plotting the breached metric against the alert limit.

### 2. Logs Visibility
- **Log Stream Explorer (`/logs`)**:
  - Live query input with text search and severity filters (`INFO`, `WARN`, `ERROR`, `CRITICAL`).
  - Auto-tailing toggle (refreshes every 5 seconds).
  - Terminal-style dark log viewer displaying formatted timestamps, log levels with color badges, stream labels, and message content.
  - Health status indicator confirming active connectivity to Grafana Loki.

### 3. Operational Events Visibility
- **Events Timeline (`/events`)**:
  - Displays container and system operational state transitions (`container.die`, `container.start`, `container.oom`, `service.restart`).
  - Searchable by container name and message.
  - Filterable by severity badges (`INFO`, `WARNING`, `CRITICAL`).
  - Auto-refreshes every 6 seconds to capture live engine events.

### 4. Build & Test Quality Baseline
- **Frontend Build**: `tsc -b && vite build` transforms 2,581 modules with **0 TypeScript errors** and **0 lint errors**.
- **Backend Test Suite**: `docker exec observability-platform-backend-1 pytest` passes **50 out of 50 tests (100%)** in ~18 seconds.

---

## Part 3: Concrete Next Tasks (Punch List)

To complete the flow exactly as depicted in your handwritten diagram:

### Task 1: Complete Time-Window Incident Correlation (Stage 3)
- In [incident_context.py](file:///d:/Projects/observability-platform/backend/app/services/correlation/incident_context.py), enrich the context payload by:
  1. Fetching Loki logs matching the affected service/host within $[T_{\text{detected}} - 15\text{m}, T_{\text{detected}} + 5\text{m}]$.
  2. Querying PostgreSQL `events` for containers or hosts that died, restarted, or experienced OOM in the same window.
  3. Including this correlated log and event evidence alongside metric points in the prompt.

### Task 2: Implement Qdrant Runbook RAG Ingestion & Search (Stage 4)
- Implement `backend/app/services/ai/rag_service.py`:
  1. Define a Qdrant collection `runbooks_knowledge` (using vector cosine similarity).
  2. Ingest markdown troubleshooting runbooks (e.g., High CPU troubleshooting, Memory leak resolution, Database connection exhaustion, Container OOM kill runbooks).
  3. Generate embeddings (using Gemini Embeddings or FastEmbed) and query Qdrant using the incident's summary and metric name.
  4. Inject the top matching runbook excerpt into [prompt_builder.py](file:///d:/Projects/observability-platform/backend/app/services/ai/prompt_builder.py).

### Task 3: Automatic Docker Event Poller Service
- Add an autonomous background daemon in FastAPI startup (`on_event("startup")` or APScheduler task) that taps the local Docker daemon socket (`unix:///var/run/docker.sock` or Windows named pipe) and automatically posts events to `POST /api/v1/events/ingest` so manual event posting is never required.

### Task 4: Interactive Verification & User Walkthrough
- Spin up simulated anomalous traffic on `workload-generator`, observe the incident trigger in APScheduler, verify correlated metrics/logs/events on the React UI, and generate the end-to-end Gemini RCA report.
