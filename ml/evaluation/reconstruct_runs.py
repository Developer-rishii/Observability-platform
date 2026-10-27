import psycopg2
import json

conn = psycopg2.connect('postgresql://user:password@localhost:5433/observability')
with conn.cursor() as cur:
    cur.execute('SELECT id, metric_name, detected_at, threshold, metric_value, severity, detection_source FROM incidents ORDER BY id ASC')
    incs = cur.fetchall()
    print('INCIDENTS:')
    for inc in incs:
        print(' ', inc)
    cur.execute("""
        SELECT timestamp, event_type, payload 
        FROM events 
        WHERE event_type IN ('container.die', 'container.restart', 'container.start', 'container.kill') 
        ORDER BY timestamp ASC
    """)
    evs = cur.fetchall()
    print(f'\nLIFECYCLE EVENTS COUNT: {len(evs)}')
    for e in evs:
        container = (e[2] or {}).get("container_name") or (e[2] or {}).get("name") or e[2]
        print(' ', e[0], e[1], container)
