# observability

## 1. Project Overview
Observability is a full-stack AI-powered cloud observability platform.

## 2. Architecture Overview
FastAPI backend, Next.js frontend, PostgreSQL, Qdrant, Prometheus, Loki.

## 3. Repository Structure
- `backend/`: FastAPI backend
- `frontend/`: Next.js frontend
- `agent/`: Monitoring agent
- `ml/`: Machine learning logic
- `rag/`: RAG retrieval
- `infrastructure/`: Docker & deployment config
- `docs/`: Project documentation
- `tests/`: Automated tests
- `.github/`: GitHub Actions workflows

## 4. Technology Stack
- Backend: Python 3.11, FastAPI, SQLAlchemy, PostgreSQL
- Frontend: Next.js, Tailwind CSS, TypeScript
- Monitoring: Prometheus, Loki, Grafana
- AI/ML: Scikit-learn, Qdrant, Gemini API

## 5. Prerequisites
- Docker & Docker Compose
- Node.js
- Python 3.11+

## 6. Environment Setup
Copy `.env.example` to `.env` and fill in your values.

## 7. Docker Setup
Run `docker compose up --build` to start the local stack.

## 8. Backend Setup
See `backend/README.md` (to be created).

## 9. Frontend Setup
See `frontend/README.md` (to be created).

## 10. Database Setup
Handled automatically by Docker and Alembic.

## 11. Development Commands
- `docker compose up --build`
- `alembic upgrade head`

## 12. Testing
Run tests using pytest in the backend directory.

## 13. Branching Strategy
- `production`
- `dev`
- `feature/*`

## 14. CI/CD
GitHub Actions configured for backend and frontend linting/testing, and Docker builds.

## 15. Deployment Overview
Vercel for frontend, Render for backend, Linux VPS for infrastructure.
