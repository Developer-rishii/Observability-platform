# 11. Development Roadmap

## Overview

The MVP is broken into 7 phases. Each phase builds on the previous. The goal is a fully functional, production-ready system at the end of Phase 7.

---

## Phase 1 — Backend Foundation

**Goal:** Working server with database connected, auth fully functional.

- [ ] Initialize Node.js + Express + TypeScript project
- [ ] Setup Prisma ORM and connect to PostgreSQL
- [ ] Write full `schema.prisma` with all 16 tables
- [ ] Run initial migration (`prisma migrate dev`)
- [ ] Seed Admin user via a seed script
- [ ] Implement Auth routes:
  - `POST /auth/register`
  - `POST /auth/verify-email`
  - `POST /auth/resend-verification`
  - `POST /auth/login`
  - `POST /auth/forgot-password`
  - `POST /auth/reset-password`
  - `POST /auth/change-password`
  - `POST /auth/logout`
- [ ] Setup Nodemailer for transactional emails (verification, reset)
- [ ] JWT middleware (`requireAuth`, `requireRole`)
- [ ] Setup `helmet`, `cors`, `express-rate-limit`
- [ ] Audit log service (write to `audit_logs` table)
- [ ] Basic health check endpoint

**Deliverable:** Fully tested Auth API (can be tested via Postman/Insomnia).

---

## Phase 2 — Developer Profile APIs

**Goal:** Developer can manage their complete profile and submit for verification.

- [ ] `GET /developer/profile`
- [ ] `PUT /developer/profile`
- [ ] `POST /developer/profile/picture` (Multer upload)
- [ ] `POST /developer/resume` (Multer upload)
- [ ] Portfolio CRUD: `POST`, `PUT`, `DELETE /developer/portfolio/{id}`
- [ ] `POST /developer/profile/submit` (submit for verification)
- [ ] Profile completion percentage calculation logic
- [ ] Developer can only see their own data (RBAC check)

**Deliverable:** Developer can create, update, and submit their full profile via API.

---

## Phase 3 — Admin + Projects APIs

**Goal:** Admin can manage developers, projects, payments, and send notifications.

- [ ] `GET /admin/developers` (with filters + pagination)
- [ ] `GET /admin/developers/{id}`
- [ ] `PATCH /admin/developers/{id}/verify` (approve/reject/request changes)
- [ ] `PUT /admin/developers/{id}` (admin edit)
- [ ] `GET /admin/verification-queue`
- [ ] `GET|POST /admin/projects`
- [ ] `PUT /admin/projects/{id}`
- [ ] `PATCH /admin/projects/{id}/status`
- [ ] `GET /admin/projects/{id}/applicants`
- [ ] `POST /admin/projects/{id}/assign`
- [ ] `GET|POST|PATCH /admin/payments`
- [ ] `POST /admin/notifications/send`
- [ ] Developer project endpoints: `GET /projects`, `GET /projects/{id}`, `POST /projects/{id}/apply`, `DELETE /projects/{id}/apply`
- [ ] `GET /developer/applications`
- [ ] `GET|PATCH /developer/notifications`

**Deliverable:** Full backend API complete and testable.

---

## Phase 4 — Frontend: Public Pages + Auth

**Goal:** Polished public website and working auth flows.

- [ ] Vite + React project setup
- [ ] Global CSS design system (`index.css`) with all tokens
- [ ] Shared components: `Navbar`, `Footer`, `Button`, `Input`, `Toast`
- [ ] Public pages: Landing, About, How It Works, Benefits, Contact, Privacy, Terms, 404
- [ ] Auth pages: Register, Login, Email Verify, Forgot Password, Reset Password
- [ ] `AuthContext` with JWT storage and user state
- [ ] Protected route wrapper (`PrivateRoute`, `AdminRoute`)
- [ ] Axios API client with interceptors (auth header, error handling)

**Deliverable:** Public site live and login/register working end-to-end.

---

## Phase 5 — Developer Dashboard Frontend

**Goal:** Developer can do everything from the browser.

- [ ] Dashboard layout with sidebar + main content area
- [ ] Dashboard Home: status banner, completion bar, summary cards, recent notifications
- [ ] Profile page: all fields, save, submit for verification
- [ ] Portfolio page: add/edit/delete portfolio items
- [ ] Resume upload with progress indicator
- [ ] Browse Projects list with filters
- [ ] Project Detail page with apply/withdraw
- [ ] My Applications page
- [ ] Active/Assigned Projects page
- [ ] Completed Projects page
- [ ] Payments page with summary cards + history table
- [ ] Notifications page with mark-all-read
- [ ] Account Settings (change password)

**Deliverable:** Developer can do everything from the browser — no Postman needed.

---

## Phase 6 — Admin Dashboard Frontend

**Goal:** Admin can operate the entire platform from the browser.

- [ ] Admin dashboard layout (separate sidebar and color accent)
- [ ] Admin Dashboard Home: summary cards + activity feed
- [ ] Developers List with search + filters
- [ ] Developer Detail page: full profile view + approve/reject/request changes
- [ ] Verification Queue page
- [ ] Projects List with filters
- [ ] Create/Edit Project page with file attachments
- [ ] Project Applicants page with Assign action
- [ ] Payments Management page: add records, mark as paid
- [ ] Send Notification page (single + broadcast)
- [ ] Admin Settings page (change password)

**Deliverable:** Admin can run the entire platform without touching a database or API client.

---

## Phase 7 — Polish, Testing & Deployment

**Goal:** Production-ready system.

- [ ] Full responsive design audit (mobile, tablet, desktop)
- [ ] Error state and empty state implementation on every page
- [ ] Loading spinners on all async actions
- [ ] Toast notification system for all user feedback
- [ ] Form validation (client-side) matching backend rules
- [ ] Cross-browser testing
- [ ] Write a `docker-compose.yml` for backend + PostgreSQL
- [ ] Environment variable documentation (`.env.example`)
- [ ] Deployment on VPS (Nginx reverse proxy + Docker)
- [ ] SSL certificate setup
- [ ] Final smoke test of all user flows

**Deliverable:** Live, production-ready platform accessible at the project domain.
