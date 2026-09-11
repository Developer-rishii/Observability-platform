# DevBridge Network — Documentation Index

Welcome to the official documentation for the **DevBridge Network** MVP.

## How to Navigate

| # | File | What It Covers |
|---|---|---|
| 1 | [01-product-overview.md](./01-product-overview.md) | Vision, problem statement, personas, business model |
| 2 | [02-mvp-scope.md](./02-mvp-scope.md) | User roles, full feature list, what's out of scope |
| 3 | [03-user-flows.md](./03-user-flows.md) | End-to-end flows, verification state machine, project state machine |
| 4 | [04-pages-public-developer.md](./04-pages-public-developer.md) | All public pages + all developer dashboard pages (fields, validation, error states) |
| 5 | [05-pages-admin.md](./05-pages-admin.md) | All admin dashboard pages (fields, validation, error states) |
| 6 | [06-database-design.md](./06-database-design.md) | All 16 database tables with columns, types, and constraints |
| 7 | [07-api-documentation.md](./07-api-documentation.md) | Every API endpoint with request/response/error specs |
| 8 | [08-ui-design-guidelines.md](./08-ui-design-guidelines.md) | Color palette, typography, spacing, components, animations |
| 9 | [09-security-requirements.md](./09-security-requirements.md) | Auth security, RBAC, file upload, audit logging, data privacy |
| 10 | [10-edge-cases.md](./10-edge-cases.md) | All known edge cases to handle per module |
| 11 | [11-development-roadmap.md](./11-development-roadmap.md) | 7 build phases with task checklists |
| 12 | [12-testing-checklist.md](./12-testing-checklist.md) | Manual test cases for every feature |
| 13 | [13-deployment-checklist.md](./13-deployment-checklist.md) | Server setup, environment variables, deployment steps |
| 14 | [14-final-notes.md](./14-final-notes.md) | Technical decisions, conventions, post-MVP roadmap |
| 15 | [15-sprint-plan.md](./15-sprint-plan.md) | 10-day sprint plan for developers |
| 16 | [16-developer-workflow.md](./16-developer-workflow.md) | Git guidelines, branch conventions, PR process |

---

## Quick Summary

**DevBridge Network** is a **private, invitation-and-approval based developer network**.

- Developers apply and get verified manually by Admins.
- Once approved, developers can browse and apply to pre-confirmed client projects.
- DevBridge handles all client relationships; developers just build.
- Payments are manually recorded by Admin — no payment gateway in MVP.

**Tech Stack:**
- Frontend: React + Vite + Vanilla CSS
- Backend: Node.js + Express + TypeScript
- Database: PostgreSQL + Prisma ORM
- File Storage: Local server disk
- Auth: JWT + bcrypt
- Deployment: Docker + Nginx on VPS
