# AURA Cafe — Next Initiative Brainstorm
**Date:** 2026-07-14  
**Mode:** Ultracode deep/parallel  
**Status:** Approved by user — proceed to plan

---

## Problem Statement

AURA Cafe là single-location container cafe tại Sa Dec với WiFi không ổn định. Hiện tại:
- **Customer/KDS/admin views** đều dùng HTTP polling (3-10s interval) — plan cũ 260626 đã "complete" nhưng baseline vẫn là polling
- **Không có offline queue** — khi WiFi drop, orders có thể bị mất
- **Không có real-time WebSocket/Durable Object** — mỗi viewport phải poll riêng, tạo unnecessary load + UI latency
- Khi cafe scale lên (thêm location/thương hiệu mới), polling cost grows linearly

## Key Data Points (từ scout + Kongming)

| Metric | Value |
|--------|-------|
| API routes | 50+ |
| Features | 30+ |
| D1 tables | 14 (schema.sql) |
| Test files | 47 (target 1063) |
| DO binding | None — chưa có wrangler.toml entry |
| CORS | `*` wildcard in wrangler.toml (security gap) |
| Cal.com webhook | Header equality only (no HMAC) |
| forest/land layer | Unimplemented |

---

## Evaluated Approaches

### A. Durable Objects + Offline Sync (RECOMMENDED)

**Business impact:** Very High  
**Tech cost:** Medium  
**Net:** WINNER

Single DO `OrderBroadcaster` — WebSocket fan-out cho 3 viewports (customer/KDS/admin). Client-side IndexedDB queue + Background Sync API cho WiFi drop.

```
POST /api/orders → DO first → D1 second (eventual consistency)
DO state: Map<orderId, {status, items, table, created_at, seq}>
WebSocket clients: role-based registration
Reconnect: diff-sync từ last-known sequence number
```

**Pros:**
- Cloudflare DO = globally consistent, persistent, no external infra
- 3 viewports = 1 implementation
- Future-proofs real-time data layer cho dashboard, loyalty integrity, KDS accuracy
- Offline queue = daily operational pain relief ngay

**Cons:**
- New abstraction (DO) — team cần learn
- Migration path từ polling → DO cần careful rollout
- `wrangler.toml` cần thêm DO binding

### B. Operator Intelligence Dashboard (Rank 2)

**Business impact:** High  
**Tech cost:** High  
**Net:** Second priority

CEO muốn per-zone revenue, peak hours, VIP behavior. Nhưng data layer hiện tại là polling — dashboard over stale data = false confidence.

**Verdict:** Build SAU KHI real-time order flow stable. Aggregation query đơn giản khi data sạch.

### C. Webhook HMAC + CORS Hardening Sprint (Rank 3)

**Business impact:** Medium  
**Tech cost:** Low  
**Net:** Important nhưng không tạo observable value mới

- CORS_ORIGIN="*" → set về auraspace.cafe (1 line)
- Cal.com webhook → switch to HMAC verification
- Zalo ZNS/Mautic/SpeedSMS → thêm almeno shared-secret

**Verdict:** Bundle vào hardening phase, chạy parallel với real-time Week 2.

### D. Deferred / Abandon

| Item | Why defer |
|------|-----------|
| forest/land buildout | YAGNI — 3+ shared orchestration modules chưa có |
| JWT → better-auth migration | HS256+PBKDF2 đủ, ROI ≈ 0 |
| Subscription upgrade flow | Chưa có PMF evidence từ customers |
| Sandbox infra cho 3rd party | Thêm `AURA_ENV` flag gating writes (1 day, not a sprint) |
| Better-auth migration | Token migration chi phí cao, benefit thấp |

---

## Sprint Scope (2 tuần)

### Week 1: OrderBroadcaster DO
- [ ] Design DO state schema
- [ ] Implement OrderBroadcaster DO với WebSocket fan-out
- [ ] Modify `POST /api/orders` → write DO first, D1 second
- [ ] Client reconnect + diff-sync logic
- [ ] Unit tests cho DO state machine

### Week 2: Offline Queue + Hardening (parallel)
- [ ] Client-side IndexedDB queue + Background Sync API
- [ ] E2E: simulate WiFi drop → submit → reconnect → verify delivery
- [ ] CORS_ORIGIN fix + audit routes
- [ ] Cal.com HMAC verification
- [ ] Full test suite green

---

## Touchpoints

| File/Module | Change |
|-------------|--------|
| `src/routes/orders.ts` | POST writes DO before D1 |
| `src/tree/orders/` | Extend domain — no replace |
| `src/routes/cal-booking-webhook.ts` | HMAC fix (hardening) |
| `wrangler.toml` | Add DO binding, fix CORS_ORIGIN |
| `src/types/env.ts` | Add OrderBroadcaster DO binding type |
| `src/lib/offline-queue.ts` | NEW — IndexedDB + Background Sync |

---

## Success Metrics

| Metric | Target | How |
|--------|--------|-----|
| Order submission reliability | 100% eventual delivery | Idempotency key + DO write confirmation |
| WebSocket reconnect | < 2s after WiFi restore | Client logs |
| Test suite green | 1750+ cases pass | `npm test` exit 0 |
| CORS whitelist | Single origin | wrangger.toml + header check |
| CEO observable | "Staff no longer losing orders" | Qualitative — Week 2 demo |

---

## Risks

| Risk | Likelihood | Mitigation |
|------|-----------|-----------|
| DO plan limit on CF Free tier | Medium | Check wrangler d1 list + DO billing upfront |
| WiFi drop frequency overestimated | Low | E2E test simulates worst case |
| Polling → DO migration causes duplicate events | Medium | Idempotency key per order |
| Team unfamiliar with DO API | Medium | 1-day spike, Kongming-style code review |

---

**Trạng thái:** Sẵn sàng plan. Mời chọn mode:

| Option | Khi nào | Why |
|--------|---------|-----|
| `/ak:plan --tdd` (Recommended) | Logic phức tạp + tests tồn tại | Tests-first đảm bảo behavior lock-in |
| `/ak:plan` (default) | Standard feature | Phase-by-phase implementation plan |
| End session | Plan sau | Skip bước này |
