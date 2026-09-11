# 14. Final Notes & Architectural Decisions

## Key Architectural Principles
1. **Modular Monolith Backend**: FastAPI application structured into domain packages (`api/`, `core/`, `models/`, `schemas/`, `services/`). Avoid unnecessary microservice fragmentation.
2. **Dedicated Logic Folders**: Reusable ML logic resides in `ml/`, vector RAG routines in `rag/`, agent logic in `agent/`, and infrastructure configs in `infrastructure/`.
3. **Pydantic Schemas for Strict API Contracts**: All request/response validation relies on explicit Pydantic models.
4. **Primary Source of Truth**: The project architecture and technology stack follow the Observability Platform development plan.
