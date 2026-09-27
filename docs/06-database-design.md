# Database Design

## Overview
This document outlines the database schema for the Observability Platform, built on PostgreSQL using SQLAlchemy.

## Tables

### `users`
- `id`: Integer (PK)
- `email`: String (Unique, Index)
- `hashed_password`: String
- `full_name`: String
- `is_active`: Boolean
- `is_admin`: Boolean
- `created_at`: DateTime

### `servers`
- `id`: Integer (PK)
- `hostname`: String (Unique, Index)
- `ip_address`: String
- `os_info`: String
- `status`: String (active)
- `created_at`: DateTime
- **Relationships**: One-to-Many with `services` and `events`.

### `services`
- `id`: Integer (PK)
- `server_id`: Integer (FK -> `servers.id`)
- `name`: String
- `service_type`: String
- `status`: String (running)
- `created_at`: DateTime

### `events`
- `id`: Integer (PK)
- `client_event_id`: String (Unique, Index) - Agent-generated ID for deduplication.
- `server_id`: Integer (FK -> `servers.id`)
- `event_type`: String
- `source`: String
- `severity`: String (info)
- `payload`: JSON
- `timestamp`: DateTime

### `incidents`
- `id`: Integer (PK)
- `title`: String
- `description`: Text
- `severity`: String (medium)
- `status`: String (open, investigating, resolved)
- `created_at`: DateTime
- `resolved_at`: DateTime

### `incident_events`
- `id`: Integer (PK)
- `incident_id`: Integer (FK -> `incidents.id`)
- `event_id`: Integer (FK -> `events.id`)

### `incident_logs`
- `id`: Integer (PK)
- `incident_id`: Integer (FK -> `incidents.id`)
- `log_line`: Text
- `timestamp`: DateTime

### `alerts`
- `id`: Integer (PK)
- `rule_name`: String
- `metric_name`: String
- `threshold`: Float
- `status`: String (firing)
- `triggered_at`: DateTime

### `ai_analyses`
- `id`: Integer (PK)
- `incident_id`: Integer (FK -> `incidents.id`)
- `prompt`: Text
- `response`: Text
- `created_at`: DateTime

### `knowledge_documents`
- `id`: Integer (PK)
- `title`: String
- `content`: Text
- `vector_id`: String
- `created_at`: DateTime

### `system_configurations`
- `id`: Integer (PK)
- `key`: String (Unique, Index)
- `value`: Text
- `updated_at`: DateTime

## Relationships
- **Servers** have many **Services** and **Events**.
- **Incidents** link to multiple **Events** via the `incident_events` join table, and to multiple **IncidentLogs**.
- **Incidents** can also have associated **AIAnalyses**.
