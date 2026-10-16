# Diagnosing and Mitigating High API Latency

## Symptoms
API response time metrics spike sharply; 95th and 99th percentile (p95 / p99) request duration crosses operational thresholds (e.g., > 1000ms–3000ms). Web clients and frontend user interfaces experience visible loading delays, spinning indicators, or client-side timeout exceptions. Upstream reverse proxies (like Nginx) log increasing upstream response times, and Prometheus triggers latency breach alerts.

## Likely causes
- Slow, unindexed database queries performing sequential full-table scans or excessive nested joins on growing tables.
- Downstream microservice or external API dependency bottlenecks causing blocking waits.
- Deliberate fault injection or network traffic shaping (e.g., simulated latency delays in test harnesses).
- Connection pool exhaustion forcing HTTP request handlers to wait idle in queues for database or HTTP sockets.
- Thread starvation or synchronous I/O operations blocking the main asynchronous event loop.
- CPU throttling or memory pressure degrading garbage collection and process execution speed.

## How to check
1. Query Prometheus for p95 request duration histogram:
   ```promql
   histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket[1m])) by (le))
   ```
2. Inspect slow database queries in PostgreSQL using `pg_stat_statements`:
   ```sql
   SELECT query, calls, mean_exec_time, max_exec_time FROM pg_stat_statements ORDER BY mean_exec_time DESC LIMIT 10;
   ```
3. Check application structured logs for request elapsed duration fields (`duration_ms`).
4. Enable distributed tracing (e.g., OpenTelemetry or Jaeger) to isolate which internal span or downstream call contributes the most latency.
5. Review container resource utilization via `docker stats` to verify whether latency coincides with CPU or memory saturation.

## How to fix
1. Add missing database indexes on filter columns (`WHERE`, `ORDER BY`, `JOIN` keys) and run `EXPLAIN ANALYZE` on sluggish queries.
2. Introduce caching layers (Redis / Memcached) for frequently requested, slow-changing query results.
3. Configure aggressive, bounded timeouts on all downstream HTTP calls (e.g., `httpx.Client(timeout=3.0)`) and implement circuit breaker patterns.
4. Scale web application worker processes (e.g., Uvicorn `--workers 4` or Gunicorn worker pools) to handle concurrent requests without thread contention.
5. Convert synchronous blocking operations into non-blocking asynchronous calls (`async/await`) or background tasks.

## Sources
- Google Cloud Architecture Framework: Performance Efficiency and Latency Optimization
- OpenTelemetry Documentation: Distributed Tracing and Latency Breakdown
- PostgreSQL Documentation: Using EXPLAIN and Indexing Strategies
