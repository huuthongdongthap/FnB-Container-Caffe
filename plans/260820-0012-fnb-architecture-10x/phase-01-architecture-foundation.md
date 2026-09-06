# Phase 1: Architecture Foundation

**Duration:** Week 1-2 | **Risk:** Low-Medium | **Goal:** Clean architecture, reduce complexity

---

## 1.1 Split Worker Entry Module

**Current:** `worker/src/index.ts` = 636 LOC, 60+ imports, 90+ route mounts.

**Target:** Domain-based route modules, each ≤50 LOC.

### New Structure

```
worker/src/
├── index.ts              # ~80 LOC: middleware + domain mounts
├── routes/
│   ├── orders/           # order CRUD, status, KDS
│   │   ├── index.ts      # mount sub-routes
│   │   ├── create.ts
│   │   ├── update.ts
│   │   ├── kds.ts
│   │   └── mobile.ts
│   ├── payments/         # payment gateway integration
│   │   ├── index.ts
│   │   ├── payos.ts
│   │   ├── momo.ts
│   │   └── webhooks.ts
│   ├── auth/             # authentication & authorization
│   │   ├── index.ts
│   │   ├── register.ts
│   │   ├── login.ts
│   │   └── staff.ts
│   ├── menu/             # menu & categories
│   │   ├── index.ts
│   │   └── categories.ts
│   ├── loyalty/          # loyalty, referral, birthday, checkin
│   │   ├── index.ts
│   │   ├── points.ts
│   │   ├── referral.ts
│   │   └── birthday.ts
│   ├── admin/            # admin dashboard, reports, metrics
│   │   ├── index.ts
│   │   ├── dashboard.ts
│   │   ├── customers.ts
│   │   └── reports.ts
│   ├── integrations/     # ERPNext, TastyIgniter, Frigate, etc.
│   │   ├── index.ts
│   │   ├── erpnext.ts
│   │   └── third-party.ts
│   ├── saas/             # multi-tenant, subscriptions
│   │   ├── index.ts
│   │   └── tenants.ts
│   └── cron/             # scheduled jobs
│       ├── index.ts
│       └── jobs.ts
```

### Migration Steps

1. Create domain directories
2. Move handlers from `index.ts` to domain modules
3. Update imports in new `index.ts`
4. Verify all routes still work
5. Delete old flat route files

---

## 1.2 API Versioning

**Current:** All routes under `/api/`.

**Target:** `/api/v1/` prefix with backward compat alias.

### Implementation

```typescript
// worker/src/index.ts
const v1 = new Hono<{ Bindings: Env }>();

// Mount all routes under v1
v1.route('/menu', menuRouter);
v1.route('/orders', ordersRouter);
// ... etc

// Versioned path
app.route('/api/v1', v1);

// Backward compat alias (deprecated, remove in v4)
app.route('/api', v1);
```

### Affected Files

- `worker/src/index.ts` — add v1 router
- All frontend API calls — no change needed (alias handles it)

---

## 1.3 Order State Machine

**Current:** Order status is a string, updated via raw SQL.

**Target:** Finite state machine with validated transitions.

### State Diagram

```
┌─────────┐
│ pending │
└────┬────┘
     │ confirm()
     ▼
┌───────────┐
│ confirmed │
└────┬──────┘
     │ startPreparing()
     ▼
┌───────────┐
│ preparing │
└────┬──────┘
     │ markReady()
     ▼
┌──────────┐
│  ready   │
└────┬─────┘
     │ serve()
     ▼
┌─────────┐
│ served  │
└────┬────┘
     │ complete()
     ▼
┌───────────┐
│ completed │
└───────────┘

Cancel paths:
  pending → cancelled
  confirmed → cancelled
  preparing → cancelled (with notification)

Refund path:
  completed → refunded
```

### Implementation

```typescript
// worker/src/lib/order-state-machine.ts

type OrderStatus = 
  | 'pending' 
  | 'confirmed' 
  | 'preparing' 
  | 'ready' 
  | 'served' 
  | 'completed' 
  | 'cancelled' 
  | 'refunded';

const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['preparing', 'cancelled'],
  preparing: ['ready', 'cancelled'],
  ready: ['served'],
  served: ['completed'],
  completed: ['refunded'],
  cancelled: [],
  refunded: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function transitionOrder(
  current: OrderStatus, 
  next: OrderStatus,
  orderId: string
): { valid: boolean; error?: string } {
  if (!canTransition(current, next)) {
    return { 
      valid: false, 
      error: `Invalid transition: ${current} → ${next}` 
    };
  }
  // Audit trail, notifications, etc.
  return { valid: true };
}
```

### DB Migration

```sql
-- Add transition log table
CREATE TABLE order_transitions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id TEXT NOT NULL,
  from_status TEXT NOT NULL,
  to_status TEXT NOT NULL,
  changed_by TEXT,
  changed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  metadata TEXT, -- JSON for additional context
  FOREIGN KEY (order_id) REFERENCES orders(id)
);
```

---

## 1.4 Error Boundaries

**Current:** Single `React.Suspense` in App.tsx.

**Target:** Error boundaries per route group.

### Implementation

```tsx
// src/components/error-boundary.tsx
import React from 'react';

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  onError?: (error: Error) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    this.props.onError?.(error);
    console.error('ErrorBoundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="p-8 text-center">
          <h2>Đã xảy ra lỗi</h2>
          <p className="text-gray-500">{this.state.error?.message}</p>
          <button 
            onClick={() => this.setState({ hasError: false, error: null })}
            className="mt-4 px-4 py-2 bg-blue-500 text-white rounded"
          >
            Thử lại
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
```

### Usage in App.tsx

```tsx
<ErrorBoundary>
  <React.Suspense fallback={<LoadingSpinner />}>
    <Routes>
      <Route path="/menu/*" element={
        <ErrorBoundary>
          <MenuPage />
        </ErrorBoundary>
      } />
      {/* ... other routes */}
    </Routes>
  </React.Suspense>
</ErrorBoundary>
```

---

## 1.5 Delete Duplicate Stitch Pages

**Current:** Multiple versions of same pages exist.

**Duplicates to consolidate:**

| Keep | Delete | Reason |
|------|--------|--------|
| `StitchMenuNew` | `StitchMenu2New` | Redundant menu variant |
| `StitchAccountNew` | `StitchAccountDashNew` | Same page, different layout |
| `StitchReferralNew2` | `StitchReferralNew1` | v2 is improved |
| `StitchContainerNew2` | `StitchContainerNew1` | v2 is improved |

### Deletion Checklist

1. Verify no imports reference deleted files
2. Update route definitions
3. Delete files
4. Run `tsc --noEmit` to verify
5. Run tests

---

## 1.6 Consolidate Zustand Stores

**Current:** 28 stores with overlapping concerns.

**Target:** 15 consolidated stores.

### Merge Plan

| Current Stores | Merge Into | Rationale |
|----------------|------------|-----------|
| `use-cart-store` | Keep | Core cart, localStorage |
| `use-order-store` | Keep | Order lifecycle |
| `use-menu-store` | Keep | Menu data |
| `use-auth-store` | Keep | Authentication |
| `use-payment-store` | Merge into `use-order-store` | Payment is part of order flow |
| `use-loyalty-store` | Keep | Loyalty logic |
| `use-referral-store` | Merge into `use-loyalty-store` | Referral is part of loyalty |
| `use-reservation-store` | Keep | Reservations |
| `use-checkin-store` | Merge into `use-loyalty-store` | Checkin is part of loyalty |
| `use-contact-store` | Keep | Contact form |
| `use-favorites-store` | Keep | User favorites |
| `use-refund-store` | Merge into `use-order-store` | Refund is part of order |
| `admin/use-admin-customers-store` | Keep | Customer management |
| `admin/use-admin-dashboard-store` | Keep | Dashboard metrics |
| `admin/use-admin-orders-store` | Merge into `use-order-store` | Admin order view |
| `admin/use-admin-reservations-store` | Merge into `use-reservation-store` | Same data |
| `admin/use-admin-shifts-store` | Keep | Staff shifts |
| `admin/use-admin-staff-store` | Keep | Staff management |
| `admin/use-audit-store` | Keep | Audit logging |
| `admin/use-metrics-store` | Merge into `admin/use-admin-dashboard-store` | Same data |
| `admin/use-performance-store` | Merge into `admin/use-admin-dashboard-store` | Same data |

### Migration Steps

1. Create merged store files
2. Update imports in consuming components
3. Verify no data loss
4. Delete old store files
5. Run tests

---

## Verification

After Phase 1:

1. `npx tsc --noEmit` — zero errors
2. `npx vitest run` — all tests pass
3. `npx vite build --mode production` — successful build
4. Manual smoke test of critical flows:
   - Menu → Cart → Checkout → Order Success
   - Admin login → Dashboard → Orders
   - KDS → Order status update

---

*Phase 1 created: 2026-08-20*
