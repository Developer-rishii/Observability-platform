# 2. MVP Scope and Feature List

## 2.1 User Roles

| Role | Access Level | Description |
|---|---|---|
| **User / Engineer** | Developer & Metrics Dashboard | Authenticated SRE/DevOps engineer. Views real-time metrics, system logs, active incidents, and AI remediation suggestions. |
| **Admin** | Admin Dashboard & System Settings | Admin with full access to manage servers, alert threshold rules, system configurations, and AI runbook knowledge base. |

---

## 2.2 Complete Feature List

### 2.2.1 Authentication & Security
- User registration and JWT authentication.
- Password hashing using `bcrypt`.
- Secret token authentication for external agent endpoints.
- Role-based access control (Admin vs User).

### 2.2.2 Server & Service Management
- Active server registration, IP address, OS info, and health status tracking.
- Service tracking per server (Docker containers, background services).
- Node Exporter & cAdvisor integration for metrics extraction.

### 2.2.3 Event & Log Monitoring
- Docker Engine events API stream ingestion.
- Centralized log aggregation with Loki backend.
- Filterable log stream viewer on the frontend.

### 2.2.4 Anomaly Detection & Incident Correlation
- Isolation Forest ML model for detecting metric anomalies.
- Rolling z-score calculations for CPU/Memory spikes.
- Time-windowed correlation engine linking events and log bursts into Incidents.
- Incident state management (`open`, `investigating`, `resolved`).

### 2.2.5 RAG & AI Remediation Engine
- Qdrant vector database integration for runbook ingestion (`all-MiniLM-L6-v2` embeddings).
- Google Gemini API integration for automated incident root cause analysis and remediation suggestions.
- Interactive AI diagnostic assistant widget in the incident detail view.

### 2.2.6 Dashboard & Visualization
- Dark-mode responsive Next.js frontend.
- Interactive metrics charts powered by Recharts (CPU, Memory, Disk, Network I/O).
- Incident matrix and alert notification feed.

---

## 2.3 Explicitly Out of Scope for MVP

- ❌ Kubernetes Cluster Operator (only Docker Engine and standalone VPS servers supported in MVP).
- ❌ Multi-region failover automation (alerts and AI diagnosis provided; manual remediation execution).
- ❌ Automated payment or SaaS subscription billing.
- ❌ Mobile native apps (responsive web only).
