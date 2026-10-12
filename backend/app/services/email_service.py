"""
Email delivery service using stdlib smtplib with STARTTLS.
All SMTP credentials are read from environment-backed Settings — never hardcoded.
"""
from __future__ import annotations

import logging
import smtplib
import threading
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from app.core.config import settings

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# HTML email templates
# ---------------------------------------------------------------------------

_VERIFY_SUBJECT = "Verify your AetherPulse account"
_VERIFY_HTML = """\
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#0a0e1a;font-family:Inter,Segoe UI,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="padding:40px 16px;">
      <table width="560" cellpadding="0" cellspacing="0"
             style="background:#111827;border:1px solid #1e293b;border-radius:12px;overflow:hidden;">
        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#6d28d9 0%,#06b6d4 100%);padding:32px 40px;">
            <p style="margin:0;font-size:22px;font-weight:700;color:#fff;letter-spacing:-0.5px;">
              AetherPulse
            </p>
            <p style="margin:4px 0 0;font-size:13px;color:rgba(255,255,255,.7);">
              Cloud Observability Platform
            </p>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:40px;">
            <h2 style="margin:0 0 12px;font-size:20px;font-weight:600;color:#f1f5f9;">
              Confirm your email address
            </h2>
            <p style="margin:0 0 28px;font-size:14px;color:#94a3b8;line-height:1.6;">
              Hi {full_name},<br/><br/>
              You're almost ready to access your observability workspace.
              Click the button below to verify your email address.
              This link expires in <strong style="color:#e2e8f0;">24 hours</strong>.
            </p>
            <a href="{verify_url}"
               style="display:inline-block;padding:14px 32px;background:linear-gradient(135deg,#6d28d9,#06b6d4);
                      color:#fff;font-size:14px;font-weight:600;text-decoration:none;border-radius:8px;">
              Verify Email Address
            </a>
            <p style="margin:28px 0 0;font-size:12px;color:#475569;">
              Or paste this link into your browser:<br/>
              <a href="{verify_url}" style="color:#06b6d4;word-break:break-all;">{verify_url}</a>
            </p>
            <hr style="margin:32px 0;border:none;border-top:1px solid #1e293b;"/>
            <p style="margin:0;font-size:11px;color:#334155;">
              If you did not create an AetherPulse account, you can safely ignore this email.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
"""

_RESET_SUBJECT = "Reset your AetherPulse password"
_RESET_HTML = """\
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#0a0e1a;font-family:Inter,Segoe UI,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="padding:40px 16px;">
      <table width="560" cellpadding="0" cellspacing="0"
             style="background:#111827;border:1px solid #1e293b;border-radius:12px;overflow:hidden;">
        <tr>
          <td style="background:linear-gradient(135deg,#6d28d9 0%,#06b6d4 100%);padding:32px 40px;">
            <p style="margin:0;font-size:22px;font-weight:700;color:#fff;">AetherPulse</p>
            <p style="margin:4px 0 0;font-size:13px;color:rgba(255,255,255,.7);">Cloud Observability Platform</p>
          </td>
        </tr>
        <tr>
          <td style="padding:40px;">
            <h2 style="margin:0 0 12px;font-size:20px;font-weight:600;color:#f1f5f9;">
              Password reset request
            </h2>
            <p style="margin:0 0 28px;font-size:14px;color:#94a3b8;line-height:1.6;">
              Hi {full_name},<br/><br/>
              We received a request to reset the password for your account.
              Click the button below to choose a new password.
              This link expires in <strong style="color:#e2e8f0;">1 hour</strong>.
            </p>
            <a href="{reset_url}"
               style="display:inline-block;padding:14px 32px;background:linear-gradient(135deg,#6d28d9,#06b6d4);
                      color:#fff;font-size:14px;font-weight:600;text-decoration:none;border-radius:8px;">
              Reset Password
            </a>
            <p style="margin:28px 0 0;font-size:12px;color:#475569;">
              Or paste this link into your browser:<br/>
              <a href="{reset_url}" style="color:#06b6d4;word-break:break-all;">{reset_url}</a>
            </p>
            <hr style="margin:32px 0;border:none;border-top:1px solid #1e293b;"/>
            <p style="margin:0;font-size:11px;color:#334155;">
              If you did not request a password reset, no action is required and your password
              remains unchanged.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
"""


# ---------------------------------------------------------------------------
# SMTP helper
# ---------------------------------------------------------------------------

def _send_smtp(to_email: str, subject: str, html_body: str) -> None:
    """Send a single HTML email via SMTP STARTTLS (synchronous, runs in thread)."""
    if not settings.SMTP_HOST or not settings.SMTP_USERNAME:
        logger.warning(
            "SMTP not configured (SMTP_HOST/SMTP_USERNAME missing). "
            "Skipping email to %s — subject: %s",
            to_email,
            subject,
        )
        return

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"{settings.SMTP_FROM_NAME} <{settings.SMTP_FROM_EMAIL}>"
    msg["To"] = to_email
    msg.attach(MIMEText(html_body, "html", "utf-8"))

    try:
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=15) as server:
            server.ehlo()
            if settings.SMTP_USE_TLS:
                server.starttls()
                server.ehlo()
            server.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
            server.sendmail(settings.SMTP_FROM_EMAIL, [to_email], msg.as_string())
        logger.info("Email sent to %s — subject: %s", to_email, subject)
    except Exception:
        logger.exception("Failed to send email to %s", to_email)


def _send_async(to_email: str, subject: str, html_body: str) -> None:
    """Fire-and-forget email delivery in a daemon thread."""
    t = threading.Thread(target=_send_smtp, args=(to_email, subject, html_body), daemon=True)
    t.start()


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def send_verification_email(to_email: str, full_name: str, token: str) -> None:
    """Send an account-verification email with a signed token link."""
    verify_url = f"{settings.FRONTEND_URL}/verify-email?token={token}"
    html = _VERIFY_HTML.format(
        full_name=full_name or "there",
        verify_url=verify_url,
    )
    _send_async(to_email, _VERIFY_SUBJECT, html)


def send_password_reset_email(to_email: str, full_name: str, token: str) -> None:
    """Send a password-reset email with a signed token link."""
    reset_url = f"{settings.FRONTEND_URL}/reset-password?token={token}"
    html = _RESET_HTML.format(
        full_name=full_name or "there",
        reset_url=reset_url,
    )
    _send_async(to_email, _RESET_SUBJECT, html)
