# Local Demo Execution Plan — AI Cloud Monitoring Platform

Team: Rushikesh (main dev) · Sayali · Pooja — Draft v3, 13 Oct 2026 (updated after the code check)

## Code check results (13 Oct)

The code check found 2 bugs that stop real data from reaching the dashboard, and 2 features the audit called done that do not exist (Isolation Forest and RAG). The plan below is corrected to match. These findings come from the Antigravity check, so confirm items 1 and 2 yourself; each takes a minute.

| # | Finding | Where | Effect on the plan |
| --- | --- | --- | --- |
| 1 | Every metrics request returns 500: `settings` is used but never imported | `backend/app/api/v1/metrics.py` | Fix first (R0) |
| 2 | The frontend asks for `/metrics/query-range`, the backend serves `/metrics/query` | `frontend/src/api/services.ts` | Fix first (R0) |
| 3 | Real secrets (Gemini key, JWT, agent token, SMTP password) sit in plain text in a tracked file | `docker-compose.yml` | Move to `.env` and rotate (R0) |
| 4 | The agent token is compared with `!=`, and CI never runs `pytest` | `backend/app/api/v1/events.py`, `.github/workflows/ci-cd.yml` | R0 |
| 5 | Isolation Forest does not exist: no code, no model | `backend/app/ml/` (empty) | Built from scratch (S4); threshold detection stays as the backup |
| 6 | RAG does not exist and Qdrant has no collections | `backend/app/rag/` (empty) | P2, P4, R4 |
| 7 | The Gemini client calls `gemini-1.5-pro`, which Google has retired. Tests mock Gemini, so they hide the 404. | `backend/app/services/ai/gemini_client.py` | R4 |
| 8 | node-exporter and Loki run outside Compose, so nobody else can reproduce them | Docker on the host | R1 and R2 move them into Compose |
| 9 | cAdvisor shows cgroup paths, not container names, on Docker Desktop | throwaway test | Dropped; use the demo app's own metrics (R1) |
| 10 | Detection opens an incident on the first breach, never resolves it, and checks only CPU, memory and disk | `backend/app/services/detection/scheduler.py` | S2 |
| 11 | Incident evidence holds metrics only, no logs or events | `backend/app/services/incident_context.py` | S3 |
| 12 | The Infrastructure page adds fake servers when fewer than 7 real ones exist | `frontend/src/pages/Infrastructure.tsx` | P3 |
| 13 | There is no `infrastructure/scripts/` folder | repo | S1 creates it |

Already working: 50 backend tests pass, migrations are at head, the frontend builds, and the Loki client, logs API, events ingest endpoint and AI analyze route exist.

## 1. Your sketches, checked

**Sketch 1 (RCA flow): correct.** It matches the project description: infrastructure → metrics, logs, events → anomaly detector → incident correlation → RAG search (Qdrant) → incident context → prompt builder → Gemini → RCA report. One refinement: the Isolation Forest scores **metrics** (plus counts such as container restarts). Logs and events are not fed into it. They are collected as **evidence** at the correlation step. The RAG query is built from that evidence.

**Sketch 2 (demo on your laptop): a valid plan.** Real HTTP requests, a real database, real container metrics, real logs and real Docker events are all possible on Docker Desktop. The earlier note about Docker Desktop only means host numbers describe the **Docker Desktop VM**, not Windows itself. CPU, memory and container faults still show up correctly. Just label the server "docker-desktop-vm" in the demo.

**Fix these 6 things in the sketch:**

1. **Use two Postgres containers.** `demo-db` (monitored) and the platform's own `db`. If they are the same, the "stop the database" fault kills the monitoring platform too.
2. **Monitor only demo containers.** Put the label `monitor=true` on them. Otherwise the platform monitors itself and creates confusing incidents.
3. **Draw the platform in the picture.** Backend, platform `db`, Qdrant, frontend, Prometheus, Loki and Alloy are missing from sketch 2.
4. **Keep the disk fault small.** Fill a capped folder inside the demo app (max 500 MB). Never fill the laptop or WSL2 disk.
5. **Skip cAdvisor.** The code check confirmed that on Docker Desktop it shows cgroup paths, not container names. Use the demo app's own metrics and node-exporter.
6. **Tell your guide the demo runs locally.** The project description lists a Linux VPS for the final deployment. Keep cloud deployment as an optional extra and record a backup video of a successful run.

## 2. Final demo layout

```
Windows laptop → Docker Desktop
  Monitored stack (docker-compose.demo.yml)       Platform (docker-compose.yml)
  - demo-app    (real HTTP + real DB)             - backend (FastAPI)
  - demo-db     (Postgres, monitored)             - db (platform Postgres)
  - traffic-generator (sends requests)            - frontend, qdrant
  - agent       (Docker events → backend)         - prometheus, loki, alloy
  - node-exporter
  Every monitored container has label monitor=true
```

Run everything with: `docker compose -f docker-compose.yml -f docker-compose.demo.yml up --build`

Host ports today (write them in the README): frontend 5173 (Vite), backend 8000, Prometheus 9090, Loki 3100, Qdrant 6333, platform database 5433, node-exporter 9100, demo-app 8081 (container port 8080). Host port 8080 is taken by the standalone cAdvisor that R1 removes. Do not publish the demo database port to the host.

## 3. What is not done yet

Fix first:

1. The metrics API crash and the frontend/backend path mismatch (findings 1 and 2).
2. The secrets in `docker-compose.yml`: rotate them and move them to `.env`.
3. CI does not run `pytest`.

Build:

- Put node-exporter and Loki into Compose (they run outside it today) and add Alloy for log shipping.
- Extend the existing workload generator into the demo app, add a separate `demo-db`, and add the traffic generator.
- Write the 5 fault scripts (the `infrastructure/scripts/` folder does not exist).
- Build the Docker events agent. The backend endpoint it posts to already exists.
- Harden detection: consecutive breaches, automatic recovery, more metrics.
- Add real logs and events to incident evidence.
- Build Isolation Forest from scratch, trained on real data from the demo.
- Build RAG from scratch: knowledge documents, ingestion into Qdrant, retrieval inside the analysis.
- Replace the retired Gemini model.
- Remove fake data from the frontend and wire each page to its real endpoint.
- Measure results, write the demo script and package the one-command demo.

The audit's "complete" claims were partly wrong, so each person runs the check at the top of section 4 before starting.

## 4. Rules for everyone

- Before starting, run `docker compose up --build`, `pytest` and `npm run build`. If one fails, fix it first.
- One task = one branch = one PR. Never merge your own PR.
- Change only the files named in your task.
- A screen is done only when its data changes after you run a fault.
- Never put secrets in a tracked file. Use `.env` and list the names in `.env.example`.
- Commit prefixes and branch rules are in `docs/16-developer-workflow.md`.

## 5. Order of work

| Round | Rushikesh | Sayali | Pooja |
| --- | --- | --- | --- |
| 0 | R0 Fix blockers | S1 Demo app, demo database and faults | P1 Traffic generator |
| 1 | R1 Real metrics | S2 Detection hardening | P2 Knowledge base documents |
| 2 | R2 Real logs, R3 Events agent | S3 Real evidence in incidents | P3 Frontend cleanup and wiring (starts after R0), P4 RAG ingestion |
| 3 | R4 Gemini fix and RAG link | S4 Isolation Forest | P3 continues |
| 4 | R5 One-command demo | S5 Test results | P5 Demo script and QA |

Dependencies: R1 needs S1 for app metrics (node-exporter can start first). S2 needs R1 and S1. S3 needs R2 and R3 (use fixture files until then). R4 needs P2 and P4. P1 can be tested against any simple server before S1 is ready. P3 needs R0, then wires each page as its endpoint goes live. S4 starts only after S2 works; threshold detection is the fallback if time runs out. If Pooja is overloaded in round 2, Rushikesh takes P4.

## 6. Rushikesh's tasks (main dev: blockers, data pipeline, AI link)

### R0. Fix blockers

Branch: `bugfix/metrics-and-secrets`

Files: `backend/app/api/v1/metrics.py`, `frontend/src/api/services.ts`, `docker-compose.yml`, `.env.example`, `backend/app/api/v1/events.py`, `.github/workflows/ci-cd.yml`, `backend/tests/`.

Steps:

1. In `metrics.py`, add `from app.core.config import settings`. Without it every metrics request returns 500. Add a test that calls the metrics route so this cannot come back.
2. Make the frontend match the backend path: change the call in `services.ts` from `/metrics/query-range` to `/metrics/query`. Do not add a second route.
3. Remove the values of `GEMINI_API_KEY`, `JWT_SECRET`, `AGENT_SHARED_SECRET` and `SMTP_PASSWORD` from `docker-compose.yml`. Read them from `.env` with `${VAR}` and list the names with fake values in `.env.example`. Rotate the real Gemini key and SMTP password in their dashboards and generate new JWT and agent secrets. Removing them from the file does not remove them from git history, so rotation is what protects you.
4. In `events.py` (around line 60), compare the agent token with `hmac.compare_digest` instead of `!=`.
5. In `.github/workflows/ci-cd.yml`, add a `pytest` step.
6. Set `FRONTEND_ORIGIN=http://localhost:5173` in `.env` and `.env.example` (the port Vite uses).

Done when: the metrics endpoint returns 200 with JSON, CI runs `pytest`, `docker-compose.yml` contains no secret values, and the Metrics page loads in the browser with no CORS error.

### R1. Real metrics

Branch: `feature/real-metrics`

Files: `docker-compose.demo.yml`, `infrastructure/prometheus/prometheus.yml`, `backend/app/services/ingestion/prometheus_client.py`, the metrics API file.

Steps:

1. Move node-exporter into `docker-compose.demo.yml` with a pinned image (host port 9100). It runs outside Compose today, so nobody else can reproduce it. Do not add cAdvisor.
2. Add a scrape job (15 s) for `demo-app:8080`. The demo app's default Python process metrics give its own CPU and memory.
3. In `prometheus_client.py`, keep the working queries (CPU, memory, disk, network) and add request rate, p95 latency, error rate and `demo_data_dir_bytes`. A metric with no data returns an empty list.
4. When Prometheus is unreachable, raise HTTP 503 with `{"detail": "...", "code": "prometheus_unavailable"}`. Today it returns None or an empty list.
5. Name the host "docker-desktop-vm" in API responses.

Done when: Prometheus shows node-exporter and demo-app UP, the metrics endpoint returns changing numbers while Sayali's CPU fault runs, and stopping Prometheus gives a 503.

### R2. Real logs

Branch: `feature/real-logs`

Files: `docker-compose.yml`, `infrastructure/loki/config.yml`, `infrastructure/alloy/config.alloy`. The Loki client (`backend/app/services/logging/loki_client.py`) and `backend/app/api/v1/logs.py` already exist.

Steps:

1. Move Loki into Compose (it runs outside today) and add Alloy. Mount `/var/run/docker.sock` read-only into Alloy. Alloy replaces Promtail, which Grafana has announced as end-of-life; check the Grafana docs.
2. Alloy keeps only containers with label `monitor=true` and adds labels `service` and `container`.
3. Check the existing logs endpoint accepts `service`, `level`, `q`, `start`, `end` and `limit` (max 500). Add what is missing.

Done when: with traffic running, the logs endpoint shows real demo-app request lines.

### R3. Docker events agent

Branch: `feature/events-agent`

Files: `agent/` (main.py, Dockerfile, requirements.txt), `docker-compose.demo.yml`. The backend endpoint already exists.

Steps:

1. Python agent with the Docker SDK. Listen to container events (start, stop, die, restart, oom, kill) only for label `monitor=true`. Mount `/var/run/docker.sock` read-only.
2. POST each event to the existing `POST /api/v1/events/ingest` with header `X-Agent-Token` and a `client_event_id` built from container id + action + event time. The Event table already ignores repeated `client_event_id` values.
3. Put the container name in `payload.container_name`. No migration is needed; read it with `payload->>'container_name'`.
4. If the backend is down, keep the events and retry with growing waits. Send the queue when it returns.

Done when: `docker kill demo-app` creates exactly one new event within a few seconds, a repeated event still gives one row, and events sent while the backend was stopped arrive after it restarts.

### R4. Gemini fix and RAG link

Branch: `feature/ai-rag-wiring`

Files: `backend/app/services/ai/gemini_client.py`, `backend/app/core/config.py`, `.env.example`, `backend/app/rag/retriever.py` (from P4), the route `POST /api/v1/ai/incidents/{id}/analyze`.

Steps:

1. The client calls `gemini-1.5-pro`, which Google has retired, so real calls fail with 404. Read the model name from `GEMINI_MODEL`. Choose a current model from Google's official model list on the day you build. A third-party page says the Gemini 2.5 models retire on 20 Oct 2026, so check the official list before picking. Test once with a real key.
2. Add a per-incident cooldown so an analysis cannot be re-run within N seconds.
3. After P4 is merged, add retrieval: build a query from the incident context, take the top 5 chunks above a relevance threshold from Qdrant, add them to the prompt, and return their titles and scores as `knowledgeSources`.
4. If Qdrant or Gemini fails, return the "unavailable" result and keep the incident page working.

Done when: analyzing a real incident with a real key returns a valid RCA with at least one source, and with no key you get "unavailable", not a crash.

### R5. One-command demo

Branch: `feature/demo-packaging`

Steps:

1. Make `docker compose -f docker-compose.yml -f docker-compose.demo.yml up --build` work from a clean clone.
2. Add healthchecks, `restart: unless-stopped` on `demo-app`, and memory limits on heavy containers.
3. Complete `.env.example`, the admin seed script, and a README "Run the demo" section with the port table.
4. Add WSL2 memory advice (`.wslconfig`) to the README.
5. Record a backup video of a successful run.

Done when: someone with only the README can start the stack and log in to see live data. Optional later: cloud deployment, only if your guide requires it.

## 7. Sayali's tasks (demo app, detection, evidence, Isolation Forest, results)

### S1. Demo app, demo database and faults

Branch: `feature/demo-app-faults`

Files: `infrastructure/workload-generator/` (extend it and rename the Compose service to `demo-app`), `docker-compose.demo.yml`, `infrastructure/scripts/` (new), `docs/FAULT_SCENARIOS.md`.

Steps:

1. The existing app is a Flask CPU burner with `/spike` and `/metrics`. Keep it and extend it; do not rewrite it. Keep container port 8080 and host port 8081, and update the Prometheus job name to match the new service name.
2. Add `demo-db`, a separate Postgres container (not the platform's `db`) with `products` and `orders` tables and about 50 seeded products.
3. Add `GET /health`, `GET /api/products`, `GET /api/orders` and `POST /api/orders`. They must use the real `demo-db`. Do not simulate responses, or "stop the database" proves nothing. Log one JSON line per request (time, level, path, status, duration\_ms). A database error logs ERROR and returns 500.
4. On `/metrics` expose `http_requests_total{path,status}`, a request-duration histogram and `demo_data_dir_bytes`. Add label `monitor=true` and `restart: unless-stopped`.
5. Fault endpoints under `/admin/fault/*`, protected by an `X-Fault-Token` header and capped: `cpu` (max 120 s), `latency` (max 3000 ms for max 120 s, then it resets itself), `disk` (max 500 MB into `/data/fill`) and `disk/clear`.
6. Create `infrastructure/scripts/` with PowerShell scripts: `cpu-stress.ps1`, `container-crash.ps1` (docker kill demo-app), `db-stop.ps1` (stop demo-db, wait, start it again), `latency-spike.ps1`, `disk-fill.ps1`.
7. In `docs/FAULT_SCENARIOS.md`, write the command and expected symptoms for each fault.

Done when: all 5 scripts run, each effect shows in Prometheus, and each fault ends by itself or has a clear cleanup command.

### S2. Detection hardening

Branch: `feature/detection-hardening`

Files: `backend/app/services/detection/scheduler.py` and its tests.

Steps:

1. Today it checks only CPU, memory and disk against static thresholds and opens an incident on the first breach. Add p95 latency, error rate, container restart count (from the events table) and `demo_data_dir_bytes`.
2. Open an incident only after N consecutive breaches. Resolve it automatically after M consecutive normal checks. Make N and M settings in `.env`.
3. Missing data is never an anomaly: log it and skip it. Keep one open incident per server + metric. Set severity by how far the value passes the threshold.
4. Add pure-logic tests for breach counting, recovery, duplicates and missing data.

Done when: one CPU fault creates exactly one incident, a repeat while it is open creates no duplicate, the incident resolves after recovery, and a 30-minute normal run produces no false incidents (or the exact count is written down).

### S3. Real evidence in incidents

Branch: `feature/correlation-real`

Files: `backend/app/services/incident_context.py` and the incident detail response.

Steps:

1. Today it packages only metric details. Add, from 5 minutes before to 5 minutes after the incident: error and warning logs for the affected service (use the existing Loki client) and Docker events for that service and its dependency (`demo-app` depends on `demo-db`; read the container name from `payload->>'container_name'`).
2. Return them in the incident detail response. A missing source gives an empty list plus a note, never an error.
3. Build against fixture files in `tests/fixtures/` until R2 and R3 are ready.

Done when: the "stop the database" incident shows "connection refused" logs and a stop event for `demo-db`.

### S4. Isolation Forest from scratch

Branch: `feature/isolation-forest`

Files: `backend/app/ml/` (training script, inference class), `backend/app/services/detection/scheduler.py`.

Steps:

1. There is no ML code today. Start only after S2 works; threshold detection is the fallback if time runs out.
2. Capture features from a 30-minute normal run of the real demo (rolling mean and std for CPU and latency, error rate, restart count). Do not train on made-up numbers. Use synthetic data only to fill a gap, and say so in the report.
3. Train `IsolationForest` and save the model file together with its feature list.
4. Add an inference class. The scheduler flags an anomaly when the model score or a threshold rule trips. If the model file is missing, use thresholds only.

Done when: the training script reproduces the model from captured data, detection logs show an anomaly score, one fault run is flagged, and the normal run's false alarms are counted.

### S5. Test results

Branch: `feature/evaluation-results`

Steps: run each of the 5 scenarios 3 times. In `ml/evaluation/results.md` record: scenario, fault start time, first metric change, detection time, incident created (yes/no), false alarms, RCA useful (yes/no), recovery time. Add the 30-minute normal run. Write only measured numbers. If Isolation Forest was not finished, say the results are for threshold detection.

Done when: the file has 15 scenario rows plus the normal run.

## 8. Pooja's tasks (traffic, knowledge base, frontend, RAG ingestion, demo)

### P1. Traffic generator

Branch: `feature/traffic-generator`

Files: `infrastructure/traffic-generator/` (app.py, Dockerfile, requirements.txt), `docker-compose.demo.yml`.

Steps:

1. A Python loop using `httpx` (3-second timeout). Pick a request each time: 60% `GET /api/products`, 25% `GET /api/orders`, 10% `POST /api/orders` (random product and quantity), 5% `GET /health`.
2. Settings from environment: `TARGET_URL` (default `http://demo-app:8080`) and `REQUESTS_PER_SECOND` (default 5).
3. Never crash on errors. Log them and continue. Print a summary (sent, errors) every 30 seconds. Use `restart: unless-stopped`.

Done when: `docker compose logs traffic-generator` shows steady requests and the demo app's request counter keeps rising. You can test it against any simple server before Sayali's S1 is ready.

### P2. Knowledge base documents

Branch: `feature/knowledge-base`

Files: `rag/knowledge_base/` (create it if it is missing).

Steps:

1. Write 10 short markdown files (200 to 400 words each): high CPU, memory and OOM kill, container crash loop, exit code 137, Postgres connection refused, Postgres too many connections, API latency, HTTP 500 spike, disk full, log rotation.
2. Use the same layout in each: Symptoms, Likely causes, How to check, How to fix, Sources. Write in your own words from official documentation. Do not copy and paste.

Done when: the 10 files exist with all five headings, and each of the 5 demo faults has at least one matching document.

### P3. Frontend cleanup and wiring

Branch: `feature/data-status`, then one small branch per page: `feature/wire-<page>`

Steps:

1. Remove the fake servers that `frontend/src/pages/Infrastructure.tsx` adds when fewer than 7 real ones come back. Show the real list, or an empty state.
2. Create `docs/DATA_STATUS.md`: a table of every screen (16 routes), whether it uses the real API or sample data, and which function in `frontend/src/api/services.ts` it calls.
3. Add a small "Demo data" badge that shows on any page still using sample data. There is no mock switch today, so never leave sample data unlabeled.
4. After R0 is merged, wire pages in this order as their endpoints go live: Infrastructure, Metrics, Logs, Events, Incidents. For each page, change only the function in `frontend/src/api/`, delete its sample data, and check the loading, empty and error states.

Done when: each wired page's numbers change after a fault script runs, and the table is up to date.

### P4. RAG ingestion and search

Branch: `feature/rag-ingestion`

Files: `backend/app/rag/ingest.py`, `backend/app/rag/retriever.py`, `backend/requirements.txt`, `rag/retrieval_notes.md`.

Steps:

1. Read the markdown files in `rag/knowledge_base/`. Split each into chunks of about 300 to 500 tokens with about 15% overlap. Keep the document title and section heading with each chunk.
2. Embed the chunks with `sentence-transformers` (model `all-MiniLM-L6-v2`; it downloads once on first run, so you need internet then). Add `qdrant-client` and `sentence-transformers` to `requirements.txt` if they are missing.
3. Store the chunks in a Qdrant collection. Qdrant runs on port 6333 but has no collections today. Keep title, section and source file with each chunk.
4. Write `search(query, k=5, min_score)` in `retriever.py`. It returns chunks with their source and score and drops chunks below the score threshold.
5. Test 5 queries, one per fault type. Write the top results in `rag/retrieval_notes.md`.

Done when: Qdrant has the collection and each fault's query returns a relevant document in the top 3. Rushikesh reviews this PR because R4 builds on it. If this is too much alongside P3, Rushikesh takes it.

### P5. Demo script and QA

Branch: `feature/demo-script`

Steps: write `docs/DEMO_SCRIPT.md` with the exact demo steps (start the stack, show normal data, run a fault, show the incident, evidence, retrieved knowledge and the AI analysis, recover). Run it 3 times, write down how long it takes, and log each bug as a GitHub issue with a screenshot.

Done when: a person who has not seen the project can follow the script alone.

## 9. The 5 demo scenarios

| # | Scenario | How you trigger it | What you should see |
| --- | --- | --- | --- |
| 1 | CPU stress | `cpu-stress.ps1` | CPU metric rises, requests get slower |
| 2 | Container crash | `container-crash.ps1` | die and restart events, short gap in metrics, startup logs |
| 3 | Database unavailable | `db-stop.ps1` | "connection refused" logs, error rate up, stop event on `demo-db` |
| 4 | API latency | `latency-spike.ps1` | p95 latency rises, possible timeouts |
| 5 | Disk spike | `disk-fill.ps1` (max 500 MB) | `demo_data_dir_bytes` rises and crosses the threshold |

## 10. Message to give each agent

Paste this, then paste one task from sections 6 to 8.

```
Work in this repo only on the task below. Create the branch named in the task.
Change only the files the task names. Run the "Done when" check and show the real
output, not a summary. Commit with the prefix from docs/16-developer-workflow.md and
push the branch. Do not merge. If anything fails or a file contradicts the task,
stop and tell me instead of guessing.
```

## 11. Decisions

Decided after the code check:

1. **Frontend port.** Keep Vite's 5173 and set `FRONTEND_ORIGIN` to `http://localhost:5173` (R0).
2. **Demo app.** Extend the existing Flask `workload-generator` in place, with a real `demo-db` and no simulated endpoints (S1). Python stays, so the language question is closed.
3. **Container names in events.** Keep them in `payload`; no migration (R3, S3).
4. **Exposed secrets.** Treat them as leaked. Rotate the Gemini key and SMTP password and replace the JWT and agent secrets (R0). If the repo is public, assume the old keys were copied.

Still open:

1. **Is a laptop-only demo accepted?** Ask your guide. The project description names a Linux VPS for the final deployment.
2. **Laptop memory.** The stack is about 12 containers. If the laptop has less than 16 GB RAM, tell the team so the stack can be trimmed.
3. **Gemini model.** Pick it from Google's official list when R4 starts and test it with a real key.
