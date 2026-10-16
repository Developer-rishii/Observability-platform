import os
import time
import math
import uuid
import threading
from contextlib import asynccontextmanager
from typing import Optional, List

from fastapi import FastAPI, BackgroundTasks, Header, HTTPException, Depends, status, Request
from fastapi.responses import JSONResponse
from prometheus_client import make_asgi_app
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError

from config import FAULT_TOKEN, DEMO_DATA_DIR
from database import engine, get_db, check_db_health, init_db_and_seed
from models import Product, Order
from schemas import (
    ProductResponse,
    OrderCreate,
    OrderResponse,
    CpuFaultRequest,
    LatencyFaultRequest,
    DiskFillRequest
)
from metrics import (
    SPIKE_REQUESTS,
    CPU_SIMULATOR,
    HTTP_REQUESTS_TOTAL,
    HTTP_REQUEST_DURATION_SECONDS,
    measure_data_dir_bytes
)
from logging_config import log_request, logger

# State tracking for faults
fault_lock = threading.Lock()
cpu_fault_end_time: float = 0.0
latency_fault_state = {
    "latency_ms": 0,
    "expires_at": 0.0
}

MAX_DISK_FILL_BYTES = 500 * 1024 * 1024  # 500 MB limit

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: ensure data directory, measure it, and initialize database tables/seed
    os.makedirs(DEMO_DATA_DIR, exist_ok=True)
    measure_data_dir_bytes()
    try:
        init_db_and_seed()
    except Exception as e:
        logger.error(f"Startup DB init failed: {e}")
    yield
    # Shutdown

app = FastAPI(title="Demo Workload Generator & App", lifespan=lifespan)

# Silence standard uvicorn access logs to prevent duplicate request records
import logging
logging.getLogger("uvicorn.access").setLevel(logging.WARNING)

from prometheus_client import generate_latest, CONTENT_TYPE_LATEST
from fastapi import Response

# Direct Prometheus metrics endpoint
@app.get("/metrics")
@app.get("/metrics/")
def get_metrics():
    return Response(content=generate_latest(), media_type=CONTENT_TYPE_LATEST)

# Helper for route path normalization to prevent unbounded Prometheus label cardinality
def normalize_path(path: str) -> str:
    if path.startswith("/api/products"):
        return "/api/products"
    if path.startswith("/api/orders"):
        return "/api/orders"
    if path.startswith("/admin/fault"):
        return "/admin/fault"
    if path in ("/health", "/spike", "/metrics"):
        return path
    return "other"

# Structured Logging & Metrics & Latency Fault Middleware
@app.middleware("http")
async def observability_and_latency_middleware(request: Request, call_next):
    start_time = time.perf_counter()
    path = request.url.path

    # Apply injected latency if fault is currently active
    now = time.time()
    with fault_lock:
        if now < latency_fault_state["expires_at"] and latency_fault_state["latency_ms"] > 0:
            delay_sec = latency_fault_state["latency_ms"] / 1000.0
            time.sleep(delay_sec)

    try:
        response = await call_next(request)
        status_code = response.status_code
        duration_ms = (time.perf_counter() - start_time) * 1000.0

        # Determine log level
        if status_code >= 500:
            level = "ERROR"
        elif status_code >= 400:
            level = "WARNING"
        else:
            level = "INFO"

        log_request(level, path, status_code, duration_ms)

        norm_path = normalize_path(path)
        HTTP_REQUESTS_TOTAL.labels(path=norm_path, status=str(status_code)).inc()
        HTTP_REQUEST_DURATION_SECONDS.labels(path=norm_path, status=str(status_code)).observe(duration_ms / 1000.0)

        # Refresh data dir metric when metrics endpoint is scraped
        if path == "/metrics":
            measure_data_dir_bytes()

        return response
    except Exception as exc:
        duration_ms = (time.perf_counter() - start_time) * 1000.0
        log_request("ERROR", path, 500, duration_ms, error_detail=str(exc))
        norm_path = normalize_path(path)
        HTTP_REQUESTS_TOTAL.labels(path=norm_path, status="500").inc()
        HTTP_REQUEST_DURATION_SECONDS.labels(path=norm_path, status="500").observe(duration_ms / 1000.0)
        raise exc

# Authentication dependency for admin fault endpoints
def verify_fault_token(x_fault_token: Optional[str] = Header(None, alias="X-Fault-Token")):
    if not x_fault_token or x_fault_token != FAULT_TOKEN:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Unauthorized: Invalid or missing X-Fault-Token"
        )
    return True

# CPU burn background worker
def burn_cpu(duration: int):
    global cpu_fault_end_time
    with fault_lock:
        cpu_fault_end_time = max(cpu_fault_end_time, time.time() + duration)
        CPU_SIMULATOR.set(95.0)

    while True:
        with fault_lock:
            if time.time() >= cpu_fault_end_time:
                break
        math.factorial(100)

    with fault_lock:
        if time.time() >= cpu_fault_end_time:
            CPU_SIMULATOR.set(5.0)

# -------------------------------------------------------------
# Existing /spike endpoint (Preserved)
# -------------------------------------------------------------
@app.post("/spike")
def spike(background_tasks: BackgroundTasks, duration: int = 5):
    if duration > 120:
        duration = 120
    SPIKE_REQUESTS.inc()
    background_tasks.add_task(burn_cpu, duration)
    return {"message": f"CPU spike initiated for {duration} seconds"}

# -------------------------------------------------------------
# Demo Application Endpoints
# -------------------------------------------------------------
@app.get("/health")
def health_check():
    """Check demo application health and database connectivity."""
    db_ok = check_db_health()
    if not db_ok:
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={
                "status": "unhealthy",
                "database": "disconnected",
                "error": "Database unavailable"
            }
        )
    return {
        "status": "healthy",
        "database": "connected"
    }

@app.get("/api/products", response_model=List[ProductResponse])
def get_products(db: Session = Depends(get_db)):
    """Retrieve all products from demo-db."""
    try:
        products = db.query(Product).order_by(Product.id.asc()).all()
        return products
    except SQLAlchemyError as e:
        logger.error(f"Database error while fetching products: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal database error while fetching products"
        )

@app.get("/api/orders", response_model=List[OrderResponse])
def get_orders(db: Session = Depends(get_db)):
    """Retrieve all orders from demo-db."""
    try:
        orders = db.query(Order).order_by(Order.id.desc()).all()
        return orders
    except SQLAlchemyError as e:
        logger.error(f"Database error while fetching orders: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal database error while fetching orders"
        )

@app.post("/api/orders", response_model=OrderResponse, status_code=status.HTTP_201_CREATED)
def create_order(order_data: OrderCreate, db: Session = Depends(get_db)):
    """Validate request, verify product stock, and create order in a real DB transaction."""
    try:
        # Atomic lock or check for stock
        product = db.query(Product).filter(Product.id == order_data.product_id).first()
        if not product:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Product with id {order_data.product_id} not found"
            )

        if product.available_quantity < order_data.quantity:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Insufficient quantity. Available: {product.available_quantity}, requested: {order_data.quantity}"
            )

        total_price = round(product.price * order_data.quantity, 2)
        product.available_quantity -= order_data.quantity

        order = Order(
            product_id=order_data.product_id,
            quantity=order_data.quantity,
            total_price=total_price,
            customer_name=order_data.customer_name,
            customer_email=order_data.customer_email,
            status="completed"
        )
        db.add(order)
        db.commit()
        db.refresh(order)
        return order
    except HTTPException:
        db.rollback()
        raise
    except SQLAlchemyError as e:
        db.rollback()
        logger.error(f"Database error during order creation: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal database error during order creation"
        )

# -------------------------------------------------------------
# Controlled Fault-Injection Endpoints (/admin/fault/*)
# -------------------------------------------------------------
@app.post("/admin/fault/cpu")
def inject_cpu_fault(
    payload: CpuFaultRequest,
    background_tasks: BackgroundTasks,
    _: bool = Depends(verify_fault_token)
):
    """Trigger controlled CPU stress for up to 120 seconds."""
    duration = payload.duration
    if duration > 120 or duration < 1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Duration must be between 1 and 120 seconds"
        )
    background_tasks.add_task(burn_cpu, duration)
    return {
        "status": "CPU stress fault initiated",
        "duration_seconds": duration,
        "max_duration_seconds": 120
    }

@app.post("/admin/fault/latency")
def inject_latency_fault(
    payload: LatencyFaultRequest,
    _: bool = Depends(verify_fault_token)
):
    """Trigger artificial latency up to 3,000ms for up to 120 seconds."""
    if payload.latency_ms > 3000 or payload.latency_ms < 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Latency must be between 0 and 3000 milliseconds"
        )
    if payload.duration > 120 or payload.duration < 1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Duration must be between 1 and 120 seconds"
        )

    with fault_lock:
        latency_fault_state["latency_ms"] = payload.latency_ms
        latency_fault_state["expires_at"] = time.time() + payload.duration

    return {
        "status": "Latency fault activated",
        "injected_latency_ms": payload.latency_ms,
        "duration_seconds": payload.duration,
        "expires_in_seconds": payload.duration
    }

@app.post("/admin/fault/latency/reset")
def reset_latency_fault(_: bool = Depends(verify_fault_token)):
    """Reset injected latency fault immediately."""
    with fault_lock:
        latency_fault_state["latency_ms"] = 0
        latency_fault_state["expires_at"] = 0.0
    return {"status": "Latency fault reset to normal"}

@app.post("/admin/fault/disk/fill")
def inject_disk_fill_fault(
    payload: DiskFillRequest,
    _: bool = Depends(verify_fault_token)
):
    """Write test data strictly inside designated demo data directory up to 500 MB max."""
    size_mb = payload.size_mb
    if size_mb > 500 or size_mb < 1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Size must be between 1 and 500 MB"
        )

    bytes_to_write = size_mb * 1024 * 1024
    current_bytes = measure_data_dir_bytes()

    if current_bytes + bytes_to_write > MAX_DISK_FILL_BYTES:
        max_mb = MAX_DISK_FILL_BYTES // (1024 * 1024)
        curr_mb = round(current_bytes / (1024 * 1024), 2)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Disk fill limit of {max_mb} MB exceeded. Current: {curr_mb} MB, requested: {size_mb} MB"
        )

    os.makedirs(DEMO_DATA_DIR, exist_ok=True)
    filename = f"fill_{int(time.time())}_{uuid.uuid4().hex[:8]}.dat"
    file_path = os.path.join(DEMO_DATA_DIR, filename)

    # Prevent path traversal
    resolved_path = os.path.abspath(file_path)
    if not resolved_path.startswith(os.path.abspath(DEMO_DATA_DIR)):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid path traversal detected"
        )

    # Write data in 1MB chunks
    chunk_1mb = b"X" * (1024 * 1024)
    try:
        with open(resolved_path, "wb") as f:
            for _ in range(size_mb):
                f.write(chunk_1mb)
    except OSError as e:
        logger.error(f"Error writing disk fault data: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to write disk fill data: {e}"
        )

    updated_bytes = measure_data_dir_bytes()
    return {
        "status": "Disk fill data generated",
        "file": filename,
        "size_mb": size_mb,
        "current_data_dir_bytes": updated_bytes
    }

@app.post("/admin/fault/disk/clear")
def clear_disk_fill_fault(_: bool = Depends(verify_fault_token)):
    """Safely remove only generated fault files from designated data directory."""
    freed_bytes = 0
    removed_count = 0
    if os.path.exists(DEMO_DATA_DIR):
        for fname in os.listdir(DEMO_DATA_DIR):
            # Only remove files generated by disk fault
            if fname.startswith("fill_") and fname.endswith(".dat"):
                fpath = os.path.join(DEMO_DATA_DIR, fname)
                try:
                    size = os.path.getsize(fpath)
                    os.remove(fpath)
                    freed_bytes += size
                    removed_count += 1
                except OSError as e:
                    logger.error(f"Could not remove fault file {fname}: {e}")

    updated_bytes = measure_data_dir_bytes()
    return {
        "status": "Fault test files cleaned",
        "files_removed": removed_count,
        "freed_bytes": freed_bytes,
        "current_data_dir_bytes": updated_bytes
    }

@app.get("/admin/fault/status")
def get_fault_status(_: bool = Depends(verify_fault_token)):
    """Return status of all fault injection mechanisms."""
    now = time.time()
    with fault_lock:
        cpu_active = now < cpu_fault_end_time
        cpu_rem = max(0.0, round(cpu_fault_end_time - now, 1))
        latency_active = (now < latency_fault_state["expires_at"]) and (latency_fault_state["latency_ms"] > 0)
        latency_rem = max(0.0, round(latency_fault_state["expires_at"] - now, 1))
        current_lat = latency_fault_state["latency_ms"] if latency_active else 0

    disk_bytes = measure_data_dir_bytes()

    return {
        "cpu_fault": {
            "active": cpu_active,
            "remaining_seconds": cpu_rem
        },
        "latency_fault": {
            "active": latency_active,
            "injected_latency_ms": current_lat,
            "remaining_seconds": latency_rem
        },
        "disk_fault": {
            "current_data_dir_bytes": disk_bytes,
            "max_allowed_bytes": MAX_DISK_FILL_BYTES
        }
    }
