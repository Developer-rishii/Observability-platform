# Observability Platform — Developer Workflow & Git Guidelines

Welcome to the Observability Platform. To keep the codebase clean, robust, and deployable, every developer must follow this branching strategy and Git flow.

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
| **New Features** | `feature/your-feature-name` | `feature/metrics-visualization` |
| **Bug Fixes** | `bugfix/issue-description` | `bugfix/auth-token-refresh` |
| **Hotfixes (Prod)** | `hotfix/critical-prod-patch` | `hotfix/agent-disconnect-patch` |

---

## 3. Commit Prefix Conventions

Commit messages must follow ownership boundaries and scope prefixes:
- `feat:` New general feature
- `fix:` Bug fix
- `docs:` Documentation updates
- `test:` Automated test additions
- `infra:` Infrastructure & Docker setup
- `agent:` Custom monitoring agent code
- `ml:` Machine learning models (Isolation Forest / Z-score)
- `correlation:` Event correlation engine
- `rag:` Qdrant vector retrieval routines
- `ai:` Google Gemini AI integration
- `frontend:` Next.js frontend UI updates

---

## 4. Step-by-Step Feature Workflow

When you start working on any feature (e.g., from the Sprint Plan):

### Step 1: Sync your local environment
Make sure your local `dev` branch is up to date with the remote repository.
```bash
git checkout dev
git pull origin dev
```

### Step 2: Create a Feature Branch
Create your branch using the naming convention.
```bash
git checkout -b feature/metrics-visualization
```

### Step 3: Implement your feature & Commits
Write code, run local verification checks, and keep commits small and meaningful.
```bash
git add .
git commit -m "frontend: add CPU and RAM usage charts using Recharts"
```

### Step 4: Push to Remote
Push your feature branch to the remote repository.
```bash
git push -u origin feature/metrics-visualization
```

### Step 5: Open a Pull Request (PR)
- Go to GitHub and open a Pull Request from `feature/metrics-visualization` into **`dev`** (NOT `production`).
- Fill in the PR template (`.github/PULL_REQUEST_TEMPLATE.md`): describe what changed, how you tested it, and attach screenshots for UI changes.
- Assign reviewers.

### Step 6: Review & Merge
- The reviewer tests the code locally or reviews the diff.
- Ensure all GitHub Actions CI checks (`backend`, `frontend`, `docker-build`) pass.
- Once approved, merge the PR into `dev` (use "Squash and merge" to keep the commit history clean).
- Delete the remote feature branch.

---

## 5. Quality Checklist Before Merging

Before you request a review:
1. **Frontend Verification:** Run `npm run build` or `npx tsc --noEmit` inside `frontend/`. Zero TypeScript errors allowed.
2. **Backend Verification:** Ensure FastAPI models compile cleanly (`python -m py_compile app/main.py`) and pytest tests pass.
3. **No Dev Secrets:** Ensure no real passwords, API keys, or `.env` files are tracked in Git.
4. **No Unused Code:** Remove debug print/console statements and commented-out code blocks.
5. **Responsive Design:** Verify visual correctness on mobile and desktop viewports.
