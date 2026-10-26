# Troubleshooting Disk Full and Filesystem Saturation

## Symptoms
Disk utilization metrics on host or volume mounts cross critical thresholds (> 85% to 95%). Applications begin crashing with `IOError: [Errno 28] No space left on device` or `Database write error: disk full`. Database servers shut down or enter read-only safe mode. Docker containers cannot be created, started, or commit new image layers, and log forwarders stop shipping data.

## Likely causes
- Runaway application or access log files accumulating without log rotation or compression policies in place.
- Rapid temporary file generation or data dump scripts filling storage directories (e.g. simulated disk fill scripts populating `/data/fill`).
- Accumulation of orphaned Docker images, dangling volumes, stopped container layers, and build cache on the host filesystem.
- Database write-ahead logging (WAL) logs or unvacuumed dead row bloat consuming available tablespace storage.
- Inode exhaustion (running out of filesystem metadata inodes despite having free block storage).

## How to check
1. Check disk space across all mounted filesystems:
   `df -h`
2. Check inode utilization:
   `df -i`
3. Identify the largest directories and files consuming space:
   `du -ahx / | sort -rh | head -n 20`
4. Inspect Docker disk consumption:
   `docker system df`
5. Query Prometheus disk metrics:
   `100 - (node_filesystem_avail_bytes / node_filesystem_size_bytes * 100)`
   or custom application gauges such as `demo_data_dir_bytes`.

## How to fix
1. If caused by a transient test or fault file (e.g. `/data/fill`), immediately remove the filler files:
   `rm -rf /data/fill/*` or call the designated cleanup API endpoint (e.g., `POST /admin/fault/disk/clear`).
2. Clean up obsolete Docker resources:
   `docker system prune -af --volumes`
3. Configure Docker container log size limits in `daemon.json` or Compose:
   ```yaml
   logging:
     driver: "json-file"
     options:
       max-size: "10m"
       max-file: "3"
   ```
4. Set up automated log rotation using Linux `logrotate` for host log files under `/var/log`.
5. For databases, perform `VACUUM FULL` to reclaim space and enforce WAL archive retention limits.

## Sources
- Linux Filesystem Hierarchy Standard (FHS) and df/du Manual Pages
- Docker Documentation: Manage Docker Data and System Prune Reference
- PostgreSQL Documentation: Routine Maintenance and Disk Space Management
