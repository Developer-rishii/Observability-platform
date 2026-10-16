# Diagnosing Container CrashLoopBackOff and Restart Cycles

## Symptoms
A container continuously terminates within seconds of starting and restarts repeatedly in a rapid cycle. `docker ps` reports container uptime resetting every few seconds with incrementing restart counts (e.g., `Restarting (1) 2 seconds ago`). In Kubernetes or orchestrators, the pod enters `CrashLoopBackOff` status. External clients encounter HTTP 502 Bad Gateway or connection refused errors.

## Likely causes
- Application startup failures caused by unhandled exceptions (such as missing required environment variables, syntax errors, or unresolved dependency imports).
- Immediate termination of the entrypoint process because the main foreground task exited or executed in daemon mode without keeping PID 1 alive.
- Failure to establish a connection with mandatory downstream dependencies (e.g., database, message broker, vector store) during startup initialization.
- File system permission errors preventing reading configuration files or binding to privileged network ports (e.g., ports under 1024 without root permissions).
- Container health check failures continually failing consecutive probe intervals.

## How to check
1. Inspect the last standard error logs before the process terminated:
   `docker logs --tail 100 <container_name>`
2. Inspect exit code and termination reason:
   `docker inspect <container_name> --format 'Status={{.State.Status}} ExitCode={{.State.ExitCode}} Error={{.State.Error}}'`
3. Run the container interactively with an override entrypoint to inspect the file environment manually:
   `docker run -it --entrypoint /bin/sh <image_name>`
4. Check whether dependent containers (such as database or cache) are healthy and reachable on the shared Docker network:
   `docker compose ps`

## How to fix
1. Fix runtime exceptions identified in startup logs (e.g., add missing environment keys in `.env` or fix corrupted configuration parameters).
2. Ensure the main foreground command in Dockerfile does not detach (use foreground flags like `CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0"]` instead of background backgrounding).
3. Implement resilient startup retry logic with exponential backoff for database and dependency connections instead of crashing immediately on first connection attempt.
4. Correct container file ownership using `chown` and verify port bindings.
5. In Compose, configure explicit `depends_on` conditions ensuring upstream dependencies are healthy:
   ```yaml
   depends_on:
     db:
       condition: service_healthy
   ```

## Sources
- Docker Documentation: Container Lifecycle and Entrypoint Execution
- Kubernetes Documentation: Pod Lifecycle and Troubleshooting CrashLoopBackOff
- Python Logging and Exception Handling Best Practices
