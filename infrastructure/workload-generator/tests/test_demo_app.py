import os
import sys
import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import StaticPool
from sqlalchemy.exc import SQLAlchemyError

# Add workload-generator directory to sys.path so modules import directly
workload_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if workload_dir not in sys.path:
    sys.path.insert(0, workload_dir)

from app import app, verify_fault_token, MAX_DISK_FILL_BYTES
from config import FAULT_TOKEN
from database import get_db
from models import Base, Product, Order

# Setup isolated shared in-memory SQLite database using StaticPool
TEST_DB_URL = "sqlite:///:memory:"
test_engine = create_engine(
    TEST_DB_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)

def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db

@pytest.fixture(autouse=True)
def setup_test_db():
    Base.metadata.create_all(bind=test_engine)
    db = TestingSessionLocal()
    # Seed 3 test products
    p1 = Product(name="Test Compute Node", description="Test Node", price=50.0, available_quantity=10)
    p2 = Product(name="Test Storage Volume", description="Test Disk", price=20.0, available_quantity=5)
    p3 = Product(name="Test Low Stock Node", description="Out of stock test", price=100.0, available_quantity=1)
    db.add_all([p1, p2, p3])
    db.commit()
    yield
    Base.metadata.drop_all(bind=test_engine)

client = TestClient(app)

# ----------------------------------------------------------------------
# 1. Health Endpoint Tests
# ----------------------------------------------------------------------
def test_health_success():
    with patch("app.check_db_health", return_value=True):
        resp = client.get("/health")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "healthy"
        assert data["database"] == "connected"

def test_health_database_failure():
    with patch("app.check_db_health", return_value=False):
        resp = client.get("/health")
        assert resp.status_code == 503
        data = resp.json()
        assert data["status"] == "unhealthy"
        assert data["database"] == "disconnected"
        assert "error" in data

# ----------------------------------------------------------------------
# 2. Products API Tests
# ----------------------------------------------------------------------
def test_get_products_success():
    resp = client.get("/api/products")
    assert resp.status_code == 200
    products = resp.json()
    assert len(products) == 3
    assert products[0]["name"] == "Test Compute Node"
    assert products[0]["price"] == 50.0
    assert products[0]["available_quantity"] == 10

def test_get_products_database_error():
    mock_db = MagicMock()
    mock_db.query.side_effect = SQLAlchemyError("DB connection timeout")
    app.dependency_overrides[get_db] = lambda: mock_db
    try:
        resp = client.get("/api/products")
        assert resp.status_code == 500
        assert resp.json()["detail"] == "Internal database error while fetching products"
    finally:
        app.dependency_overrides[get_db] = override_get_db

# ----------------------------------------------------------------------
# 3. Orders API Tests
# ----------------------------------------------------------------------
def test_create_order_success():
    payload = {
        "product_id": 1,
        "quantity": 2,
        "customer_name": "Alice Smith",
        "customer_email": "alice@example.com"
    }
    resp = client.post("/api/orders", json=payload)
    assert resp.status_code == 201
    order = resp.json()
    assert order["product_id"] == 1
    assert order["quantity"] == 2
    assert order["total_price"] == 100.0  # 50.0 * 2
    assert order["customer_name"] == "Alice Smith"
    assert order["status"] == "completed"

    # Verify stock decremented
    db = TestingSessionLocal()
    product = db.query(Product).filter(Product.id == 1).first()
    assert product.available_quantity == 8
    db.close()

def test_create_order_insufficient_stock():
    payload = {
        "product_id": 3,
        "quantity": 5,  # only 1 available
        "customer_name": "Bob Jones",
        "customer_email": "bob@example.com"
    }
    resp = client.post("/api/orders", json=payload)
    assert resp.status_code == 400
    assert "Insufficient quantity" in resp.json()["detail"]

def test_create_order_product_not_found():
    payload = {
        "product_id": 9999,
        "quantity": 1,
        "customer_name": "Charlie",
        "customer_email": "charlie@example.com"
    }
    resp = client.post("/api/orders", json=payload)
    assert resp.status_code == 404
    assert "not found" in resp.json()["detail"]

def test_create_order_database_error_rolls_back_and_returns_500():
    payload = {
        "product_id": 1,
        "quantity": 2,
        "customer_name": "Rollback Test",
        "customer_email": "rollback@example.com"
    }
    with patch.object(Session, "commit", side_effect=SQLAlchemyError("DB commit failure")):
        resp = client.post("/api/orders", json=payload)
        assert resp.status_code == 500
        assert "Internal database error" in resp.json()["detail"]

    # Verify inventory was NOT decremented due to rollback
    db = TestingSessionLocal()
    product = db.query(Product).filter(Product.id == 1).first()
    assert product.available_quantity == 10
    db.close()

def test_create_order_invalid_payload():
    # Negative quantity
    resp = client.post("/api/orders", json={"product_id": 1, "quantity": -5, "customer_name": "X", "customer_email": "x@x.com"})
    assert resp.status_code == 422

def test_get_orders_success():
    # Create an order first
    client.post("/api/orders", json={
        "product_id": 2,
        "quantity": 1,
        "customer_name": "Order Getter",
        "customer_email": "order@example.com"
    })
    resp = client.get("/api/orders")
    assert resp.status_code == 200
    orders = resp.json()
    assert len(orders) >= 1
    assert orders[0]["customer_name"] == "Order Getter"

# ----------------------------------------------------------------------
# 4. Structured Logging & Prometheus Metrics Tests
# ----------------------------------------------------------------------
def test_structured_request_logging_emits_fields():
    with patch("app.log_request") as mock_log:
        resp = client.get("/api/products")
        assert resp.status_code == 200
        mock_log.assert_called_once()
        args, _ = mock_log.call_args
        # level, path, status, duration_ms
        assert args[0] == "INFO"
        assert args[1] == "/api/products"
        assert args[2] == 200
        assert isinstance(args[3], float)

def test_metrics_endpoint_available_and_contains_required_metrics():
    # Make a request to increment counters
    client.get("/health")
    resp = client.get("/metrics")
    assert resp.status_code == 200
    body = resp.text
    assert "http_requests_total" in body
    assert "http_request_duration_seconds" in body
    assert "demo_data_dir_bytes" in body
    assert "spike_requests_total" in body

# ----------------------------------------------------------------------
# 5. Fault Injection Endpoints: Authentication Tests
# ----------------------------------------------------------------------
def test_fault_endpoints_reject_missing_token():
    resp = client.post("/admin/fault/cpu", json={"duration": 5})
    assert resp.status_code == 401
    assert "Unauthorized" in resp.json()["detail"]

def test_fault_endpoints_reject_invalid_token():
    headers = {"X-Fault-Token": "wrong-secret-token"}
    resp = client.post("/admin/fault/cpu", json={"duration": 5}, headers=headers)
    assert resp.status_code == 401
    assert "Unauthorized" in resp.json()["detail"]

# ----------------------------------------------------------------------
# 6. CPU Fault Limits
# ----------------------------------------------------------------------
def test_cpu_fault_success():
    headers = {"X-Fault-Token": FAULT_TOKEN}
    with patch("app.burn_cpu"):
        resp = client.post("/admin/fault/cpu", json={"duration": 10}, headers=headers)
        assert resp.status_code == 200
        assert resp.json()["duration_seconds"] == 10

def test_cpu_fault_rejects_excessive_duration():
    headers = {"X-Fault-Token": FAULT_TOKEN}
    resp = client.post("/admin/fault/cpu", json={"duration": 150}, headers=headers)
    assert resp.status_code in (400, 422)

def test_cpu_fault_rejects_negative_duration():
    headers = {"X-Fault-Token": FAULT_TOKEN}
    resp = client.post("/admin/fault/cpu", json={"duration": 0}, headers=headers)
    assert resp.status_code in (400, 422)

# ----------------------------------------------------------------------
# 7. Latency Fault Limits & Auto-Reset
# ----------------------------------------------------------------------
def test_latency_fault_success_and_reset():
    headers = {"X-Fault-Token": FAULT_TOKEN}
    resp = client.post("/admin/fault/latency", json={"latency_ms": 500, "duration": 10}, headers=headers)
    assert resp.status_code == 200
    assert resp.json()["injected_latency_ms"] == 500

    # Reset
    reset_resp = client.post("/admin/fault/latency/reset", headers=headers)
    assert reset_resp.status_code == 200

def test_latency_fault_rejects_excessive_latency():
    headers = {"X-Fault-Token": FAULT_TOKEN}
    # Limit is 3000ms
    resp = client.post("/admin/fault/latency", json={"latency_ms": 5000, "duration": 10}, headers=headers)
    assert resp.status_code in (400, 422)

def test_latency_fault_rejects_excessive_duration():
    headers = {"X-Fault-Token": FAULT_TOKEN}
    # Limit is 120s
    resp = client.post("/admin/fault/latency", json={"latency_ms": 1000, "duration": 200}, headers=headers)
    assert resp.status_code in (400, 422)

# ----------------------------------------------------------------------
# 8. Disk Fault Limits, Path Traversal, and Cleanup
# ----------------------------------------------------------------------
def test_disk_fault_fill_and_clear(tmp_path):
    headers = {"X-Fault-Token": FAULT_TOKEN}
    with patch("app.DEMO_DATA_DIR", str(tmp_path)):
        # Fill 2 MB
        fill_resp = client.post("/admin/fault/disk/fill", json={"size_mb": 2}, headers=headers)
        assert fill_resp.status_code == 200
        assert fill_resp.json()["size_mb"] == 2
        assert os.path.exists(os.path.join(str(tmp_path), fill_resp.json()["file"]))

        # Clear
        clear_resp = client.post("/admin/fault/disk/clear", headers=headers)
        assert clear_resp.status_code == 200
        assert clear_resp.json()["files_removed"] >= 1
        assert clear_resp.json()["freed_bytes"] >= 2 * 1024 * 1024

def test_disk_fault_rejects_over_500mb():
    headers = {"X-Fault-Token": FAULT_TOKEN}
    resp = client.post("/admin/fault/disk/fill", json={"size_mb": 600}, headers=headers)
    assert resp.status_code in (400, 422)

# ----------------------------------------------------------------------
# 9. Existing /spike Endpoint Compatibility
# ----------------------------------------------------------------------
def test_existing_spike_endpoint_preserved():
    with patch("app.burn_cpu"):
        resp = client.post("/spike?duration=3")
        assert resp.status_code == 200
        assert "CPU spike initiated" in resp.json()["message"]
