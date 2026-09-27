# Security Requirements

## Overview
This document outlines the security architecture for the Observability Platform.

## Authentication & Authorization
- **User Authentication**: Handled via JSON Web Tokens (JWT) using `python-jose`.
- **Password Storage**: Passwords are hashed using `bcrypt` before storage.
- **Roles**: Simple Developer / Admin role model. No complex RBAC beyond this unless requested.
- **Agent Authentication**: Monitoring agents authenticate their ingestion requests using a shared secret provided in headers (`AGENT_SHARED_SECRET`).

## Network Security
- **CORS**: Cross-Origin Resource Sharing is locked to the frontend origin (specified by `FRONTEND_ORIGIN` env var).
- **Rate Limiting**: To be implemented on ingestion endpoints to prevent abuse.

## Data Protection
- Hardcoded secrets are prohibited. All secrets (DB passwords, JWT keys, Gemini API keys) are managed via environment variables and loaded by `pydantic-settings`.
