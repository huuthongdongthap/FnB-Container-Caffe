# Phase 1 — Fix /order Zustand Selector Crash

**Priority:** P0 (blocker — /order hoàn toàn không render) · **Status:** Pending

## Context
- Deep check phát hiện `/order` rơi vào ErrorBoundary: "Maximum update depth exceeded"
- Root cause: zustand v5 `useStore` dùng `React.useSyncExternalStore` với selector wrap trong `useCallback` deps `[api, selector]`. Selector inline trả **object mới mỗi render** → snapshot identity unstable → re-render loop vô hạn (verified: `node_modules/zustand/esm/react.mjs`)
- Lỗi nằm ở `src/pages/TableOrder.tsx:36-38`

## Root Cause Code

```tsx
// SAI — object mới mỗi lần render → infinite loop
const { queuedOffline } = useOrderStoreWithOfflineFlush(
  (s) => ({ queuedOffline: s.queuedOffline }),
);
```

## Fix

```tsx
// ĐÚNG — selector atomic, trả primitive reference ổn định
const queuedOffline = useOrderStoreWithOfflineFlush((s) => s.queuedOffline);
```

Lưu ý: `TableOrder.tsx:58` có destructuring từ hook khác (`useOrderActions` hoặc tương tự — check lúc implement); chỉ sửa dòng 36-38.

## Files

**Modify:**
- `src/pages/TableOrder.tsx` (line 36-38 + destructuring line 58 nếu cần)

## Todo

- [ ] Sửa selector `TableOrder.tsx:36-38` thành atomic `(s) => s.queuedOffline`
- [ ] Điều chỉnh destructuring ở line 58 nếu compiler complain
- [ ] Grep toàn repo các selector zustand v5 trả object inline tương tự (`useStore.*\(\(s\) => \(\{`) — fix luôn nếu có
- [ ] Verify `/order` render bình thường trên dev :8082

## Success Criteria

- `/order` load không crash, không ErrorBoundary
- Console không còn "Maximum update depth exceeded"
- `npm run build` (hoặc `tsc --noEmit`) pass

## Risks

- Thấp — 1-line change. Pattern atomic selector là chuẩn zustand v5.
