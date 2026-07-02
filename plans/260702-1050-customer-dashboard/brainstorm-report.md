# Customer Dashboard — Brainstorm Report

## Vấn đề
Khách hàng AURA CAFE không có trang cá nhân để xem lịch sử order, quản lý loyalty points, và cập nhật thông tin cá nhân.

## Yêu cầu
- Trang `/account` cho authenticated customer
- 3 tab: Thông tin cá nhân, Lịch sử đơn hàng, Ưu đãi (Loyalty + Referral)
- Backend API mới: `GET /api/orders/my-orders`, `PATCH /api/customers/me`

## Giải pháp

### Backend (2 endpoints mới)
1. `GET /api/orders/my-orders` — JWT → customer_id → SELECT * FROM orders WHERE customer_id = ?
2. `PATCH /api/customers/me` — JWT → UPDATE customers SET name/phone/birthday

### Frontend
- `src/pages/account/index.tsx` — Dashboard với 3 tab
- `src/App.tsx` — Route `/account` (không cần admin)
- Navbar — Link "Tài khoản" khi logged in

### Files modified
- `worker/src/routes/orders-hono.ts` — Add /my-orders
- `worker/src/routes/customers.ts` — Add PATCH /me
- `src/App.tsx` — Route
- `src/components/ui/navbar.tsx` — Conditional link
- NEW: `src/pages/account/index.tsx` + components
- NEW: `src/hooks/use-account.ts`

### States
| State | Behavior |
|-------|----------|
| Loading | Skeleton cards |
| Empty orders | "Chưa có đơn hàng nào" + CTA đặt món |
| Error | Toast + retry |
| Token expired | Redirect login + clear auth |

### Effort: ~1.5h

---

**Final recommendation:** Single-page dashboard with tab navigation.
Backend-first (TDD: 6 tests for 2 new endpoints), then frontend.
