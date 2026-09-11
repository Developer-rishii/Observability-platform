# 8. UI Design Guidelines

## 8.1 Design Philosophy

DevBridge is a **professional, premium platform** aimed at serious developers who want international work. The design must communicate trust, credibility, and exclusivity — it is not a mass-market freelance site.

Core design principles:
- **Premium Dark Mode** — dark backgrounds with carefully chosen accent colors
- **Clarity over decoration** — every element must serve a purpose
- **Responsive first** — must work seamlessly on all screen sizes (web only, no native app in MVP)
- **Micro-interactions** — smooth hover effects and transitions to feel alive and polished

---

## 8.2 Color Palette

| Token | Hex | Usage |
|---|---|---|
| `--bg-primary` | `#0A0A0F` | Page background (near-black) |
| `--bg-card` | `#12121A` | Card and panel backgrounds |
| `--bg-elevated` | `#1A1A26` | Elevated surfaces, modals |
| `--border` | `#2A2A3A` | Borders and dividers |
| `--accent-blue` | `#4F8EF7` | Primary action color |
| `--accent-purple` | `#7C3AED` | Gradient start, highlights |
| `--accent-gradient` | `#7C3AED → #4F8EF7` | CTA buttons, hero elements |
| `--text-primary` | `#FFFFFF` | Headings and primary text |
| `--text-secondary` | `#A0A0B8` | Body text, descriptions |
| `--text-muted` | `#5A5A75` | Placeholder text, meta info |
| `--success` | `#22C55E` | Approved status, success toasts |
| `--warning` | `#F59E0B` | Pending/under review status |
| `--error` | `#EF4444` | Rejected status, error states |
| `--info` | `#3B82F6` | Info banners |

---

## 8.3 Typography

| Element | Font | Size | Weight |
|---|---|---|---|
| Page heading (H1) | Inter | 2.5rem–3.5rem | 700 |
| Section heading (H2) | Inter | 1.75rem–2rem | 600 |
| Card heading (H3) | Inter | 1.25rem | 600 |
| Body text | Inter | 1rem | 400 |
| Small / meta | Inter | 0.875rem | 400 |
| Button text | Inter | 0.9rem | 600 |
| Label | Inter | 0.8rem | 500 |

> **Google Fonts import:** `Inter` with weights 400, 500, 600, 700.

---

## 8.4 Spacing System

Use a consistent 4px base grid:

| Token | Value | Usage |
|---|---|---|
| `--space-1` | 4px | Micro spacing |
| `--space-2` | 8px | Inside elements |
| `--space-3` | 12px | Between related elements |
| `--space-4` | 16px | Component padding |
| `--space-6` | 24px | Section internal spacing |
| `--space-8` | 32px | Component gaps |
| `--space-12` | 48px | Section spacing |
| `--space-16` | 64px | Page section gaps |

---

## 8.5 Border Radius

| Usage | Value |
|---|---|
| Buttons, inputs, badges | `8px` |
| Cards and panels | `12px` |
| Modals | `16px` |
| Avatars / pills | `9999px` (fully rounded) |

---

## 8.6 Component Styles

### Buttons

**Primary Button:**
- Background: `var(--accent-gradient)`
- Text: White
- Hover: slightly brighter gradient + translate Y -1px
- Disabled: opacity 0.5, cursor not-allowed

**Secondary / Ghost Button:**
- Border: `1px solid var(--border)`
- Background: transparent
- Hover: background `var(--bg-elevated)`

**Danger Button:**
- Background: `var(--error)` at 15% opacity
- Border: `1px solid var(--error)`
- Text: `var(--error)`

### Input Fields
- Background: `var(--bg-elevated)`
- Border: `1px solid var(--border)`
- Focus border: `var(--accent-blue)`
- Error border: `var(--error)`
- Border radius: `8px`
- Padding: `12px 16px`
- Placeholder color: `var(--text-muted)`

### Cards
- Background: `var(--bg-card)`
- Border: `1px solid var(--border)`
- Border radius: `12px`
- Padding: `24px`
- Hover: border color lifts to `var(--accent-blue)` at 40% opacity, subtle box-shadow

### Status Badges

| Status | Background | Text |
|---|---|---|
| Approved / Completed | Green (15% opacity) | `#22C55E` |
| Pending / Under Review | Yellow (15% opacity) | `#F59E0B` |
| Rejected | Red (15% opacity) | `#EF4444` |
| Open | Blue (15% opacity) | `#4F8EF7` |
| Assigned / In Progress | Purple (15% opacity) | `#7C3AED` |

---

## 8.7 Layout Structure

### Public Pages
```
[Navbar]
[Hero / Page Content]
[Footer]
```

### Developer Dashboard
```
[Sidebar — fixed left, 240px wide]
[Main Content Area — flex-grow]
```

### Admin Dashboard
```
[Sidebar — fixed left, 240px wide, different accent]
[Main Content Area — flex-grow]
```

### Sidebar Items — Developer
- Dashboard
- My Profile
- Portfolio
- Browse Projects
- My Applications
- Active Projects
- Completed Projects
- Payments
- Notifications
- Account Settings

### Sidebar Items — Admin
- Dashboard
- Verification Queue
- All Developers
- Projects
- Payments
- Send Notification
- Settings

---

## 8.8 Animations & Transitions

- **Page transition:** fade-in 200ms ease
- **Button hover:** `transform: translateY(-1px)` + `transition: 0.15s`
- **Card hover:** border color + `box-shadow` shift, `transition: 0.2s`
- **Modal open:** scale from 0.95 to 1, fade in, `transition: 0.2s`
- **Sidebar active item:** background highlight with left border accent
- **Notification bell:** pulse animation when unread count > 0
- **Progress bar:** smooth width change on `transition: 0.4s ease`

---

## 8.9 Responsive Breakpoints

| Name | Min Width | Usage |
|---|---|---|
| Mobile | — | Sidebar collapses to hamburger menu |
| Tablet | 768px | Two-column grids appear |
| Desktop | 1024px | Sidebar always visible |
| Wide | 1280px | Maximum content width capped at 1200px |

---

## 8.10 Empty States

Every list/table that can have zero items must show an empty state:
- An illustrative icon or SVG
- A short message (e.g. "No projects yet")
- An optional CTA button where relevant

---

## 8.11 Toast Notifications

- Position: bottom-right corner
- Auto-dismiss: 4 seconds
- Types: success (green), error (red), info (blue), warning (yellow)
- Stacking: up to 3 toasts visible at once, older ones push down
