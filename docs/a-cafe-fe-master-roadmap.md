# AURA CAFE — FE Master Roadmap (Tổng hợp)

**Ngày:** 2026-09-10
**Phạm vi:** FE + BE touchpoints (API contracts only; không bao gồm Worker business logic)
**Liên kết gốc:** Được tổng hợp từ 4 tài liệu:
- [`implementation_plan.md`](../../../.gemini/antigravity/brain/e67aa9da-5128-4c10-b155-04f3fdcc517e/implementation_plan.md) — Biz pivot: WHY (kill Grand Opening, focus Loyalty + Delivery)
- [`frontend_architecture_blueprint.md`](../../../.gemini/antigravity/brain/e67aa9da-5128-4c10-b155-04f3fdcc517e/frontend_architecture_blueprint.md) — Target state FE (scaled-down, no monorepo)
- [`task.md`](../../../.gemini/antigravity/brain/e67aa9da-5128-4c10-b155-04f3fdcc517e/task.md) — Backbone 4-phase (reordered FE-first)
- [`plans/260910-go-live-master-phases/plan.md`](../plans/260910-go-live-master-phases/plan.md) — Operational checkpoints (secrets, PayOS, QR, drills, launch)

**Plan chi tiết (phân tích brainstorm):** [`plans/260910-fe-first-architecture-merge/plan.md`](../plans/260910-fe-first-architecture-merge/plan.md)

---

## Executive Summary

Ship go-live trước (Wave A), migrate sang feature-sliced theo từng feature được chạm vào (Wave B), **defer monorepo** (Wave C — quyết định 2026-09-10). Không big-bang restructure. Codebase flat hiện tại (`src/pages` + `src/components` + `src/hooks/stores` — 16 zustand stores) được giữ nguyên cho đến khi feature đó đến lượt migrate.

## Current State (verified by scout)

- **Flat Type-based:** `src/components/` + `src/pages/` (86 lazy chunks qua 4 route files) + `src/hooks/` + `src/lib/`
- **16 zustand stores** trong `src/hooks/stores/` — cart đã centralized
- **TỒN TẠI:** TrackOrder (đã route `/track-order`), delivery/takeaway/dine-in components (`src/components/order/`), SW đã đăng ký (`public/sw.js`), loyalty pages, KDS, i18n vi/en
- **CHƯA CÓ:** `src/features/`, `packages/ui`, Edge SSR, Grand Opening chưa deprecate, loyalty 4-tier chưa wire FE, wallet checkout option chưa có
- Tổng FE ~91k LOC

---

## Merged Logic — 4 Docs thành 1

| Tài liệu gốc | Vai trò trong roadmap tổng hợp |
|---|---|
| `implementation_plan.md` | **WHY** — kill Grand Opening (AURA20/AURA10), focus Loyalty 4-tier + Delivery |
| `task.md` | **BACKBONE** — reorder FE-first |
| `frontend_architecture_blueprint.md` | **TARGET STATE** — nhưng chia Phase, không làm 1 lúc |
| `go-live-master-phases/plan.md` | **OPERATIONAL CHECKPOINTS** — lồng trên feature work (secrets, PayOS, QR, drills) |

---

## Waves & Phases Roadmap

| Wave | Phase | Tên | Trạng thái | Liên kết |
|------|-------|-----|-----------|----------|
| **A — Go-Live Unblocker** | 0 | Deprecate Grand Opening | ⚪ | [phase-00](../plans/260910-fe-first-architecture-merge/phase-00-deprecate-grand-opening.md) |
| | 1 | Loyalty 4-tier FE wiring | ⚪ | [phase-01](../plans/260910-fe-first-architecture-merge/phase-01-loyalty-4tier-fe.md) |
| | 2 | Delivery/Takeaway/Dine-in checkout completion | ⚪ | phase-02 |
| | 3 | `/track-order` real-time + Telegram bar notification | ⚪ | phase-03 |
| | 4 | Aura Wallet payment option at checkout | ⚪ | phase-04 |
| | 5 | PWA polish (SW đã có; verify offline + install prompt) | ⚪ | phase-05 |
| **B — Feature-Slice Migration** | 6 | Slice `ordering` → `src/features/ordering/` (template đầu tiên) | ⚪ | phase-06 |
| | 7 | Slice `loyalty-cashback` | ⚪ | phase-07 |
| | 8 | Slice `kds-kitchen` | ⚪ | phase-08 |
| | 9 | Slice `admin-sales` | ⚪ | phase-09 |
| **C — Monorepo + Edge SSR** | — | **DEFERRED** — xem revisit triggers bên dưới | ⏸ | [phase-deferred-monorepo](../plans/260910-fe-first-architecture-merge/phase-deferred-monorepo.md) |

---

## Chi tiết Wave A — Go-Live Unblockers

### Phase 0 — Deprecate Grand Opening
- `AURA20`, `AURA10` → `is_active = 0` trên D1
- `bonus_campaigns` khai trương → `active = 0`
- **GIỮ** `WELCOME` (10% max 30k, new-member)
- Xoá countdown/banner khai trương trên homepage
- Liên kết: [phase-00-deprecate-grand-opening.md](../plans/260910-fe-first-architecture-merge/phase-00-deprecate-grand-opening.md)

### Phase 1 — Loyalty 4-Tier FE Wiring
- Tiers: **Đồng** (1.0x, 3%) · **Bạc** (1.1x, 5%) · **Vàng** (1.3x, 7%) · **Bạch Kim** (1.5x, 10%)
- Checkout phone input (debounce 400ms) → `GET /api/loyalty/lookup?phone=` → show tier + wallet balance
- Auto-create profile + cashback wallet khi new phone order online
- Post-payment: points + cashback tự credit (toast + updated balance)
- **BE touchpoints (contract only):** `/api/loyalty/lookup` verification · `POST /api/orders` response ext: `loyaltyResult { pointsEarned, cashbackEarned, tier }`
- Liên kết: [phase-01-loyalty-4tier-fe.md](../plans/260910-fe-first-architecture-merge/phase-01-loyalty-4tier-fe.md)

### Phase 2 — Delivery/Takeaway/Dine-in Checkout Completion
- Hoàn thiện flow chọn hình thức nhận hàng (đã có partial trong `src/components/order/`)
- Nhập địa chỉ giao hàng nội ô Sa Đéc kèm ghi chú người giao
- Cổng thanh toán: VietQR / PayOS auto 24/7 + COD + Aura Wallet

### Phase 3 — Track-Order + Telegram
- Trang theo dõi hành trình real-time (`/track-order` — page đã tồn tại, verify wiring + status steps)
- Đồng bộ đơn online sang KDS với nhãn Delivery nổi bật
- Telegram bot thông báo cho ca trực quầy bar khi có đơn online

### Phase 4 — Aura Wallet at Checkout
- Hiển thị số dư ví hoàn tiền trong checkout form
- Toggle "Dùng ví Aura" tại màn hình thanh toán online
- Liên kết: cần profile + wallet đã auto-create từ Phase 1

### Phase 5 — PWA Polish
- SW đã đăng ký (`public/sw.js` + `use-sw-registration.ts`)
- Verify offline fallback menu + cart
- Install prompt UX (SWUpdatePrompt.tsx đã có)

---

## Chi tiết Wave B — Feature-Slice Migration

**Nguyên tắc:** Chỉ move 1 feature vào `src/features/<name>/` khi bạn **đang chạm vào nó cho feature mới**. Flat dirs cũ được giữ đến lượt migrate — **KHÔNG big-bang.**

| Phase | Feature | Tên thư mục đích | Liên kết |
|-------|---------|------------------|----------|
| 6 | Ordering | `src/features/ordering/` | phase-06 |
| 7 | Loyalty + Cashback | `src/features/loyalty-cashback/` | phase-07 |
| 8 | KDS Kitchen | `src/features/kds-kitchen/` | phase-08 |
| 9 | Admin Sales | `src/features/admin-sales/` | phase-09 |

Mỗi feature-slice tự chỉ được pages/, components/, hooks/, stores/ của riêng nó.

---

## Wave C — DEFERRED (Monorepo + Edge SSR)

**Quyết định (user, 2026-09-10):** Defer toàn bộ.

**Đã defer:**
- `apps/customer-web` + `apps/staff-pos-kds` + `apps/admin-portal` split
- `packages/ui` shared component library
- Edge SSR cache cho menu pages

**Lý do defer:**
- Single SPA phục vụ cả 3 surface tốt ở scale hiện tại (86 lazy chunks đã code-split per route)
- POS/KDS/admin cùng domain — chưa có deployment surface riêng
- 16 zustand stores + shared auth — split sẽ cần extract cross-app state trước (chi phí cao, chưa có lợi ích)

**Revisit triggers (1 trong 4 để reconsider):**
1. Staff KDS/POS chuyển sang tablet hardware với offline-first requirements
2. Admin portal cần deploy cadence riêng (release risk tolerance khác)
3. Menu page LCP >2.5s trên 3G (chỉ lành Edge SSR cho menu, KHÔNG phải full monorepo)
4. Greenlit thêm client app (Zalo Mini App, native shell)

**Chi phí của deferral:** Không có hôm nay. Khi trigger kích hoạt, cấu trúc feature-sliced từ Wave B giúp split trở nên mechanical (features move wholesale vào apps/).

Liên kết: [phase-deferred-monorepo.md](../plans/260910-fe-first-architecture-merge/phase-deferred-monorepo.md)

---

## Dependencies Giữa Các Phase

```
Phase 0 → Phase 1  (banner removal clears loyalty UX surface)
Phase 1 → Phase 4  (wallet needs loyalty profile)
Phase 2 → Phase 3  (track-order needs delivery state machine wired)
Phase 6–9 (Wave B) — độc lập với Wave A; mỗi feature-slice land cùng feature mới
```

Operational gates từ [`260910-go-live-master-phases`](../plans/260910-go-live-master-phases/plan.md):
- Phase 1 (secrets) + Phase 2 (PayOS live) **layer trên** Wave A completion — consult các phase file đó khi deploy

---

## Success Criteria

1. 86 route chunks không đổi public surface (không route changes nếu không có migration note)
2. 3228+ tests pass tại mỗi phase boundary
3. Mỗi feature-slice migration = 0 dead imports từ old location
4. `/api/version` shortSha = HEAD sau mỗi deploy
5. BE touchpoints chỉ: API contracts mới/thay đổi được document theo phase

---

## Files Liên Quan Trong Repo

```
plans/260910-fe-first-architecture-merge/
├── plan.md                              # Overview roadmap
├── phase-00-deprecate-grand-opening.md  # Phase 0 chi tiết
├── phase-01-loyalty-4tier-fe.md         # Phase 1 chi tiết
├── phase-deferred-monorepo.md           # Wave C defer rationale
└── phase-02..09                         # (pending — chờ approve overview)

src/
├── App.tsx                              # Root (QueryClient + Router + providers)
├── routes/                              # 4 route files (public/stitch/mobile/admin)
├── pages/                               # 86 lazy chunks (flat, sẽ migrate Wave B)
├── components/order/                    # delivery/takeaway/dine-in (partial)
├── hooks/stores/                        # 16 zustand stores (cart, loyalty, order, payment...)
├── lib/offline-db.ts                    # PWA offline prep
└── pages/stitch/track-order/            # TrackOrder page (đã có)

worker/src/                              # BE — BE touchpoints chỉ ở scope FE contract
```

---

## Liên kết chính

| Tài liệu | Liên kết |
|----------|----------|
| **Brainstorm analysis (plan)** | [plans/260910-fe-first-architecture-merge/plan.md](../plans/260910-fe-first-architecture-merge/plan.md) |
| **Phase 0 — Deprecate Grand Opening** | [phase-00-deprecate-grand-opening.md](../plans/260910-fe-first-architecture-merge/phase-00-deprecate-grand-opening.md) |
| **Phase 1 — Loyalty 4-tier** | [phase-01-loyalty-4tier-fe.md](../plans/260910-fe-first-architecture-merge/phase-01-loyalty-4tier-fe.md) |
| **Wave C — Deferred monorepo** | [phase-deferred-monorepo.md](../plans/260910-fe-first-architecture-merge/phase-deferred-monorepo.md) |
| **Go-Live Master Phases (operational)** | [plans/260910-go-live-master-phases/plan.md](../plans/260910-go-live-master-phases/plan.md) |
| **Implementation plan (biz pivot gốc)** | [../../../.gemini/antigravity/brain/e67aa9da-5128-4c10-b155-04f3fdcc517e/implementation_plan.md](../../../.gemini/antigravity/brain/e67aa9da-5128-4c10-b155-04f3fdcc517e/implementation_plan.md) |
| **FE Blueprint (gốc)** | [../../../.gemini/antigravity/brain/e67aa9da-5128-4c10-b155-04f3fdcc517e/frontend_architecture_blueprint.md](../../../.gemini/antigravity/brain/e67aa9da-5128-4c10-b155-04f3fdcc517e/frontend_architecture_blueprint.md) |
| **Task list (gốc)** | [../../../.gemini/antigravity/brain/e67aa9da-5128-4c10-b155-04f3fdcc517e/task.md](../../../.gemini/antigravity/brain/e67aa9da-5128-4c10-b155-04f3fdcc517e/task.md) |
| **Golive code fixes journal (liên quan)** | [plans/260910-golive-code-fixes/journal.md](../plans/260910-golive-code-fixes/journal.md) |
