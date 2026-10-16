"""
Settings API endpoints.

Provides:
  GET    /settings/profile            – current user's profile
  PATCH  /settings/profile            – update display name
  PATCH  /settings/password           – change own password
  GET    /settings/system-config      – admin: read system config keys
  PATCH  /settings/system-config      – admin: update a config value
  GET    /settings/users              – admin: list all users
  PATCH  /settings/users/{id}/role    – admin: toggle is_admin
  PATCH  /settings/users/{id}/active  – admin: toggle is_active
"""

from __future__ import annotations

import re
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict, field_validator
from sqlalchemy.orm import Session
from datetime import datetime

from app.core.database import get_db
from app.core.security import get_password_hash, verify_password
from app.models import User
from app.models.models import SystemConfiguration
from app.api.deps import get_current_active_user

router = APIRouter()

_EMAIL_REGEX = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class ProfileUpdate(BaseModel):
    full_name: Optional[str] = None


class PasswordChange(BaseModel):
    current_password: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def strength(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters.")
        return v


class ConfigKeyUpdate(BaseModel):
    key: str
    value: str


class UserRolePatch(BaseModel):
    is_admin: bool


class UserActivePatch(BaseModel):
    is_active: bool


class ProfileOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
    full_name: Optional[str]
    is_admin: bool
    is_verified: bool
    created_at: datetime


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
    full_name: Optional[str]
    is_admin: bool
    is_active: bool
    is_verified: bool
    created_at: datetime


class ConfigOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    key: str
    value: str
    updated_at: Optional[datetime]


class MessageResponse(BaseModel):
    message: str


# ---------------------------------------------------------------------------
# Profile endpoints (any authenticated user)
# ---------------------------------------------------------------------------

@router.get("/profile", response_model=ProfileOut)
def get_profile(current_user: User = Depends(get_current_active_user)):
    """Return the current user's profile."""
    return current_user


@router.patch("/profile", response_model=ProfileOut)
def update_profile(
    payload: ProfileUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Update the current user's display name."""
    if payload.full_name is not None:
        current_user.full_name = payload.full_name.strip() or None
    db.commit()
    db.refresh(current_user)
    return current_user


@router.patch("/password", response_model=MessageResponse)
def change_password(
    payload: PasswordChange,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Change the current user's password after verifying the existing one."""
    if not verify_password(payload.current_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect.",
        )
    if payload.current_password == payload.new_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password must differ from the current password.",
        )
    current_user.hashed_password = get_password_hash(payload.new_password)
    db.commit()
    return {"message": "Password updated successfully."}


# ---------------------------------------------------------------------------
# System configuration (admin only)
# ---------------------------------------------------------------------------

# Keys exposed to the admin UI. Excludes secrets (JWT, SMTP passwords, API keys).
_ALLOWED_CONFIG_KEYS = {
    "CPU_THRESHOLD_PCT",
    "MEM_THRESHOLD_PCT",
    "DISK_THRESHOLD_PCT",
    "DETECTION_INTERVAL_SECONDS",
    "DETECTION_CONSECUTIVE_BREACHES",
    "DETECTION_RECOVERY_CHECKS",
    "ANOMALY_THRESHOLD",
    "CORRELATION_WINDOW_MINUTES",
    "GEMINI_MODEL",
    "LLM_TIMEOUT_SECONDS",
}


def _require_admin(current_user: User = Depends(get_current_active_user)) -> User:
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin privileges required.",
        )
    return current_user


@router.get("/system-config", response_model=List[ConfigOut])
def list_system_config(
    db: Session = Depends(get_db),
    admin: User = Depends(_require_admin),
):
    """Return all persisted system configuration overrides (admin only)."""
    rows = db.query(SystemConfiguration).all()
    # Only surface allowed keys
    return [r for r in rows if r.key in _ALLOWED_CONFIG_KEYS]


@router.patch("/system-config", response_model=ConfigOut)
def upsert_system_config(
    payload: ConfigKeyUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(_require_admin),
):
    """Insert or update a system configuration value (admin only)."""
    if payload.key not in _ALLOWED_CONFIG_KEYS:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Key '{payload.key}' is not a configurable setting.",
        )
    row = db.query(SystemConfiguration).filter(SystemConfiguration.key == payload.key).first()
    if row:
        row.value = payload.value
        row.updated_at = datetime.utcnow()
    else:
        row = SystemConfiguration(key=payload.key, value=payload.value)
        db.add(row)
    db.commit()
    db.refresh(row)
    return row


# ---------------------------------------------------------------------------
# User management (admin only)
# ---------------------------------------------------------------------------

@router.get("/users", response_model=List[UserOut])
def list_users(
    db: Session = Depends(get_db),
    admin: User = Depends(_require_admin),
):
    """List all users in the workspace (admin only)."""
    return db.query(User).order_by(User.created_at.asc()).all()


@router.patch("/users/{user_id}/role", response_model=UserOut)
def update_user_role(
    user_id: int,
    payload: UserRolePatch,
    db: Session = Depends(get_db),
    admin: User = Depends(_require_admin),
):
    """Toggle admin role for a user (admin only). Cannot demote self."""
    if user_id == admin.id and not payload.is_admin:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot remove your own admin privileges.",
        )
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")
    user.is_admin = payload.is_admin
    db.commit()
    db.refresh(user)
    return user


@router.patch("/users/{user_id}/active", response_model=UserOut)
def update_user_active(
    user_id: int,
    payload: UserActivePatch,
    db: Session = Depends(get_db),
    admin: User = Depends(_require_admin),
):
    """Activate or deactivate a user account (admin only). Cannot deactivate self."""
    if user_id == admin.id and not payload.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot deactivate your own account.",
        )
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")
    user.is_active = payload.is_active
    db.commit()
    db.refresh(user)
    return user
