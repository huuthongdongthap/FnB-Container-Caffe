# AURA OS — Business Logic & Security Boundary Audit

This audit examines whether frontend code attempts to enforce business truth, duplicates server calculations, violates M4-B/M4-C invariants, or breaches security boundaries.

---

## 1. Non-Negotiable Invariant Baseline

| Invariant | Authoritative Engine | Frontend Responsibility | Prohibited Frontend Behavior | Status |
|---|---|---|---|---|
| **Pricing (M4-C)** | Cloudflare Worker + `@aura/domain-order` | Submit user intent (item id, qty, modifiers) | Re-computing discounts, taxes, or total price | **Verified** |
| **Customer Menu (M4-B)** | Cloudflare Worker + `CustomerMenuResponse` | Render customer-safe DTO | Requesting or reading cost/margin/recipe | **Verified** |
| **Order Snapshot** | D1 SQLite (creation freeze) | Display immutable snapshot | Modifying unit price after placement | **Verified** |
| **Order State Machine** | Worker transition matrix | Trigger transition actions via API | Authorizing state jumps locally | **Verified** |
| **IDOR & Scoping** | Worker auth middleware | Send session token / phone | Bypassing ownership checks | **Verified** |

---

## 2. Hardcoded Mock Data & Prototype Duplication

**CRITICAL FINDING:** Several stitch pages contain **hardcoded mock data arrays** with local state management simulating operational flows:

### A. Stitch KDS (`src/pages/stitch/kds/index.tsx`)
```ts
const TICKETS: Ticket[] = [
  { id: 9842, status: 'PREPARING', table: 'B01', service: 'DINE IN', elapsed: '08:45', ... },
  { id: 9843, status: 'PENDING', table: 'B05', service: 'TOGO', elapsed: '02:10', ... },
  // 5 mock tickets with local setInterval timer simulation!
];
```
- **Risk:** This is a **pure prototype view** simulating kitchen operations with client-side timers, completely detached from the real `use-kds` hook or SSE/WebSocket connection.
- **Remediation:** Wire to authoritative `use-kds.ts` hook under `OpsShell`; deprecate hardcoded mock array.

### B. Stitch Order Management (`src/pages/stitch/order-management/index.tsx`)
- Contains static mock orders and local filter state.
- **Risk:** Simulates order dispatch without hitting the backend API.
- **Remediation:** Wire to `use-order.ts` or admin order hooks.

### C. Triplicate KDS Implementations
1. `src/pages/KDS.tsx` (175 LOC) — uses real `use-kds.ts` query hook, connected to backend.
2. `src/pages/mobile/kitchen-display.tsx` (184 LOC) — uses `use-kds.ts`, mobile-adapted.
3. `src/pages/stitch/kds/index.tsx` (172 LOC) — uses **hardcoded mock array `TICKETS`**.
- **Action:** Consolidate around `src/pages/KDS.tsx` as the single canonical KDS implementation on `OpsShell`. Delete or repurpose the stitch mock.

### D. Duplicate POS Implementations
1. `src/pages/admin/POS.tsx` (174 LOC) — connected to catalog/order APIs.
2. `src/pages/stitch/admin-pos/index.tsx` (182 LOC) — prototype view with local mock catalog.
- **Action:** Consolidate around `src/pages/admin/POS.tsx` (or move to `OpsShell` as TablePOS).

---

## 3. Frontend Price Calculation Audit

Inspected: `src/hooks/stores/use-cart-store.ts`, `src/components/cart/cart-bottom-bar.tsx`, `src/pages/checkout.tsx`.

### Findings:
1. **`use-cart-store.ts`**: Stores `{ id, name, price, quantity, selectedVariant, selectedModifiers }`. It computes an *estimated* cart subtotal client-side for UI display (`totalPrice()` helper).
   - **Compliance:** **PASS WITH ADVISORY.** The subtotal is displayed for customer convenience before submission. The checkout submission payload sends only item IDs, quantities, and modifier IDs to `POST /api/orders`. The server independently recalculates all prices from the database.
   - **Advisory:** UI label should say "Tạm tính" (Estimated total), not "Tổng tiền" (Final total), until the server returns the authoritative order summary.

2. **`cart-bottom-bar.tsx`**: Reads `totalPrice()` from the cart store. Renders a single formatted number.
   - **Compliance:** PASS (pure display).

3. **`src/pages/checkout.tsx`**: Submits order intent to `/api/orders`. Renders the authoritative response returned by the server.
   - **Compliance:** PASS (server authoritative).

---

## 4. Customer-Safe Menu Projection (M4-B Audit)

Inspected: `src/pages/menu.tsx`, `src/hooks/useCustomerMenu.ts`, `src/hooks/use-menu.ts`.

### Findings:
1. **`useCustomerMenu.ts`**: Hits `GET /api/menu` and types the response against the customer DTO.
   - Sensitive fields (`costPrice`, `recipe`, `supplierId`, `margin`, `internalNotes`) are **NOT present** in the frontend type definition.
   - Even if backend leaked fields, frontend types drop them. (Backend positive allowlist was verified in M4-B).
   - **Compliance:** **PASS (Fully enforced).**

2. **`src/pages/menu.tsx`**: Uses `useCustomerMenu()` as primary data source.
   - **Compliance:** **PASS.**

3. **Potential Leak in Stitch Prototypes**:
   - `src/pages/stitch/digital-menu/index.tsx` and `digital-menu-2/index.tsx` import static mock data files with arbitrary price/description fields.
   - These are unrouted or showcase-only; they do not hit the live API.
   - **Remediation:** Replace with canonical `menu.tsx` consumption.

---

## 5. Order State Machine Dual-Gate Audit

Inspected order transition triggers across UI:

| Location | Action | How Transition is Triggered | Client Authorization Check? | Server Enforcement |
|---|---|---|---|---|
| `src/pages/KDS.tsx` | Bump ticket (preparing → ready) | `mutation.mutate({ orderId, status: 'ready' })` | None (optimistic UI only) | Dual-gate: structural 400 then role 403 |
| `src/pages/admin/Orders.tsx` | Cancel order | `mutation.mutate({ orderId, status: 'cancelled' })` | Role check for UI button visibility only | Authoritative backend check |
| `src/pages/track-order/` | View live status | Read-only polling | None | Customer-scoped |

**Compliance:** **PASS.** Frontend does not attempt to enforce state transitions locally. All mutations hit the server, which validates against the canonical state machine.

---

## 6. Token & Design System Invariant Audit

| File Area | Token Compliance | Prohibited Classes | Remediation |
|---|---|---|---|
| `src/components/md3/*` | **100% Strict M3** | 0 raw classes | Standard reference |
| `src/components/ui/*` | Mixed | Uses Tailwind theme tokens + some raw | Bridge with adapters |
| `src/components/stitch/*` | Mixed | 180+ raw color/shape classes | Tokenize to AURA/M3 |
| `src/pages/admin/*` | Poor | 280+ raw color/shape classes | Tokenize during Phase 5 |
| `src/pages/stitch/*` | Very Poor | 300+ raw classes | Tokenize or delete |
| `src/pages/mobile/*` | Critical | Hardcoded inline `#0B132B` styles | Standardize to OpsShell |

---

## 7. Security Boundary Summary

```
┌─────────────────────────────────────────────────────────┐
│                    SECURITY ASSESSMENT                  │
├──────────────────────────┬──────────────────────────────┤
│ M4-C Server Pricing      │ ✓ COMPLIANT (Server owns it) │
│ M4-B Customer Menu DTO   │ ✓ COMPLIANT (Stripped at API)│
│ State Machine Authority  │ ✓ COMPLIANT (Server enforced)│
│ IDOR Protection          │ ✓ COMPLIANT (Session-scoped) │
│ Mock Data Leaks          │ ⚠️ 4 STITCH PROTOTYPES FOUND  │
│ Ops Dark Surface         │ ⚠️ OPS SHELL LIGHT IN LIGHT  │
│ CartBar Leaks Outside    │ ⚠️ CART BAR RENDERS ON KDS   │
└──────────────────────────┴──────────────────────────────┘
```

**Verdict:** Security and domain invariants (M4-B, M4-C) are **intact and correctly enforced** at the API boundary. The structural defects are purely frontend shell leakage, mock data in prototype pages, and design-token violations. No backend changes required.