import os
import sys
import time
import random
import json
import logging
from datetime import datetime, timezone
import httpx
import numpy as np

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger("load-schedule")

TARGET_URL = os.getenv("TARGET_URL", "http://localhost:8081").rstrip("/")
SCHEDULE_LOG_FILE = os.path.join(os.path.dirname(__file__), "load_schedule.json")

def choose_request():
    """Exact distribution from infrastructure/traffic-generator/app.py:
    - 60% GET /api/products
    - 25% GET /api/orders
    - 10% POST /api/orders (random product and quantity)
    - 5%  GET /health
    """
    roll = random.random()
    if roll < 0.60:
        return "GET", "/api/products", None
    elif roll < 0.85:
        return "GET", "/api/orders", None
    elif roll < 0.95:
        payload = {
            "product_id": random.randint(1, 50),
            "quantity": random.randint(1, 5),
        }
        return "POST", "/api/orders", payload
    else:
        return "GET", "/health", None


def run_load_block(client: httpx.Client, label: str, target_rate: float, duration_seconds: float) -> dict:
    interval = 1.0 / target_rate
    start_utc = datetime.now(timezone.utc).isoformat()
    start_time = time.monotonic()
    next_time = start_time

    sent = 0
    errors = 0
    latencies = []

    logger.info(f"--- Starting Block: '{label}' | Target Rate: {target_rate} req/s | Duration: {duration_seconds}s ---")

    while (time.monotonic() - start_time) < duration_seconds:
        now = time.monotonic()
        if now < next_time:
            time.sleep(max(0.0, next_time - now))
        next_time += interval

        method, path, payload = choose_request()
        url = f"{TARGET_URL}{path}"
        req_start = time.monotonic()
        try:
            if method == "GET":
                resp = client.get(url)
            elif method == "POST":
                resp = client.post(url, json=payload)
            else:
                resp = client.request(method, url)

            lat = time.monotonic() - req_start
            latencies.append(lat)
            sent += 1
            if resp.is_error and resp.status_code != 422:
                errors += 1
        except Exception as e:
            sent += 1
            errors += 1
            lat = time.monotonic() - req_start
            latencies.append(lat)

    end_utc = datetime.now(timezone.utc).isoformat()
    actual_duration = time.monotonic() - start_time
    achieved_rate = sent / actual_duration if actual_duration > 0 else 0.0
    p50_ms = float(np.percentile(latencies, 50) * 1000) if latencies else 0.0
    p95_ms = float(np.percentile(latencies, 95) * 1000) if latencies else 0.0

    logger.info(
        f"Completed '{label}': Achieved={achieved_rate:.2f} req/s, Sent={sent}, "
        f"Errors={errors}, P50={p50_ms:.1f}ms, P95={p95_ms:.1f}ms"
    )

    return {
        "label": label,
        "target_rate_rps": target_rate,
        "achieved_rate_rps": round(achieved_rate, 2),
        "duration_seconds": round(actual_duration, 1),
        "start_utc": start_utc,
        "end_utc": end_utc,
        "total_sent": sent,
        "errors": errors,
        "p50_latency_ms": round(p50_ms, 2),
        "p95_latency_ms": round(p95_ms, 2),
    }


def main():
    # Schedule definition:
    # 5 min warm-up at 5 req/s (300s)
    # Then 3 iterations of:
    #   Light:  2 req/s (240s = 4 min)
    #   Medium: 5 req/s (240s = 4 min)
    #   Busy:   8 req/s (240s = 4 min)
    blocks = [
        {"label": "warmup_medium", "rate": 5.0, "duration": 300},
    ]

    for cycle in range(1, 4):
        blocks.extend([
            {"label": f"cycle_{cycle}_light", "rate": 2.0, "duration": 240},
            {"label": f"cycle_{cycle}_medium", "rate": 5.0, "duration": 240},
            {"label": f"cycle_{cycle}_busy", "rate": 8.0, "duration": 240},
        ])

    results = []
    logger.info(f"Connecting to demo app at {TARGET_URL} across {len(blocks)} schedule blocks...")

    with httpx.Client(timeout=3.0) as client:
        for b in blocks:
            record = run_load_block(
                client=client,
                label=b["label"],
                target_rate=b["rate"],
                duration_seconds=b["duration"],
            )
            results.append(record)

            # Persist progress after every block to load_schedule.json
            with open(SCHEDULE_LOG_FILE, "w", encoding="utf-8") as f:
                json.dump(results, f, indent=2)

    logger.info("All scheduled blocks completed successfully.")


if __name__ == "__main__":
    main()
