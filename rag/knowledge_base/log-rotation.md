# Managing Container Log Rotation and Storage Bloat

## Symptoms
The host root filesystem gradually fills up over days or weeks of uptime, with directory `/var/lib/docker/containers/` consuming gigabytes of disk space. Disk saturation alerts fire repeatedly even though database and user media directories remain normal. Docker daemon responsiveness degrades, and reading or tailing container logs (`docker logs`) takes excessively long or causes high I/O wait times.

## Likely causes
- Default Docker daemon configuration: Docker's standard `json-file` logging driver retains container stdout and stderr indefinitely with unlimited file size unless explicit rotation bounds are configured.
- Verbose debug logging left enabled in production containers, generating thousands of lines of output per second.
- Misconfigured Linux `logrotate` rules failing to match rotated file extensions or lacking `copytruncate` directives for processes holding open file handles.
- High error frequency causing log loops where every error triggers a verbose stack trace that compounds disk exhaustion.
- Absence of centralized log aggregation (e.g., Loki or Alloy) leading teams to rely entirely on local container disk persistence.

## How to check
1. Measure the size of container log files directly on the host:
   `sudo du -sh /var/lib/docker/containers/*/*-json.log | sort -rh | head -n 10`
2. Inspect logging driver configuration for a running container:
   `docker inspect <container_name> --format '{{json .HostConfig.LogConfig}}'`
3. Verify global Docker daemon settings in `/etc/docker/daemon.json`.
4. Test logrotate configuration syntax and execute a dry run:
   `logrotate -d /etc/logrotate.conf`

## How to fix
1. Truncate oversized active log files without stopping containers:
   `sudo truncate -s 0 /var/lib/docker/containers/<container_id>/<container_id>-json.log`
2. Enforce global log limits in `/etc/docker/daemon.json`:
   ```json
   {
     "log-driver": "json-file",
     "log-opts": {
       "max-size": "20m",
       "max-file": "5"
     }
   }
   ```
   Then reload Docker: `sudo systemctl restart docker`.
3. Configure logging limits per service directly in `docker-compose.yml`:
   ```yaml
   logging:
     driver: "json-file"
     options:
       max-size: "10m"
       max-file: "3"
   ```
4. Ship logs to a centralized storage engine (such as Grafana Loki via Grafana Alloy) and truncate local retention.

## Sources
- Docker Documentation: Configure Logging Drivers and json-file Options
- Linux Manual Pages: logrotate(8) Configuration and copytruncate Directives
- Grafana Labs Documentation: Loki and Alloy Log Shipping Architecture
