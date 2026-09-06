# Report — Fix DEV-AUDIT: Tenant Isolation + KDS Realtime SSE

Date: 2026-08-26 | Project: FnB-Container-Caffe (AURA CAFE, Sa Đéc)
Scope (user-approved): P0 tenant isolation + P1 KDS realtime SSE. Bỏ qua: shared-types refactor, brand tone.

## Audit claims vs verified reality

| Claim audit | Verdict |
|---|---|
| `X-Tenant-Id` header tin tuyệt đối | ✅ Đúng — `worker/src/middleware/tenant.ts:17-21` |
| Anonymous khai thác được | ❌ Sai — route gate bởi `requireAuth()` (`index.ts:463`). Chỉ user đã đăng nhập leak được metadata tenant (name/slug/tier) qua `GET /api/saas/tenants/my` |
| "Đọc ghi xuyên tenant" | ⚠️ Phóng đại — middleware chỉ mount `/api/saas/tenants/*`; orders/menus chưa filter theo tenant |
| OrderBroadcaster DO "có sẵn, FE không dùng" | ⚠️ DO thiếu hẳn hàm `fetch()`/WS handler — route `/api/realtime/:channelId` fail runtime. Infra WS HỎNG, không phải bỏ quên |
| KDS polling 5s lãng phí | ✅ Đúng — `use-kds.ts` react-query 5s |

## Root bugs phát hiện thêm (không có trong audit)

1. **auth.ts làm mất tenantId:** `requireAuth` chỉ copy `{id,email,name,role}` từ JWT vào context → dù fix tenant.ts thì `user.tenantId` vẫn luôn undefined. Fix bắt buộc chạm cả 2 file.
2. **Auth transport lệch pha:** FE comment "httpOnly cookie auth" + `credentials:'include'`, nhưng worker không có dòng nào parse Cookie; `getAuthToken` chỉ đọc Bearer mà FE cũng không gắn. SSE (EventSource) không set được header → cookie session là điều kiện tiên quyết của Phase C.

## Changes

### Phase A — Tenant isolation
- `worker/src/middleware/auth.ts`: copy `tenantId`/`tier` từ JWT payload vào user context (+ AuthUser type).
- `worker/src/middleware/tenant.ts`: xóa toàn bộ niềm tin header. Resolve CHỈ từ signed JWT; thiếu binding → `'default'` + log warn.
- Test mới `worker/src/__tests__/middleware/tenant.test.ts`: 4 cases (JWT resolve, spoofed header ignored, staff→default, anonymous→default).

### Phase B — Cookie session (prerequisite)
- `worker/src/tree/auth/login.ts`: `Set-Cookie: access_token=<jwt>; HttpOnly; Secure; SameSite=None; Path=/; Max-Age=JWT_EXPIRY_SECONDS`.
- `worker/src/tree/auth/logout.ts`: clear cookie (`Max-Age=0`).
- `worker/src/lib/jwt.ts` `getAuthToken()`: fallback parse cookie sau khi thử Bearer (mobile/API client không vỡ).

### Phase C — KDS realtime SSE
- `worker/src/routes/kds-stream.ts` (mới): `GET /api/kds/orders/stream`, pattern order-stream.ts — poll D1 mỗi 3s, emit event `snapshot` khi payload đổi, timeout 120s rồi EventSource tự reconnect. Snapshot-based (state dashboard) thay vì event-based → không mất event, không KV TTL race.
- `worker/src/index.ts`: mount router mới dưới gate `requireAuth(['owner','staff'])` sẵn có.
- `src/hooks/use-kds.ts`: EventSource `{withCredentials:true}` listener `snapshot` → `setQueryData`; giữ polling 5s làm fallback (station≠'all' vẫn polling); mutations giữ nguyên.

## Verification

- Worker tests: **150 files / 1537 tests PASSED** (gồm 4 tenant tests mới).
- FE tests: **340 files / 3105 tests PASSED** (sửa mock use-kds.test.ts thêm export API_BASE).
- `tsc --noEmit`: worker ✅ FE ✅.

## Known limitations (out of scope)

- Staff JWT chưa mang tenantId (lookup chỉ match owner trong `saas_tenants.owner_user_id`) → staff rơi `'default'`. Binding staff↔tenant cần migration schema + UI gán — đề xuất sprint riêng.
- Orders/menus queries chưa filter `tenant_id` ở tầng SQL — isolation hiện chỉ chặn metadata leak; data-level tenancy là hạng mục kiến trúc lớn hơn.
- `/api/admin/orders?status=` endpoint mà use-kds poll hiện trả shape khác BE `/kds` — polling fallback vẫn chạy như trước, không regression; hợp nhất endpoint để sprint sau.

## Unresolved questions

Không — cả 3 quyết định thiết kế đã chốt với user trước implement.
