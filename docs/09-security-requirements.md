# 9. Security Requirements

## 9.1 Authentication Security

- **Password hashing:** All passwords must be hashed using **bcrypt** with a minimum work factor of 12. Plaintext passwords must never be stored or logged.
- **JWT tokens:** Access tokens must expire after **8 hours**. Include `user_id`, `role`, and `iat` in the payload. Sign with a strong secret (`JWT_SECRET` env variable, minimum 32 characters).
- **Remember Me:** Extend token validity to 30 days if the user checks "Remember Me" at login.
- **Account lockout:** After 5 consecutive failed login attempts for the same email, lock the account for 15 minutes. Do not distinguish between "email not found" and "wrong password" in the error message.
- **Email verification required:** Users who have not verified their email must be blocked from logging in (return `403 Forbidden` with a clear message and resend link).

---

## 9.2 Token Security

- **Email verification tokens:** Generate using `crypto.randomBytes(32)` (hex-encoded), stored hashed in the DB. Expire after **24 hours**. Mark as `used_at` once consumed — a token can only be used once.
- **Password reset tokens:** Same generation method. Expire after **1 hour**. Mark as `used_at` once consumed.
- **No token reuse:** Once a token is consumed (used or expired), it must not be accepted again even if presented before deletion.

---

## 9.3 API Security

- **Role-based access control (RBAC):** Every route must verify both authentication (valid JWT) and role authorization (Developer vs Admin). A Developer must never be able to access Admin routes even with a valid JWT.
- **Input validation:** All incoming request bodies must be validated with Zod (or equivalent) before touching the database. Reject invalid input with `422` and field-level error details.
- **CORS:** Set explicit allowed origins. Do not use wildcard `*` in production.
- **Rate limiting:** Apply rate limits to all Auth endpoints, especially login (see 9.1) and forgot-password (max 3 requests per email per hour).
- **File upload validation:** Validate MIME type server-side (do not trust the client-provided `Content-Type`). Reject unsupported file types with `415`.
- **SQL injection:** Prisma's parameterized queries protect against injection. Never build raw SQL queries with string concatenation.
- **HTTP headers:** Use `helmet` middleware to set secure HTTP headers (X-Content-Type-Options, X-Frame-Options, HSTS, etc.).

---

## 9.4 File Upload Security

- Validate file type by reading the file's magic bytes (not just the extension or MIME type header).
- Sanitize file names before saving (strip special characters, path traversal sequences).
- Store uploads in a non-publicly-routable directory and serve them via a controlled route.
- Enforce file size limits at the server level (not just the client).

---

## 9.5 Audit Logging

Record an entry in the `audit_logs` table for the following actions:

| Action | entity_type | Notes |
|---|---|---|
| `USER_REGISTERED` | user | |
| `USER_LOGIN` | user | |
| `USER_LOGIN_FAILED` | user | Include IP |
| `EMAIL_VERIFIED` | user | |
| `PASSWORD_RESET_REQUESTED` | user | |
| `PASSWORD_CHANGED` | user | |
| `PROFILE_SUBMITTED` | developer_profile | |
| `VERIFICATION_STATUS_CHANGED` | developer_profile | Include note |
| `PROJECT_CREATED` | project | |
| `PROJECT_ASSIGNED` | project | Include developer_id |
| `PROJECT_STATUS_CHANGED` | project | |
| `PAYMENT_RECORDED` | payment | |
| `PAYMENT_MARKED_PAID` | payment | |
| `NOTIFICATION_SENT` | notification | |

---

## 9.6 Admin Account Security

- Admin accounts must be seeded manually via a backend script. There is no self-registration path for Admins.
- Admin login uses the same endpoint as developer login; the role is resolved server-side from the database.
- All Admin routes must be protected by `requireRole('admin')` middleware.

---

## 9.7 Data Privacy

- Developer email addresses must be treated as sensitive PII (Personally Identifiable Information).
- Profile data must not be exposed to other developers — each developer can only access their own data.
- Admin can access all developer data, but this access is logged.
- Passwords (plaintext or hashed) must never appear in API responses.
- Resume files and profile pictures must only be accessible to the developer who uploaded them and Admins.
