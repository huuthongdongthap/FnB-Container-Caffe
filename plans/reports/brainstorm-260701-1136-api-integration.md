# Brainstorm: Full-Stack API Integration — FnB Container Caffe v3.1

**Date:** 2026-07-01 | **Source:** `/brainstorm plan next`

## Problem

React v3.0 migration deployed. 268 frontend tests + 80 worker tests pass. But frontend components render with **static/mock data** — no API calls to the deployed Hono worker. Pages look correct but are disconnected from real backend.

## Requirements

| Item | Detail |
|------|--------|
| **Expected output** | 20 React pages connected to real worker APIs. Auth flow (register/login/JWT). Protected routes. Admin dashboard with real data. All 268 existing tests still pass + new integration tests. |
| **Acceptance criteria** | Customer can: register → login → browse menu → add to cart → checkout (COD/PayOS) → see real order confirm → track order → earn loyalty points → refer friends. Admin can: login → see dashboard with real stats → manage orders/customers/staff/reservations. |
| **Scope** | Full stack: 11 customer pages + 9 admin pages. All worker endpoints wired. Auth system with JWT + protected routes. |
| **Out of scope** | New backend endpoints (worker has everything needed). UI redesign. New features. Payment provider changes. |
| **Constraints** | Zustand stores (matches cart pattern). TDD — tests first. Existing 268 tests must not break. Build: 0 TS errors. Worker API contracts unchanged. |
| **Touchpoints** | `src/lib/api-client.ts`, `src/hooks/use-cart-store.ts`, all `src/pages/*.tsx`, all `src/components/**/*.tsx`, `src/App.tsx` (add ProtectedRoute), `src/test-utils.tsx` (add auth wrapper) |

## Approach: Zustand Stores + API Client

**Chosen:** Zustand stores for all state (consistent with existing `use-cart-store.ts`).

Each store:
- State interface + actions that call `api-client.ts`
- Loading/error/success tracking per operation
- Auth token from `use-auth-store` attached to all API calls
- localStorage persistence for auth token + cart

### Architecture

```
src/hooks/stores/
├── use-cart-store.ts          ← Exists — keep as-is
├── use-auth-store.ts          ← NEW: JWT, user, login/register/logout
├── use-menu-store.ts          ← NEW: categories, items, search
├── use-order-store.ts         ← NEW: create, track, history
├── use-loyalty-store.ts       ← NEW: points, tier, rewards
├── use-referral-store.ts      ← NEW: code, cashback, stats
├── use-reservation-store.ts   ← NEW: slots, book, confirm
├── use-checkin-store.ts       ← NEW: submit, verify
├── use-contact-store.ts       ← NEW: send contact form
└── admin/
    ├── use-admin-orders-store.ts
    ├── use-admin-customers-store.ts
    ├── use-admin-staff-store.ts
    ├── use-admin-dashboard-store.ts
    └── use-admin-reservations-store.ts

src/components/auth/
├── AuthProvider.tsx            ← Initialize auth from localStorage
├── ProtectedRoute.tsx          ← Redirect to /admin/login if no token
├── LoginForm.tsx               ← Email + password → JWT
└── RegisterForm.tsx            ← Name + email + phone + password → JWT
```

### Auth Flow

```
1. App mounts → AuthProvider reads JWT from localStorage
2. Any route wrapped in <ProtectedRoute> checks auth store
3. Unauthenticated → redirect to /admin/login
4. Login/Register → POST /api/auth/login or /api/auth/register
5. JWT stored in Zustand (persisted to localStorage as 'aura_auth')
6. All API calls read token from use-auth-store.getState().token
7. 401 response → clear token, redirect to login
```

### Store Pattern (matching use-cart-store.ts)

```typescript
interface MenuState {
  items: MenuItem[];
  categories: string[];
  loading: boolean;
  error: string | null;
  fetchMenu: () => Promise<void>;
}
```

### API Endpoints Mapped

| Store | API | Method |
|-------|-----|--------|
| use-auth-store | `/api/auth/register` | POST |
| | `/api/auth/login` | POST |
| | `/api/auth/logout` | POST |
| | `/api/auth/me` | GET |
| use-menu-store | `/api/menu` | GET |
| use-order-store | `/api/orders` | POST (create) |
| | `/api/orders/:id` | GET (track) |
| | `/api/orders` | GET (history, auth required) |
| use-loyalty-store | `/api/loyalty` | GET |
| | `/api/loyalty/redeem` | POST |
| use-referral-store | `/api/referrals/code` | GET |
| | `/api/referrals/apply` | POST |
| use-reservation-store | `/api/reservations` | GET/POST |
| use-checkin-store | `/api/checkin` | POST |
| use-contact-store | `/api/contact` | POST |
| use-payments (inline) | `/api/payments/create-link` | POST |
| Admin stores | All admin-prefixed endpoints | GET/POST/PUT/DELETE |

### Trade-offs (Zustand vs TanStack Query)

| Concern | Zustand | TanStack Query |
|---------|---------|----------------|
| Cache invalidation | Manual (reset state) | Automatic (staleTime) |
| Background refetch | Manual (setInterval) | Built-in (refetchOnWindowFocus) |
| Loading/error state | Manual per store | Built-in per query |
| Optimistic updates | Manual state mutation | Built-in (onMutate) |
| Code consistency | ✅ Matches cart-store | New pattern |
| Bundle size | ✅ Already in use | Already in use |
| Learning curve | ✅ Team knows it | New pattern |

**Bottom line:** Zustand is the right call for consistency. The trade-offs (manual cache/refetch) are acceptable for a café site where menu data changes infrequently and orders are write-heavy.

## Phases (estimated 18-22h)

| Phase | Name | Scope | Effort |
|-------|------|-------|--------|
| 1 | Auth System | Auth store, Provider, ProtectedRoute, LoginForm, RegisterForm, token persistence, 401 handling | 4h |
| 2 | Revenue Path Integration | Menu store, Order store, Payment link. Wire Home, Menu, Checkout, Success, Failure pages | 5h |
| 3 | Loyalty + Marketing | Loyalty, Referral, Promotion stores. Wire Loyalty, Calculator, Referral, Promotions pages | 4h |
| 4 | Operations + Reservations | Reservation, Checkin, Contact, TrackOrder stores. Wire all ops pages | 3h |
| 5 | Admin Dashboard | All admin stores. Wire Dashboard, Orders, Customers, Staff, Reservations, POS, CheckinApprove | 4h |
| 6 | Testing + Polish | Integration tests per store. Auth flow E2E. 268 existing tests still pass. Build verification | 3h |

## Risks

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Worker CORS blocks SPA origin | Medium | Worker already has CORS middleware. Verify `Access-Control-Allow-Origin` matches Pages domain |
| Auth token expires mid-session → broken API calls | Medium | Auth store intercepts 401, clears token, redirects to login |
| Zustand store proliferation → inconsistent patterns | Low | All stores follow cart-store template. Code review enforces |
| Existing tests break from store integration | Low | TDD: write tests first, verify old tests still pass each phase |

## Unresolved Questions

- None. All design decisions confirmed.

## Next Step

→ `/ck:plan --tdd` with this report as source.
