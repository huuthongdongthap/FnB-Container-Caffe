# Phase 2 — Design Token Foundation & Semantic Mapping Specification

**Status:** SPECIFIED & ESTABLISHED  
**Date:** 2026-09-20  
**Scope:** AURA Brand → Material Design 3 (M3) Semantic Role Mapping & Token Architecture

---

## 1. Architectural Token Flow

The design system follows a 4-tier semantic chain:

```
┌─────────────────────────────────────────────────────────────┐
│ 1. AURA Brand Primitive Values                              │
│    Navy (#0A1128), Chrome (#6B9FB8), Bronze (#D4AF37),      │
│    Noir Void (#050814), Pearl (#FAFAF8), Forest (#4A7C59)   │
└──────────────────────────────┬──────────────────────────────┘
                               │ maps to
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. M3 Semantic Roles (--md-sys-*)                           │
│    Primary, Secondary, Tertiary, Surface, Surface Containers│
│    On-Surface, Outline, Error, Status Colors                │
└──────────────────────────────┬──────────────────────────────┘
                               │ mapped in
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. Tailwind CSS v4 Theme Bridge (@theme in global.css)      │
│    --color-md-primary, --color-md-surface, --radius-md-*,   │
│    --font-display, --font-body                              │
└──────────────────────────────┬──────────────────────────────┘
                               │ consumed by
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. Production Shells & Components                           │
│    CustomerShell (Public), OpsShell (Noir), AdminShell (HQ) │
│    M3 Primitives & UI Adapters                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Semantic Role Specification & Mapping Matrix

### 2.1 Color Roles (Dark-First Brand Identity)

| M3 Semantic Role | CSS Variable | Brand Source | Hex Value | Purpose / Usage |
|---|---|---|---|---|
| **Primary** | `--md-sys-color-primary` | `--aura-forest-light` | `#4A7C59` | Primary interactive actions, prominent CTAs |
| **On Primary** | `--md-sys-color-on-primary` | (Literal) | `#FFFFFF` | Text/icons on primary containers |
| **Primary Container** | `--md-sys-color-primary-container` | `--aura-forest-deep` | `#1A2D1F` | Subtle primary backgrounds, selected states |
| **On Primary Container** | `--md-sys-color-on-primary-container` | `--aura-forest-pale` | `#A8C5A0` | Text/icons on primary container |
| **Secondary** | `--md-sys-color-secondary` | `--aura-chrome-500` | `#6B9FB8` | Secondary buttons, filter chips, active indicators |
| **On Secondary** | `--md-sys-color-on-secondary` | `--aura-noir-deep` | `#0A0F1E` | Text/icons on secondary elements |
| **Secondary Container** | `--md-sys-color-secondary-container` | `--aura-chrome-dark` | `#4A6B85` | Tonal secondary backgrounds |
| **On Secondary Container** | `--md-sys-color-on-secondary-container` | `--aura-chrome-bright` | `#8FA3B8` | Contrast text on secondary container |
| **Tertiary** | `--md-sys-color-tertiary` | `--aura-chrome-light` | `#B8C5D0` | Tertiary highlights, badges, subtle accents |
| **On Tertiary** | `--md-sys-color-on-tertiary` | `--aura-noir-deep` | `#0A0F1E` | Text on tertiary surfaces |
| **Error** | `--md-sys-color-error` | (Literal) | `#EF5350` | Destructive actions, validation error states |
| **On Error** | `--md-sys-color-on-error` | (Literal) | `#FFFFFF` | Text on error surfaces |
| **Error Container** | `--md-sys-color-error-container` | (Literal) | `#7F1D1D` | Error banners, invalid field backgrounds |
| **On Error Container** | `--md-sys-color-on-error-container` | (Literal) | `#FECACA` | Text on error container |
| **Outline** | `--md-sys-color-outline` | `--aura-chrome-400` | `#8898A4` | Component borders, card outlines |
| **Outline Variant** | `--md-sys-color-outline-variant` | `--aura-navy-500` | `#2A4A7A` | Subtle dividers, decorative borders |

### 2.2 Shell-Specific Surface Hierarchy

| Shell | Target Environment | Surface Role | Token | Value |
|---|---|---|---|---|
| **CustomerShell** | Public Web / PWA | Surface | `--md-sys-color-surface` | `#0A0F1E` (`--aura-noir-deep`) |
| | | Surface Container | `--md-sys-color-surface-container` | `#16213E` (`--aura-noir-mid`) |
| | | Surface Container High | `--md-sys-color-surface-container-high`| `#1E2A47` (`--aura-noir-bright`) |
| **OpsShell** | KDS / POS / TV Menu | Surface Dim / Lowest | `--md-sys-color-surface-dim` | `#050814` (`--aura-noir-void`) |
| | (Permanent Dark) | Surface Container Low | `--md-sys-color-surface-container-low` | `#0A0F1E` (`--aura-noir-deep`) |
| | | Surface Container Highest| `--md-sys-color-surface-container-highest`| `#334155` (`--aura-noir-steel`) |
| **AdminShell** | HQ / Management | Background / Surface | `--aura-pearl-50` / `100` | `#FAFAF8` / `#F5F5F0` |
| | (Light Data-Dense) | On Surface | `--aura-navy-900` | `#0A1128` |

### 2.3 Shape Tokens (M3 Standard)

| M3 Shape Level | Token | Value | Applied To |
|---|---|---|---|
| `none` | `--md-sys-shape-corner-none` | `0px` | Full-width banners, tables, sharp containers |
| `extra-small` | `--md-sys-shape-corner-extra-small` | `4px` | Small tags, status badges, dense data cells |
| `small` | `--md-sys-shape-corner-small` | `8px` | Text inputs, small buttons, menu dropdowns |
| `medium` | `--md-sys-shape-corner-medium` | `12px` | Standard cards, dialogs, bottom sheets |
| `large` | `--md-sys-shape-corner-large` | `16px` | Hero cards, prominent modals, floating action bars |
| `extra-large` | `--md-sys-shape-corner-extra-large`| `24px` | Large navigation drawers, container shells |
| `full` | `--md-sys-shape-corner-full` | `9999px` | Pill buttons, filter chips, circular avatars |

### 2.4 Elevation System (Glass / Industrial Tones)

- **Level 0 (`--md-sys-elevation-0`):** `none` (flat surfaces)
- **Level 1 (`--md-sys-elevation-1`):** `0px 1px 3px 1px rgba(0,0,0,0.15), 0px 1px 2px rgba(0,0,0,0.3)` (resting cards)
- **Level 2 (`--md-sys-elevation-2`):** `0px 2px 6px 2px rgba(0,0,0,0.15), 0px 1px 2px rgba(0,0,0,0.3)` (hovered cards, chips)
- **Level 3 (`--md-sys-elevation-3`):** `0px 4px 8px 3px rgba(0,0,0,0.15), 0px 1px 3px rgba(0,0,0,0.3)` (menus, top app bars)
- **Level 4 (`--md-sys-elevation-4`):** `0px 6px 10px 4px rgba(0,0,0,0.15), 0px 2px 3px rgba(0,0,0,0.3)` (dialogs, bottom sheets)
- **Level 5 (`--md-sys-elevation-5`):** `0px 8px 12px 6px rgba(0,0,0,0.15), 0px 4px 4px rgba(0,0,0,0.3)` (floating action buttons, critical alerts)

### 2.5 Typography Hierarchy

- **Display (`var(--md-sys-typescale-display-*)`):** Quicksand, 36px / 44px line-height, bold (Hero headings)
- **Headline (`var(--md-sys-typescale-headline-*)`):** Quicksand, 28px / 36px line-height, bold (Section headers)
- **Title (`var(--md-sys-typescale-title-*)`):** Quicksand, 20px / 28px line-height, semibold (Card titles, dialog titles)
- **Body (`var(--md-sys-typescale-body-*)`):** Be Vietnam Pro, 16px / 26px line-height, regular (Readable body text)
- **Label (`var(--md-sys-typescale-label-*)`):** Be Vietnam Pro, 14px / 20px line-height, medium (Buttons, tabs, chips)

---

## 3. Incremental Migration Principles

1. **No Blind Global Search/Replace:** Do not execute blanket script replaces on all 473 files.
2. **Prioritized Adoption Path:**
   - **Step 1:** Core layouts (`CustomerShell`, `OpsShell`, `AdminShell`).
   - **Step 2:** MD3 Primitives & Adapters (`src/components/ui/adapters/`).
   - **Step 3:** Shared composite components (`RecommendationSection`, `CartBottomBar`, etc.).
   - **Step 4:** High-traffic feature pages (`Menu`, `KDS`, `Dashboard`, `Orders`).
3. **Preserve Business Logic & Visual Appearance:** Every token migration must retain exact visual contrast ratios (minimum 4.5:1 AA) and touch targets (≥44px/48dp).

---

## 4. Verification Protocol

- `npx tsc --noEmit` — 0 errors.
- `npx vitest run` — all 3,477 tests pass.
- `npm run build` — production Vite build succeeds.
