# 14. Final Notes for the Development Team

## 14.1 Start Here

Read the documents in this order before writing a single line of code:

1. [01-product-overview.md](./01-product-overview.md) — Understand the product vision and who it is for.
2. [02-mvp-scope.md](./02-mvp-scope.md) — Know exactly what is and is not in scope.
3. [03-user-flows.md](./03-user-flows.md) — Understand how all the pieces connect.
4. [06-database-design.md](./06-database-design.md) — Build the schema first; everything else depends on it.
5. [07-api-documentation.md](./07-api-documentation.md) — Implement API routes to these exact specs.
6. [04-pages-public-developer.md](./04-pages-public-developer.md) and [05-pages-admin.md](./05-pages-admin.md) — Build the UI from these specs.
7. [08-ui-design-guidelines.md](./08-ui-design-guidelines.md) — Apply the design system consistently.
8. [09-security-requirements.md](./09-security-requirements.md) — Never skip security; implement as you build, not as an afterthought.
9. [10-edge-cases.md](./10-edge-cases.md) — Handle these before marking any feature complete.
10. [12-testing-checklist.md](./12-testing-checklist.md) — Check off each item before calling a phase done.
11. [13-deployment-checklist.md](./13-deployment-checklist.md) — Follow exactly when going live.

---

## 14.2 What Not to Build

The out-of-scope list in [02-mvp-scope.md](./02-mvp-scope.md) is firm. Do **not**:

- Build any AI features
- Build a payment gateway integration
- Build a chat system
- Build a mobile app
- Add sub-admin roles or multi-tenant features
- Build analytics dashboards beyond the basic summary cards defined in the Admin Dashboard

If a feature is not in this documentation, it is out of scope. Every hour spent on out-of-scope features is an hour taken from MVP completion.

---

## 14.3 Key Technical Decisions

| Decision | Choice | Reason |
|---|---|---|
| Language | TypeScript (both frontend and backend) | Type safety reduces runtime bugs |
| Frontend framework | React + Vite | Fast development, familiar ecosystem |
| Backend framework | Express.js | Lightweight, flexible, widely known |
| ORM | Prisma | Strong TypeScript integration, migration management |
| Database | PostgreSQL | Relational data, strong consistency |
| Auth | JWT (stateless) | Simple to implement, works well for SPA + API |
| File storage | Local server disk | Simplest MVP approach; no third-party dependency |
| Email | Nodemailer + SMTP | No third-party API key required; use any SMTP provider |
| Styling | Vanilla CSS with custom properties | No framework dependency, full control |
| Containerization | Docker + Docker Compose | Consistent environments, easy VPS deployment |

---

## 14.4 Naming Conventions

- **Database table names:** `snake_case`, plural (e.g. `developer_profiles`, `project_applications`)
- **Column names:** `snake_case` (e.g. `profile_picture_url`, `created_at`)
- **API route params:** `kebab-case` path segments, `snake_case` JSON keys
- **TypeScript files:** `camelCase` for variables/functions, `PascalCase` for components and types
- **React component files:** `PascalCase` (e.g. `ProfilePage.tsx`, `DashboardHome.tsx`)
- **CSS variables:** `--kebab-case` (e.g. `--bg-primary`, `--accent-blue`)

---

## 14.5 API Response Conventions

- All timestamps returned as ISO 8601 strings (e.g. `"2026-07-17T12:00:00Z"`)
- All monetary amounts returned as strings (to avoid floating-point precision issues in JSON)
- All UUIDs returned as lowercase strings
- Lists always return `{ data: [...], total: N, page: N, limit: N }` shape
- Single resource returns the object directly (no wrapper)
- Errors always follow the format defined in doc 07 (section 7.8)

---

## 14.6 Post-MVP Features (Future Consideration)

These are explicitly out of scope for MVP but may be considered in V2:

- **AI Matching:** AI-powered developer-to-project matching based on skills and history.
- **In-app messaging:** Encrypted developer ↔ Admin messaging within the platform.
- **Developer ratings:** Admin rates developer performance per project (visible internally only).
- **Earnings analytics:** Charts and trends for developer payment history.
- **Subscription tiers:** Premium developer tiers with priority project access.
- **Client portal:** A read-only client login to see project status (not developer profiles).
- **Mobile app:** React Native app for developer dashboard.
- **Referral system:** Developer earns a bonus for referring another developer who gets approved.

---

## 14.7 Contact & Ownership

This document is the single source of truth for the DevBridge Network MVP. Any feature not described here is out of scope. Any change to scope must be reflected in an updated version of this document before development begins on that change.

**Document version:** 1.0  
**Prepared:** July 2026  
**Product name:** DevBridge Network (working name)
