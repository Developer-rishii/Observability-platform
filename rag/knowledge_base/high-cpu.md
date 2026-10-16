# Troubleshooting High CPU Usage in Containerized Services

## Symptoms
Sustained CPU utilization above 80% to 90% on host or container telemetry dashboards, elevated system load averages exceeding available virtual core counts, and noticeable degradation in HTTP response times across API endpoints. Thread pools experience exhaustion, incoming requests queue up, client timeouts multiply, and Prometheus alerting rules such as HighCPUUsage fire continuously.

## Likely causes
- Unoptimized computational algorithms, infinite recursion, or heavy mathematical operations running on web worker threads.
- Sudden surges in incoming traffic exceeding provisioned container capacity without adequate rate limiting.
- Synchronous or blocking computations executing directly inside an asynchronous event loop framework (such as FastAPI or Node.js).
- Heavy regular expression evaluation, unindexed search processing, or massive JSON serialization of unbounded payloads.
- Background batch jobs running concurrently during peak business hours.

## How to check
1. Query Prometheus using PromQL:
   `100 - (avg(rate(node_cpu_seconds_total{mode="idle"}[1m])) * 100)`
2. Run `docker stats` in the terminal to inspect real-time CPU percentages per container.
3. Access the container shell and run `top -b -n 1` or `pidstat 1 5` to isolate the specific offending PID and thread.
4. Capture stack traces using diagnostic profilers such as `py-spy top --pid <pid>` or `perf top`.
5. Check web server access logs to correlate CPU spikes with specific endpoint requests, request rates, or anomalous query parameters.

## How to fix
1. Restart the impacted container using `docker restart <container_name>` if a runaway thread is trapped in an infinite loop.
2. Configure CPU constraints in Compose files (`deploy.resources.limits.cpus`) to isolate resource consumption and prevent host starvation.
3. Offload intensive workloads from web handlers to background workers (e.g., Celery, RQ) using asynchronous message queues.
4. Implement distributed caching (e.g., Redis or Memcached) for expensive query responses.
5. Apply client rate limiting at the API gateway or reverse proxy to throttle sudden spikes.

## Sources
- Docker Documentation: Resource Constraints and CPU Allocation
- Prometheus Monitoring Guidelines: System and Container Metrics
- Linux Performance Analysis by Brendan Gregg
