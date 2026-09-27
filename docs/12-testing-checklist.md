# Testing Checklist

## Backend
- [ ] **Auth**: JWT generation, expiry, and bcrypt validation works.
- [ ] **Agent Event Ingestion**: Validates payload schema, correctly uses `AGENT_SHARED_SECRET`.
- [ ] **Event Idempotency**: Resending the same `client_event_id` does not create duplicate DB rows.
- [ ] **Metrics/Logs Proxy Auth**: Endpoints correctly authenticate requests before hitting Prometheus/Loki.
- [ ] **ML Detector Scheduling**: Background tasks run at the expected interval and handle missing models gracefully.
- [ ] **Correlation Window Logic**: Events within `CORRELATION_WINDOW_MINUTES` correctly group into a single incident.
- [ ] **RAG Retrieval Relevance**: Queries return semantically relevant documents from Qdrant.
- [ ] **Gemini RCA Schema Validation**: AI outputs strictly adhere to the expected incident context JSON schema.
- [ ] **CORS & Security**: Frontend origin is correctly allowed, all other origins are blocked.

## Frontend
- [ ] **Build**: `npm run build` succeeds with zero TypeScript errors.
- [ ] **Routing**: Protected routes redirect to login if unauthenticated.
- [ ] **Data Fetching**: Handles backend unavailability gracefully.
