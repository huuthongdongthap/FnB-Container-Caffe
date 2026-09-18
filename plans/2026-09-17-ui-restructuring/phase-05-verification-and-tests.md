# Pha 05: Verification & Tests — Complete UI Restructuring

## Mục tiêu
- Chạy toàn bộ test suite (3,379 tests) → **GREEN**
- Verify routing: 3 Shell隔离, 5 tab Bottom Nav, CartBottomBar logic
- Visual regression check: 3 shell themes, density, typography
- Build production bundle → size check
- Smoke test critical user flows end-to-end

---

## 1. Test Suite Verification

### 1.1 Unit Tests (Vitest)
```bash
npx vitest run --reporter=verbose 2>&1 | tail -30
# Expect: Test Files  1xx passed | Tests  3379 passed
```

**Critical test files to verify:**
- `src/components/md3/__tests__/md3-app-shell.test.tsx` — NavigationBar active state
- `src/components/stitch/__tests__/CustomerShell.test.tsx` — Shell config matching
- `src/components/stitch/__tests__/OpsShell.test.tsx` — No MD3AppShell render
- `src/components/stitch/__tests__/AdminShell.test.tsx` — AdminLayout wrapper
- `src/components/cart/__tests__/cart-bottom-bar.test.tsx` — `hasM3NavBar` logic
- `src/hooks/__tests__/useCustomerMenu.test.ts` — TanStack Query integration
- `src/routes/__tests__/routing.test.tsx` — Layout Route nesting

### 1.2 Integration Tests (Worker)
```bash
cd worker && npx vitest run --reporter=verbose 2>&1 | tail -20
# Expect: All integration tests pass (order → payment → ERPNext → loyalty)
```

### 1.3 Type Check
```bash
npx tsc --noEmit 2>&1 | tail -10
# Expect: 0 errors
```

---

## 2. Routing Verification Matrix

| Route | Shell | TopAppBar | BottomNav | CartBottomBar | Notes |
|-------|-------|-----------|-----------|---------------|-------|
| `/` | Customer | ❌ | ✅ | ✅* | Home tab |
| `/menu` | Customer | ✅ | ✅ | ✅* | Menu tab |
| `/table-reservation` | Customer | ✅ | ✅ | ✅* | Reservation tab |
| `/promotions` | Customer | ✅ | ✅ | ✅* | Promotions tab |
| `/account` | Customer | ✅ | ✅ | ✅* | Account tab |
| `/checkout` | Customer | ✅ | ❌ | ✅ | Functional |
| `/order` | Customer | ✅ | ❌ | ✅ | Table order |
| `/checkin` | Customer | ✅ | ❌ | ✅ | Check-in |
| `/kds` | Ops | ❌ | ❌ | ❌ | Fullscreen dark |
| `/tv-menu` | Ops | ❌ | ❌ | ❌ | Fullscreen dark |
| `/pos/table/:id` | Ops | ❌ | ❌ | ❌ | Fullscreen dark |
| `/admin/*` | Admin | Sidebar | ❌ | ❌ | AdminLayout |

*CartBottomBar chỉ hiện khi có món trong giỏ (store state)

### 2.1 Automated Routing Tests

```tsx
// src/routes/__tests__/routing.test.tsx
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { App } from '@/App';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient();

function renderApp(pathname: string) {
  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter initialEntries={[pathname]}>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  );
}

describe('Shell Routing Isolation', () => {
  test('CustomerShell: /menu has BottomNav + TopAppBar', () => {
    renderApp('/menu');
    expect(screen.getByRole('navigation', { name: /bottom navigation/i })).toBeInTheDocument();
    expect(screen.getByRole('banner')).toBeInTheDocument();
  });

  test('CustomerShell: /checkout has TopAppBar only', () => {
    renderApp('/checkout');
    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: /bottom navigation/i })).not.toBeInTheDocument();
  });

  test('OpsShell: /kds has NO TopAppBar, NO BottomNav, NO Cart', () => {
    renderApp('/kds');
    expect(screen.queryByRole('banner')).not.toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: /bottom navigation/i })).not.toBeInTheDocument();
    expect(screen.queryByTestId('cart-bottom-bar')).not.toBeInTheDocument();
    expect(screen.getByTestId('ops-shell')).toBeInTheDocument();
  });

  test('OpsShell: /tv-menu isolated', () => {
    renderApp('/tv-menu');
    expect(screen.getByTestId('ops-shell')).toBeInTheDocument();
  });

  test('AdminShell: /admin/dashboard has Sidebar', () => {
    renderApp('/admin/dashboard');
    expect(screen.getByTestId('admin-sidebar')).toBeInTheDocument();
    expect(screen.getByTestId('admin-breadcrumbs')).toBeInTheDocument();
  });
});

describe('Bottom Nav Active State', () => {
  const tabs = ['/', '/menu', '/table-reservation', '/promotions', '/account'];
  tabs.forEach((path) => {
    test(`active tab highlighted at ${path}`, () => {
      renderApp(path);
      const nav = screen.getByRole('navigation', { name: /bottom navigation/i });
      const activeItem = nav.querySelector('[aria-selected="true"]');
      expect(activeItem).toBeInTheDocument();
    });
  });
});
```

---

## 3. CartBottomBar Logic Tests

```tsx
// src/components/cart/__tests__/cart-bottom-bar.test.tsx
import { render, screen } from '@testing-library/react';
import { CartBottomBar } from '@/components/cart/cart-bottom-bar';
import { useCartStore } from '@/stores/cart-store';
import { MemoryRouter } from 'react-router-dom';

// Mock store
vi.mock('@/stores/cart-store', () => ({
  useCartStore: vi.fn(),
}));

describe('CartBottomBar Visibility', () => {
  const renderBar = (pathname: string, hasItems: boolean) => {
    (useCartStore as any).mockReturnValue({
      items: hasItems ? [{ id: '1', qty: 2, price: 50000 }] : [],
      total: hasItems ? 100000 : 0,
    });

    return render(
      <MemoryRouter initialEntries={[pathname]}>
        <CartBottomBar />
      </MemoryRouter>
    );
  };

  test('shows on /menu when cart has items', () => {
    renderBar('/menu', true);
    expect(screen.getByTestId('cart-bottom-bar')).toBeInTheDocument();
  });

  test('hides on /menu when cart empty', () => {
    renderBar('/menu', false);
    expect(screen.queryByTestId('cart-bottom-bar')).not.toBeInTheDocument();
  });

  test('hides on /kds (OpsShell) even with items', () => {
    renderBar('/kds', true);
    expect(screen.queryByTestId('cart-bottom-bar')).not.toBeInTheDocument();
  });

  test('hides on /tv-menu even with items', () => {
    renderBar('/tv-menu', true);
    expect(screen.queryByTestId('cart-bottom-bar')).not.toBeInTheDocument();
  });

  test('hides on /admin/dashboard even with items', () => {
    renderBar('/admin/dashboard', true);
    expect(screen.queryByTestId('cart-bottom-bar')).not.toBeInTheDocument();
  });

  test('shows on /checkout with items', () => {
    renderBar('/checkout', true);
    expect(screen.getByTestId('cart-bottom-bar')).toBeInTheDocument();
  });

  test('lifts above BottomNav (bottom-20) on tab pages', () => {
    renderBar('/menu', true);
    const bar = screen.getByTestId('cart-bottom-bar');
    expect(bar).toHaveClass('bottom-20');
  });

  test('sits at bottom-4 on functional pages (no BottomNav)', () => {
    renderBar('/checkout', true);
    const bar = screen.getByTestId('cart-bottom-bar');
    expect(bar).toHaveClass('bottom-4');
  });
});
```

---

## 4. Visual Regression Checks

### 4.1 Storybook / Visual Tests
```bash
# Nếu có Storybook
npx chromatic --project-token=<token> --only-changed
# Hoặc manual check các story:
# - CustomerShell stories (5 tabs + functional pages)
# - OpsShell stories (KDS, TV, POS)
# - AdminShell stories (Dashboard, Reports, Settings)
```

### 4.2 Manual Visual Checklist

#### CustomerShell
- [ ] `/` — Navy AppBar (small), 5 tabs active Home, CartBar lifts (bottom-20)
- [ ] `/menu` — Chrome title "Thực đơn", tabs active Menu, categories render
- [ ] `/table-reservation` — Calendar icon active, form renders
- [ ] `/promotions` — TicketPercent icon active, promotions list
- [ ] `/account` — User icon active, center-aligned title "Tài khoản"
- [ ] `/checkout` — TopAppBar "Thanh toán", NO BottomNav, CartBar at bottom-4
- [ ] `/order` — TopAppBar "Đặt món", NO BottomNav, table layout

#### OpsShell
- [ ] `/kds` — Noir void bg, Chrome text, NO bars, KDS tickets fullscreen
- [ ] `/tv-menu` — Noir void, auto-rotating menu display
- [ ] `/pos/table/123` — Noir void, table POS keypad, large touch targets

#### AdminShell
- [ ] `/admin/dashboard` — Pearl bg, Navy sidebar, breadcrumbs, dense table
- [ ] `/admin/reports` — Collapsible sidebar, CSV export (Bronze button)
- [ ] `/admin/settings` — Form density compact, proper labels

---

## 5. Build & Bundle Verification

```bash
npm run build 2>&1 | tail -30
```

**Expected output checks:**
- [ ] Build succeeds (exit code 0)
- [ ] Bundle size: `dist/assets/index-*.js` < 500KB gzipped (baseline)
- [ ] No duplicate chunks (code splitting works)
- [ ] CSS extracted: `dist/assets/index-*.css` exists
- [ ] No TypeScript errors during build

```bash
# Quick size check
gzip -c dist/assets/index-*.js | wc -c
# Should be ~150-300KB depending on features
```

---

## 6. End-to-End Smoke Tests (Critical Flows)

### 6.1 Customer Flow: Browse → Order → Pay
1. Mở `/` → thấy Hero + BottomNav
2. Tap "Thực đơn" → `/menu` load categories + items từ Catalog API
3. Tap món → `/menu/:id` detail, tap "Thêm vào giỏ"
4. CartBottomBar hiện (bottom-20), tap giỏ → `/checkout`
5. Điền thông tin → thanh toán PayOS → `/order-success`

### 6.2 Ops Flow: KDS Ticket
1. Mở `/kds` → fullscreen dark, không customer UI
2. Mới order từ customer → ticket xuất hiện realtime (WebSocket)
3. Tap "Đang làm" → "Hoàn thành" → ticket biến mất

### 6.3 Admin Flow: Report Export
1. Login `/admin/login` → redirect `/admin/dashboard`
2. Vào `/admin/reports` → chọn ngày → tap "Xuất CSV" (Bronze button)
3. File download thành công

---

## 7. Accessibility (WCAG 2.1 AA) Spot Check

```bash
# Axe-core quick check (nếu có integration)
npx playwright test --project=chromium --grep=a11y
```

**Manual checks:**
- [ ] Color contrast: Navy/Chrome (7:1), Bronze/Navy (4.5:1) — pass
- [ ] Focus visible: Tab navigation shows ring trên mọi interactive element
- [ ] ARIA labels: BottomNav items có `aria-label` tiếng Việt
- [ ] Screen reader: CartBottomBar announce "Giỏ hàng, 2 món, 100.000đ"
- [ ] Touch targets: ≥48x48dp trên mobile (Customer), ≥56x56dp trên Ops

---

## 8. Performance Baseline

```bash
# Lighthouse CI hoặc local
npx lighthouse http://localhost:5173 --only-categories=performance --output=json
```

**Targets:**
- [ ] LCP < 2.5s (CustomerShell)
- [ ] TBT < 200ms
- [ ] CLS < 0.1
- [ ] Bundle JS < 300KB gzipped (first load)

---

## 9. Final Checklist — Sign Off

| Category | Criteria | Status |
|----------|----------|--------|
| **Tests** | `npx vitest run` → 3,379 passed | ☐ |
| **Tests** | Worker integration tests pass | ☐ |
| **Types** | `npx tsc --noEmit` → 0 errors | ☐ |
| **Routing** | 3 Shell隔离 verified (routing test matrix) | ☐ |
| **Nav** | 5 tabs active state correct | ☐ |
| **Cart** | CartBottomBar logic: show/hide/lift correct | ☐ |
| **Visual** | Customer (Navy/Chrome), Ops (Noir/Chrome), Admin (Pearl/Navy) | ☐ |
| **Density** | Standard / Comfortable / Compact per shell | ☐ |
| **Typography** | Vietnamese-first scale, Noto Sans Vietnamese loaded | ☐ |
| **Terminology** | Tiếng Việt F&B trên mọi label/button | ☐ |
| **Build** | `npm run build` success, bundle size OK | ☐ |
| **Smoke** | Customer order flow works | ☐ |
| **Smoke** | KDS ticket flow works | ☐ |
| **Smoke** | Admin CSV export works | ☐ |
| **A11y** | Contrast, focus, ARIA, touch targets pass | ☐ |
| **Perf** | LCP/TBT/CLS within budget | ☐ |

---

## 10. Rollback Plan (nếu có issue)

```bash
# Nếu Phase 01-04 gây regression không fix được trong 2 strikes
git revert <phase-01-commit> <phase-02-commit> <phase-03-commit> <phase-04-commit>
# Hoặc reset về commit trước restructure
git reset --hard <pre-restructure-commit>
```

---

## 11. Post-Merge Actions

- [ ] Tag release: `git tag ui-restructure-v1.0.0`
- [ ] Update `docs/project-changelog.md` với UI restructuring entry
- [ ] Update `docs/development-roadmap.md` — mark UI phases complete
- [ ] Notify team: UI restructuring complete, 3 shells live