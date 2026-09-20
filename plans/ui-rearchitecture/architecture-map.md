# AURA OS — Frontend Architecture Map

## 1. System Overview & Core Framing

AURA OS Frontend is a React 18 + Vite + Tailwind CSS SPA operating as the unified human interface for the AURA F&B platform. It is backed by Cloudflare Workers (D1 SQLite, Hono OpenAPI backend) with authoritative business domain packages (`@aura/domain-catalog`, `@aura/domain-order`, `@aura/domain-crm`).

### Target Layer Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           EXPERIENCE SHELLS                             │
│    ┌───────────────────┐    ┌─────────────────┐    ┌─────────────────┐  │
│    │   CustomerShell   │    │    OpsShell     │    │   AdminShell    │  │
│    │  (Mobile/PWA/M3)  │    │ (KDS/TV/POS/TV) │    │ (HQ/Management) │  │
│    └─────────┬─────────┘    └────────┬────────┘    └────────┬────────┘  │
├──────────────┼───────────────────────┼──────────────────────┼───────────┤
│              ▼                       ▼                      ▼           │
│      Customer Feature        Operations Feature        Admin Feature    │
│      Modules & Pages          Modules & Pages         Modules & Pages   │
├─────────────────────────────────────────────────────────────────────────┤
│                           FEATURE / SHARED UI                           │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │                    Shared Composite Components                    │  │
│  │     (OrderCard, ProductItem, CartDrawer, TableSelector, etc.)     │  │
│  └─────────────────────────────────┬─────────────────────────────────┘  │
│                                    ▼                                    │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │                 M3 Component Primitives (Canonical)               │  │
│  │  (MD3Button, MD3Card, MD3Dialog, MD3TopAppBar, MD3NavigationBar)  │  │
│  └─────────────────────────────────┬─────────────────────────────────┘  │
│                                    ▼                                    │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │              AURA Design Tokens (M3 Strict + Luxury)              │  │
│  │    (Navy #0A1128, Chrome #6B9FB8, Bronze #D4AF37, Noir #050814)   │  │
│  └───────────────────────────────────────────────────────────────────┘  │
├─────────────────────────────────────────────────────────────────────────┤
│                       DATA & STATE MANAGEMENT                           │
│  ┌──────────────────────────────┐     ┌──────────────────────────────┐  │
│  │    TanStack Query Hooks      │     │    Zustand Domain Stores     │  │
│  │   (useCustomerMenu, useOrder)│     │  (useCartStore, useAuthStore)│  │
│  └──────────────┬───────────────┘     └──────────────┬───────────────┘  │
├─────────────────┼────────────────────────────────────┼──────────────────┤
│                 ▼                                    ▼                  │
│       Typed API Client Layer (OpenAPI Schemas & Zod DTO Validation)     │
├─────────────────────────────────────────────────────────────────────────┤
│                       BACKEND RUNTIME & DOMAIN                          │
│     Cloudflare Worker (Hono) ── D1 SQLite ── @aura/domain-* Engine      │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Invariant Boundaries: Separation of Concerns

### Architectural Rule: `Shell ≠ Route ≠ Page ≠ Feature ≠ Component ≠ API`

| Layer | Responsibility | Forbidden In This Layer | Source Location |
|---|---|---|---|
| **Shell** | Viewport chrome, navigation skeleton, security boundary, theme container | Route logic, page content, business calculations, direct DB calls | `src/components/stitch/*Shell.tsx` |
| **Route** | URL matching, route-level auth guarding, code-splitting boundary (`React.lazy`) | View markup, state management, complex JSX rendering | `src/routes/*.tsx` |
| **Page** | Route endpoint view, composition of feature modules, layout orchestration | Direct SQL/DB access, backend truth calculation, duplicate shells | `src/pages/**/*.tsx` |
| **Feature** | Domain-specific widgets (MenuGrid, KitchenQueue, POSKeypad) | Route path registration, global shell rendering | `src/components/{domain}/*` |
| **Component** | Reusable atomic & molecular UI primitives (Buttons, Cards, Dialogs) | Domain-specific API fetching, hardcoded route links | `src/components/ui/*`, `src/components/md3/*` |
| **API / Hook** | Data fetching, caching, mutation submission, optimistic updates | Direct UI rendering, DOM manipulation | `src/hooks/*`, `src/lib/api-client.ts` |

---

## 3. Design System Flow

### Design Rule: `AURA Tokens → M3 Primitives → Shared → Feature → Page`

1. **Tokens (`src/styles/aura-tokens.css`)**: Defines semantic CSS custom properties:
   - Primary: `--aura-chrome-500` (`#6B9FB8`) / `--md-sys-color-primary`
   - Backgrounds: `--aura-navy-900` (`#0A1128`), `--aura-noir-void` (`#050814` for Ops), `--aura-pearl-50` (`#FAFAF8` for Admin)
   - Accent: `--aura-bronze-500` (`#D4AF37`) / `--md-sys-color-tertiary`
   - Shapes: `--md-sys-shape-corner-*` (none=0, xs=4px, sm=8px, md=12px, lg=16px, xl=24px, full=9999px)
   - Elevation: `--md-sys-elevation-level0..3`
2. **M3 Primitives (`src/components/md3/`)**: Strict Material Design 3 React primitives consuming CSS variables directly.
3. **Public Component Barrier (`src/components/ui/index.ts`)**: The stable contract exposing M3 primitives to 120+ consuming files.
4. **Feature Modules (`src/components/{cart,menu,kds,admin}/`)**: Composed domain widgets using M3 primitives.
5. **Page Layer (`src/pages/`)**: Screen views assembled from Feature Modules.

---

## 4. Backend & Security Boundary Invariants (Non-Negotiable)

1. **Server-Authoritative Pricing (M4-C)**: Frontend submits user intent (`items: [{menuItemId, quantity, selectedVariantId, selectedModifierIds}]`); Cloudflare Worker resolves unit prices, validates modifier pricing, calculates discounts, taxes, delivery fees, and order totals. Frontend NEVER sends or enforces final price.
2. **Customer-Safe Menu Projection (M4-B)**: Public/guest menu views consume strictly `GET /api/menu` returning `CustomerMenuResponse`. Sensitive fields (`costPrice`, `recipe`, `supplierId`, `margin`, `internalNotes`) are stripped at the Worker domain boundary.
3. **Immutable Order Snapshot**: Order line items are snapshotted on server creation with immutable price/modifier freeze.
4. **Dual-Gate State Machine**: Order status transitions (`pending` → `confirmed` → `preparing` → `ready` → `completed` / `cancelled`) are strictly enforced by the backend transition matrix. Frontend UI reflects available transitions based on user role (`customer` vs `staff` vs `admin`).
5. **IDOR & Ownership Scoping**: Customer order lookups are scoped to phone number or guest session ID. Foreign or unauthorized accesses return 404/403 fail-closed.
