# Resolving PostgreSQL FATAL: Too Many Connections

## Symptoms
Application clients fail to obtain new database connections, throwing `psycopg2.OperationalError: FATAL: remaining connection slots are reserved for non-replica superuser connections` or `FATAL: sorry, too many clients already`. New web requests stall waiting for an available connection from connection pools until request timeout thresholds expire, causing widespread HTTP 500 or 504 errors across the platform.

## Likely causes
- Application connection pool leaks where database connections are acquired but never closed or returned to the pool (frequently in unhandled error paths or missing context managers).
- The database `max_connections` parameter is configured too low for the aggregate pool sizes across all connected microservice instances.
- High traffic concurrency spawning excessive ephemeral threads or processes that each instantiate independent unpooled connections.
- Long-running or abandoned transactions holding connections in `idle in transaction` state, preventing them from being reused.
- Absence of a dedicated connection pooler (such as PgBouncer) in high-throughput environments.

## How to check
1. Query current active connection counts and state from PostgreSQL:
   ```sql
   SELECT count(*), state FROM pg_stat_activity GROUP BY state;
   ```
2. Identify which client hosts or applications consume the most connections:
   ```sql
   SELECT client_addr, usename, count(*) FROM pg_stat_activity GROUP BY client_addr, usename ORDER BY count DESC;
   ```
3. Inspect the configured connection limit:
   ```sql
   SHOW max_connections;
   ```
4. Check for orphaned `idle in transaction` queries:
   ```sql
   SELECT pid, now() - query_start AS duration, query FROM pg_stat_activity WHERE state = 'idle in transaction' ORDER BY duration DESC;
   ```

## How to fix
1. Terminate runaway idle connections immediately:
   ```sql
   SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE state = 'idle in transaction' AND now() - query_start > interval '5 minutes';
   ```
2. Always manage database sessions with context managers (`with Session() as session:`) or `finally` blocks to guarantee session closure.
3. Configure bounded connection pool limits in application ORM settings (e.g. SQLAlchemy `pool_size=10, max_overflow=5`).
4. Increase `max_connections` in `postgresql.conf` (e.g., `max_connections = 200`), ensuring adequate shared buffers and host memory.
5. Deploy PgBouncer as a lightweight connection pooler in front of PostgreSQL to handle thousands of client connections with transaction-level pooling.

## Sources
- PostgreSQL Documentation: Connections and Authentication - max_connections Setting
- SQLAlchemy 2.0 Documentation: Engine Configuration and Connection Pool Management
- PgBouncer Architectural Documentation: Connection Pooling Models
