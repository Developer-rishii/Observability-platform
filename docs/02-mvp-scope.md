# 2. MVP Scope and Feature List

## 2.1 User Roles

| Role | Access Level | Description |
|---|---|---|
| **Guest** | Public pages only | Any visitor who has not created an account. Can view marketing pages and register. |
| **Developer** | Developer Dashboard | A registered user who has (or is working toward) verified status. Can manage their profile, browse and apply to projects, and view payments. |
| **Admin** | Admin Dashboard (full access) | Internal DevBridge staff. Reviews developers, manages projects, assigns work, and records payments. In MVP there is a single Admin role with full permissions (no sub-roles). |

---

## 2.2 Complete Feature List

### 2.2.1 Authentication
- Register (email + password, developer role only — Admin accounts are seeded manually, not self-registered).
- Login with email and password.
- Email verification (a verification link/token must be confirmed before the dashboard is accessible).
- Forgot Password (request reset link by email).
- Reset Password (set a new password from a valid, time-limited reset token).
- Change Password (from within the authenticated dashboard).
- Logout.

### 2.2.2 Developer Profile
- Personal details: full name, profile picture, country, phone number, email (read-only after verification).
- Professional details: years of experience, preferred technologies, skill tags, availability status.
- Portfolio: repeatable list of past projects (title, description, link, optional image).
- Resume upload (PDF or DOCX).
- GitHub profile URL (optional).
- LinkedIn profile URL (optional).
- Profile completion percentage, calculated from required fields.

### 2.2.3 Verification Workflow
- Developer explicitly submits their profile for verification once required fields are complete.
- Verification status: **Pending, Under Review, Approved, Rejected, Changes Requested**.
- Admin can attach an internal note explaining a rejection or requested change.
- Developer is notified by email and in-app notification whenever status changes.
- Only **Approved** developers can view and apply to projects.

### 2.2.4 Developer Dashboard
- Verification status banner.
- Profile completion percentage with a link to finish incomplete sections.
- Counts and lists: Available Projects, Applied Projects, Assigned Projects, Completed Projects.
- Payment summary: total earnings, pending payments, completed payments.
- Notifications feed.

### 2.2.5 Project Module
- Project fields: title, description, budget, required technologies, timeline/deadline, status, client requirements document(s), attachments.
- Project status values: **Open, Assigned, In Progress, Review, Completed**.
- Developers can view open project details, apply with an optional note, and withdraw a pending application.
- Admin can create, edit, and close projects; review applicants; and assign a project to one developer.

### 2.2.6 Admin Dashboard
- View, search, and filter all developers (by status, skill, availability, country).
- Open a full developer detail view (profile + documents + verification history).
- Approve, reject, or request changes on a developer profile, with notes.
- Edit a developer profile directly (for corrections).
- Create, edit, and manage projects.
- Review applicants and assign a project to a developer.
- Update project status as work progresses.
- Manually record and manage payments per developer per project.
- Send manual notifications to one or all developers.

### 2.2.7 Payments (Manual Record-Keeping Only)
- Admin manually creates a payment record linked to a developer and a completed (or in-progress) project.
- Payment fields: amount, currency, status (Pending / Paid), date, optional note.
- Developer can view Total Earnings, Pending Payments, Completed Payments, and a full payment history table.
- **No payment gateway, escrow, or automated payout exists in MVP.**

### 2.2.8 Notifications
- System-generated notifications: Profile Approved, Profile Rejected, Changes Requested, New Project Available, Project Assigned, Payment Released.
- Admin-generated manual notifications (broadcast or targeted to one developer).
- In-app notification bell/list plus an email copy of each notification.

---

## 2.3 Explicitly Out of Scope for MVP

The following are intentionally excluded from Version 1:

- ❌ AI features of any kind (AI matching, AI resume review, AI portfolio review, AI chat).
- ❌ Premium membership or subscription plans.
- ❌ Analytics dashboards beyond the basic counts described above.
- ❌ In-app chat system or video calling.
- ❌ Community forum or social features.
- ❌ Referral program.
- ❌ Native mobile application (web responsive only).
- ❌ Enterprise features (SSO, multi-tenant admin roles, custom contracts).
- ❌ Payment gateway integration or automated payouts.
