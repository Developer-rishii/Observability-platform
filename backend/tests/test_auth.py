import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.core.security import verify_password, get_password_hash
from app.core.database import SessionLocal, get_db
from app.models.models import User

client = TestClient(app)

@pytest.fixture(scope="module")
def db():
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()

@pytest.fixture(scope="module")
def test_user(db):
    email = "testauth@example.com"
    password = "testpassword123"
    
    # Create test user
    user = db.query(User).filter(User.email == email).first()
    if not user:
        user = User(
            email=email,
            hashed_password=get_password_hash(password),
            full_name="Test Auth User",
            is_active=True,
            is_admin=False
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    
    yield {"email": email, "password": password, "user": user}
    
    # Teardown
    db.delete(user)
    db.commit()

def test_password_hashing():
    password = "secretpassword"
    hashed = get_password_hash(password)
    assert verify_password(password, hashed)
    assert not verify_password("wrongpassword", hashed)

def test_login_success(test_user):
    response = client.post(
        "/api/v1/auth/login",
        json={"email": test_user["email"], "password": test_user["password"]}
    )
    assert response.status_code == 200
    data = response.json()
    assert "accessToken" in data or "access_token" in data
    assert data.get("tokenType", data.get("token_type")) == "bearer"
    assert data["user"]["email"] == test_user["email"]

def test_login_failure():
    response = client.post(
        "/api/v1/auth/login",
        json={"email": "wrong@example.com", "password": "wrongpassword"}
    )
    assert response.status_code == 401

def test_get_me(test_user):
    # First login to get token
    login_response = client.post(
        "/api/v1/auth/login",
        json={"email": test_user["email"], "password": test_user["password"]}
    )
    token = login_response.json().get("accessToken", login_response.json().get("access_token"))
    
    # Then get me
    response = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 200
    assert response.json()["email"] == test_user["email"]
    assert response.json()["full_name"] == "Test Auth User"

def test_get_me_unauthorized():
    response = client.get("/api/v1/auth/me")
    assert response.status_code == 401
