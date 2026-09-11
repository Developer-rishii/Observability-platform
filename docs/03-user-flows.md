# 3. User Flows

## 3.1 End-to-End Developer Flow

1. Visitor lands on the public homepage.
2. Visitor clicks **"Join the Network"** and is taken to the Register page.
3. Visitor creates an account with name, email, and password.
4. System sends a verification email containing a time-limited link.
5. User clicks the link; email is marked verified; user is redirected to the Developer Dashboard in an incomplete-profile state.
6. Developer completes profile: personal details, skills, technologies, experience, availability.
7. Developer uploads resume and adds portfolio entries (with optional GitHub/LinkedIn links).
8. Developer clicks **"Submit for Verification"** once all required fields are complete.
9. Verification status changes to **Pending**, then to **Under Review** when Admin opens the file.
10. Admin approves, rejects, or requests changes. Developer is notified either way.
11. If **Approved**: dashboard unlocks full project access. If **Rejected or Changes Requested**: developer edits the profile and re-submits.
12. Approved developer browses **Open** projects and applies to relevant ones.
13. Admin reviews applicants for that project and assigns it to one developer.
14. Assigned developer's project status moves to **Assigned**, then **In Progress** as work begins.
15. Developer delivers work through channels coordinated by Admin (outside the MVP system, e.g. email/file transfer); Admin marks project **Review**, then **Completed**.
16. Admin records the payment for the completed project.
17. Developer sees the payment appear in **Pending Payments**, and later in **Completed Payments** once marked Paid.
18. Developer receives a notification at each of these milestones (assigned, payment released, etc.).

---

## 3.2 Admin Operational Flow

1. Admin logs in to the Admin Dashboard.
2. Admin reviews the queue of **Pending/Under Review** developer profiles.
3. Admin opens a developer detail page, reviews resume, portfolio, skills, and links.
4. Admin approves, rejects, or requests changes, optionally adding a private note.
5. Separately, DevBridge closes a new client deal outside the system.
6. Admin creates a new **Project record** with title, description, budget, tech stack, timeline, and any client requirement attachments. Status defaults to **Open**.
7. Approved developers apply. Admin reviews the list of applicants for that project.
8. Admin assigns the project to one developer; project status changes to **Assigned** and the developer is notified.
9. As work proceeds, Admin updates project status (**In Progress → Review → Completed**) to reflect real progress.
10. Once the client confirms delivery (outside the system), Admin marks the project **Completed**.
11. Admin creates a **Payment record** for the developer tied to that project and updates its status as it is paid.
12. Admin can, at any time, send a manual notification to one developer or broadcast to all developers.

---

## 3.3 Verification Status State Machine

| From | Trigger | To | Who |
|---|---|---|---|
| *(new profile)* | Account created, profile not yet submitted | **Not Submitted** | Developer |
| Not Submitted | Developer clicks "Submit for Verification" | **Pending** | Developer |
| Pending | Admin opens the profile for review | **Under Review** | Admin |
| Under Review | Admin approves the profile | **Approved** | Admin |
| Under Review | Admin rejects the profile | **Rejected** | Admin |
| Under Review | Admin requests changes | **Changes Requested** | Admin |
| Rejected / Changes Requested | Developer edits profile and re-submits | **Pending** | Developer |

```
Not Submitted
     │
     ▼ (Developer submits)
  Pending
     │
     ▼ (Admin opens profile)
 Under Review
   ┌──┼──┐
   ▼  │  ▼
Approved │ Rejected
         │
         ▼
  Changes Requested
         │
         ▼ (Developer re-submits)
       Pending
```

---

## 3.4 Project Status State Machine

| From | Trigger | To | Who |
|---|---|---|---|
| *(new project)* | Admin creates project | **Open** | Admin |
| Open | Admin assigns project to a developer | **Assigned** | Admin |
| Assigned | Admin marks work as started | **In Progress** | Admin |
| In Progress | Admin marks work delivered for client review | **Review** | Admin |
| Review | Client approves delivery (recorded by Admin) | **Completed** | Admin |
| Review | Client requests rework (recorded by Admin) | **In Progress** | Admin |

```
Open
 │
 ▼ (Admin assigns developer)
Assigned
 │
 ▼ (Work starts)
In Progress
 │
 ▼ (Delivery submitted)
Review ──────► In Progress (rework)
 │
 ▼ (Client approves)
Completed
```
