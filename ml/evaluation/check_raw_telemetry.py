import urllib.request
import urllib.parse
import json
import time
import psycopg2
import datetime

now = int(time.time())
start = now - 3600

# 1. Prometheus 5xx requests
q_5xx = 'sum(rate(http_requests_total{job="demo-app", status=~"5.."}[1m]))'
url_5xx = f'http://localhost:9090/api/v1/query_range?query={urllib.parse.quote(q_5xx)}&start={start}&end={now}&step=60s'
res_5xx = json.loads(urllib.request.urlopen(url_5xx).read())
vals_5xx = [float(v[1]) for v in res_5xx['data']['result'][0]['values']] if res_5xx['data']['result'] else []
print('Prometheus 5xx rate (last 1h, 60s step):')
print(f'  Count: {len(vals_5xx)}, Non-zero count: {sum(1 for v in vals_5xx if v > 0)}, Max: {max(vals_5xx) if vals_5xx else 0}')

# 2. Prometheus data_dir_bytes
q_disk = 'demo_data_dir_bytes{job="demo-app"}'
url_disk = f'http://localhost:9090/api/v1/query_range?query={urllib.parse.quote(q_disk)}&start={start}&end={now}&step=60s'
res_disk = json.loads(urllib.request.urlopen(url_disk).read())
vals_disk = [float(v[1]) for v in res_disk['data']['result'][0]['values']] if res_disk['data']['result'] else []
print('\nPrometheus demo_data_dir_bytes (last 1h, 60s step):')
print(f'  Count: {len(vals_disk)}, Non-zero count: {sum(1 for v in vals_disk if v > 0)}, Max: {max(vals_disk) if vals_disk else 0}')

# 3. PostgreSQL events table for container.die / container.oom
conn = psycopg2.connect('postgresql://user:password@localhost:5433/observability')
with conn.cursor() as cur:
    cutoff = datetime.datetime.utcnow() - datetime.timedelta(hours=1)
    cur.execute("""
        SELECT event_type, COUNT(*) 
        FROM events 
        WHERE timestamp >= %s AND event_type IN ('container.die', 'container.oom')
        GROUP BY event_type
    """, (cutoff,))
    rows = cur.fetchall()
    print('\nPostgreSQL container.die/container.oom counts (last 1h):')
    print(' ', rows if rows else 'None found')
