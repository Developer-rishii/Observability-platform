# 8. UI Design Guidelines

## 8.1 Design Philosophy

Observability Platform uses a **sleek, high-density dark mode UI** tailored for SREs, DevOps engineers, and system admins.

Core design principles:
- **Dark Theme First** — Slate / Dark Navy background (`#0f172a`) to minimize eye strain.
- **Data Density & Visualization** — Fast, real-time charts using Recharts.
- **High-Contrast Metrics & Badges** — Clear visual distinction for incident severities (`critical`, `high`, `medium`, `low`).
- **Responsive Layout** — Mobile-friendly dashboard shell with collapsing navigation sidebar.

---

## 8.2 Color Palette

| Token | Hex | Usage |
|---|---|---|
| `--bg-primary` | `#0f172a` | Deep Slate background |
| `--bg-card` | `#1e293b` | Card container background |
| `--border` | `#334155` | Border dividers |
| `--accent-blue` | `#3b82f6` | Primary action & charts |
| `--text-primary` | `#f8fafc` | Primary text |
| `--text-muted` | `#94a3b8` | Subtext / Muted |
| `--status-critical` | `#ef4444` | Critical alerts & incidents |
| `--status-warning` | `#f59e0b` | High / Warning alerts |
| `--status-healthy` | `#10b981` | Active nodes & healthy services |
