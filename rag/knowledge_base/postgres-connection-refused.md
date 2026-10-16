# Resolving PostgreSQL Connection Refused Errors

## Symptoms
Application logs are flooded with database connectivity exceptions, including `psycopg2.OperationalError: could not connect to server: Connection refused`, `asyncpg.exceptions.CannotConnectNowError`, or `Is the server running on host "db" and accepting TCP/IP connections on port 5432?`. API endpoints relying on database reads or writes immediately return HTTP 500 Internal Server Error, and application health check probes fail.

## Likely causes
- The PostgreSQL database container or daemon is completely stopped, paused, or currently restarting.
- Network disconnection or isolation: application and database containers reside on different Docker networks and cannot resolve or reach each other.
- Misconfigured connection string host or port (e.g., using `localhost:5432` inside a container instead of the Docker service name `db` or `demo-db`).
- PostgreSQL configuration directive `listen_addresses` in `postgresql.conf` is not set to `*`, refusing non-local interface requests.
- Host firewall rules or Docker port mapping conflicts preventing TCP packet transmission on port 5432.

## How to check
1. Verify the PostgreSQL container status:
   `docker ps -a --filter "name=db"`
2. Check container connectivity using `pg_isready`:
   `docker exec -it <db_container> pg_isready -h localhost -p 5432`
3. Test network routing from the application container to the database container:
   `docker exec -it <app_container> nc -zv db 5432`
   or
   `docker exec -it <app_container> python -c "import socket; s = socket.socket(); s.connect(('db', 5432)); print('Connected')"`
4. Review PostgreSQL container error logs:
   `docker logs --tail 100 <db_container>`

## How to fix
1. If the database container is stopped, start it:
   `docker start <db_container>` or `docker compose up -d db`
2. Ensure both containers share the same Compose network:
   ```yaml
   services:
     backend:
       networks:
         - default
     db:
       networks:
         - default
   ```
3. Verify environment variable connection URLs use the container DNS name (e.g., `postgresql://user:pass@db:5432/dbname` rather than `localhost`).
4. Ensure `postgresql.conf` contains `listen_addresses = '*'` and `pg_hba.conf` permits host connections from the container network subnet (`0.0.0.0/0 md5`).
5. In client code, wrap queries with connection retry backoff to survive transient database restarts.

## Sources
- PostgreSQL Official Documentation: Client Authentication and Server Configuration
- Docker Networking Guide: Container-to-Container DNS Resolution
- Psycopg2 Troubleshooting Guide: OperationalError Diagnostics
