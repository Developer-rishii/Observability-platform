# 3. User Flows & System State Machines

## 3.1 End-to-End Incident Resolution Flow

1. **Telemetry & Log Ingestion**: Custom agent streams container metrics and Docker events to the backend. Prometheus scrapes metrics; Loki aggregates logs.
2. **Anomaly & Event Spike Detection**: The ML service evaluates rolling z-scores and runs Isolation Forest on incoming metrics.
3. **Correlation Engine**: When metric spikes coincide with error log bursts within the correlation time window (15 mins), the backend creates an **Incident** (`status: open`).
4. **Alert Notification**: An alert is triggered (`firing`) and displayed on the frontend dashboard.
5. **RAG Vector Search**: The backend retrieves relevant runbook documentation from Qdrant (`all-MiniLM-L6-v2` vector search) based on the incident log signature.
6. **AI Analysis & Diagnosis**: FastAPI invokes the Google Gemini API with the incident context, logs, and vector runbooks to generate a root cause analysis and step-by-step remediation guide.
7. **SRE Investigation & Remediation**: SRE logs into the dashboard, opens the incident detail view, reads the AI diagnosis, and interacts with the AI diagnostic assistant widget for further guidance.
8. **Resolution**: SRE executes remediation steps on the server. Metrics stabilize. SRE marks the incident as **Resolved** (`status: resolved`).

---

## 3.2 Incident Status State Machine

| From | Trigger | To | Who / System |
|---|---|---|---|
| *(new incident)* | Anomaly detected & correlated across metrics/logs | **Open** | Correlation Engine |
| Open | SRE opens incident details and begins triage | **Investigating** | SRE / DevOps |
| Open / Investigating | Metrics normalize or SRE confirms fix | **Resolved** | SRE / System |

```
    Open (Created by Correlation Engine)
      │
      ▼ (SRE opens incident view)
  Investigating
      │
      ▼ (Remediation executed & metrics stabilized)
   Resolved
```
