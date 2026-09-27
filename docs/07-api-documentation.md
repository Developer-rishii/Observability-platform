# API Documentation

## Overview
This document outlines the REST API for the Observability Platform. The API is built with FastAPI and exposed under `/api/v1`.

All non-auth routes are currently marked as `[PLACEHOLDER]` until fully implemented.

## Routes

### `auth` (`/api/v1/auth`)
- **POST `/login`**: Authenticate a user and return a JWT.
- **POST `/register`**: Register a new developer/admin user.
- **GET `/me`**: Get current user details.

### `servers` (`/api/v1/servers`) [PLACEHOLDER]
- **GET `/`**: List all active servers.
- **GET `/{id}`**: Get server details.
- **POST `/`**: Register a new server.

### `events` (`/api/v1/events`) [PLACEHOLDER]
- **GET `/`**: Retrieve events (with filters).
- **POST `/`**: Ingest a new event from an agent (requires `AGENT_SHARED_SECRET`, includes `client_event_id` for idempotency).

### `metrics` (`/api/v1/metrics`) [PLACEHOLDER]
- **GET `/`**: Proxy/Retrieve metrics from Prometheus.

### `logs` (`/api/v1/logs`) [PLACEHOLDER]
- **GET `/`**: Proxy/Retrieve logs from Loki.

### `incidents` (`/api/v1/incidents`) [PLACEHOLDER]
- **GET `/`**: List incidents.
- **GET `/{id}`**: Get incident details.
- **PATCH `/{id}`**: Update incident status.

### `alerts` (`/api/v1/alerts`) [PLACEHOLDER]
- **GET `/`**: List current firing alerts.
- **POST `/`**: Webhook endpoint for Prometheus alerts.

### `ai` (`/api/v1/ai`) [PLACEHOLDER]
- **POST `/analyze`**: Trigger Gemini RCA for a specific incident.

### `rag` (`/api/v1/rag`) [PLACEHOLDER]
- **POST `/ingest`**: Ingest new knowledge documents into Qdrant.
- **POST `/query`**: Retrieve relevant documents for an incident context.
