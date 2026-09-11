# 4. Page Breakdown — User & SRE Dashboard

## 4.1 Dashboard Overview Page
Real-time monitoring hub showing active nodes, system status, active alerts, and incident summaries.

**Components / Features:**
- Health Summary Cards: Total Nodes, Active Containers, Open Incidents, Active Alerts.
- CPU & Memory Utilization Timeline Charts (powered by Recharts).
- Live Docker Event Stream ticker.
- Recent Incidents feed.

---

## 4.2 Server & Infrastructure Page
List and detail view for all monitored servers and node exporters.

**Components / Features:**
- Server table: Hostname, IP address, OS details, uptime, status (Active/Offline).
- Container list: Active containers, CPU/RAM usage per container, restart counts.
- Register New Node / Agent modal.

---

## 4.3 Log Explorer Page
Centralized log streaming viewer connected to Loki backend.

**Components / Features:**
- Search and query bar with service filtering (e.g. `service=web`, `level=error`).
- Real-time log stream tailing.
- Time range picker (Last 15m, 1h, 24h).
- Log severity distribution chart.

---

## 4.4 Incidents & Anomaly Correlation Page
Incident management workspace.

**Components / Features:**
- Incident list filterable by status (`open`, `investigating`, `resolved`) and severity (`critical`, `high`, `medium`).
- Incident Detail View:
  - Correlated event timeline & log bursts.
  - Anomaly score (Isolation Forest / z-score).
  - RAG Vector Runbook matches.
  - AI Diagnostics Assistant widget powered by Google Gemini API.
