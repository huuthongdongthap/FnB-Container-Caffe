# Pha 01: Shell Architecture — 3 Experience Shells

## Mục tiêu
Tách `StitchAppLayout` (nguyên khối) thành 3 Shell độc lập:
1. **CustomerShell** (`MD3AppShell` + `CartBottomBar` + Bottom Nav 5 tabs)
2. **OpsShell** (Fullscreen, không Header/Footer, không Nav, không Cart)
3. **AdminShell** (Sidebar + Top Breadcrumbs + Compact Tables)

---

## Các tệp liên quan (File Inventory)

| File | Role | Hành động |
|------|------|-----------|
| `src/components/stitch/StitchAppLayout.tsx` | Layout gốc (legacy + MD3 mixed) | **REFACTOR** → thin router wrapper |
| `src/components/stitch/CustomerShell.tsx` | **NEW** | Tạo mới |
| `src/components/stitch/OpsShell.tsx` | **NEW** | Tạo mới |
| `src/components/stitch/AdminShell.tsx` | **NEW** | Tạo mới (wrapper AdminLayout) |
| `src/components/md3/md3-app-shell.tsx` | MD3AppShell (TopAppBar + NavBar) | **KEEP** — dùng trong CustomerShell |
| `src/components/cart/cart-bottom-bar.tsx` | Cart floating bar | **KEEP** — chỉ mount trong CustomerShell |
| `src/components/stitch/StitchHeader.tsx` | Legacy header | **RETIRE** (chỉ dùng cho trang không MD3) |
| `src/components/stitch/StitchFooter.tsx` | Legacy footer | **RETIRE** |
| `src/App.tsx` | Root routes assembly | **REFACTOR** — mount shells qua Layout Routes |

---

## 1. Tạo `CustomerShell.tsx`

```tsx
// src/components/stitch/CustomerShell.tsx
import { MD3AppShell } from '@/components/md3';
import { useDefaultNavItems } from '@/components/md3';
import CartBottomBar from '@/components/cart/cart-bottom-bar';
import { getShellConfig, hasM3NavBar } from './StitchAppLayout';
import { ErrorBoundary } from '@/components/shared/ErrorBoundary';
import { useLocation } from 'react-router-dom';

export default function CustomerShell({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const navItems = useDefaultNavItems();
  const shellConfig = getShellConfig(location.pathname);
  const showNav = shellConfig?.showNav ?? true;
  const showTop = shellConfig?.showTop ?? true;
  const variant = shellConfig?.variant ?? 'small';
  const title = shellConfig?.title ?? 'AURA CAFE';

  return (
    <MD3AppShell
      title={title}
      navigationItems={navItems}
      topAppBarVariant={variant}
      showTopAppBar={showTop}
      showNavigationBar={showNav}
    >
      <ErrorBoundary>{children}</ErrorBoundary>
    </MD3AppShell>
  );
}
```

---

## 2. Tạo `OpsShell.tsx`

```tsx
// src/components/stitch/OpsShell.tsx
import { ErrorBoundary } from '@/components/shared/ErrorBoundary';
import { cn } from '@/lib/cn';
import type { ReactNode } from 'react';

export default function OpsShell({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary>
      <div className={cn(
        'min-h-screen flex flex-col',
        'bg-[var(--aura-noir-void)] text-[var(--aura-chrome-light)]'
      )}>
        <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-auto">
          {children}
        </main>
      </div>
    </ErrorBoundary>
  );
}
```

**Đặc điểm:**
- Không `MD3AppShell`, không `TopAppBar`, không `NavigationBar`.
- Không `CartBottomBar` (import guard không load).
- Tối ưu fullscreen: KDS, TV Menu, POS TableOrder.

---

## 3. Tạo `AdminShell.tsx` (wrapper mỏng cho AdminLayout)

```tsx
// src/components/stitch/AdminShell.tsx
import { AdminLayout } from '@/pages/admin/AdminLayout';
import type { ReactNode } from 'react';

export default function AdminShell({ children }: { children: ReactNode }) {
  return (
    <AdminLayout>
      {children}
    </AdminLayout>
  );
}
```

---

## 4. Cập nhật `App.tsx` — Mount shells qua Layout Routes

```tsx
// src/App.tsx (chỉ phần routes)
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { lazy } from 'react';
import CustomerShell from '@/components/stitch/CustomerShell';
import OpsShell from '@/components/stitch/OpsShell';
import AdminShell from '@/components/stitch/AdminShell';

const KDSPage = lazy(() => import('@/pages/KDS'));
const TVMenuPage = lazy(() => import('@/pages/TVMenu'));
const TableOrder = lazy(() => import('@/pages/TableOrder'));
// ... import các page khác

function AppContent() {
  return (
    <AuthProvider>
      <ToastProvider>
        <BrowserRouter>
          <Routes>
            {/* ── CUSTOMER SHELL ── */}
            <Route element={<CustomerShell />}>
              <Route path="/" element={<HomePage />} />
              <Route path="/menu" element={<MenuPage />} />
              <Route path="/table-reservation" element={<ReservationNew />} />
              <Route path="/promotions" element={<PromotionsNew />} />
              <Route path="/account" element={<AccountPage />} />
              <Route path="/checkout" element={<CheckoutPage />} />
              <Route path="/order" element={<TableOrder />} />
              {/* ... các route khách khác ... */}
            </Route>

            {/* ── OPS SHELL ── */}
            <Route element={<OpsShell />}>
              <Route path="/kds" element={<KDSPage />} />
              <Route path="/tv-menu" element={<TVMenuPage />} />
              <Route path="/pos/table/:tableId" element={<TableOrder />} />
            </Route>

            {/* ── ADMIN SHELL ── */}
            <Route element={<AdminShell />}>
              <Route path="/admin/login" element={<AdminLoginPage />} />
              <Route element={<ProtectedRoute />}>
                <Route path="/admin/*" element={<Outlet />} />
              </Route>
            </Route>

            <Route path="*" element={<NotFoundNew />} />
          </Routes>
        </BrowserRouter>
        <CartBottomBar /> {/* Chỉ hiện trên CustomerShell nhờ hasM3NavBar */}
      </ToastProvider>
    </AuthProvider>
  );
}
```

---

## 5. Cập nhật `StitchAppLayout.tsx` — Thin Router Wrapper

Giữ lại hàm `getShellConfig` và `hasM3NavBar` cho `CartBottomBar` dùng. Export lại để backward compat.

```tsx
// src/components/stitch/StitchAppLayout.tsx
// ⚠️ KHÔNG render MD3AppShell ở đây nữa — chỉ export helpers
export { getShellConfig, hasM3NavBar } from './shell-config';
```

Tạo file mới `src/components/stitch/shell-config.ts` chứa `MD3_SHELL_CONFIG`, `getShellConfig`, `hasM3NavBar`.

---

## Checklist hoàn thành Pha 01

- [ ] Tạo `shell-config.ts` (extract từ StitchAppLayout)
- [ ] Tạo `CustomerShell.tsx` (wrap MD3AppShell)
- [ ] Tạo `OpsShell.tsx` (fullscreen clean)
- [ ] Tạo `AdminShell.tsx` (wrapper AdminLayout)
- [ ] Refactor `App.tsx` dùng Layout Routes mount 3 shell
- [ ] Loại bỏ `StitchHeader`, `StitchFooter` khỏi render path mặc định
- [ ] `CartBottomBar` chỉ hoạt động khi `hasM3NavBar(pathname) === true`
- [ ] Chạy `npx vitest run` — 3,379 tests pass
- [ ] Kiểm tra route `/kds`, `/tv-menu`, `/admin` **không** hiển thị Bottom Nav khách

---

## Rủi ro & Mitigation

| Rủi ro | Mitigation |
|--------|------------|
| Route nesting sai khiến CartBar hiển trên KDS | Unit test `hasM3NavBar('/kds') === false` |
| Lazy load Suspense boundary vỡ | Giữ `<React.Suspense>` ở root `App.tsx` wrapper |
| Admin route mất ProtectedRoute | Viết test `render(<ProtectedRoute><AdminShell/></ProtectedRoute>)` |

---

## Tiêu chí hoàn thành (Done Definition)
1. `npx vitest run` → **3,379 passed**
2. Mở `/menu` → có TopAppBar + Bottom Nav 5 tabs + CartBottomBar (khi có món)
3. Mở `/kds` → **không** Bottom Nav, **không** CartBar, fullscreen dark
4. Mở `/admin/dashboard` → Sidebar + Breadcrumbs + Tables (AdminLayout)
5. `npm run build` thành công, bundle size không tăng đột biến