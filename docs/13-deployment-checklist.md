# 13. Deployment Checklist

## 13.1 Pre-Deployment
- [ ] All environment variables set in `.env` (refer to `.env.example`).
- [ ] `.env` and secret keys are NOT committed to git repository.
- [ ] PostgreSQL and Qdrant containers running and volume persistence verified.
- [ ] `alembic upgrade head` executed successfully against production database.
- [ ] Docker Compose build passes cleanly without layer errors.

---

## 13.2 Deployment Targets
- **Frontend**: Deployed to Vercel.
- **Backend Service**: Deployed to Render as a Docker service.
- **Monitoring Stack & Agent**: Deployed to Linux VPS.

---

## 13.3 Environment Variables Checklist
- `DATABASE_URL`
- `JWT_SECRET`
- `JWT_EXPIRY_MINUTES`
- `PROMETHEUS_URL`
- `LOKI_URL`
- `AGENT_SHARED_SECRET`
- `MODEL_PATH`
- `ANOMALY_THRESHOLD`
- `CORRELATION_WINDOW_MINUTES`
- `GEMINI_API_KEY`
- `QDRANT_URL`
- `EMBEDDING_MODEL_NAME`
- `NEXT_PUBLIC_API_BASE_URL`

---

## 13.4 Verification
- [ ] `GET http://localhost:8000/` returns API running status.
- [ ] `GET http://localhost:8000/api/v1/health` returns `{"status": "healthy"}`.
- [ ] `GET http://localhost:8000/docs` displays FastAPI Swagger documentation.
- [ ] Qdrant is accessible on port `6333`.
- [ ] PostgreSQL accepts connections on `5432`.
