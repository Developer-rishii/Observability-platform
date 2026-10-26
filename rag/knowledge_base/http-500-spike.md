# Investigating Sudden HTTP 500 Error Spikes

## Symptoms
The HTTP 5xx error rate surges dramatically across API endpoints, crossing defined alerting thresholds (e.g., > 1% to 5% of total requests). Dashboards indicate rising `http_requests_total{status=~"5.."}` metrics. End-users experience broken workflows, failed form submissions, and generic "Internal Server Error" messages. Frontend clients display error toasts or crash screens.

## Likely causes
- Unhandled application exceptions, such as `NullPointerException`, `KeyError`, `AttributeError`, or schema validation failures on malformed input data.
- Downstream database outages, connection refusal, query syntax errors, or schema drift following unmigrated database releases.
- Third-party service failures or timeouts returning errors that are not gracefully caught or translated by upstream handlers.
- Environment variable misconfigurations or missing required secrets (e.g., invalid API keys, missing cryptographic signing secrets).
- Resource exhaustion (e.g., full disk partitions preventing file writing or out-of-memory states causing thread abortions).

## How to check
1. Query Prometheus for the error rate percentage:
   ```promql
   sum(rate(http_requests_total{status=~"5.."}[1m])) / sum(rate(http_requests_total[1m])) * 100
   ```
2. Query centralized log aggregators (e.g. Loki or Elastic) filtering for `level="ERROR"` or `status >= 500`:
   `{service="demo-app"} |= "ERROR"`
3. Inspect container standard error output:
   `docker logs --tail 200 <container_name> | grep -A 5 -B 2 -E "Traceback|Error|Exception"`
4. Review recent deployments, container image tags, or Git commit history to determine if a recent deployment introduced the regression.
5. Verify database migration status:
   `docker compose exec backend alembic current`

## How to fix
1. If caused by a newly deployed bad release, immediately roll back to the previously stable container image or commit.
2. Add global exception middleware in web applications (e.g. FastAPI `@app.exception_handler(Exception)`) to trap unhandled errors, log complete tracebacks, and return meaningful JSON error responses.
3. Catch specific dependency exceptions (like database disconnection or network timeouts) and return appropriate status codes (e.g., HTTP 503 Service Unavailable) with retry headers rather than generic 500s.
4. Run missing database migrations (`alembic upgrade head`) if the error stems from non-existent columns or missing tables.
5. Implement automated regression tests and CI/CD smoke test gates to prevent deployment of broken endpoints.

## Sources
- Mozilla Developer Network (MDN): HTTP 500 Internal Server Error Reference
- FastAPI / Starlette Documentation: Handling Errors and Custom Exception Handlers
- Prometheus Documentation: Recording Rules and Error Rate Calculations
