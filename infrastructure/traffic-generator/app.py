import os
import sys
import time
import random
import signal
import logging
import httpx

# Configure logging to stdout
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger("traffic-generator")

TARGET_URL = os.getenv("TARGET_URL", "http://demo-app:8080").rstrip("/")
try:
    REQUESTS_PER_SECOND = float(os.getenv("REQUESTS_PER_SECOND", "5"))
    if REQUESTS_PER_SECOND <= 0:
        REQUESTS_PER_SECOND = 5.0
except ValueError:
    REQUESTS_PER_SECOND = 5.0

INTERVAL = 1.0 / REQUESTS_PER_SECOND

running = True


def handle_signal(signum, frame):
    global running
    logger.info("Received shutdown signal (%s). Exiting gracefully...", signum)
    running = False


signal.signal(signal.SIGINT, handle_signal)
signal.signal(signal.SIGTERM, handle_signal)


def choose_request():
    """
    Pick request based on distribution:
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


def main():
    logger.info("Starting Traffic Generator")
    logger.info("Target URL: %s", TARGET_URL)
    logger.info("Rate: %.1f requests/sec (interval: %.4fs)", REQUESTS_PER_SECOND, INTERVAL)

    total_sent = 0
    total_errors = 0
    window_sent = 0
    window_errors = 0

    last_summary_time = time.monotonic()

    # Reuse httpx client with 3-second timeout
    with httpx.Client(timeout=3.0) as client:
        while running:
            start_time = time.monotonic()
            method, path, payload = choose_request()
            url = f"{TARGET_URL}{path}"

            try:
                if method == "GET":
                    resp = client.get(url)
                elif method == "POST":
                    resp = client.post(url, json=payload)
                else:
                    resp = client.request(method, url)

                total_sent += 1
                window_sent += 1

                if resp.is_error:
                    total_errors += 1
                    window_errors += 1
                    logger.warning("%s %s -> HTTP %d", method, path, resp.status_code)
                else:
                    logger.debug("%s %s -> HTTP %d", method, path, resp.status_code)

            except Exception as exc:
                total_sent += 1
                window_sent += 1
                total_errors += 1
                window_errors += 1
                logger.warning("Error requesting %s %s: %s", method, url, exc)

            # Print summary every 30 seconds
            now = time.monotonic()
            if now - last_summary_time >= 30.0:
                logger.info(
                    "[SUMMARY (Last 30s)] Sent: %d, Errors: %d | [LIFETIME] Sent: %d, Errors: %d",
                    window_sent,
                    window_errors,
                    total_sent,
                    total_errors,
                )
                window_sent = 0
                window_errors = 0
                last_summary_time = now

            # Throttle to maintain target requests per second
            elapsed = time.monotonic() - start_time
            sleep_needed = INTERVAL - elapsed
            if sleep_needed > 0:
                time.sleep(sleep_needed)

    logger.info(
        "Traffic Generator stopped. Final stats: Sent=%d, Errors=%d",
        total_sent,
        total_errors,
    )


if __name__ == "__main__":
    main()
