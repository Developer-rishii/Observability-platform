# DevBridge Network — 10-Day Sprint Plan (Phase 1)

## Project Overview
**Product:** DevBridge Network — Private Developer Network Platform
**Phase Scope:** End-to-end loop: Developer Registration → Verification Queue → Project Assignment → Payment Tracking.
**Build Team:**
- **Rushi Borkar** → Developer Track (All developer dashboard screens, profile forms, search, notifications, payments view, and their backend integrations).
- **Rushikesh** → Admin Track (Admin dashboard metrics, verification queue details, project posting/assigning, payments management, and security/audit logging backend).
**Duration:** 10 Working Days (2 Weeks)
**Status:** Approved v2.0 (Condensed 10-Day Plan)

---

## Technical Stack & Architecture

### Backend Architecture
- **Language/Framework:** Node.js + Express.js + TypeScript
- **Database / ORM:** PostgreSQL + Prisma ORM
- **Directory Structure:**
```
/backend/src/
├── config/              # Database pool config, environment checks
├── controllers/         # Request handling logic (auth, profile, project, admin)
├── routes/              # Express routing definitions mapping controllers
├── middleware/          # Security (helmet, cors, rate-limit), auth check, file upload
├── services/            # Transactional helpers (email, notifications, audit log)
├── validators/          # Zod schema definitions for request bodies
└── app.ts               # Core app config and server start script
```

### Frontend Feature-Driven Architecture (React)
Files are grouped by **domain feature + user role**. This makes it instantly clear which features belong to Admin and which belong to Developer. Auth is kept common since both roles share it.
```
/frontend/src/
├── assets/              # Static branding files, logos, images
├── components/          # Shared atomic components (Button, Input, Spinner, Modal, Card, Toast)
├── context/             # Global contexts (AuthContext.tsx, ThemeContext.tsx)
├── hooks/               # Custom hooks (useFetch.ts, useToast.ts)
├── layouts/             # Shared dashboard layouts (AdminLayout.tsx, DeveloperLayout.tsx, PublicLayout.tsx)
├── routes/              # Route config and guards (AppRoutes.tsx, PrivateRoute.tsx)
├── theme/               # Centralized design tokens (colors.ts, index.ts)
├── features/
│   ├── auth/            # ── COMMON (both roles) ──────────────────────────────
│   │   └── pages/       #   LoginPage, RegisterPage, ForgotPasswordPage,
│   │                    #   ResetPasswordPage, VerifyEmailPage
│   │
│   ├── public/          # ── PUBLIC (unauthenticated visitors) ───────────────
│   │   └── pages/       #   LandingPage, AboutPage, BenefitsPage, ContactPage,
│   │                    #   PrivacyPage, TermsPage, NotFoundPage
│   │
│   ├── admin/           # ── ADMIN ROLE ONLY (/admin/* routes) ───────────────
│   │   ├── dashboard/
│   │   │   └── pages/   #   AdminDashboardPage
│   │   ├── developers/
│   │   │   └── pages/   #   DevelopersListPage, DeveloperDetailPage
│   │   ├── projects/
│   │   │   └── pages/   #   AdminProjectsPage, ProjectApplicantsPage
│   │   ├── payments/
│   │   │   └── pages/   #   AdminPaymentsPage
│   │   ├── notifications/
│   │   │   └── pages/   #   SendNotificationPage
│   │   └── verification/
│   │       ├── pages/   #   VerificationQueuePage
│   │       └── components/ # VerificationModal
│   │
│   └── developer/       # ── DEVELOPER ROLE ONLY (/developer/* routes) ───────
│       ├── dashboard/
│       │   └── pages/   #   DashboardHomePage, OnboardingPage
│       ├── profile/
│       │   ├── pages/   #   ProfileWizardPage
│       │   └── components/ # WizardStep1PersonalInfo, WizardStep2Professional,
│       │                   # WizardStep3Portfolio, WizardStep4Resume
│       ├── projects/
│       │   └── pages/   #   ProjectsListPage, ProjectDetailPage,
│       │                #   MyApplicationsPage, ActiveProjectsPage
│       ├── payments/
│       │   └── pages/   #   (Developer earnings view — coming in Sprint 2)
│       ├── notifications/
│       │   └── pages/   #   NotificationsPage
│       └── settings/
│           └── pages/   #   AccountSettingsPage
└── index.css            # Global CSS system, design tokens, DM Sans typography
```


---

# Day-by-Day Implementation Plan

---

## DAY 1 · Project Initializations & Relational Database Migration

**Goal:** Create directories, initialize base config files, set up Prisma ORM, run initial DB migration, seed Admin user, and establish Vite frontend with custom CSS variable tokens.

### Rushi Borkar · Developer Track
- **Setup Frontend Repo:** Initialize react app in `/frontend` using Vite TypeScript template. Install `react-router-dom`, `axios`, and `lucide-react`.
- **Implement Global CSS System:** Update `/frontend/src/index.css` with the visual design system tokens (colors, typography, transitions):
  ```css
  :root {
    --bg-primary: #0A0A0F;
    --bg-card: #12121A;
    --bg-elevated: #181824;
    --border: #232333;
    --accent-blue: #3B82F6;
    --accent-purple: #8B5CF6;
    --accent-gradient: linear-gradient(135deg, var(--accent-blue), var(--accent-purple));
    --text-primary: #F3F4F6;
    --text-secondary: #9CA3AF;
    --text-muted: #6B7280;
    --success: #10B981;
    --warning: #F59E0B;
    --error: #EF4444;
  }
  ```
- **Shared Components:** Create base wrapper layouts `/frontend/src/components/` for `Button.tsx`, `Input.tsx`, and standard layout skeletons. Add a test page with route `/` rendering basic layouts.

### Rushikesh · Admin Track
- **Setup Backend Repo:** Create `/backend/` directory. Run `npm init -y`. Install standard backend dependencies: Express, TypeScript, ts-node-dev, CORS, helmet, Prisma, jsonwebtoken, bcrypt, zod, nodemailer, dotenv, multer. Configure `tsconfig.json`.
- **Database Schema Definition:** Write `/backend/prisma/schema.prisma` mapping out all models: `User`, `EmailVerificationToken`, `PasswordResetToken`, `DeveloperProfile`, `DeveloperSkill`, `DeveloperTechnology`, `PortfolioItem`, `VerificationHistory`, `Project`, `ProjectTechnology`, `ProjectAttachment`, `ProjectApplication`, `Payment`, `Notification`, `AuditLog`.
- **Run DB Migration & Seed:** Run `npx prisma migrate dev --name init` and generate prisma client. Create `/backend/prisma/seed.ts` to automatically populate the primary Admin account (`admin@devbridge.com`) with a password hashed via bcrypt.
- **Express Base Setup:** Write `/backend/src/app.ts` importing helmet, cors, express json parsers. Setup `GET /health` responding with status `ok` and server time.

**Acceptance Bar (Day 1):**
- [ ] Backend runs on `localhost:4000` and `/health` returns status `200`.
- [ ] Database contains all 15 tables with correct schema. Admin seed user row exists.
- [ ] Frontend boots on `localhost:5173` rendering the brand theme correctly.

---

## DAY 2 · User Authentication & Access Boundaries (API)

**Goal:** Implement registration, login, email verification, password resets, role-checking middleware, and local rate-limiters.

### Rushi Borkar · Developer Track
- **Registration Controller:** Write `POST /api/v1/auth/register` in `/backend/src/routes/authRoutes.ts`. Validate input fields using Zod validator `/backend/src/validators/authSchema.ts`. Hash pass with bcrypt (work factor 12). Create `User` row (default role `developer`), generate token, insert in `EmailVerificationToken`.
- **Login Controller:** Write `POST /api/v1/auth/login`. Verify pass, confirm `email_verified` is true, generate standard JWT (duration 8 hours) with fields `{ id, email, role }`. Return generic `401 Unauthorized` for all failed checks.
- **Email Verification:** Build `POST /api/v1/auth/verify-email`. Accept verification token. Match against active token in database, check expiration, set user status, and mark token as used.
- **Email Service Config:** Build `/backend/src/services/emailService.ts` wrapping nodemailer config. Setup HTML email templates (`email_verification.html`).

### Rushikesh · Admin Track
- **JWT Authorization Middleware:** Write `/backend/src/middleware/auth.ts` containing the `requireAuth` function. Extract bearer token, verify signatures, load basic user details, and assign `req.user`.
- **Role Verification Middleware:** Build `/backend/src/middleware/roleCheck.ts` containing `requireRole(role)`. Checks `req.user.role` matches request destination. Rejects with `403 Forbidden` if role is invalid.
- **Forgot & Reset Password Controller:** Build `POST /api/v1/auth/forgot-password` (sends link + token via email) and `POST /api/v1/auth/reset-password` (validates reset token, updates password hash).
- **Authentication Safeguards:** Add `express-rate-limit` middleware config to sensitive endpoints: login (max 5 per IP per 15 min), forgot password (max 3 per email per hour). Create protected endpoint `GET /api/v1/admin/ping` for verification.

**Acceptance Bar (Day 2):**
- [ ] Register creates a User row and sends verification email. Login returns signed JWT.
- [ ] Verification tokens expire and can only be used once.
- [ ] Calling `/admin/ping` with a developer credentials token returns `403 Forbidden`.

---

## DAY 3 · Profile CRUD API (Backend) + Auth UI (Frontend)

**Goal:** Write developer profile endpoints, onboarding submission validators, and frontend authentication flow screens.

### Rushi Borkar · Developer Track
- **Developer Profile Endpoints:** Write `GET /api/v1/developer/profile` and `PUT /api/v1/developer/profile` in `/backend/src/routes/developerRoutes.ts`. Verify profile ownership. `PUT` should upsert profile fields and rebuild relation arrays (`DeveloperSkill`, `DeveloperTechnology`).
- **Onboarding Submit API:** Create `POST /api/v1/developer/profile/submit`. Validate completeness: checks for `full_name`, `country`, `phone_number`, `years_of_experience`, minimum 3 skills, minimum 1 technology, and a uploaded resume link. If checks fail, return `422 Unprocessable Entity` with a list of missing fields.
- **Auth Context Setup:** Write `/frontend/src/context/AuthContext.tsx`. Track login state, save JWT, and build axios request interceptors to auto-attach headers.
- **Onboarding/Auth UI Pages:** Build frontend screens `/frontend/src/features/auth/pages/`: `LoginPage.tsx`, `RegisterPage.tsx`, `ForgotPasswordPage.tsx`, `ResetPasswordPage.tsx`, `VerifyEmailPage.tsx`.

### Rushikesh · Admin Track
- **Developers Management API:** Create `GET /api/v1/admin/developers` (paginated list, supports filters: `status`, `availability`, `search` by name/email).
- **Developer Inspect API:** Build `GET /api/v1/admin/developers/:id`. Return full developer snapshot, portfolio list, experience entries, and historical verification status changes.
- **Verification Decider API:** Build `PATCH /api/v1/admin/developers/:id/verify`. Approve, reject, or request changes. Require a decision reason note (minimum 10 characters) if status is set to rejected or changes requested. Save status events into the `VerificationHistory` table.
- **Verification Queue API:** Build `GET /api/v1/admin/verification-queue` returning pending profiles sorted by submission timestamp.

**Acceptance Bar (Day 3):**
- [ ] Complete registration, login, and verify flow runs in the browser.
- [ ] Unauthenticated router access is blocked and redirects to `/login`.
- [ ] Verification state API successfully handles transitions: Approved, Rejected, Changes Requested.

---

## DAY 4 · File Handling, Portfolio CRUD & Notifications API

**Goal:** Setup local file storage, profile image and PDF resume uploaders, and transactional notifications.

### Rushi Borkar · Developer Track
- **File Upload Configuration:** Create `/backend/src/middleware/upload.ts` using Multer. Set upload limits and write validation checks for file types (JPEG/PNG only for images, PDF/DOCX for resumes).
- **MIME Type Magic Byte Verification:** Build verification checking file signatures/magic bytes to prevent upload of disguised executable files.
- **Profile Image & Resume API:** Write `POST /api/v1/developer/profile/picture` and `POST /api/v1/developer/resume`. Handle uploads, delete old files from disk if replaced, and update database fields.
- **Portfolio CRUD:** Write routes for `POST`, `PUT`, `DELETE` under `/api/v1/developer/portfolio` checking user permissions on edit.

### Rushikesh · Admin Track
- **Notification Services:** Write `/backend/src/services/notificationService.ts` exporting `createNotification(developer_profile_id, type, message)`.
- **Verification Alerts integration:** Wire this service into verification decider controllers. Triggers email delivery alongside the in-app notification when statuses change.
- **In-App Notifications Feed:** Write API `GET /api/v1/developer/notifications` returning paginated user alerts. Build `PATCH /api/v1/developer/notifications/read-all` to clear read state.
- **Manual Alerts Sender:** Build `POST /api/v1/admin/notifications/send` to allow admin direct targeted messaging or broadcast messages to all approved developers.
- **Security Audit Logger:** Create `/backend/src/services/auditService.ts`. Log user logins, status modifications, profile changes, and transaction actions to the `AuditLog` table.

**Acceptance Bar (Day 4):**
- [ ] Rejects invalid file types (e.g. `.exe` disguised as `.jpg`) during magic byte tests.
- [ ] Portfolio items can be added, updated, and deleted successfully.
- [ ] Admin verification updates produce real database notifications and mock email alerts.

---

## DAY 5 · Projects & Applications Lifecycle (API)

**Goal:** Implement project postings, developer applications list, and assignment state machines.

### Rushi Borkar · Developer Track
- **Dev Browse Projects API:** Write `GET /api/v1/projects`. Limit to verified and approved developers. Only show projects with status `open`. Supports filtering by technology.
- **Project Detail Lookup:** Write `GET /api/v1/projects/:id`. Show project information, attachments, and application status.
- **Project Apply API:** Create `POST /api/v1/projects/:id/apply`. Guard: verify project is `open`, check that developer is approved, check that developer hasn't applied yet. Record new application row with status `pending`.
- **Withdraw API:** Build `DELETE /api/v1/projects/:id/apply` permitting developer application withdrawal only while application status is `pending`.

### Rushikesh · Admin Track
- **Project CRUD API:** Build `POST /api/v1/admin/projects` (accepts title, details, budget, technology tag lists, deadline, attachments), `PUT /api/v1/admin/projects/:id`, and `GET /api/v1/admin/projects`.
- **Project Lifecycle State API:** Build `PATCH /api/v1/admin/projects/:id/status`. Validate status machine transitions: `open` → `assigned` → `in_progress` → `review` → `completed`. If transition violates standard state flow, return `422`.
- **Review Applicants & Assign:** Build `GET /api/v1/admin/projects/:id/applicants`. Build `POST /api/v1/admin/projects/:id/assign` accepting developer ID. Set chosen developer status to `assigned`, mark other developers' applications status to `not_selected`, set project status to `assigned`.

**Acceptance Bar (Day 5):**
- [ ] Unverified developer is blocked from viewing projects with `403`.
- [ ] Apply attempts on already applied or closed projects fail with correct error responses.
- [ ] Project assignment triggers alerts for selected and not selected developers.

---

## DAY 6 · Payments API & Developer Dashboard Frontend Layouts

**Goal:** Create payment records API, developer profile form wizards, and local state controllers.

### Rushi Borkar · Developer Track
- **Developer Onboarding Wizard:** Create `/frontend/src/features/profile/pages/ProfileWizardPage.tsx` using Feature-driven structure. Multi-step profile form:
  - Step 1: Personal Info (Full Name, Phone, Location, Portfolio Link).
  - Step 2: Professional Details (Experience years, Tech Stack chip tags input, Skills selection).
  - Step 3: Portfolio Repeater Form (Portfolio items addition).
  - Step 4: Resume Uploader UI (Drag and drop PDF upload with progress bars).
- **Dashboard Layout Layouts:** Build `/frontend/src/layouts/DeveloperLayout.tsx` showing sidebar links, notifications indicator, and account options. Add hamburger collapse for smaller viewports.
- **Developer Dashboard Home:** Create `DashboardHomePage.tsx`. Display status banner, profile progress bars, notifications list, and project lists.

### Rushikesh · Admin Track
- **Admin Payments API:** Build `GET /api/v1/admin/payments` (lists payments, filters: `developer_id`, `project_id`, `status`). Build `POST /api/v1/admin/payments` to record payment lines.
- **Developer Payments Lookup:** Build `GET /api/v1/developer/payments` returning developer payment lists.
- **Payment Update API:** Build `PATCH /api/v1/admin/payments/:id` to mark payments as paid. On update, trigger transaction notifications.

**Acceptance Bar (Day 6):**
- [ ] Developer profile updates persist to database.
- [ ] Completion progress bars dynamically calculate completion percentage based on profile fields.
- [ ] Admin payments API can create, read, and update payments correctly.

---

## DAY 7 · Developer Project Browser & Admin Review Panel UI

**Goal:** Build list screens, filter cards, applicant selection details, and status control forms in the UI.

### Rushi Borkar · Developer Track
- **Project Search UI:** Create `/frontend/src/features/projects/pages/ProjectsListPage.tsx`. Implement search bar inputs, technology chip selection selectors, and list rendering.
- **Project Detail Page:** Build `ProjectDetailPage.tsx` showing project data. Implement apply button triggering application notes dialog.
- **My Applications Tracker:** Build `MyApplicationsPage.tsx`. Tab selectors showing: Applied, Active, and Completed projects. Include withdraw button (confirm box required).
- **Active Projects & Payments UI:** Create `ActiveProjectsPage.tsx` and `DeveloperPaymentsPage.tsx` with summary cards (Total Earned, Pending, Paid) and tables.

### Rushikesh · Admin Track
- **Admin Dashboard Shell:** Build `/frontend/src/layouts/AdminLayout.tsx` using red/slate accent theme. Add dashboard home `/frontend/src/features/dashboard/pages/AdminDashboardPage.tsx` with live metric widgets.
- **Verification Queue UI:** Build `/frontend/src/features/verification/pages/VerificationQueuePage.tsx` displaying pending applications.
- **Review Developer Detail UI:** Build `DeveloperDetailPage.tsx` showing full profile details. Add a modal overlay dialog to review resumes and handle Verification controls (Approve, Reject, Changes Requested) with note field inputs.

**Acceptance Bar (Day 7):**
- [ ] Complete browse, filter, detail, and apply flow runs on frontend.
- [ ] Admin dashboard renders live metrics from database.
- [ ] Admin can approve or request changes on pending profiles with inputs validation.

---

## DAY 8 · Admin Project Management, Application Review & Payments UI

**Goal:** Build admin interfaces for projects CRUD, applicant selection, manual notifications, and payment tracking.

### Rushi Borkar · Developer Track
- **In-App Notifications Viewer:** Build `/frontend/src/features/notifications/pages/NotificationsPage.tsx` displaying notifications feed with mark-as-read controls.
- **Settings Screen:** Build `AccountSettingsPage.tsx` with password modification forms.
- **UX Loaders:** Implement skeletons loading views on all list loaders.

### Rushikesh · Admin Track
- **Admin Projects List UI:** Create `/frontend/src/features/projects/pages/AdminProjectsPage.tsx` listing all projects. Add "Create Project" forms.
- **Review Candidates & Assign UI:** Build `/frontend/src/features/projects/pages/ProjectApplicantsPage.tsx`. Table of applicants showing skill tags. Add "Assign Developer" controls with popups.
- **Payment Operations UI:** Create `/frontend/src/features/payments/pages/AdminPaymentsPage.tsx` showing payments lists and "Record Payment" dialog forms.

**Acceptance Bar (Day 8):**
- [ ] Admin can successfully create a project, upload project files, and assign candidate.
- [ ] Admin can create payment transactions and set status to Paid.
- [ ] Skeletons load appropriately.

---

## DAY 9 · Public Marketing Web Pages, Alert Banners & Responsiveness

**Goal:** Create public marketing pages, handle system empty/error states, and audit responsive views.

### Rushi Borkar · Developer Track
- **Public Core Pages:** Build `/frontend/src/features/public/pages/`: `LandingPage.tsx` (brand hero section, how it works widgets, CTA link to registration), `AboutPage.tsx`, `BenefitsPage.tsx`, `ContactPage.tsx` (validation contact forms), `PrivacyPage.tsx`, `TermsPage.tsx`, `NotFoundPage.tsx`.
- **Public & Vetted Navbars:** Design header navigation routes matching user auth roles.

### Rushikesh · Admin Track
- **Admin Send Notifications UI:** Create `/frontend/src/features/notifications/pages/SendNotificationPage.tsx` to build custom announcements and developer group messages.
- **Developers Manager UI:** Build `/frontend/src/features/developers/pages/DevelopersListPage.tsx` with search fields.
- **Global Error Handling:** Add global toast alert layouts. Ensure empty tables show illustrative placeholders instead of blank spaces.
- **Responsive Layout Auditing:** Optimize views for mobile (375px), tablet (768px), and desktop (1280px).

**Acceptance Bar (Day 9):**
- [ ] All public marketing pages are readable on mobile and desktop.
- [ ] Contact form validates inputs and displays success status message.
- [ ] List views show empty states.

---

## DAY 10 · Security Audits, Docker Setup & Final Deploys

**Goal:** Test security constraints, build Docker images, configure VPS, run deployments, and tag git versions.

### Rushi Borkar · Developer Track
- **Security Check:** Validate that routes check authorization profiles. Perform token tests verifying developers cannot access admin routes or edit other developer records.
- **Test Lockouts & Limits:** Verify that failed logins lock accounts, and APIs enforce rate limit blocks.
- **Frontend Build Verification:** Run production build scripts locally:
  ```bash
  cd frontend && npm run build
  ```
  Verify the output files compile clean with zero TypeScript compilation warnings.

### Rushikesh · Admin Track
- **Docker Integration Setup:** Write `/backend/Dockerfile` (TypeScript compilation multi-stage build config). Write `/docker-compose.yml` to bundle PostgreSQL database and backend API.
- **Production Server Config:** Install Docker on VPS. Clone repositories, write production `.env` config with distinct JWT secret keys.
- **Database Migrations on Production:** Run Prisma deploy scripts:
  ```bash
  docker compose run --rm backend npx prisma migrate deploy
  docker compose run --rm backend npx ts-node prisma/seed.ts
  ```
- **Deployment:** Start docker services on production port. Run smoke checks. Tag repo commit as `phase-1-launch` on `dev` and merge into stable `production` branch.

**Acceptance Bar (Day 10):**
- [ ] Local dev compose starts services successfully.
- [ ] Deploy server operates over HTTPS with active routes.
- [ ] Verification tests show security boundaries prevent token authorization leaks.

---

## Developer Checklists & Runbooks

### Runbook for Rushi Borkar (Developer Side)
1. Branch out from `dev`: `git checkout -b feature/developer-<feature-name>`.
2. Keep UI layouts matching design variables inside `/frontend/src/index.css`.
3. Use axios client interceptors to communicate with APIs.
4. Verify TS builds using command `npm run type-check`.

### Runbook for Rushikesh (Admin Side)
1. Branch out from `dev`: `git checkout -b feature/admin-<feature-name>`.
2. Set audit logs in all modification controllers.
3. Validate request schema input fields with Zod.
4. Verify migration consistency before creating database model changes.
