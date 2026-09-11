# 5. Page-by-Page Breakdown — Admin Area

> All Admin pages require an authenticated session with the Admin role. Any attempt to reach an Admin route without the Admin role must redirect to Login (or show a 403 page if already logged in as a Developer).

---

## 5.1 Admin Dashboard Home

Overview of platform activity for internal staff.

**Fields / Content:**
- Summary cards: Total Developers, Pending Verifications, Open Projects, Active (Assigned/In Progress) Projects, Completed Projects this month.
- Recent activity feed (new sign-ups, new applications, status changes).
- Quick links to Verification Queue and Create Project.

**Error / Empty States:**
- Empty state for activity feed: "No recent activity."

---

## 5.2 Developers List Page

Searchable, filterable table of every developer account.

**Fields / Content:**
- Search box (by name or email).
- Filters: Verification Status, Availability, Country, Skill/Technology.
- Table columns: Name, Email, Verification Status, Availability, Date Joined, Actions (View).
- Pagination controls.

**Error / Empty States:**
- Empty state when a filter/search returns nothing: "No developers match your filters."

---

## 5.3 Developer Detail Page

Full read view of one developer's profile plus verification controls.

**Fields / Content:**
- All profile fields (personal, professional, portfolio, resume link, GitHub/LinkedIn).
- Verification status with **Approve**, **Reject**, and **Request Changes** buttons.
- Internal notes field (visible to Admin only, not the developer).
- Edit Profile button (opens an editable version for Admin corrections).
- History log of status changes with timestamps and the note attached to each.

**Validation Rules:**
- A rejection or change-request action requires a non-empty note (minimum 10 characters).

**Error / Empty States:**
- "A note is required to reject or request changes" shown if Admin tries to submit without one.
- Confirmation dialog before Approve/Reject is finalized: "This will notify the developer. Continue?"

---

## 5.4 Verification Queue Page

Focused list of only Pending / Under Review profiles, to work through efficiently.

**Fields / Content:**
- Queue list ordered by submission date (oldest first).
- One-click open into Developer Detail Page.

**Error / Empty States:**
- Empty state: "No profiles waiting for review."

---

## 5.5 Projects List Page

Table of all projects with filters by status.

**Fields / Content:**
- Filters: Status (Open, Assigned, In Progress, Review, Completed), Technology.
- Table columns: Title, Status, Budget, Timeline, Assigned Developer (if any), Actions (View/Edit).
- Create Project button.

**Error / Empty States:**
- Empty state: "No projects yet — create your first project."

---

## 5.6 Create / Edit Project Page

Form used to create a new project or edit an existing one.

**Fields / Content:**
- Project Title (text)
- Description (rich text/textarea)
- Budget (number + currency)
- Required Technologies (multi-select tags)
- Timeline / Deadline (date)
- Client Requirement Attachments (file upload, multiple)
- Status (select, defaults to Open on creation)
- Save / Publish button

**Validation Rules:**
- Title: required, 3–150 characters.
- Description: required, minimum 30 characters.
- Budget: required, positive number.
- Required Technologies: at least 1 selected.
- Timeline: required, must be a future date on creation.
- Attachments: PDF, DOCX, PNG, JPG only, max 20 MB total.

**Error / Empty States:**
- Inline validation errors per field.
- Confirmation dialog if Admin tries to leave with unsaved changes.

---

## 5.7 Project Applicants Page

List of developers who applied to a specific project, with an Assign action.

**Fields / Content:**
- Table: Developer Name, Skills match summary, Availability, Applied Date, Application Note.
- Assign button per row.

**Error / Empty States:**
- Confirmation dialog before assigning: "Assigning will notify this developer and close applications for others. Continue?"
- Empty state: "No applicants yet for this project."

---

## 5.8 Project Status Update

Inline control on the Project Detail / Edit page to move status forward.

**Fields / Content:**
- Status dropdown restricted to valid next states (see state machine in doc 03-user-flows.md).

**Validation Rules:**
- Only forward transitions (plus Review → In Progress for rework) are allowed.
- Invalid transitions are hidden from the dropdown rather than merely blocked after the fact.

---

## 5.9 Payments Management Page

Admin's control panel for recording and tracking all payments.

**Fields / Content:**
- Table: Developer, Project, Amount, Currency, Status (Pending/Paid), Date, Note.
- Add Payment Record button: Developer (select), Project (select), Amount, Currency, Status, Note.
- Edit/mark-as-paid action per row.

**Validation Rules:**
- Amount: required, positive number.
- Developer and Project: required selections.

**Error / Empty States:**
- Empty state: "No payment records yet."

---

## 5.10 Notifications (Admin Send) Page

Lets Admin send a manual notification.

**Fields / Content:**
- Recipient (select: single developer or "All Developers").
- Message (textarea).
- Send button.

**Validation Rules:**
- Message: required, 5–500 characters.

**Error / Empty States:**
- Confirmation dialog before a broadcast to all developers is sent.

---

## 5.11 Settings Page

Basic Admin account settings.

**Fields / Content:**
- Admin name and email (editable)
- Change Password fields (current password, new password, confirm new password)

**Validation Rules:**
- Same password rules as the developer Account Settings page.
- Minimum 8 characters, at least 1 letter and 1 number.
