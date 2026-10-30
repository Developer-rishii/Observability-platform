#!/usr/bin/env python3
"""Offline telemetry baseline data extractor.

Pulls metrics from Prometheus query_range API (15s step) and container die/oom
events from PostgreSQL, evaluates 5-minute rolling windows using features.py,
and exports clean datasets to CSV.
"""
import sys
import os
import argparse
import datetime
import requests
import psycopg2
import pandas as pd
import numpy as np

# Import feature definitions directly from ml.features
from ml.features import FEATURE_NAMES, get_feature_queries, build_feature_vector


def query_prometheus_range(base_url: str, query: str, start: float, end: float, step: str = "15s") -> dict:
    """Queries Prometheus query_range endpoint."""
    url = f"{base_url.rstrip('/')}/api/v1/query_range"
    params = {"query": query, "start": start, "end": end, "step": step}
    resp = requests.get(url, params=params, timeout=30)
    resp.raise_for_status()
    data = resp.json()
    if data.get("status") != "success":
        raise RuntimeError(f"Prometheus query failed: {data}")
    return data["data"]


def get_series_values(data: dict) -> dict:
    """Extracts timestamp -> float mapping from Prometheus range result."""
    result = {}
    results = data.get("result", [])
    if not results:
        return result
    for t, val in results[0].get("values", []):
        try:
            result[int(t)] = float(val)
        except (ValueError, TypeError):
            continue
    return result


def fetch_container_die_count(pg_url: str, timestamp_utc: datetime.datetime, window_minutes: int = 15) -> float:
    """Queries count of container.die and container.oom events from the PostgreSQL events table."""
    conn = psycopg2.connect(pg_url)
    try:
        with conn.cursor() as cur:
            cutoff = timestamp_utc - datetime.timedelta(minutes=window_minutes)
            cur.execute(
                """
                SELECT COUNT(*) FROM events 
                WHERE timestamp >= %s AND timestamp <= %s 
                  AND event_type IN ('container.die', 'container.oom')
                """,
                (cutoff, timestamp_utc),
            )
            count = cur.fetchone()[0]
            return float(count or 0.0)
    finally:
        conn.close()


def collect_dataset(
    prom_url: str,
    pg_url: str,
    start_ts: float,
    end_ts: float,
    out_csv: str,
):
    """Gathers range telemetry, evaluates rolling 5m windows, and writes to CSV."""
    queries = get_feature_queries()

    start_dt = datetime.datetime.fromtimestamp(start_ts, tz=datetime.timezone.utc)
    end_dt = datetime.datetime.fromtimestamp(end_ts, tz=datetime.timezone.utc)
    print(f"Querying Prometheus range [{start_dt.isoformat()} to {end_dt.isoformat()}]...")
    cpu_data = get_series_values(query_prometheus_range(prom_url, queries["cpu"], start_ts, end_ts))
    lat_data = get_series_values(query_prometheus_range(prom_url, queries["latency_p95"], start_ts, end_ts))
    req_tot_data = get_series_values(query_prometheus_range(prom_url, queries["requests_total"], start_ts, end_ts))
    req_5xx_data = get_series_values(query_prometheus_range(prom_url, queries["requests_5xx"], start_ts, end_ts))
    data_dir_data = get_series_values(query_prometheus_range(prom_url, queries["data_dir_bytes"], start_ts, end_ts))

    all_ts = sorted(list(set(cpu_data.keys()) | set(lat_data.keys()) | set(req_tot_data.keys())))
    if not all_ts:
        print("No telemetry points found in the specified window.")
        return

    rows = []
    dropped_count = 0

    print(f"Computing rolling features across {len(all_ts)} timestamps...")
    for current_ts in all_ts:
        # 5-minute lookback window (300 seconds)
        window_start = current_ts - 300
        window_times = [t for t in all_ts if window_start <= t <= current_ts]

        cpu_series = [cpu_data.get(t) for t in window_times]
        lat_series = [lat_data.get(t) for t in window_times]
        req_tot_series = [req_tot_data.get(t) for t in window_times]
        req_5xx_series = [req_5xx_data.get(t, 0.0) for t in window_times]
        data_dir_series = [data_dir_data.get(t) for t in window_times]

        # Die / OOM count from Postgres
        curr_dt = datetime.datetime.utcfromtimestamp(current_ts)
        try:
            die_count = fetch_container_die_count(pg_url, curr_dt, window_minutes=15)
        except Exception as e:
            die_count = 0.0

        feat_vector = build_feature_vector(
            cpu_series=cpu_series,
            latency_series=lat_series,
            requests_5xx_series=req_5xx_series,
            requests_total_series=req_tot_series,
            data_dir_series=data_dir_series,
            container_die_count_15m=die_count,
        )

        if feat_vector is None:
            dropped_count += 1
            continue

        row_dict = {"timestamp": curr_dt.isoformat()}
        for name, val in zip(FEATURE_NAMES, feat_vector):
            row_dict[name] = val
        rows.append(row_dict)

    df = pd.DataFrame(rows)
    os.makedirs(os.path.dirname(os.path.abspath(out_csv)), exist_ok=True)
    df.to_csv(out_csv, index=False)
    print(f"Exported {len(df)} rows to {out_csv} (dropped incomplete rows: {dropped_count}).")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Baseline Telemetry Exporter")
    parser.add_argument("--prom-url", default="http://localhost:9090", help="Prometheus base URL")
    parser.add_argument("--pg-url", default="postgresql://user:password@localhost:5433/observability", help="Database connection URL")
    parser.add_argument("--start-ts", type=float, default=None, help="Explicit start timestamp")
    parser.add_argument("--end-ts", type=float, default=None, help="Explicit end timestamp")
    parser.add_argument("--start-offset-min", type=int, default=60, help="Minutes ago for start")
    parser.add_argument("--end-offset-min", type=int, default=0, help="Minutes ago for end")
    parser.add_argument("--out", required=True, help="Output CSV path")
    args = parser.parse_args()

    if args.start_ts is not None and args.end_ts is not None:
        start_ts = args.start_ts
        end_ts = args.end_ts
    else:
        now_ts = datetime.datetime.now(datetime.timezone.utc).timestamp()
        start_ts = now_ts - (args.start_offset_min * 60)
        end_ts = now_ts - (args.end_offset_min * 60)

    collect_dataset(args.prom_url, args.pg_url, start_ts, end_ts, args.out)
