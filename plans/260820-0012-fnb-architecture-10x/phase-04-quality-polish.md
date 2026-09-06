# Phase 4: Quality & Polish

**Duration:** Week 7-8 | **Risk:** Low | **Goal:** Production hardening

---

## 4.1 Full i18n Extraction

**Current:** Only `vi`/`en` routes, ~30% hardcoded Vietnamese strings.

**Target:** 100% string extraction, fallback chains.

### Steps

1. Audit all `.tsx` files for hardcoded strings
2. Create `src/i18n/vi.ts` and `src/i18n/en.ts`
3. Replace all strings with `t('key')` calls
4. Add language switcher to UI

### Translation Keys to Extract

| Domain | Key Count | Examples |
|--------|-----------|---------|
| Menu | 25 | "Cà phê", "Đồ ăn", "Thực đơn" |
| Cart | 15 | "Giỏ hàng", "Xóa", "Thử lại" |
| Checkout | 30 | "Thanh toán", "Đặt hàng", "Thành công" |
| Orders | 20 | "Trạng thái", "Chờ xác nhận", "Đang chuẩn bị" |
| Admin | 40 | "Báo cáo", "Khách hàng", "Đơn hàng" |
| Errors | 15 | "Lỗi kết nối", "Dữ liệu không hợp lệ" |
| Notifications | 10 | "Đơn hàng mới", "Thanh toán thành công" |
| **Total** | **~155** | |

---

## 4.2 Consistent Loading States

**Current:** Mix of skeletons, spinners, empty divs.

**Target:** Standardized skeleton components per page type.

### Skeleton Library

```tsx
// src/components/ui/skeleton.tsx
export function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-gray-200 rounded ${className}`} />;
}

export function MenuSkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
      {Array.from({length: 8}).map((_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-40 w-full rounded-lg" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      ))}
    </div>
  );
}

export function OrderListSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({length: 5}).map((_, i) => (
        <div key={i} className="flex items-center gap-4 p-4 border rounded-lg">
          <Skeleton className="h-12 w-12 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <Skeleton className="h-8 w-20" />
        </div>
      ))}
    </div>
  );
}
```

---

## 4.3 Fix 12 Deferred Audit Findings

### CRITICAL (1)

| ID | Issue | Fix |
|----|-------|-----|
| L004 | PayOS race condition (phantom orders) | Add order lifecycle state + retry mechanism |

### HIGH (8)

| ID | Issue | Fix |
|----|-------|-----|
| L008 | Mobile auth stale user | Add refresh token endpoint, auto-refresh on 401 |
| B001 | ERPNext POS auth | Add auth middleware, verify if intentionally public |
| B003 | Idempotency key race | KV write-then-read pattern |
| B005 | Reservation double-booking | UNIQUE partial index on (table_id, date, time) |
| B006 | Client-trusted total | Server-side recalc + tolerance check |
| B007 | Mobile staff login | Device token verification audit |
| B008 | Tenant isolation bypass | JWT vs header reconciliation |

### MEDIUM (3)

| ID | Issue | Fix |
|----|-------|-----|
| B009 | Anonymous reservations | Rate limit + auth decision |
| B012 | Order creation rate limit | Global daily cap |
| L009 | Store getState at render | Use selectors |

---

## 4.4 E2E Tests for Critical Flows

**Current:** Unit tests only, no end-to-end flow coverage.

**Target:** Playwright E2E for all critical paths.

### Critical Flows

1. **Customer Order Flow**
   - Browse menu → Add to cart → Checkout → Pay → Success
2. **Staff KDS Flow**
   - Login → View orders → Update status → Complete
3. **Admin Dashboard Flow**
   - Login → View metrics → Filter by date → Export
4. **Payment Flow**
   - Create order → PayOS redirect → Webhook → Order updated
5. **Reservation Flow**
   - Book table → Admin confirm → Check-in → Table status update

### Playwright Test Structure

```typescript
// tests/e2e/order-flow.spec.ts
import { test, expect } from '@playwright/test';

test('Customer order flow', async ({ page }) => {
  // 1. Browse menu
  await page.goto('/menu');
  await page.click('[data-testid="menu-item-1"]');
  
  // 2. Add to cart
  await page.click('[data-testid="add-to-cart"]');
  await expect(page.locator('[data-testid="cart-count"]')).toHaveText('1');
  
  // 3. Checkout
  await page.click('[data-testid="cart-fab"]');
  await page.fill('[data-testid="customer-name"]', 'Test User');
  await page.fill('[data-testid="customer-phone"]', '0901234567');
  await page.click('[data-testid="place-order"]');
  
  // 4. Verify success
  await expect(page).toHaveURL('/order-success');
  await expect(page.locator('[data-testid="order-number"]')).toBeVisible();
});
```

---

## 4.5 Performance Optimization

**Current:** Bundle size unanalyzed, potential bloat.

**Target:** <150KB initial load, <500KB total bundle.

### Steps

1. Run `npm run build --analyze` to identify bloat
2. Code-split by route (already done with React.lazy)
3. Tree-shake unused exports
4. Optimize images (WebP, lazy load)
5. Add `prefetch`/`preload` for critical resources

### Bundle Analysis Targets

| Asset | Current | Target |
|-------|---------|--------|
| JS (initial) | Unknown | <150KB |
| JS (total) | Unknown | <500KB |
| CSS | Unknown | <50KB |
| Images | Unknown | <200KB |

---

## Verification

After Phase 4:

1. All 155 i18n strings extracted and translated
2. Skeleton screens consistent across all pages
3. All 12 audit findings fixed and verified
4. E2E tests pass for all 5 critical flows
5. Bundle analysis shows <500KB total

---

*Phase 4 created: 2026-08-20*