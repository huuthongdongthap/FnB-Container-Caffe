# Pha 02: Navigation & Information Architecture

## Mục tiêu
- Cô lập 5 tab Bottom Navigation của khách hàng: **Trang chủ**, **Thực đơn**, **Đặt bàn**, **Ưu đãi**, **Cá nhân**.
- Tách hẳn điều hướng Operations (KDS, TV, POS) và Admin khỏi hệ thống Navigation của khách.
- Chuẩn hóa đường dẫn route theo pattern: `/menu`, `/table-reservation`, `/promotions`, `/account`, `/`.

---

## Các tệp liên quan

| File | Role | Hành động |
|------|------|-----------|
| `src/components/md3/md3-app-shell.tsx` | NavigationBar render | **REFACTOR** — dùng `useDefaultNavItems` chuẩn 5 tabs |
| `src/components/md3/index.ts` | Export `useDefaultNavItems` | **UPDATE** — cập nhật 5 items cố định |
| `src/routes/public-routes.tsx` | Public route definitions | **UPDATE** — gom nhóm route khách theo 5 tab |
| `src/routes/admin-routes.tsx` | Admin route definitions | **KEEP** — đã tách biệt |
| `src/App.tsx` | Route mounting | **REF** (từ Pha 01) |

---

## 1. Cập nhật `useDefaultNavItems` — 5 Tabs Cố Định

```tsx
// src/components/md3/index.ts (hoặc file riêng md3-nav-items.ts)
import { Home, Coffee, Calendar, TicketPercent, User } from 'lucide-react';

export function useDefaultNavItems(): MD3NavItem[] {
  return [
    { value: '/',           label: 'Trang chủ',    icon: <Home size={24} /> },
    { value: '/menu',       label: 'Thực đơn',     icon: <Coffee size={24} /> },
    { value: '/table-reservation', label: 'Đặt bàn', icon: <Calendar size={24} /> },
    { value: '/promotions', label: 'Ưu đãi',       icon: <TicketPercent size={24} /> },
    { value: '/account',    label: 'Cá nhân',      icon: <User size={24} /> },
  ];
}
```

**Lưu ý:** `value` là `pathname` prefix. `MD3AppShell` so khớp `location.pathname.startsWith(value)`.

---

## 2. Gom nhóm Route Khách (Customer Routes)

```tsx
// src/routes/public-routes.tsx (cập nhật)
export const publicRoutes = [
  // Tab 1: Trang chủ
  <Route key="/" path="/" element={guarded(<HomePage />)} />,
  <Route key="/container" path="/container" element={guarded(<ContainerPage />)} />,

  // Tab 2: Thực đơn
  <Route key="/menu" path="/menu" element={guarded(<MenuPage />)} />,
  <Route key="/menu/:id" path="/menu/:id" element={guarded(<MenuItemDetailPage />)} />,

  // Tab 3: Đặt bàn
  <Route key="/table-reservation" path="/table-reservation" element={guarded(<ReservationNew />} />) />,

  // Tab 4: Ưu đãi
  <Route key="/promotions" path="/promotions" element={guarded(<PromotionsNew />} />) />,
  <Route key="/events" path="/events" element={guarded(<EventsPage />} />) />,

  // Tab 5: Cá nhân
  <Route key="/account" path="/account" element={guarded(<AccountPage />} />) />,
  <Route key="/loyalty" path="/loyalty" element={guarded(<LoyaltyPage />} />) />,
  <Route key="/referral" path="/referral" element={guarded(<ReferralPage />} />) />,
  <Route key="/order-history" path="/order-history" element={guarded(<OrderHistoryPage />} />) />,

  // Các trang chức năng không có tab (checkout, order, checkin...)
  <Route key="/checkout" path="/checkout" element={guarded(<CheckoutPage />} />) />,
  <Route key="/order" path="/order" element={guarded(<TableOrder />} />) />,
  <Route key="/checkin" path="/checkin" element={guarded(<CheckinNew />} />) />,
  <Route key="/track-order" path="/track-order" element={guarded(<TrackOrderNew />} />) />,
  <Route key="/order-success" path="/order-success" element={guarded(<OrderSuccessPage />} />) />,
  <Route key="/order-failure" path="/order-failure" element={guarded(<OrderFailureNew />} />) />,
];
```

---

## 3. Cập nhật `shell-config.ts` — Chỉ áp dụng MD3 shell cho 5 tabs + checkout/order

```ts
// src/components/stitch/shell-config.ts
export const MD3_SHELL_CONFIG = [
  // Tab pages — full shell (TopAppBar + NavBar)
  { match: '/', exact: true, title: 'AURA CAFE', variant: 'small', showNav: true, showTop: false },
  { match: '/menu', title: 'Thực đơn', variant: 'small', showNav: true, showTop: true },
  { match: '/table-reservation', title: 'Đặt bàn', variant: 'small', showNav: true, showTop: true },
  { match: '/promotions', title: 'Ưu đãi', variant: 'small', showNav: true, showTop: true },
  { match: '/account', title: 'Tài khoản', variant: 'center-aligned', showNav: true, showTop: true },
  { match: '/loyalty', title: 'Thành viên', variant: 'small', showNav: true, showTop: true },
  { match: '/referral', title: 'Giới thiệu', variant: 'small', showNav: true, showTop: true },

  // Functional pages — TopAppBar only, KHÔNG Bottom Nav
  { match: '/checkout', title: 'Thanh toán', variant: 'small', showNav: false, showTop: true },
  { match: '/order', title: 'Đặt món', variant: 'small', showNav: false, showTop: true },
  { match: '/checkin', title: 'Check-in', variant: 'small', showNav: false, showTop: true },
  { match: '/track-order', title: 'Tra cứu', variant: 'small', showNav: false, showTop: true },
];
```

---

## 4. Loại bỏ `/kds`, `/tv-menu`, `/pos` khỏi `PAGES_WITH_OWN_HEADER`

Các route này giờ thuộc **OpsShell** (Pha 01), không còn đi qua `CustomerShell`.

---

## Checklist hoàn thành Pha 02

- [ ] `useDefaultNavItems` trả về đúng 5 tabs cố định (Home, Menu, Reservation, Promotions, Account)
- [ ] `public-routes.tsx` gom route theo 5 nhóm tab
- [ ] `shell-config.ts` khớp 5 tab + functional pages
- [ ] `/kds`, `/tv-menu`, `/pos/*` **không** match bất kỳ config nào trong `MD3_SHELL_CONFIG`
- [ ] Chạy `npx vitest run` — 3,379 tests pass
- [ ] Kiểm tra UI: 5 tabs hiển thị đúng, active state đúng khi chuyển route
- [ ] Kiểm tra CartBottomBar: hiện trên 5 tab + checkout/order, **không** hiện trên `/kds`, `/tv-menu`

---

## Tiêu chí hoàn thành
1. 5 tab Bottom Nav hoạt động đúng spec M3 (2-5 destinations)
2. Không có route Operations/Admin nào bị nhầm lẫn vào Customer Nav
3. Toàn bộ test suite pass
4. Không regression routing