"""
Authentication API endpoints.

Provides:
  POST /auth/login              – issue JWT
  POST /auth/register           – create account + send verification email
  POST /auth/verify-email       – consume verification token
  POST /auth/resend-verification – re-send verification email
  POST /auth/forgot-password    – send password-reset email
  POST /auth/reset-password     – consume reset token + set new password
  GET  /auth/me                 – return authenticated user profile
"""

from __future__ import annotations

import hashlib
import secrets
from datetime import datetime, timedelta

import re

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, field_validator
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.security import get_password_hash, verify_password, create_access_token
from app.models import User
from app.models.models import PasswordResetToken, VerificationToken
from app.schemas import LoginRequest, TokenResponse
from app.api.deps import get_current_active_user
from app.services.email_service import send_verification_email, send_password_reset_email

router = APIRouter()

_EMAIL_REGEX = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


# ---------------------------------------------------------------------------
# Pydantic request / response models (auth-specific, not in global schemas)
# ---------------------------------------------------------------------------

class RegisterRequest(BaseModel):
    email: str
    password: str
    full_name: str | None = None

    @field_validator("email")
    @classmethod
    def valid_email(cls, v: str) -> str:
        clean = v.strip().lower()
        if not _EMAIL_REGEX.match(clean):
            raise ValueError("Invalid email address format.")
        return clean

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters.")
        return v


class MessageResponse(BaseModel):
    message: str


class VerifyEmailRequest(BaseModel):
    token: str


class ForgotPasswordRequest(BaseModel):
    email: str

    @field_validator("email")
    @classmethod
    def valid_email(cls, v: str) -> str:
        clean = v.strip().lower()
        if not _EMAIL_REGEX.match(clean):
            raise ValueError("Invalid email address format.")
        return clean


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters.")
        return v


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_TOKEN_BYTES = 32  # 256-bit raw token → 64-char hex hash stored in DB


def _generate_token() -> tuple[str, str]:
    """Return (raw_token, sha-256 hex hash) pair."""
    raw = secrets.token_hex(_TOKEN_BYTES)
    token_hash = hashlib.sha256(raw.encode()).hexdigest()
    return raw, token_hash


def _hash_token(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("/login", response_model=TokenResponse)
def login(login_data: LoginRequest, db: Session = Depends(get_db)):
    """Authenticate a user and return a JWT access token."""
    user = db.query(User).filter(User.email == login_data.email).first()
    if not user or not verify_password(login_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Inactive user")
    if not user.is_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="email_not_verified",
        )

    access_token = create_access_token(
        data={"sub": user.email},
        expires_delta=timedelta(minutes=settings.JWT_EXPIRY_MINUTES),
    )
    return {"access_token": access_token, "token_type": "bearer", "user": user}


@router.post("/register", response_model=MessageResponse, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest, db: Session = Depends(get_db)):
    """Create a new user account and dispatch a verification email."""
    existing = db.query(User).filter(User.email == payload.email).first()
    if existing:
        # Return a generic message so we don't reveal account existence
        return {"message": "If this email is new, a verification link has been sent."}

    user = User(
        email=payload.email,
        hashed_password=get_password_hash(payload.password),
        full_name=payload.full_name,
        is_active=True,
        is_admin=False,
        is_verified=False,
    )
    db.add(user)
    db.flush()  # assign user.id before creating token

    raw, token_hash = _generate_token()
    vtoken = VerificationToken(
        user_id=user.id,
        token_hash=token_hash,
        expires_at=datetime.utcnow() + timedelta(hours=24),
    )
    db.add(vtoken)
    db.commit()

    send_verification_email(
        to_email=user.email,
        full_name=user.full_name or "",
        token=raw,
    )
    return {"message": "Account created. Please check your email to verify your account."}


@router.post("/verify-email", response_model=MessageResponse)
def verify_email(payload: VerifyEmailRequest, db: Session = Depends(get_db)):
    """Consume a single-use email-verification token."""
    token_hash = _hash_token(payload.token)
    vtoken = (
        db.query(VerificationToken)
        .filter(
            VerificationToken.token_hash == token_hash,
            VerificationToken.used == False,  # noqa: E712
        )
        .first()
    )
    if not vtoken:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired token.")
    if vtoken.expires_at < datetime.utcnow():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Verification link has expired.")

    vtoken.used = True
    vtoken.user.is_verified = True
    db.commit()
    return {"message": "Email verified successfully. You can now sign in."}


@router.post("/resend-verification", response_model=MessageResponse)
def resend_verification(payload: ForgotPasswordRequest, db: Session = Depends(get_db)):
    """Re-issue a verification email for an unverified account."""
    user = db.query(User).filter(User.email == payload.email).first()
    # Always return success to avoid account enumeration
    if not user or user.is_verified:
        return {"message": "If your account exists and is unverified, a new link has been sent."}

    # Invalidate previous tokens
    db.query(VerificationToken).filter(
        VerificationToken.user_id == user.id,
        VerificationToken.used == False,  # noqa: E712
    ).update({"used": True})

    raw, token_hash = _generate_token()
    vtoken = VerificationToken(
        user_id=user.id,
        token_hash=token_hash,
        expires_at=datetime.utcnow() + timedelta(hours=24),
    )
    db.add(vtoken)
    db.commit()

    send_verification_email(to_email=user.email, full_name=user.full_name or "", token=raw)
    return {"message": "If your account exists and is unverified, a new link has been sent."}


@router.post("/forgot-password", response_model=MessageResponse)
def forgot_password(payload: ForgotPasswordRequest, db: Session = Depends(get_db)):
    """Dispatch a password-reset email (always returns 200 to avoid enumeration)."""
    user = db.query(User).filter(User.email == payload.email).first()
    if not user or not user.is_active:
        return {"message": "If this email is registered, password-reset instructions have been sent."}

    # Invalidate any outstanding reset tokens
    db.query(PasswordResetToken).filter(
        PasswordResetToken.user_id == user.id,
        PasswordResetToken.used == False,  # noqa: E712
    ).update({"used": True})

    raw, token_hash = _generate_token()
    ptoken = PasswordResetToken(
        user_id=user.id,
        token_hash=token_hash,
        expires_at=datetime.utcnow() + timedelta(hours=1),
    )
    db.add(ptoken)
    db.commit()

    send_password_reset_email(to_email=user.email, full_name=user.full_name or "", token=raw)
    return {"message": "If this email is registered, password-reset instructions have been sent."}


@router.post("/reset-password", response_model=MessageResponse)
def reset_password(payload: ResetPasswordRequest, db: Session = Depends(get_db)):
    """Consume a password-reset token and set a new hashed password."""
    token_hash = _hash_token(payload.token)
    ptoken = (
        db.query(PasswordResetToken)
        .filter(
            PasswordResetToken.token_hash == token_hash,
            PasswordResetToken.used == False,  # noqa: E712
        )
        .first()
    )
    if not ptoken:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired token.")
    if ptoken.expires_at < datetime.utcnow():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Password-reset link has expired.")

    ptoken.used = True
    ptoken.user.hashed_password = get_password_hash(payload.new_password)
    db.commit()
    return {"message": "Password updated successfully. You can now sign in."}


@router.get("/me", response_model=dict)
def read_users_me(current_user: User = Depends(get_current_active_user)):
    """Return the current user's profile information."""
    return {
        "id": current_user.id,
        "email": current_user.email,
        "full_name": current_user.full_name,
        "is_admin": current_user.is_admin,
        "is_verified": current_user.is_verified,
    }
