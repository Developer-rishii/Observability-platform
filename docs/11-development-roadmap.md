# Development Roadmap

## Overview
This roadmap outlines the phases of development for the Observability Platform. Strict adherence to the dependency order ensures layers are built on solid, existing foundations.

## Phases

> **Parallel start:** Phases 1–3 are the critical serial foundation. Pooja's frontend
> scaffolding and RAG knowledge-base curation (marked **[Pooja ‖]**) begin alongside
> Phase 1 — they do not wait for the backend tracks to finish.

### Phase 1: Foundation & Auth  *(all three tracks start here)*
- **[Rushikesh]** Setup project structure, Postgres, Qdrant, Docker Compose.
- **[Rushikesh]** Implement JWT Authentication and user roles.
- **[Pooja ‖]** Scaffold Next.js design system, shared component library, and
  page shells (Login, Overview, Metrics, Incidents, AI RCA panel) — no real data yet,
  mock props only.
- **[Pooja ‖]** Begin RAG knowledge-base curation: collect runbooks and post-mortems
  into `knowledge_documents`-ready markdown so they can be ingested once Qdrant is live.

### Phase 2: Servers, Agents, & Events  *(Rushikesh leads; Sayali ramps up)*
- **[Rushikesh]** Server registration and agent shared-secret auth.
- **[Rushikesh]** `/events` ingestion endpoint with idempotency (`client_event_id`).
- **[Sayali ‖]** Design and stub the ML feature-extraction schema (input/output
  contracts) so Phase 4 integration is unblocked as soon as events flow.
- **[Pooja ‖]** Wire Servers and Events screens to real API (replaces mock props).

### Phase 3: Metrics & Logs Proxies  *(Rushikesh; others continue parallel work)*
- **[Rushikesh]** Connect backend to Prometheus and Loki; build proxy endpoints.
- **[Sayali ‖]** Train the baseline Isolation Forest model against synthetic/captured
  event data; save `isolation_forest.pkl`.
- **[Pooja ‖]** Wire Metrics view to real proxy; begin Qdrant ingestion pipeline.

### Phase 4: ML Anomaly Detector
- **[Sayali]** Integrate trained model into a background scoring worker; hook into event pipeline.

### Phase 5: Incident Correlation Engine
- **[Sayali]** Group anomalies and alerts into `Incidents` using the correlation window.
- **[Sayali]** Incidents API and frontend incident lists/details.

### Phase 6: RAG & Gemini RCA
- **[Pooja]** Qdrant document ingestion and semantic search (pipeline built in Phase 3,
  now connected to live incident contexts).
- **[Pooja]** Gemini integration + prompt builder consuming `incident_context` JSON
  from Sayali's correlation engine.

### Phase 7: Frontend Wiring & Polish
- Finalize dashboard, AI RCA panel, and settings screens.
- End-to-end UX testing across all three tracks.

### Phase 8: Testing & Deployment
- Integration tests across the full stack.
- Prepare for production deployment.
