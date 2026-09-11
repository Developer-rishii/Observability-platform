# 16. Developer Workflow & Git Guidelines — Observability Platform

## Branching Conventions
- Main branches: `production` and `dev`.
- Feature branches: `feature/<feature-name>`.

## Commit Conventions
- `feat:` New feature implementation
- `fix:` Bug fix
- `docs:` Documentation updates
- `test:` Test additions
- `infra:` Infrastructure & Docker setup
- `agent:` Monitoring agent development
- `ml:` ML anomaly detection models
- `correlation:` Correlation engine updates
- `rag:` Vector retrieval routines
- `ai:` Gemini AI remediation features
- `frontend:` Frontend UI updates

## Pull Request Guidelines
- All PRs must target the `dev` branch.
- Standard PR template (`.github/PULL_REQUEST_TEMPLATE.md`) must be filled out completely.
- CI/CD pipeline checks (Backend CI, Frontend CI, Docker Build CI) must pass.
