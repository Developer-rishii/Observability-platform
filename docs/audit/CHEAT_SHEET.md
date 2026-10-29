# AetherPulse Defense Cheat Sheet

> **Single-Page Quick Reference for Evaluators & Technical Defense**  
> *Keep this document open or printed during your presentation tomorrow.*

---

## 1. Top 15 Non-Negotiable Numbers & Facts

| Parameter | Exact Value | Where Configured / Source |
| :--- | :--- | :--- |
| **Active ML Threshold** | `0.7287` | `ml/models/feature_metadata.json` |
| **Validation Score P99.5** | `0.7087` (Formula: $0.7087 + 0.02 = 0.7287$) | `ml/models/feature_metadata.json` |
| **Model Algorithm & Trees** | `IsolationForest` (`n_estimators=150`, `max_samples=1.0`) | `ml/models/feature_metadata.json` |
| **Active Model Version & Hash**| `iforest-v1.0` (SHA-256: `0462cea9f4f4693a02796e9cf0a1cbb0f59048a1...`) | `ml/models/feature_metadata.json` |
| **Detection Scheduler Cadence**| `15 seconds` | `backend/app/services/detection_scheduler.py:44` |
| **Breaches to Open Incident** | `3 consecutive cycles` ($3 \times 15\text{s} = 45\text{s}$ anomaly) | `backend/app/services/detection_scheduler.py:46` |
| **Clears to Auto-Resolve** | `3 consecutive cycles` ($3 \times 15\text{s} = 45\text{s}$ normal) | `backend/app/services/detection_scheduler.py:47` |
| **Auto-Resolution Wall-Clock** | `5 to 8 minutes` after fault stops (due to 5m Prometheus rate rolling window) | `backend/app/services/ml/features.py` |
| **Incident Cooldown** | `300 seconds` (5 minutes duplicate suppression) | `backend/app/services/incident_repository.py:16` |
| **Training Baseline Size** | `275 rows` (15s cadence $\approx 68.5$ mins: Oct 26 09:24 to 10:32 UTC) | `ml/data/normal_train.csv` |
| **Validation Baseline Size** | `96 rows` (15s cadence $\approx 24$ mins: Oct 26 16:14 to 16:38 UTC) | `ml/data/normal_validate.csv` |
| **Feature Dimensionality** | `8 telemetry features` (7 PromQL queries, 1 Docker DB query) | `backend/app/services/ml/features.py` |
| **Zero-Variance Features** | `error_rate_5m` ($0.0$), `data_dir_growth_5m` ($0.0$) | Handled by nominal scale ($1.0\%$, $10\text{MB/s}$) & Rule Guards |
| **RAG Runbook Points** | `60 vector chunks` in Qdrant collection `incident_knowledge_base` | `qdrant-vector-rag:6333` |
| **Total Test Suite** | `126 passed backend tests` across 16 test suites | `backend/tests/` |

---

## 2. Ports, Containers & Key Endpoints

| Container / Service | Port / Protocol | What It Does |
| :--- | :--- | :--- |
| **`backend`** | `8000:8000` (HTTP) | FastAPI application server, detection scheduler, ML runtime |
| **`frontend`** | `5173:5173` (HTTP) | React + Vite enterprise UI |
| **`prometheus`** | `9090:9090` (HTTP) | Metrics engine scraped every 5s from demo-app, cAdvisor, Node Exporter |
| **`loki`** | `3100:3100` (HTTP) | Log stream aggregator (fed by Grafana Alloy) |
| **`alloy`** | `12345` (Internal) | Log collector parsing Docker container stdout/stderr |
| **`qdrant`** | `6333:6333` (HTTP/gRPC) | Vector database storing 60 runbook knowledge chunks |
| **`db`** | `5432:5432` (PostgreSQL) | Primary relational DB storing incidents, alerts, Docker events, AI analyses |
| **`demo-app`** | `8001:8001` (HTTP) | Monitored e-commerce service with `/metrics` and `/api/products` |
| **`events-agent`** | Internal Daemon | Docker socket listener streaming container stop/die events into Postgres |

---

## 3. The 8 Detection Features At a Glance

| # | Feature Name | Source / Window | Normal Mean $\pm$ Std | What Breach It Catches |
|---| :--- | :--- | :--- | :--- |
| 1 | `cpu_usage_pct_5m` | PromQL rate `container_cpu_usage_seconds_total` (5m) | $6.52\% \pm 5.17\%$ | CPU overload / infinite loops |
| 2 | `memory_usage_mb` | PromQL gauge `container_memory_usage_bytes` | $86.74\text{MB} \pm 1.25\text{MB}$ | Memory leaks / heap pressure |
| 3 | `error_rate_5m` | PromQL rate HTTP 5xx responses / total (5m) | $0.00\% \pm 0.00\%$ | Backend server exceptions (**Rule Guarded: $\ge 5\%$**) |
| 4 | `latency_p95_mean_5m`| PromQL rolling 5m mean of P95 latency histogram | $0.021\text{s} \pm 0.002\text{s}$ | Chronic DB connection stall / slow queries |
| 5 | `latency_p95_std_5m` | PromQL rolling 5m std of P95 latency histogram | $0.003\text{s} \pm 0.001\text{s}$ | Latency jitter / packet loss / intermittent lockups |
| 6 | `request_rate_mean_5m`| PromQL rate HTTP requests per second (5m) | $1.76\text{ rps} \pm 0.17\text{ rps}$| Traffic surge or complete network cutoff |
| 7 | `data_dir_growth_5m`| PromQL disk deriv `node_filesystem_free_bytes` (5m)| $0.00\text{B/s} \pm 0.00\text{B/s}$| Log runaway / disk exhaustion (**Rule Guarded: $\ge 1\text{MB/s}$**)|
| 8 | `container_die_count_15m`| SQL count from `events` table (15m window) | $0.22 \pm 0.41$ | CrashLoop / process killed (**Rule Guarded: $\ge 1$**) |

---

## 4. The 10 Sentences to Memorize for Tomorrow

1. **System Identity:** *"AetherPulse is an enterprise hybrid observability platform combining unsupervised Isolation Forest anomaly detection with rule guards and RAG-grounded generative AI root-cause analysis."*
2. **Why Isolation Forest:** *"We chose Isolation Forest because production telemetry anomalies are rare, multi-dimensional, and unlabelled—Isolation Forest isolates anomalies in few random partitions ($O(n \log n)$ time) without assuming a Gaussian distribution."*
3. **Threshold Math:** *"Our threshold of 0.7287 was calibrated on 96 clean validation rows using the 99.5th percentile score of 0.7087 plus a 0.02 safety margin to enforce a near-zero false positive rate under baseline conditions."*
4. **Why Rule Guards Exist:** *"Unsupervised ML is blind to zero-variance features in baseline data—like error rate and disk growth—so we built deterministic rule guards for error rate ($\ge 5\%$), disk growth ($\ge 1\text{MB/s}$), and container deaths ($\ge 1$) to eliminate critical blind spots."*
5. **No Training/Serving Skew:** *"Both training baseline collection and live 15-second inference import the exact same `unified features.py` module, guaranteeing zero metric definition skew between model development and production."*
6. **False Positive Suppression:** *"To prevent alert fatigue from transient metric blips, the scheduler requires 3 consecutive 15-second breaches (45 seconds total) before opening an incident, and applies a 5-minute duplicate suppression cooldown."*
7. **Why Auto-Resolution Lags:** *"When a fault is stopped, the incident auto-resolves after 3 clean cycles, but takes 5 to 8 minutes in practice because Prometheus calculates rates and latency over a 5-minute rolling window that must physically drain."*
8. **RAG Grounding Over Hallucination:** *"Our Gemini RCA does not guess blindly: we extract top feature Z-scores and query Qdrant for the top 3 matching runbooks out of 60 vector chunks to ground the LLM in proven remediation steps."*
9. **Baseline Contamination Honesty:** *"In our initial 275-row training baseline, a container restart and traffic surge occurred, elevating the model's tolerance to moderate CPU spikes—which is precisely why offline validation caught this gap and why rule guards were added as a defense-in-depth layer."*
10. **Scalability Path:** *"While our prototype monitors an e-commerce microservice with SQLite/single-node Prometheus, our architecture cleanly decouples scrapers, vector storage, and stateless FastAPI workers to scale directly to OpenTelemetry and multi-node Kubernetes clusters."*

---

## 5. Live Demo Flow & Fallback Cheat

| Step | Action | Expected Result | Fallback / If It Lags |
| :--- | :--- | :--- | :--- |
| **1. Baseline State** | Open `http://localhost:5173/`, show green cards, 0 open incidents | System Health `HEALTHY`, engine running | If engine paused, click resume in header |
| **2. Inject Fault** | Run latency spike: `python scripts/inject_fault.py latency-spike --duration 60` | CLI confirms `P95 latency injected` | If script hangs, show previously resolved Incident #356 |
| **3. Detection Alert** | Watch UI for 45s (3 cycles). Incident banner appears. | Incident: `High Anomaly: Latency Spike (P95 Variance)` | Point to `latency_p95_std_5m` with $Z > 20\sigma$ |
| **4. AI RCA Deep Dive** | Click incident $\to$ RCA tab $\to$ Click *Generate AI RCA* | Gemini returns structured root cause + runbook steps | If API quota slow, show cached RCA on Incident #356 |
| **5. Ask AI Chat** | Type: *"What is causing this latency spike and what should I check first?"* | Groq/Qwen assistant responds with contextual metrics | If offline, explain system prompt & prompt-injection regex |
| **6. Auto-Resolution** | Wait for 5-minute window to drain or show resolved status | Incident transitions from `INVESTIGATING` to `RESOLVED` | Explain 5-minute Prometheus rolling window math |

---

## 6. Golden Rules for Tomorrow
- **Never say:** *"The system detects 100% of faults using pure AI."*  
  **Instead say:** *"The system utilizes a hybrid model: Isolation Forest for subtle metric drifts and deterministic Rule Guards for fatal boundary conditions."*
- **Never hide:** The training baseline contamination. Present it proudly as the exact technical justification for why you implemented offline validation, Z-score nominal scales, and hybrid rule guards!

