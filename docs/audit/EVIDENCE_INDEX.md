# AetherPulse Evidence Index & Verification Log

> **Audit Evidence Mapping:** Every factual claim in the audit report is mapped to its exact source file, line number, database record, or live container query.  
> **Integrity Standard:** Zero unverified assertions. All items requiring physical test runs before tomorrow are transparently catalogued.

---

## 1. Evidence Verification Table

| Claim / Fact | File Path / Source Reference | Specific Code Line / Evidence Details |
| :--- | :--- | :--- |
| **Active ML Threshold = 0.7287** | `ml/models/feature_metadata.json` | `"threshold": 0.7287`, `"threshold_p99_5": 0.7087` |
| **Model Estimators = 150** | `ml/models/feature_metadata.json` | `"n_estimators": 150`, `"max_samples": 1.0` |
| **Model SHA-256 Checksum** | `ml/models/feature_metadata.json` | `"model_sha256": "0462cea9f4f4693a02796e9cf0a1cbb0f59048a149c4f74d026338cf48ddb16b"` |
| **Model Version = iforest-v1.0** | `ml/models/feature_metadata.json` | `"model_version": "iforest-v1.0"` |
| **Unified Feature Extraction** | `backend/app/services/ml/features.py` | Line 16: `FEATURE_NAMES = [...]`, Line 62: `extract_features_vector(...)` |
| **Training Baseline Size = 275** | `ml/data/normal_train.csv` | File contains exactly 276 lines (header + 275 rows) from `2026-10-26T09:24:25` to `10:32:55 UTC` |
| **Validation Baseline Size = 96** | `ml/data/normal_validate.csv` | File contains exactly 97 lines (header + 96 rows) from `2026-10-26T16:14:30` to `16:38:15 UTC` |
| **Scheduler Cadence = 15s** | `backend/app/services/detection_scheduler.py` | Line 44: `DETECTION_INTERVAL_SECONDS = 15` |
| **Consecutive Breach Limit = 3** | `backend/app/services/detection_scheduler.py` | Line 46: `CONSECUTIVE_BREACHES_TO_OPEN = 3` |
| **Consecutive Clean Limit = 3** | `backend/app/services/detection_scheduler.py` | Line 47: `CONSECUTIVE_CLEANS_TO_RESOLVE = 3` |
| **Incident Cooldown = 300s** | `backend/app/services/incident_repository.py` | Line 16: `INCIDENT_COOLDOWN_SECONDS = 300` |
| **Top Feature Nominal Scales** | `backend/app/services/ml/detector.py` | Lines 25–28: `NOMINAL_FEATURE_SCALES = {"error_rate_5m": 0.01, "data_dir_growth_5m": 10.0 * 1024 * 1024}` |
| **Rule Guards Definition** | `backend/app/services/detection_scheduler.py` | Lines 50–54: `RULE_GUARD_ERROR_RATE = 0.05`, `RULE_GUARD_DATA_GROWTH_BYTES = 1048576`, `RULE_GUARD_CONTAINER_DIE = 1` |
| **Database Migrations Head** | `backend/alembic/versions/0004_detection_source.py` | Migration `0004_detection_source` confirms head; revisions `0001` through `0004` chained cleanly |
| **Live Database Table Inventory** | PostgreSQL `db:5432` schema inspection | 14 tables verified: `events` (125,624), `ai_analyses` (59), `incidents` (33), `alerts` (33), `users` (4), `verification_tokens` (3), `password_reset_tokens` (1), `alembic_version` (1), plus 6 schema relation tables |
| **Total Test Count = 126** | `backend/tests/` | 16 test files verified via pytest discovery in prior run logs |
| **Live Incident #356 Evidence** | PostgreSQL `incidents` table | `id: 356`, `detected_at: 2026-10-28 10:15:58 UTC`, `resolved_at: 2026-10-28 10:22:28 UTC`, `anomaly_score: 0.7789` |
| **Top Contributing Feature (#356)**| PostgreSQL `incidents.top_features` | `latency_p95_std_5m` with Z-score $+88.25\sigma$ |
| **Gemini AI RCA Table Record** | PostgreSQL `ai_analyses` table | 59 records; Incident #356 record has `confidence: "low"`, prompt with Qdrant runbook chunks |
| **Qdrant Vector Points = 60** | Qdrant REST API (`:6333/collections/incident_knowledge_base`) | Collection status `green`, `points_count: 60`, vector size `384` |
| **Groq / OpenAI Chat Integration** | `backend/app/services/ai/openai_chat.py` | Lines 30–75: Client initialization, system prompt assembly, prompt injection sanitizer |
| **Docker Compose Orchestration** | `docker-compose.yml`, `docker-compose.demo.yml` | Base services: `backend`, `frontend`, `db`, `prometheus`, `loki`, `alloy`, `cadvisor`, `node-exporter`, `qdrant`, `events-agent`. Demo services: `demo-app`, `demo-db`, `traffic-generator` |
| **Infrastructure Explorer Page** | `frontend/src/pages/InfrastructurePage.tsx` | Lines 1–320: Cluster Topology & Dependency Graph rendering demo-app and dynamic telemetry cards |

---

## 2. Items Marked UNVERIFIED (With Technical Justifications)

Under the strict audit rules, no application builds, active load tests, or external LLM API spends could be triggered during this audit session. The following items are marked **UNVERIFIED**:

### 1. `npm run build` Execution Status
- **Claim:** The React frontend compiles with zero TypeScript errors on production build.
- **Verification Status:** `UNVERIFIED (BUILD UNTESTED)`.
- **Reason:** Per audit Hard Rule #2, frontend production build (`npm run build`) was not executed. However, Vite dev server (`npm run dev`) is currently active on port 5173 with hot-reloading functioning and zero console fatal errors.
- **Action for Tonight:** Run `npm run build` once in terminal to confirm Vite bundling succeeds.

### 2. Live Groq Streaming Token Latency
- **Claim:** Ask AI chat completes response streaming within 1.5 seconds.
- **Verification Status:** `UNVERIFIED (LIVE INFERENCE LATENCY)`.
- **Reason:** The code and environment variables (`GROQ_API_KEY`, model `qwen/qwen3.8-27b`) are verified in `openai_chat.py` and `.env`. However, sending a live query to the external LLM was withheld to prevent credential exposure and API billing.
- **Action for Tonight:** Send one test chat message in the UI (*"What is the status of demo-app?"*) to verify token generation.

### 3. Disk-Fill Live Detection Latency
- **Claim:** Live injection of `disk-fill` fault triggers an incident in under 45 seconds.
- **Verification Status:** `UNVERIFIED (LIVE SCENARIO TIMING)`.
- **Reason:** While `latency-spike` and `container-crash` scenarios have verified historical rows in PostgreSQL (Incident #356 and Incident #311), `disk-fill` relies on rule guard `RULE_GUARD_DATA_GROWTH_BYTES`. The fault injection script was not executed tonight to avoid filling host container disk space.
- **Action for Tonight:** Keep as a discussion point during Q&A rather than running it live.

---

## 3. Pre-Presentation Verification Checklist (Complete Tonight in 10 Minutes)

- [ ] **Check 1: Backend Container Health**
  ```powershell
  docker compose ps backend
  # Expected: Up (healthy)
  ```
- [ ] **Check 2: Prometheus Targets**
  Open `http://localhost:9090/targets` in browser.
  - Confirm `demo-app` is UP.
  - Confirm `cadvisor` is UP.
  - Confirm `node-exporter` is UP.
- [ ] **Check 3: Active Dashboard View**
  Open `http://localhost:5173/` in browser.
  - Confirm navigation bar loads.
  - Confirm Incidents tab shows resolved history.
- [ ] **Check 4: Ask AI Chat Ping**
  Navigate to any resolved incident $\to$ Click **Ask AI** tab $\to$ Type: *"Explain this incident"*.
  - Confirm response streams cleanly without 500 error.

