# AURA OS — State & Data Flow Audit

This matrix maps state ownership (Zustand stores + TanStack Query hooks), data flow from UI to AURA API, and identifies duplicated business logic that must not be reimplemented in the frontend.

---

## 1. State Architecture Overview

```
┌──────────────────────────────────────────────────────────────┐
│  UI LAYER (Pages / Shells / Features)                         │
│  ─ CustomerShell · OpsShell · AdminShell                     │
└───────────────┬──────────────────────────────┬───────────────┘
                │                              │
    ┌───────────▼───────────┐      ┌───────────▼──────────────┐
    │  SERVER STATE         │      │  CLIENT STATE            │
    │  TanStack Query       │      │  Zustand (12 stores)     │
    │  (~40 query hooks)    │      │  persistence: localStorage│
    └───────────┬───────────┘      └───────────┬──────────────┘
                │                              │
                │  cache invalidation          │  session / ephemeral UI
                ▼                              ▼
    ┌──────────────────────────────────────────────────────────┐
    │  TYPED API LAYER  (src/lib/api/*, OpenAPI-derived types) │
    └──────────────────────────┬───────────────────────────────┘
                               │
                               ▼
    ┌──────────────────────────────────────────────────────────┐
    │  CLOUDFLARE WORKER  (Hono)  →  D1  →  @aura/domain-*     │
    │  AUTHORITATIVE: pricing · order state · auth · inventory │
    └──────────────────────────────────────────────────────────┘
```

**Principle:** Server state MUST live in TanStack Query. Client-only ephemeral state (cart draft, UI toggles, session) lives in Zustand. Business truth (price, discount, total, availability, order state) is **never** computed or stored authoritatively in either layer.

---

## 2. Client State — Zustand Stores (12)

| Store | File | Persisted | Owns | Authoritative? | Notes |
|---|---|---|---|---|---|
| `use-cart-store` | `src/hooks/stores/use-cart-store.ts` | ✓ localStorage | Cart line items (client draft) | **No** | Server recalculates price at checkout |
| `use-order-store` | `src/hooks/stores/use-order-store.ts` | ✓ | Order draft, UI step | **No** | Order state comes from server |
| `use-auth-store` | `src/hooks/stores/use-auth-store.ts` | ✓ | Session token, user profile | Partial | Server validates every request |
| `use-menu-store` | `src/hooks/stores/use-menu-store.ts` | ✗ | Menu UI filters, category selection | No | Menu data from Query |
| `use-reservation-store` | `src/hooks/stores/use-reservation-store.ts` | ✓ | Reservation form draft | No | Server owns slot availability |
| `use-loyalty-store` | `src/hooks/stores/use-loyalty-store.ts` | ✓ | Points display cache | **No** | Server owns point balance |
| `use-favorites-store` | `src/hooks/stores/use-favorites-store.ts` | ✓ | Favorite item IDs | No | Client convenience |
| `use-checkin-store` | `src/hooks/stores/use-checkin-store.ts` | ✓ | Check-in flow state | No | Server validates code |
| `use-payment-store` | `src/hooks/stores/use-payment-store.ts` | ✗ | Payment method selection | No | Server processes |
| `use-referral-store` | `src/hooks/stores/use-referral-store.ts` | ✓ | Referral code cache | No | Server owns attribution |
| `use-refund-store` | `src/hooks/stores/use-refund-store.ts` | ✗ | Refund request draft | No | Server owns refund state |
| `use-contact-store` | `src/hooks/stores/use-contact-store.ts` | ✗ | Contact form draft | No | — |

**Supporting modules:**
- `loyalty-store-helpers.ts`, `loyalty-store-types.ts`
- `order-store-constants.ts`, `order-store-types.ts`, `order-store-utils.ts`
- `src/hooks/stores/admin/` (admin-specific stores)
- `__tests__/` (store test coverage)

**Finding:** 12 stores is reasonable. Risk is `use-cart-store` / `use-order-store` drifting toward local price computation — must be verified they only hold **intent** (item ids, quantities, modifiers), never computed totals.

---

## 3. Server State — TanStack Query Hooks (~40)

| Hook | File | Endpoint(s) | Shell(s) | Domain |
|---|---|---|---|---|
| `useCustomerMenu` | `src/hooks/useCustomerMenu.ts` | `GET /api/menu` (customer-safe DTO) | Customer | **M4-B boundary** |
| `use-menu` | `src/hooks/use-menu.ts` | `GET /api/menu` | Customer/Admin | Catalog |
| `use-cart` | `src/hooks/use-cart.ts` | cart mutations | Customer | M4-C |
| `use-checkout` | `src/hooks/use-checkout.ts` | `POST /api/orders` | Customer | **M4-C** |
| `use-order` | `src/hooks/use-order.ts` | `GET /api/orders/{id}` | Customer/Ops/Admin | M4-C |
| `use-reservations` | `src/hooks/use-reservations.ts` | `/api/reservations` | Customer/Admin | — |
| `use-promotions` | `src/hooks/use-promotions.ts` | `/api/promotions` | Customer/Admin | — |
| `use-loyalty` | `src/hooks/use-loyalty.ts` | `/api/loyalty` | Customer | — |
| `use-referral` | `src/hooks/use-referral.ts` | `/api/referral` | Customer | — |
| `use-account` | `src/hooks/use-account.ts` | `/api/account` | Customer | — |
| `use-checkin` | `src/hooks/use-checkin.ts` | `/api/checkin` | Customer/Ops | — |
| `use-reviews` | `src/hooks/use-reviews.ts` | `/api/reviews` | Customer | — |
| `use-kds` | `src/hooks/use-kds.ts` | `/api/kds` | **Ops** | Ops |
| `use-kds-audio` | `src/hooks/use-kds-audio.ts` | — (client) | **Ops** | Ops |
| `use-tv-menu` | `src/hooks/use-tv-menu.ts` | `/api/tv-menu` | **Ops** | Ops |
| `use-pos-customer` | `src/hooks/use-pos-customer.ts` | `/api/pos` | **Ops** | Ops |
| `use-split-bill` | `src/hooks/use-split-bill.ts` | `/api/orders/split` | **Ops** | Ops |
| `use-admin` | `src/hooks/use-admin.ts` | `/api/admin/*` | Admin | Admin |
| `use-analytics` | `src/hooks/use-analytics.ts` | `/api/admin/analytics` | Admin | Admin |
| `use-reports` | `src/hooks/use-reports.ts` | `/api/admin/reports` | Admin | Admin |
| `use-birthday-admin` | `src/hooks/use-birthday-admin.ts` | `/api/admin/birthday` | Admin | Admin |
| `use-broadcast` | `src/hooks/use-broadcast.ts` | `/api/admin/broadcasts` | Admin | Admin |
| `use-campaigns-admin` | `src/hooks/use-campaigns-admin.ts` | `/api/admin/campaigns` | Admin | Admin |
| `use-subscriptions` | `src/hooks/use-subscriptions.ts` | `/api/subscriptions` | Admin | Admin |
| `use-chat` | `src/hooks/use-chat.ts` | `/api/chat` | Admin | Admin |
| `use-events` | `src/hooks/use-events.ts` | `/api/events` | Customer | — |
| `use-contact` | `src/hooks/use-contact.ts` | `/api/contact` | Customer | — |
| `use-mobile-auth` | `src/hooks/use-mobile-auth.tsx` | `/api/mobile/auth` | **Mobile (orphan)** | — |

**Non-query utility hooks (no server state):** `use-focus-trap`, `use-offline-sync`, `use-online-status`, `use-parallax-glass`, `use-push-notifications`, `use-pwa-install`, `use-sw-registration`, `use-stitch-container-new2-default-data`, `use-stitch-scroll-animation`, `use-table-context`.

---

## 4. Data Flow — Customer Order Path (M4-C Contract)

```
[Customer taps "Add to cart"]
        │
        ▼
 use-cart-store  ── stores { menuItemId, qty, modifiers }  (INTENT ONLY)
        │
        ▼
 [Customer taps "Checkout"]
        │
        ▼
 use-checkout  ── POST /api/orders  { items[], intent }
        │
        ▼
 ┌─────────────────────────────────────────────────┐
 │  SERVER (AUTHORITATIVE — M4-C)                   │
 │  1. Validate menu item availability              │
 │  2. Resolve prices from catalog (NOT from client)│
 │  3. Apply promotions / loyalty discounts          │
 │  4. Compute final total (server-only)            │
 │  5. Snapshot immutable order                     │
 │  6. Set initial order state                      │
 └─────────────────────┬───────────────────────────┘
                       │  CustomerOrder DTO
                       ▼
            use-order ── cache + display ONLY
```

**Invariant:** Frontend never computes `price`, `discount`, `finalTotal`. These are rendered from the server DTO. If a UI component computes a subtotal for display convenience, it must be labeled as an *estimate* and the server value must override at confirmation.

---

## 5. Data Flow — Customer Menu Path (M4-B Contract)

```
[CustomerShell mounts /menu]
        │
        ▼
 useCustomerMenu ── GET /api/menu  (Accept: customer-safe)
        │
        ▼
 ┌─────────────────────────────────────────────────┐
 │  SERVER — Customer-Safe Projection (M4-B)        │
 │  positive zod allowlist:                         │
 │  ✓ id, name, description, imageUrl, price        │
 │  ✓ category, available, allergens, tags          │
 │  ✗ cost, supplier, margin, recipe, internalNotes │
 └─────────────────────┬───────────────────────────┘
                       │  CustomerMenu DTO
                       ▼
     Render menu — NO admin/cost fields reachable
```

**Invariant:** The customer menu MUST consume the customer-safe DTO. `use-menu.ts` (which may hit an admin-scoped endpoint) must NOT be used inside CustomerShell for menu rendering.

---

## 6. Duplicated Business Logic Audit

| Concern | Implementations Found | Risk | Action |
|---|---|---|---|
| **KDS queue/status** | `src/pages/mobile/kitchen-display.tsx`, `src/pages/KDS.tsx`, `src/pages/stitch/kds/index.tsx` | **HIGH** — 3 KDS impls | Consolidate to one OpsShell KDS |
| **POS terminal** | `src/pages/admin/POS.tsx`, `src/pages/stitch/admin-pos/index.tsx` | **HIGH** — 2 POS impls | Consolidate to one OpsShell POS |
| **Order management** | `src/pages/stitch/order-management/*`, `src/pages/admin/Orders.tsx`, `src/pages/mobile/waiter-orders.tsx` | **HIGH** — 3 order views | Split by shell (Ops vs Admin) |
| **Admin terminal** | `src/pages/stitch/admin-terminal/*`, `src/pages/stitch/admin-v2/*`, `src/pages/admin/*` (108 files) | **HIGH** — 3rd-gen overlap | Consolidate to AdminShell |
| **Cart total display** | `use-cart-store`, `cart-bottom-bar.tsx`, `StitchCheckoutNew` | Medium | Verify all read server DTO |
| **Table management** | `src/pages/mobile/table-manager.tsx`, `src/pages/admin/TableManagement.tsx` | Medium | Ops vs Admin split |
| **Menu rendering** | `StitchMenuNew`, `StitchMenu2New`, `use-menu`, `useCustomerMenu` | Medium | Customer-safe only |

---

## 7. State Ownership Violations Found

| # | Violation | Location | Evidence | Fix Phase |
|---|---|---|---|---|
| 1 | Cart state rendered outside CustomerShell | `src/App.tsx:68` | `<CartBottomBar />` outside `<Routes>`; only gate is `totalItems() > 0` | Phase 1 |
| 2 | `adminRoutes` mount without AdminShell | `src/App.tsx` | `{adminRoutes}` rendered shell-less | Phase 1 |
| 3 | `mobileRoutes` mount without any registered shell | `src/App.tsx` | Orphan `MobileLayout` with hardcoded `#0B132B` | Phase 1 |
| 4 | OpsShell uses light surface token | `src/components/stitch/OpsShell.tsx` | `--md-sys-color-surface-container-lowest` (near-white) | Phase 1 |
| 5 | MD3 primitives bypassed by 120 consumers | `src/components/ui/index.ts` | Barrel exports legacy impls; no adapter | Phase 2 |
| 6 | Token source-of-truth conflict | `global.css:14-15` | `brand-tokens.css` imported before canonical `aura-tokens.css` | Phase 2 |

---

## 8. Persistence & Cache Invalidation

| Concern | Mechanism | Notes |
|---|---|---|
| Cart persistence | `localStorage` via Zustand persist | Survives reload; must sync with server at checkout |
| Auth token | `localStorage` | Server validates per request |
| Query cache | TanStack Query defaults | Must invalidate on mutation (order create, cart update) |
| Offline | `use-offline-sync`, `use-online-status` | Queue mutations when offline |
| PWA | `use-sw-registration`, `use-pwa-install`, `use-push-notifications` | CustomerShell only |

**Risk:** Cart persisted in `localStorage` may hold stale prices if menu changes. Checkout MUST re-resolve server-side (already the M4-C contract).

---

## 9. Verification Requirements (Phase 0 conclusion)

Before any state refactor:
1. Confirm `use-cart-store` / `use-order-store` hold intent only (no computed totals) — read store source.
2. Confirm `useCustomerMenu` uses customer-safe DTO and `use-menu` is not used in CustomerShell.
3. Confirm every mutation invalidates the correct query keys.
4. Confirm no frontend code branches on order state to authorize an action (state transitions are server-only).
5. Confirm auth token handling never trusts client-asserted roles.