# 12. Testing Checklist

## 12.1 Authentication

- [ ] Register with valid data → account created, verification email sent
- [ ] Register with duplicate email → `409` error shown
- [ ] Register with invalid password (too short) → inline error
- [ ] Register with mismatched passwords → inline error
- [ ] Register without accepting Terms → submit button remains disabled
- [ ] Verify email with valid token → redirected to dashboard
- [ ] Verify email with expired token → error + resend option
- [ ] Verify email with already-used token → "already verified" message
- [ ] Login with correct credentials → JWT returned, redirect to dashboard
- [ ] Login with wrong password → generic error (no hint which field)
- [ ] Login with unverified email → `403` with resend option
- [ ] Login fails 5 times → account locked for 15 minutes
- [ ] Forgot password with real email → reset email sent
- [ ] Forgot password with fake email → same success message (no disclosure)
- [ ] Reset password with valid token → new password set, can login
- [ ] Reset password with expired token → error + link to forgot password
- [ ] Change password with wrong current password → inline error
- [ ] Change password with valid data → success, old token invalidated
- [ ] Logout → token invalidated, redirected to login

---

## 12.2 Developer Profile

- [ ] Profile page shows empty state for new developer
- [ ] Save profile with all required fields → success, completion % updates
- [ ] Save profile with missing required fields → inline errors
- [ ] Upload valid JPG profile picture (< 5 MB) → saves and displays
- [ ] Upload oversized image → `413` error shown
- [ ] Upload invalid file type (e.g. PDF) as profile picture → `415` error
- [ ] Upload valid PDF resume (< 10 MB) → saves, shows file name and date
- [ ] Upload oversized resume → `413` error shown
- [ ] Add portfolio item with all fields → appears in list
- [ ] Add portfolio item with missing required fields → inline errors
- [ ] Edit portfolio item → changes saved
- [ ] Delete portfolio item → confirmation dialog, then removed
- [ ] Submit for verification with incomplete profile → error listing missing fields
- [ ] Submit for verification with complete profile → status changes to Pending

---

## 12.3 Verification Workflow

- [ ] Admin sees new submission in Verification Queue
- [ ] Admin opens developer detail → status changes to Under Review
- [ ] Admin approves → developer status = Approved, developer gets notification + email
- [ ] Admin rejects without note → blocked with inline error
- [ ] Admin rejects with note → developer status = Rejected, developer gets notification + email
- [ ] Admin requests changes with note → developer status = Changes Requested
- [ ] Developer re-submits after changes requested → status = Pending
- [ ] Approved developer can see and apply to projects
- [ ] Unapproved developer sees locked state on project pages

---

## 12.4 Projects

- [ ] Admin creates project with all required fields → project appears in list with Open status
- [ ] Admin creates project with missing fields → inline errors
- [ ] Admin edits project → changes saved
- [ ] Admin moves project status forward → status updates, notifications sent if applicable
- [ ] Admin tries invalid status transition → option not available in dropdown
- [ ] Approved developer sees Open project in list
- [ ] Developer applies to project → application created with Pending status
- [ ] Developer applies twice to same project → `409` error
- [ ] Developer withdraws pending application → application removed
- [ ] Admin reviews applicants list → all applicants visible
- [ ] Admin assigns project to developer → project status = Assigned, developer notified
- [ ] Project moves through full lifecycle: Open → Assigned → In Progress → Review → Completed

---

## 12.5 Payments

- [ ] Admin records payment → appears in Admin payments list
- [ ] Admin marks payment as Paid → status updates
- [ ] Developer sees payment in Pending Payments → totals update
- [ ] Developer sees payment in Completed Payments after marked Paid
- [ ] Developer payment summary cards show correct totals
- [ ] Empty payment state shows "No payment records yet"

---

## 12.6 Notifications

- [ ] Developer receives in-app notification on profile approval
- [ ] Developer receives in-app notification on project assignment
- [ ] Developer receives in-app notification on payment
- [ ] Admin sends manual notification to one developer → developer receives it
- [ ] Admin broadcasts to all developers → all developers receive it
- [ ] Notification bell shows unread count badge
- [ ] Mark all as read → badge clears, all items show as read
- [ ] Empty notifications → "You're all caught up" empty state

---

## 12.7 Access Control

- [ ] Developer cannot access any `/admin/*` routes → redirected or `403`
- [ ] Unauthenticated user cannot access any `/developer/*` routes → redirected to login
- [ ] Developer cannot view or edit another developer's profile via API
- [ ] Admin can access all developer profiles
- [ ] Developer cannot withdraw another developer's application

---

## 12.8 Responsive Design

- [ ] Landing page renders correctly on mobile (320px), tablet (768px), desktop (1280px)
- [ ] Sidebar collapses to hamburger menu on mobile
- [ ] All forms usable on mobile
- [ ] Tables scroll horizontally on mobile without breaking layout
- [ ] File uploads work on mobile browsers
