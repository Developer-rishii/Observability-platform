# Development Roadmap

## Overview
This roadmap outlines the phases of development for the Observability Platform. Strict adherence to this order ensures layers are built on solid, existing foundations.

## Phases

1. **Phase 1: Foundation & Auth**
   - Setup project structure, Postgres, Qdrant, Docker Compose.
   - Implement JWT Authentication and user roles.

2. **Phase 2: Servers, Agents, & Events (Ingestion)**
   - Implement Server registration and agent shared-secret auth.
   - Build `/events` ingestion endpoint with idempotency.
   - Build frontend views for Servers and Events.

3. **Phase 3: Metrics & Logs Proxies**
   - Connect backend to Prometheus and Loki.
   - Build proxy endpoints for querying metrics and logs.

4. **Phase 4: ML Anomaly Detector**
   - Train and save the baseline ML model (`isolation_forest.pkl`).
   - Implement background worker for scoring events against the model.

5. **Phase 5: Incident Correlation Engine**
   - Build the logic to group anomalies and alerts into `Incidents` using a time window.
   - Build Incident API and frontend incident lists/details.

6. **Phase 6: RAG & Gemini RCA**
   - Implement Qdrant document ingestion and semantic search.
   - Build Gemini integration that consumes incident contexts and RAG results to generate Root Cause Analyses.

7. **Phase 7: Frontend Wiring & Polish**
   - Finalize the dashboard, AI RCA panel, and settings screens.
   - End-to-end UX testing.

8. **Phase 8: Testing & Deployment**
   - Integration tests across the full stack.
   - Prepare for production deployment.
