# Edge Cases

## Overview
This document outlines known edge cases in the Observability Platform and how they are handled.

## Ingestion & Agents
- **Agent Disconnects**: Agents will buffer events locally if the API is unreachable, sending them in bulk once reconnected.
- **Duplicate Event Delivery**: Handled using the `client_event_id` field on the `Event` model. The ingestion API acts idempotently, ignoring duplicates.
- **Malformed Agent Payloads**: The FastAPI ingestion endpoints validate payload schemas strictly using Pydantic, dropping and logging malformed payloads.

## Infrastructure Dependencies
- **Prometheus/Loki/Qdrant Unavailable**: API gracefully degrading, returning appropriate error messages to the frontend instead of unhandled 500s.
- **Gemini API Unavailable**: RCA requests will queue or retry, showing a specific "AI Unavailable" state in the incident view.
- **Model Artifact Missing**: If the ML model artifact (`isolation_forest.pkl`) is missing on backend startup, anomaly detection is skipped (with a warning log) but core ingestion remains functional.
