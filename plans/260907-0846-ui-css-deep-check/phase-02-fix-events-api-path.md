# Phase 2 — Fix /events API Path + Error State Wiring

**Priority:** P0 (functional — /events toàn page là naked error state) · **Status:** Completed

## Context
- `/events` hiển thị "Không thể tải sự kiện / THỬ LẠI" trên dark bg — nhìn như naked text nhưng thực chất `EventsNew2Error` component **có** card styling (`--aura-bg-surface` tối gần giống page bg). Vấn đề thật:
  1. `use-events.ts:27` gọi `/api/events` → **404** (worker chỉ mount `/api/pretix` — `worker/src/index.ts:263`)
  2. Retry button không có `onClick` (dead button) — `StitchEventsNew2-empty.tsx:72-79`
  3. `events.tsx` không truyền `errorMessage` / `onRetry` (prop `_onRetry` bị bỏ)
- Worker `/api/pretix/events` trả `{ success, data: PretixEvent[] }` với `PretixEventResponse = { name?: Record<string,string>; items?: PretixItem[] }` — **không có** date/time/location/capacity → cần adapter mapping
- Khi hook trả `[]` (không throw): `events.tsx:144-147` đặt `data=undefined` → `StitchEventsNew2` dùng `createDefaultEventsData` → **render demo events đầy đủ style** (hành vi mong muốn khi pretix chưa cấu hình local)

## Approach (per plan.md Key Decision 1)

Hook fail/empty → trả `[]` thay vì throw. Page hiển thị defaultData demo. Error state chỉ khi caller truyền `isError` explicitly.

## Implementation Steps

1. **`src/hooks/use-events.ts`** — sửa `queryFn`:
   ```ts
   const res = await apiFetch<{ success: boolean; data?: unknown[] }>('/api/pretix/events');
   // Adapter: pretix event → EventItem (best-effort mapping, fallback empty)
   const items = Array.isArray(res?.data) ? res.data.map(toEventItem).filter(Boolean) : [];
   return items;
   ```
   - `toEventItem(raw)`: map `slug/id`, `name.vi || name.en || name`, `date_from → date`, `location`, `capacity`, mặc định `''`/`0` cho field thiếu
   - Wrap try/catch bên trong queryFn → catch trả `[]` (không throw) để rơi vào empty → defaultData
   - Giữ nguyên interface `EventItem` (public contract không đổi)
2. **`src/components/stitch/StitchEventsNew2-empty.tsx`** — `EventsNew2Error` thêm prop `onRetry?: () => void`, gắn `onClick={onRetry}` cho button
3. **`src/pages/events.tsx`** — truyền `errorMessage={hook.error?.message}` và `onRetry={hook.refetch}` xuống `StitchEventsNew2` (thêm 2 props `errorMessage`/`onRetry` vào lời gọi, prop `_onRetry` của EventsPage giữ nguyên cho backward-compat)

## Files

**Modify:**
- `src/hooks/use-events.ts` (queryFn + adapter, ~30 dòng)
- `src/components/stitch/StitchEventsNew2-empty.tsx` (EventsNew2Error + onRetry)
- `src/pages/events.tsx` (wire props)
- `src/components/stitch/StitchEventsNew2.tsx` (pass onRetry xuống EventsNew2Error nếu cần qua prop chain)

## Todo

- [ ] Sửa queryFn sang `/api/pretix/events` + adapter + catch→`[]`
- [ ] Thêm `onRetry` prop cho `EventsNew2Error`, gắn onClick
- [ ] Wire `errorMessage`/`onRetry` từ events.tsx
- [ ] Verify `/events` :8082 render defaultData demo (không còn error state)
- [ ] Verify /api/pretix/events 404/503 case → page vẫn render defaultData

## Success Criteria

- `/events` hiển thị demo events (Midnight Saxophone Sessions hero + cards) thay vì error text
- Retry button clickable (nếu error state có hiện)
- Type-check pass; không thay đổi public contract `EventItem`

## Risks & Edge Cases

- Pretix chưa cấu hình local (503 "pretix not configured") → queryFn catch → `[]` → defaultData ✓
- Production có pretix configured → data thật map qua adapter; field thiếu → fallback chuỗi rỗng/số 0
- `useUpcomingEvents` filter `date >= now` với demo data rỗng → `upcoming=[]` → `data=undefined` → defaultData ✓ (hành vi hiện tại giữ nguyên)

## Security

- Không đổi auth flow (cookie-based, `credentials: 'include'` giữ nguyên trong apiFetch)
