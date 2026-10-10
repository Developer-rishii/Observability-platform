# Database Design

## Overview
This document outlines the database schema for the Observability Platform, built on PostgreSQL using SQLAlchemy 2 and managed by Alembic.

**Current migration head:** `0002_phase1_model_reconciliation`

---

## Tables

### `users`
| Column | Type | Notes |
|---|---|---|
| `id` | Integer PK | |
| `email` | String(255) unique | |
| `hashed_password` | String(255) | bcrypt |
| `full_name` | String(255) nullable | |
| `is_active` | Boolean | default true |
| `is_admin` | Boolean | default false |
| `created_at` | DateTime | |

---

### `servers`
| Column | Type | Notes |
|---|---|---|
| `id` | Integer PK | |
| `hostname` | String(255) unique | |
| `ip_address` | String(45) | |
| `os_info` | String(255) nullable | |
| `status` | String(50) | active \| degraded \| offline |
| `created_at` | DateTime | |

Relationships: one-to-many with `services`, `events`, `incidents`.

---

### `services`
| Column | Type | Notes |
|---|---|---|
| `id` | Integer PK | |
| `server_id` | Integer FK → `servers.id` | |
| `name` | String(255) | |
| `service_type` | String(100) nullable | |
| `status` | String(50) | default running |
| `created_at` | DateTime | |

---

### `events`
| Column | Type | Notes |
|---|---|---|
| `id` | Integer PK | |
| `client_event_id` | String(64) unique nullable | agent-side idempotency key |
| `server_id` | Integer FK → `servers.id` nullable | |
| `event_type` | String(100) | |
| `source` | String(100) | |
| `severity` | String(50) | default info |
| `payload` | JSON nullable | |
| `timestamp` | DateTime | |

---

### `incidents`
Single source of truth in `backend/app/models/incident.py`.

| Column | Type | Notes |
|---|---|---|
| `id` | Integer PK | |
| `title` | String(255) | default "Untitled Incident" |
| `description` | Text nullable | |
| `severity` | String(50) | **critical \| high \| medium \| low \| info** |
| `status` | String(50) | **candidate \| open \| investigating \| resolved** |
| `server_id` | Integer FK → `servers.id` nullable | |
| `affected_service` | String(255) nullable | |
| `metric_name` | String(255) | triggering metric |
| `metric_value` | Float | value at detection time |
| `threshold` | Float | configured threshold |
| `anomaly_score` | Float nullable | |
| `detected_at` | DateTime | renamed from `triggered_at` (migration 0002) |
| `resolved_at` | DateTime nullable | stamped when status → resolved |
| `window_start` | DateTime nullable | evidence window start |
| `window_end` | DateTime nullable | evidence window end |
| `affected_metrics` | JSON | list of metric name strings; default [] |

Relationships: one-to-many with `alerts`, `ai_analyses`.

---

### `alerts`
Linked to an `Incident`. Defined in `backend/app/models/incident.py`.

| Column | Type | Notes |
|---|---|---|
| `id` | Integer PK | |
| `incident_id` | Integer FK → `incidents.id` | |
| `rule_name` | String(255) | e.g. "cpu_threshold" |
| `metric_name` | String(255) | |
| `threshold` | Float | |
| `value` | Float nullable | observed value at trigger |
| `status` | String(50) | **firing \| acknowledged \| resolved** |
| `triggered_at` | DateTime nullable | |
| `message` | Text nullable | legacy field |
| `created_at` | DateTime | |

---

### `incident_events`
Join table linking `incidents` to raw `events`.

| Column | Type |
|---|---|
| `id` | Integer PK |
| `incident_id` | FK → `incidents.id` |
| `event_id` | FK → `events.id` |

---

### `incident_logs`
| Column | Type |
|---|---|
| `id` | Integer PK |
| `incident_id` | FK → `incidents.id` |
| `log_line` | Text |
| `timestamp` | DateTime |

> **Note:** Loki integration is **DEFERRED**. This table is a placeholder.

---

### `ai_analyses`
Defined in `backend/app/models/models.py`.

| Column | Type | Notes |
|---|---|---|
| `id` | Integer PK | |
| `incident_id` | Integer FK → `incidents.id` nullable | |
| `model_used` | String(255) nullable | e.g. "gemini-1.5-pro" |
| `response_json` | JSON nullable | validated RcaResult structure |
| `confidence` | String(50) | **low \| medium \| high** |
| `status` | String(50) | **success \| unavailable** |
| `created_at` | DateTime | |
| `prompt` | Text nullable | legacy field |
| `response` | Text nullable | legacy field |

---

### `knowledge_documents`
| Column | Type | Notes |
|---|---|---|
| `id` | Integer PK | |
| `title` | String(255) | |
| `content` | Text | |
| `vector_id` | String(255) nullable | Qdrant point ID |
| `created_at` | DateTime | |

> **Note:** RAG / Qdrant ingestion is **DEFERRED**.

---

### `system_configurations`
| Column | Type |
|---|---|
| `id` | Integer PK |
| `key` | String(255) unique |
| `value` | Text |
| `updated_at` | DateTime |

---

## Relationships Summary
- **Servers** → many **Services**, many **Events**, many **Incidents** (via `server_id`)
- **Incidents** → many **Alerts**, many **AIAnalyses**, many **Events** (via `incident_events`)
- **Incidents** → many **IncidentLogs**

## Migration History
| Revision | Description |
|---|---|
| `0001_initial_schema` | Initial tables: users, servers, services, events, incidents, alerts, ai_analyses, knowledge_documents, system_configurations |
| `41cfb96dbef2` | Add `client_event_id` to events |
| `407e38f80230` | Reshape incidents and alerts to match detection schema |
| `0002_phase1_model_reconciliation` | **Phase 1**: rename `triggered_at` → `detected_at`; add title, description, server_id, affected_service, anomaly_score, window_start, window_end, affected_metrics to incidents; restore and extend alerts; extend ai_analyses |
