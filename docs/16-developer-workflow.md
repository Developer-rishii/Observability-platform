# DevBridge Network — Developer Workflow & Git Guidelines

Welcome to the DevBridge Network project. To keep the codebase clean, robust, and deployable, every developer must follow this branching strategy and Git flow.

---

## 1. Branch Rules & Strategy

We maintain two primary branches:
1. **`production`**: Contains the stable release code deployed to production. No direct pushes allowed. Only merged from `dev` after QA.
2. **`dev`**: The active integration branch. All new feature branches must branch off from `dev` and merge back into `dev`.
---

## 2. Branch Naming Conventions

Always name your branches based on the type of work you are doing. Use **lowercase** and **kebab-case**:

| Type | Naming Pattern | Example |
|---|---|---|
| **New Features** | `feature/your-feature-name` | `feature/developer-profile-form` |
| **Bug Fixes** | `bugfix/issue-description` | `bugfix/auth-token-refresh-fix` |
| **Hotfixes (Prod)** | `hotfix/critical-prod-patch` | `hotfix/login-lockout-bypass-fix` |

---

## 3. Step-by-Step Feature Workflow

When you start working on any feature (e.g. from the Sprint Plan):

### Step 1: Sync your local environment
Make sure your local `dev` branch is up to date with the remote repository.
```bash
git checkout dev
git pull origin dev
```

### Step 2: Create a Feature Branch
Create your branch using the naming convention.
```bash
git checkout -b feature/auth-register-login
```

### Step 3: Implement your feature & Commitsa
Write code, verify that type checks pass (`tsc --noEmit`), and test locally. Keep commits small and meaningful.
```bash
git add .
git commit -m "feat: add user registration endpoint with Zod validation"
```

### Step 4: Push to Remote
Push your feature branch to the remote repository.
```bash
git push -u origin feature/auth-register-login
```

### Step 5: Open a Pull Request (PR)
- Go to GitHub and open a Pull Request from `feature/auth-register-login` into **`dev`** (NOT `production`).
- Fill in the PR template: describe what changed, how you tested it, and attach screenshots for UI changes.
- Assign the other developer (Rushi / Rushikesh) for review.

### Step 6: Review & Merge
- The reviewer tests the code locally or reviews the diff.
- Once approved, merge the PR into `dev` (use "Squash and merge" to keep the commit history clean).
- Delete the remote feature branch.

---

## 4. Quality Checklist Before Merging

Before you request a review:
1. **TypeScript Checks:** Run `tsc --noEmit` on both `/frontend` and `/backend`. Zero errors allowed.
2. **No Dev Secrets:** Ensure no real passwords, API keys, or `.env` files are tracked in Git.
3. **No Unused Code:** Delete console logs (unless needed for production debugging) and commented-out code blocks.
4. **Responsive Design:** Verify visual correctness on mobile and desktop viewports.
