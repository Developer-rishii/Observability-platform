# 4. Page-by-Page Breakdown — Public Website & Developer Area

## 4.1 Public (Guest) Pages

### 4.1.1 Landing Page
Marketing entry point. Explains what DevBridge is, why a developer should join, and drives sign-ups.

**Fields / Content:**
- Hero section: headline, sub-headline, primary CTA button ("Join the Network").
- "How It Works" 3–4 step summary (join, get verified, get matched, get paid).
- Benefits section (no cold outreach, no sales, guaranteed vetted clients, fair pay).
- Footer with links to About, How It Works, Contact, Privacy Policy, Terms & Conditions.

**Validation Rules:**
- No form inputs on this page besides the CTA link/button.

**Error / Empty States:**
- If a background image/asset fails to load, the section must degrade to a plain background color rather than showing a broken image icon.

---

### 4.1.2 About Page
Explains the company mission and the private-network model in more depth than the landing page.

**Fields / Content:**
- Mission statement
- Explanation that DevBridge is not a marketplace
- Team / company summary (static content)

---

### 4.1.3 How It Works Page
Step-by-step explanation of the developer journey from sign-up to payment.

**Fields / Content:**
- Numbered step list with short icons/illustrations
- CTA button to Register

---

### 4.1.4 Benefits Page
Reinforces why a developer should choose DevBridge over freelancing solo or on open marketplaces.

**Fields / Content:**
- Comparison-style content: solo freelancing pain points vs. DevBridge benefits

---

### 4.1.5 Contact Page
Lets a visitor reach the DevBridge team.

**Fields / Content:**
- Name (text)
- Email (text)
- Message (textarea)
- Submit button

**Validation Rules:**
- Name: required, 2–80 characters.
- Email: required, must match a standard email pattern.
- Message: required, 10–2000 characters.

**Error / Empty States:**
- Inline field errors on blur (e.g. "Please enter a valid email address").
- Submit button disabled while the request is in flight.
- Success confirmation message replaces the form on successful submit.
- If the request fails, show a non-blocking error banner: "Something went wrong. Please try again."

---

### 4.1.6 Privacy Policy Page
Static legal content describing what data is collected and how it is used.

---

### 4.1.7 Terms & Conditions Page
Static legal content describing platform usage terms for developers.

---

### 4.1.8 404 Page
Shown for any unmatched route.

**Fields / Content:**
- Friendly "Page not found" message
- Link back to the homepage

---

## 4.2 Authentication Pages

### 4.2.1 Register Page

**Fields / Content:**
- Full Name (text)
- Email Address (text)
- Password (password, with a visible strength indicator)
- Confirm Password (password)
- Terms & Conditions checkbox (must be checked)
- Submit button ("Create Account")
- Link to Login page for existing users

**Validation Rules:**
- Full Name: required, 2–100 characters.
- Email: required, valid email format, must not already exist in the system.
- Password: required, minimum 8 characters, at least 1 letter and 1 number.
- Confirm Password: must exactly match Password.
- Terms checkbox: must be checked before submit is enabled.

**Error / Empty States:**
- "An account with this email already exists" shown inline under the Email field.
- "Passwords do not match" shown inline under Confirm Password.
- Generic error banner: "Registration failed. Please try again."
- Submit button shows a loading spinner and is disabled during submission.

---

### 4.2.2 Email Verification Page

**Fields / Content:**
- Auto-processing screen with a success or failure state; no user input.
- On success: "Email verified" message with a button to continue to the Dashboard.
- On failure: message explaining the link is invalid or expired, with a button to resend.

**Validation Rules:**
- Token must be valid, unused, and not expired (recommended expiry: **24 hours**).

**Error / Empty States:**
- Expired token: "This verification link has expired. Request a new one."
- Invalid token: "This verification link is invalid."
- Already verified: redirect to Login with "Your email is already verified — please log in."

---

### 4.2.3 Login Page

**Fields / Content:**
- Email Address (text)
- Password (password)
- Remember Me (checkbox)
- Submit button ("Log In")
- Link to Forgot Password
- Link to Register

**Validation Rules:**
- Email: required, valid format.
- Password: required.

**Error / Empty States:**
- "Incorrect email or password" — single generic message to avoid revealing which was wrong.
- "Please verify your email before logging in" if account exists but is unverified, with resend link.
- Account lockout message after 5 failed attempts (lock for 15 minutes).

---

### 4.2.4 Forgot Password Page

**Fields / Content:**
- Email Address (text)
- Submit button

**Validation Rules:**
- Email: required, valid format.

**Error / Empty States:**
- For security: "If an account exists for this email, a reset link has been sent." (same message whether email exists or not).
- Rate limiting: repeated requests from the same email within a short window should not send duplicate emails.

---

### 4.2.5 Reset Password Page

**Fields / Content:**
- New Password (password)
- Confirm New Password (password)
- Submit button

**Validation Rules:**
- Token must be valid and not expired (recommended expiry: **1 hour**).
- New Password: minimum 8 characters, at least 1 letter and 1 number.
- Confirm New Password: must match New Password.

**Error / Empty States:**
- Expired/invalid token: message with a link back to Forgot Password.
- Password mismatch shown inline before submit is allowed.
- Success message with a button to go to Login.

---

## 4.3 Developer Dashboard Pages

### 4.3.1 Dashboard Home

**Fields / Content:**
- Verification status banner (Pending / Under Review / Approved / Rejected / Changes Requested) with next-step guidance text.
- Profile completion progress bar with percentage and "Complete your profile" link if under 100%.
- Summary cards: Available Projects count, Applied Projects count, Assigned Projects count, Completed Projects count.
- Recent notifications list (last 5).
- Payment snapshot: total earnings, pending payments.

**Error / Empty States:**
- If developer is not approved yet, project-related cards are shown in a locked/disabled state with tooltip: "Unlocks once your profile is approved."
- If zero notifications: empty-state with "No notifications yet."

---

### 4.3.2 Profile Page

**Fields / Content:**
- Profile Picture (image upload)
- Full Name (text)
- Country (dropdown/select)
- Phone Number (text)
- Email (read-only)
- Years of Experience (number)
- Preferred Technologies (multi-select tags)
- Skills (multi-select tags)
- Availability Status (select: Available, Partially Available, Not Available)
- GitHub Profile URL (text, optional)
- LinkedIn Profile URL (text, optional)
- Save button
- Submit for Verification button (enabled only once required fields are complete)

**Validation Rules:**
- Profile Picture: JPG/PNG only, max 5 MB.
- Full Name: required, 2–100 characters.
- Country: required, from a fixed list.
- Phone Number: required, 7–15 digits, optional leading +.
- Years of Experience: required, integer, 0–50.
- Preferred Technologies: at least 1 selected.
- Skills: at least 3 selected.
- GitHub/LinkedIn URL: if provided, must start with https://.

**Error / Empty States:**
- Inline error under any invalid field.
- "Please complete all required fields before submitting for verification."
- Unsaved changes warning if developer navigates away without saving.

---

### 4.3.3 Portfolio Page

**Fields / Content:**
- Add Project button opens a form: Project Title, Description, Project Link (optional), Project Image (optional).
- List of added portfolio entries with edit/delete actions.

**Validation Rules:**
- Project Title: required, 3–120 characters.
- Description: required, 20–1000 characters.
- Project Link: if provided, must be a valid URL.
- Project Image: JPG/PNG only, max 5 MB.

**Error / Empty States:**
- Empty state: "You haven't added any portfolio projects yet."
- Delete requires a confirmation dialog.

---

### 4.3.4 Resume Upload (part of Profile)

**Fields / Content:**
- Upload/replace resume button
- Current file name and upload date shown once a resume exists
- Download/preview link

**Validation Rules:**
- File type: PDF or DOCX only.
- Max file size: 10 MB.

**Error / Empty States:**
- "Unsupported file type. Please upload a PDF or DOCX file."
- "File is too large. Maximum size is 10 MB."
- Upload progress indicator; disable the button while uploading.

---

### 4.3.5 Projects — Available List

**Fields / Content:**
- Filterable/searchable list of project cards: title, required technologies, budget range, timeline.
- Click-through to a project detail view.

**Error / Empty States:**
- Locked state for unapproved developers with an explanatory banner.
- Empty state: "No open projects right now — check back soon."

---

### 4.3.6 Project Detail Page

**Fields / Content:**
- Title, full description, budget, required technologies, timeline, attachments/requirements.
- Apply button (Open projects) with an optional note field.
- Withdraw Application button (if the developer has already applied and the project is still Open).
- Status badge reflecting current project status.

**Validation Rules:**
- Application note: optional, max 500 characters.

**Error / Empty States:**
- "You have already applied to this project" shown instead of the Apply button after applying.
- "This project is no longer accepting applications" if status has moved past Open.

---

### 4.3.7 My Applications Page

**Fields / Content:**
- Table/list: project title, applied date, application status (Pending, Assigned to You, Not Selected).

**Error / Empty States:**
- Empty state: "You haven't applied to any projects yet."

---

### 4.3.8 Assigned / In-Progress Projects Page

**Fields / Content:**
- Project cards with status badge (Assigned, In Progress, Review) and key details (deadline, budget).

**Error / Empty States:**
- Empty state: "You don't have any active projects right now."

---

### 4.3.9 Completed Projects Page

**Fields / Content:**
- Table: project title, completion date, final status.

**Error / Empty States:**
- Empty state: "No completed projects yet."

---

### 4.3.10 Payments Page

**Fields / Content:**
- Summary cards: Total Earnings, Pending Payments, Completed Payments.
- Payment history table: project, amount, currency, status, date, note.

**Error / Empty States:**
- Empty state: "No payment records yet."

---

### 4.3.11 Notifications Page

**Fields / Content:**
- Chronological list with type icon, message, timestamp, read/unread indicator.
- Mark all as read action.

**Error / Empty States:**
- Empty state: "You're all caught up — no notifications."

---

### 4.3.12 Account Settings Page

**Fields / Content:**
- Current Password
- New Password
- Confirm New Password
- Save Changes button

**Validation Rules:**
- Current Password: required, must match the stored password.
- New Password: minimum 8 characters, at least 1 letter and 1 number.
- Confirm New Password: must match New Password.

**Error / Empty States:**
- "Current password is incorrect" inline error.
- Success toast: "Password updated successfully."
