# 7. API Documentation

> All endpoints are prefixed with `/api/v1`.
> Authenticated endpoints require a valid JWT in the `Authorization` header (`Bearer token`).
> All responses use JSON.
> All list endpoints support pagination via `?page=` and `?limit=` query parameters.

---

## 7.1 Authentication Module

### POST /auth/register
**Auth required:** No

Creates a new developer account and sends a verification email.

**Request Body:**
- `full_name` (string, required)
- `email` (string, required)
- `password` (string, required)

**Response:** `201 Created`
```json
{ "id": "...", "email": "...", "role": "developer", "email_verified": false }
```

**Error Responses:**
- `409 Conflict` — email already registered
- `422 Unprocessable Entity` — validation failed, field-level errors returned

---

### POST /auth/verify-email
**Auth required:** No

**Request Body:**
- `token` (string, required)

**Response:** `200 OK`
```json
{ "message": "Email verified" }
```

**Error Responses:**
- `400 Bad Request` — invalid token
- `410 Gone` — token expired

---

### POST /auth/resend-verification
**Auth required:** No

**Request Body:**
- `email` (string, required)

**Response:** `200 OK`
```json
{ "message": "Verification email sent" }
```

**Error Responses:**
- `429 Too Many Requests` — resend attempted too soon

---

### POST /auth/login
**Auth required:** No

**Request Body:**
- `email` (string, required)
- `password` (string, required)

**Response:** `200 OK`
```json
{ "token": "...", "user": { "id": "...", "email": "...", "role": "..." } }
```

**Error Responses:**
- `401 Unauthorized` — incorrect email or password
- `403 Forbidden` — email not verified
- `423 Locked` — too many failed attempts

---

### POST /auth/forgot-password
**Auth required:** No

**Request Body:**
- `email` (string, required)

**Response:** `200 OK`
```json
{ "message": "If an account exists, a reset link has been sent" }
```

---

### POST /auth/reset-password
**Auth required:** No

**Request Body:**
- `token` (string, required)
- `new_password` (string, required)

**Response:** `200 OK`
```json
{ "message": "Password updated" }
```

**Error Responses:**
- `400 Bad Request` — invalid token
- `410 Gone` — token expired

---

### POST /auth/change-password
**Auth required:** Yes (Developer or Admin)

**Request Body:**
- `current_password` (string, required)
- `new_password` (string, required)

**Response:** `200 OK`
```json
{ "message": "Password changed" }
```

**Error Responses:**
- `401 Unauthorized` — current password incorrect

---

### POST /auth/logout
**Auth required:** Yes

**Response:** `200 OK`
```json
{ "message": "Logged out" }
```

---

## 7.2 Developer Profile Module

### GET /developer/profile
**Auth required:** Yes (Developer)

Fetches the logged-in developer's own profile.

**Response:** `200 OK` — full profile object including skills, technologies, portfolio items

**Error Responses:**
- `404 Not Found` — profile not yet created

---

### PUT /developer/profile
**Auth required:** Yes (Developer)

**Request Body:**
- `full_name`, `country`, `phone_number`, `years_of_experience`, `availability_status`
- `github_url` (optional), `linkedin_url` (optional)
- `skills` (array), `technologies` (array)

**Response:** `200 OK` — updated profile object with recalculated `profile_completion_percent`

**Error Responses:**
- `422 Unprocessable Entity` — field-level validation errors

---

### POST /developer/profile/picture
**Auth required:** Yes (Developer)

**Request Body:** `multipart/form-data: file`

**Response:** `200 OK`
```json
{ "profile_picture_url": "..." }
```

**Validation:** JPG/PNG only, max 5 MB

**Error Responses:**
- `413 Payload Too Large`
- `415 Unsupported Media Type`

---

### POST /developer/resume
**Auth required:** Yes (Developer)

**Request Body:** `multipart/form-data: file`

**Response:** `200 OK`
```json
{ "resume_url": "...", "resume_uploaded_at": "..." }
```

**Validation:** PDF or DOCX only, max 10 MB

**Error Responses:**
- `413 Payload Too Large`
- `415 Unsupported Media Type`

---

### POST /developer/portfolio
**Auth required:** Yes (Developer)

**Request Body:**
- `title`, `description`, `project_link` (optional), `image` (optional file)

**Response:** `201 Created` — portfolio item object

**Error Responses:**
- `422 Unprocessable Entity`

---

### PUT /developer/portfolio/{id}
**Auth required:** Yes (Developer, owner only)

**Response:** `200 OK` — updated portfolio item

**Error Responses:**
- `403 Forbidden` — not the owner
- `404 Not Found`

---

### DELETE /developer/portfolio/{id}
**Auth required:** Yes (Developer, owner only)

**Response:** `204 No Content`

**Error Responses:**
- `403 Forbidden` — not the owner
- `404 Not Found`

---

### POST /developer/profile/submit
**Auth required:** Yes (Developer)

Submits the profile for verification (moves status to Pending).

**Response:** `200 OK`
```json
{ "verification_status": "pending" }
```

**Error Responses:**
- `422 Unprocessable Entity` — `{ "missing_fields": [...] }`

---

## 7.3 Project Module

### GET /projects
**Auth required:** Yes (Developer, must be Approved)

Lists Open projects. Supports `?technology=` filter.

**Response:** `200 OK` — paginated list of project summaries

**Error Responses:**
- `403 Forbidden` — developer not yet approved

---

### GET /projects/{id}
**Auth required:** Yes (Developer or Admin)

**Response:** `200 OK` — full project object with technologies and attachments

**Error Responses:**
- `404 Not Found`

---

### POST /projects/{id}/apply
**Auth required:** Yes (Developer, must be Approved)

**Request Body:**
- `note` (string, optional, max 500 chars)

**Response:** `201 Created` — application object

**Error Responses:**
- `409 Conflict` — already applied
- `422 Unprocessable Entity` — project not in Open status

---

### DELETE /projects/{id}/apply
**Auth required:** Yes (Developer, owner only)

Withdraws a pending application.

**Response:** `200 OK`
```json
{ "message": "Application withdrawn" }
```

**Error Responses:**
- `404 Not Found` — no application found
- `422 Unprocessable Entity` — application cannot be withdrawn (already assigned)

---

### GET /developer/applications
**Auth required:** Yes (Developer)

**Response:** `200 OK` — list of developer's applications with project info and status

---

## 7.4 Admin — Developer Management

### GET /admin/developers
**Auth required:** Yes (Admin)

Supports filters: `?status=`, `?availability=`, `?country=`, `?skill=`, `?search=`

**Response:** `200 OK` — paginated list

---

### GET /admin/developers/{id}
**Auth required:** Yes (Admin)

**Response:** `200 OK` — full developer profile + verification history

---

### PATCH /admin/developers/{id}/verify
**Auth required:** Yes (Admin)

**Request Body:**
- `action` (string: 'approve' | 'reject' | 'request_changes')
- `note` (string, required for reject/request_changes, min 10 chars)

**Response:** `200 OK`
```json
{ "verification_status": "approved" }
```

**Error Responses:**
- `422 Unprocessable Entity` — note missing for rejection

---

### PUT /admin/developers/{id}
**Auth required:** Yes (Admin)

Admin edit of a developer profile (same fields as developer PUT profile).

**Response:** `200 OK` — updated profile

---

### GET /admin/verification-queue
**Auth required:** Yes (Admin)

Returns only Pending and Under Review profiles, ordered by submission date (oldest first).

**Response:** `200 OK` — list

---

## 7.5 Admin — Project Management

### GET /admin/projects
**Auth required:** Yes (Admin)

Supports filters: `?status=`, `?technology=`

**Response:** `200 OK` — paginated list

---

### POST /admin/projects
**Auth required:** Yes (Admin)

**Request Body:**
- `title`, `description`, `budget_amount`, `budget_currency`, `timeline_deadline`
- `technologies` (array)
- `attachments` (multipart files, optional)

**Response:** `201 Created` — project object

---

### PUT /admin/projects/{id}
**Auth required:** Yes (Admin)

**Response:** `200 OK` — updated project

---

### PATCH /admin/projects/{id}/status
**Auth required:** Yes (Admin)

**Request Body:**
- `status` (string: valid next state only)

**Response:** `200 OK`
```json
{ "status": "in_progress" }
```

**Error Responses:**
- `422 Unprocessable Entity` — invalid status transition

---

### GET /admin/projects/{id}/applicants
**Auth required:** Yes (Admin)

**Response:** `200 OK` — list of applications with developer summary

---

### POST /admin/projects/{id}/assign
**Auth required:** Yes (Admin)

**Request Body:**
- `developer_profile_id` (UUID)

**Response:** `200 OK`
```json
{ "message": "Developer assigned", "status": "assigned" }
```

---

## 7.6 Admin — Payments

### GET /admin/payments
**Auth required:** Yes (Admin)

**Response:** `200 OK` — paginated list

---

### POST /admin/payments
**Auth required:** Yes (Admin)

**Request Body:**
- `developer_profile_id`, `project_id`, `amount`, `currency`, `status`, `note` (optional), `payment_date` (optional)

**Response:** `201 Created` — payment record

---

### PATCH /admin/payments/{id}
**Auth required:** Yes (Admin)

**Request Body:** any subset of payment fields

**Response:** `200 OK` — updated payment record

---

## 7.7 Notifications

### GET /developer/notifications
**Auth required:** Yes (Developer)

**Response:** `200 OK` — paginated list of notifications

---

### PATCH /developer/notifications/read-all
**Auth required:** Yes (Developer)

Marks all notifications as read.

**Response:** `200 OK`

---

### POST /admin/notifications/send
**Auth required:** Yes (Admin)

**Request Body:**
- `developer_profile_id` (UUID, optional — if omitted, broadcasts to all)
- `message` (string, required, 5–500 chars)

**Response:** `201 Created`
```json
{ "message": "Notification sent" }
```

---

## 7.8 General Error Format

All error responses follow this structure:

```json
{
  "error": "Human-readable error message",
  "code": "MACHINE_READABLE_CODE",
  "fields": {
    "email": "Email is already registered"
  }
}
```

> `fields` is only present on `422` validation errors.
