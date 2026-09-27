from fastapi import FastAPI, BackgroundTasks
from prometheus_client import make_asgi_app, Counter, Gauge
import time
import math

app = FastAPI()

# Add prometheus asgi middleware to route /metrics
metrics_app = make_asgi_app()
app.mount("/metrics", metrics_app)

SPIKE_REQUESTS = Counter('spike_requests_total', 'Total number of spike requests')
CPU_SIMULATOR = Gauge('simulated_cpu_usage', 'Simulated CPU usage percentage')

# initialize
CPU_SIMULATOR.set(5.0)

def burn_cpu(duration: int):
    end_time = time.time() + duration
    while time.time() < end_time:
        # burn some CPU
        math.factorial(100)
    CPU_SIMULATOR.set(5.0) # reset

@app.post("/spike")
def spike(background_tasks: BackgroundTasks, duration: int = 5):
    SPIKE_REQUESTS.inc()
    CPU_SIMULATOR.set(95.0)
    background_tasks.add_task(burn_cpu, duration)
    return {"message": f"CPU spike initiated for {duration} seconds"}
