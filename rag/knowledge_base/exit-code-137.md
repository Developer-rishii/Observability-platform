# Troubleshooting Docker Container Exit Code 137

## Symptoms
A container halts abruptly with exit status 137. No graceful termination signals are trapped by application logs, database connections terminate unceremoniously without connection pool drain, and Prometheus metrics stop publishing abruptly. In Docker status output, `docker ps -a` displays `Exited (137) X seconds ago`.

## Likely causes
- Exit code 137 indicates that the process received Unix signal 9 (`SIGKILL`), computed as standard exit code base 128 + 9 = 137.
- Out-Of-Memory (OOM) killer invoked by the Linux kernel: when the container exceeds its configured `mem_limit`, the kernel's cgroup memory controller forcefully sends `SIGKILL` without allowing application interception.
- Manual termination by an operator or script issuing `docker kill <container_name>`.
- Graceful shutdown timeout expiry: when `docker stop` is called, Docker first sends `SIGTERM` and waits for a grace period (default 10 seconds). If the application fails to exit within that window, Docker issues a forced `SIGKILL`.
- Host system running out of global RAM, leading the kernel OOM killer to terminate the largest memory-consuming processes.

## How to check
1. Verify whether the termination was caused by OOM or an external signal:
   `docker inspect <container_name> --format 'ExitCode={{.State.ExitCode}}, OOMKilled={{.State.OOMKilled}}'`
   - If `OOMKilled: true`, the container ran out of memory.
   - If `OOMKilled: false`, the process received an external `SIGKILL` (e.g. `docker kill` or timeout).
2. Check host kernel events for cgroup kills:
   `sudo dmesg -T | grep -E -i "killed process|oom_reaper"`
3. Check Docker daemon logs:
   `journalctl -u docker.service --since "10 minutes ago"`
4. Review system audit events for manual process termination signals.

## How to fix
1. If caused by OOM (`OOMKilled: true`), raise container memory limits in `docker-compose.yml` or optimize application heap usage.
2. If caused by stop timeouts, ensure the application registers signal handlers for `SIGTERM` and initiates an orderly shutdown of active workers before the 10-second timeout.
3. Configure `stop_grace_period` in `docker-compose.yml` if graceful cleanup naturally requires more than 10 seconds:
   ```yaml
   stop_grace_period: 30s
   ```
4. If testing fault injection scenarios (e.g., `docker kill`), verify automated restart policies (`restart: unless-stopped`) revive the container as expected.

## Sources
- POSIX Signal Documentation: Understanding Signals (SIGKILL 9 vs SIGTERM 15)
- Docker Documentation: Command-Line Reference for docker stop and docker kill
- Linux Foundation: Understanding Container Exit Codes
