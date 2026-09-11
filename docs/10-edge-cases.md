# 10. Edge Cases

## 10.1 Authentication Edge Cases

| Scenario | Expected Behavior |
|---|---|
| User tries to register with an email that already exists | `409 Conflict` with inline error "An account with this email already exists." |
| User clicks an email verification link that has already been used | Show "Your email is already verified — please log in." |
| User clicks a password reset link after it has expired (1 hour) | Show "This link has expired" with a button to request a new one. |
| User tries to log in before verifying their email | `403 Forbidden` with message and option to resend verification email. |
| User requests a password reset email for an email that doesn't exist | Same success message as a real email: "If an account exists..." (security: no disclosure). |
| Admin tries to self-register via the public Register form | Not possible — `role` is hardcoded to `developer` on the register endpoint. Admins are seeded manually only. |

---

## 10.2 Profile & Verification Edge Cases

| Scenario | Expected Behavior |
|---|---|
| Developer tries to submit for verification while required fields are incomplete | Show a list of missing fields; do not change status. |
| Developer submits, Admin requests changes, Developer re-submits without editing anything | The system must allow re-submission even if no fields changed (the developer decides they were complete). |
| Developer tries to submit for verification while status is already "Under Review" or "Approved" | Block the submission with a message: "Your profile is already under review" or "Your profile has already been approved." |
| Admin tries to approve a profile without the developer having uploaded a resume | Admin can approve; the resume check is the developer's responsibility, not the Admin's. |
| Admin leaves the rejection note field blank | Block the action with inline error: "A note is required to reject or request changes." |
| Developer edits their profile after being approved | Profile can be edited without affecting Approved status (no auto-re-submission). |

---

## 10.3 Project & Application Edge Cases

| Scenario | Expected Behavior |
|---|---|
| Unapproved developer tries to view open projects | Show a locked/disabled state with message: "Unlocks once your profile is approved." |
| Developer applies to a project they've already applied to | `409 Conflict` — "You have already applied to this project." |
| Developer tries to withdraw an application after they have been assigned the project | Block withdrawal — application status is no longer 'pending'. Show an appropriate message. |
| Admin assigns a project when the developer profile is no longer available | Validate availability status before assigning; show a warning if the developer is marked "Not Available." (Non-blocking — Admin can still proceed.) |
| Admin assigns a project to a developer who has already been assigned another active project | Non-blocking — Admin sees the developer's active project count in the applicants list and can decide. No automatic block. |
| Developer applies to a project after it has been moved from Open to Assigned | `422 Unprocessable Entity` — "This project is no longer accepting applications." |
| Admin tries to move project status backward (e.g. Completed → Review) | Block — only forward transitions (and Review → In Progress for rework) are valid. |

---

## 10.4 Payment Edge Cases

| Scenario | Expected Behavior |
|---|---|
| Admin records a payment for a project that is not yet Completed | Allowed — Admin may need to record partial/advance payments on in-progress projects. |
| Admin records two payment records for the same developer + project | Allowed — multiple payments (e.g. instalments) may exist for one project. |
| Developer views payment summary before any payments exist | Show all summary cards at $0 / 0 records. Empty table with "No payment records yet." |

---

## 10.5 Notification Edge Cases

| Scenario | Expected Behavior |
|---|---|
| Admin sends a broadcast notification to "All Developers" with no approved developers yet | Still allowed — the message is stored and will be visible to all developers who log in. |
| Developer has zero notifications | Show empty state: "You're all caught up — no notifications." Do not show an empty list. |
| Notification email fails to send | Log the error server-side. The in-app notification is still created. Do not block the triggering action (e.g. approval) just because the email failed. |

---

## 10.6 File Upload Edge Cases

| Scenario | Expected Behavior |
|---|---|
| User uploads a file with a valid extension but wrong MIME type (e.g. .jpg file that is actually a PDF) | Reject with `415 Unsupported Media Type` — validate by magic bytes, not extension. |
| User uploads a file larger than the limit | Reject with `413 Payload Too Large` before saving to disk. |
| Network drops mid-upload | Show an upload error state; allow the user to retry. Partial uploads must not be saved. |
| Developer uploads a new profile picture over their existing one | Old file must be deleted from storage after the new one is confirmed saved. |
| Developer uploads a new resume over their existing one | Same as above — replace and delete old file. |

---

## 10.7 Concurrent Action Edge Cases

| Scenario | Expected Behavior |
|---|---|
| Two Admins try to assign the same project to different developers at the same time | Use a database transaction. The first assignment succeeds; the second returns a conflict error. |
| Developer applies to a project at the same time the Admin closes/moves the project past Open | The unique constraint and status check prevent duplicate/invalid applications; return appropriate error. |
