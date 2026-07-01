---
title: "API Integration — Full-Stack Zustand + Auth"
description: "Connect 20 React pages to real Hono Worker APIs via Zustand stores. Full JWT auth flow with protected routes. TDD: tests first per phase."
status: complete
priority: P1
branch: "main"
tags: [api-integration, zustand, auth, jwt, react]
blockedBy: [260701-0942-fnb-fullstack-redesign]
blocks: []
created: "2026-07-01T04:42:22.092Z"
createdBy: "ck:plan"
source: "plans/reports/brainstorm-260701-1136-api-integration.md"
mode: tdd
effort: "20h"
---

# API Integration — Full-Stack Zustand + Auth

## Overview

Connect 20 React pages (11 customer + 9 admin) to real Hono Worker APIs. Build JWT auth system (register/login/logout) with Zustand stores, protected routes, and token persistence. All state managed via Zustand stores matching the existing `use-cart-store.ts` pattern.

**Source:** `plans/reports/brainstorm-260701-1136-api-integration.md`

## Design Decisions

| Decision | Choice |
|----------|--------|
| State management | Zustand stores (consistent with existing `use-cart-store.ts`) |
| Auth | JWT token in Zustand, persisted to localStorage as `aura_auth` |
| API client | Extend `src/lib/api-client.ts` with auth token injection |
| Protected routes | `<ProtectedRoute>` wrapper, redirect to `/admin/login` |
| Store pattern | All stores follow cart-store: load from storage, persist on set |
| Testing | TDD — write store tests first, verify 268 existing tests still pass |
| API base URL | `VITE_API_BASE` env var (falls back to worker URL) |

## Architecture

```
src/hooks/stores/              ← All new Zustand stores
├── use-cart-store.ts          ← Exists — keep as-is
├── use-auth-store.ts          ← NEW: JWT, user, login/register/logout
├── use-menu-store.ts          ← NEW: categories, items
├── use-order-store.ts         ← NEW: create, track, history
├── use-payment-store.ts       ← NEW: PayOS link creation
├── use-loyalty-store.ts       ← NEW: points, tier, redeem
├── use-referral-store.ts      ← NEW: code, apply, stats
├── use-reservation-store.ts   ← NEW: slots, book
├── use-checkin-store.ts       ← NEW: submit
├── use-contact-store.ts       ← NEW: send contact form
└── admin/
    ├── use-admin-orders-store.ts
    ├── use-admin-customers-store.ts
    ├── use-admin-staff-store.ts
    └── use-admin-dashboard-store.ts

src/components/auth/           ← Auth UI + infrastructure
├── AuthProvider.tsx            ← Initialize auth from localStorage on mount
├── ProtectedRoute.tsx          ← Check auth, redirect to /admin/login
├── LoginForm.tsx               ← Email + password → login
└── RegisterForm.tsx            ← Name + email + phone + password → register

src/lib/api-client.ts          ← MODIFY: add auth token injection
src/App.tsx                    ← MODIFY: wrap admin routes in ProtectedRoute
src/test-utils.tsx             ← MODIFY: add AuthProvider to test wrapper
```

## Worker API Contracts

**Note:** Loyalty/referral endpoints use dual auth: JWT (`c.get('user')`) OR phone-auth (`c.get('customer')`). See Phase 3 for phone-auth flow.

| Endpoint | Method | Auth | Store |
|----------|--------|------|-------|
| `/api/auth/register` | POST | No | use-auth-store |
| `/api/auth/login` | POST | No | use-auth-store |
| `/api/auth/logout` | POST | No | use-auth-store |
| `/api/auth/me` | GET | Bearer | use-auth-store |
| `/api/menu` | GET | No | use-menu-store |
| `/api/menu/:id` | GET | No | use-menu-store |
| `/api/orders` | POST | Bearer | use-order-store |
| `/api/orders/:id` | GET | No | use-order-store |
| `/api/orders/latest` | GET | No | use-order-store |
| `/api/payment/create-link` | POST | **Bearer** | use-payment-store |
| `/api/contact` | POST | No | use-contact-store |
| `/api/loyalty/summary` | GET | customer | use-loyalty-store |
| `/api/loyalty/points` | GET | customer | use-loyalty-store |
| `/api/loyalty/cashback` | GET | customer | use-loyalty-store |
| `/api/loyalty/redeem` | POST | customer | use-loyalty-store |
| `/api/loyalty/rewards` | GET | customer | use-loyalty-store |
| `/api/loyalty/tiers` | GET | No | use-loyalty-store |
| `/api/loyalty/phone-auth` | POST | No | use-loyalty-store |
| `/api/loyalty/referral/code` | GET | customer | use-referral-store |
| `/api/loyalty/referral/apply` | POST | customer | use-referral-store |
| `/api/loyalty/referral/stats` | GET | customer | use-referral-store |
| `/api/reservations/availability` | GET | No | use-reservation-store |
| `/api/reservations` | POST | No | use-reservation-store |
| `/api/admin/orders` | GET | Bearer | use-admin-orders-store |
| `/api/admin/customers` | GET | Bearer | use-admin-customers-store |
| `/api/auth/staff` | GET | Bearer(owner) | use-admin-staff-store |
| `/api/auth/register-staff` | POST | Bearer(owner) | use-admin-staff-store |
| `/api/stats` | GET | No | use-admin-dashboard-store |

**API base URL:** `VITE_API_BASE` env var — defaults to deployed worker URL. Current worker: `https://aura-space-worker.agencyos-openclaw.workers.dev`. Update `src/lib/api-client.ts` default accordingly.

## Phases

| Phase | Name | Status | Priority | Dependencies | Effort |
|-------|------|--------|----------|-------------|--------|
| 1 | [Auth System](./phase-01-auth-system.md) | ✅ Complete | P1 | — | 4h |
| 2 | [Revenue Path Integration](./phase-02-revenue-path-integration.md) | ✅ Complete | P1 | Phase 1 | 5h |
| 3 | [Loyalty + Marketing](./phase-03-loyalty-marketing.md) | ✅ Complete | P2 | Phase 1 | 4h |
| 4 | [Operations + Reservations](./phase-04-operations-reservations.md) | ✅ Complete | P2 | Phase 1 | 3h |
| 5 | [Admin Dashboard](./phase-05-admin-dashboard.md) | ✅ Complete | P1 | Phase 1 | 4h |
| 6 | [Testing + Polish](./phase-06-testing-polish.md) | ✅ Complete | P1 | Phases 2-5 | 3h |

**Parallel execution:** Phases 2, 3, 4, 5 can run concurrently after Phase 1 (auth) completes. Phase 6 must run last.

## Dependencies

- `blockedBy: [260701-0942-fnb-fullstack-redesign]` — the React v3.0 migration must be complete (pages/components/tests exist)

## TDD Contract

Every phase:
1. Write store tests FIRST (test loading, success, error states)
2. Implement store + API calls
3. Verify store tests pass
4. Wire store to page components
5. Run ALL existing tests — 268 must still pass
6. `npm run build` must succeed with 0 TypeScript errors
