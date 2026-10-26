# Diagnosing Memory Leaks and Out-Of-Memory (OOM) Killer Events

## Symptoms
Containers suddenly terminate or disappear without recording a clean application shutdown log. Memory utilization graphs display a steady "sawtooth" or continuous upward trajectory without stabilizing, followed by an abrupt vertical drop to zero. The Linux kernel prints OOM killer messages in host logs, and the container exits with code 137 or state `OOMKilled: true`.

## Likely causes
- Application memory leaks where allocated objects, global collections, or event listeners remain referenced and evade garbage collection.
- Loading excessively large database result sets or complete unpaginated datasets into application memory at once.
- In-memory buffering of large file uploads or payload streaming without fixed buffer size boundaries.
- String concatenation or large memory array cloning inside recursive loops.
- Inadequate container memory limits (`mem_limit`) configured lower than the baseline operational requirement of the runtime (e.g., JVM or Python memory overhead).

## How to check
1. Inspect container exit status via Docker CLI:
   `docker inspect <container_id> --format '{{json .State}}'`
   Look specifically for `"OOMKilled": true` and `"ExitCode": 137`.
2. Inspect kernel ring buffer logs on the host:
   `dmesg -T | grep -i -E "oom|out of memory|killed process"`
3. Query memory telemetry in Prometheus:
   `(node_memory_MemTotal_bytes - node_memory_MemAvailable_bytes) / node_memory_MemTotal_bytes * 100`
4. Use memory profiling tools (such as Python `tracemalloc` or `memray`) to isolate retained memory structures.

## How to fix
1. Enforce strict database query pagination using `LIMIT` and `OFFSET` or keyset pagination to avoid loading thousands of records into RAM.
2. Stream large payloads directly to disk or network sockets using chunked transfer encoding instead of buffering in memory.
3. Fix memory leaks by clearing caches with LRU eviction policies, unregistering stale event listeners, and scoping variables cleanly.
4. Adjust container resource configurations in `docker-compose.yml` with realistic limits:
   ```yaml
   deploy:
     resources:
       limits:
         memory: 1024M
   ```
5. Configure `restart: on-failure` or `restart: unless-stopped` to allow automated recovery during debugging.

## Sources
- Docker Documentation: Understand Out-of-Memory (OOM) Exceptions
- Linux Kernel Documentation: Memory Management and OOM-Killer Architecture
- Python Standard Library: tracemalloc Memory Tracking
