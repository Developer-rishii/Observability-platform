# Observability Platform — Documentation Index

Welcome to the official documentation for the **Observability Platform** MVP.

## How to Navigate

| # | File | What It Covers |
|---|---|---|
| 1 | [ARCHITECTURE.md](./ARCHITECTURE.md) | High-level system architecture, core modules, and data flow |
| 2 | [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md) | Color palette, typography, design principles, and UI components |
| 3 | [BRANCHING_STRATEGY.md](./BRANCHING_STRATEGY.md) | Git workflow, branch naming conventions, and commit guidelines |
| 4 | [01-product-overview.md](./01-product-overview.md) | Vision, problem statement, personas, and system capabilities |
| 5 | [02-mvp-scope.md](./02-mvp-scope.md) | System components, monitoring capabilities, out-of-scope items |
| 6 | [03-user-flows.md](./03-user-flows.md) | Ingestion flows, anomaly correlation pipeline, and incident management |
| 7 | [04-pages-public-developer.md](./04-pages-public-developer.md) | Dashboard, metrics visualization, server status, and incident views |
| 8 | [05-pages-admin.md](./05-pages-admin.md) | System configurations, user management, and AI runbook settings |
| 9 | [06-database-design.md](./06-database-design.md) | Database tables (users, servers, events, incidents, alerts, etc.) |
| 10 | [07-api-documentation.md](./07-api-documentation.md) | FastAPI v1 endpoints (auth, metrics, logs, incidents, AI, RAG) |
| 11 | [08-ui-design-guidelines.md](./08-ui-design-guidelines.md) | Aesthetics, dark mode palette, dynamic charts, micro-interactions |
| 12 | [09-security-requirements.md](./09-security-requirements.md) | JWT security, agent secret authentication, RBAC, and data privacy |
| 13 | [10-edge-cases.md](./10-edge-cases.md) | Agent disconnection, metric spikes, log floods, and LLM rate limits |
| 14 | [11-development-roadmap.md](./11-development-roadmap.md) | Milestone phases with technical task checklists |
| 15 | [12-testing-checklist.md](./12-testing-checklist.md) | Unit tests, API endpoint tests, and integration test coverage |
| 16 | [13-deployment-checklist.md](./13-deployment-checklist.md) | Docker Compose setup, Render, Vercel, and Linux VPS infrastructure |
| 17 | [14-final-notes.md](./14-final-notes.md) | Architecture decisions, ownership boundaries, and operational guides |
| 18 | [15-sprint-plan.md](./15-sprint-plan.md) | Sprint plan for feature delivery |
| 19 | [16-developer-workflow.md](./16-developer-workflow.md) | Git conventions, pull requests, and CI/CD workflow |

---

## Quick Summary

**Observability Platform** is an **AI-powered cloud observability platform** providing real-time infrastructure monitoring, log aggregation, anomaly correlation, and AI-driven root cause analysis.

- **Agent & Ingestion**: Custom agent collecting container & node metrics + Docker Engine event streams.
- **ML Anomaly Detection**: Isolation Forest and rolling z-scores for anomaly scoring.
- **RAG & AI Diagnostics**: Qdrant vector store with embeddings + Google Gemini API for automated remediation suggestions.

**Tech Stack:**
- **Frontend**: Next.js (App Router) + TypeScript + Tailwind CSS + Recharts
- **Backend**: Python 3.11 + FastAPI + SQLAlchemy + Alembic
- **Databases**: PostgreSQL (Relational) + Qdrant (Vector DB)
- **Monitoring Stack**: Prometheus + Node Exporter + cAdvisor + Grafana Alloy + Loki
- **AI/ML**: Scikit-learn + Sentence Transformers + Google Gemini API
- **Infrastructure**: Docker + Docker Compose + Linux VPS + GitHub Actions
