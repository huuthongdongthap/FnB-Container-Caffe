---
phase: 2
gap: G9
title: PWA Full Offline Mode
status: complete
effort: 8h
priority: P2
depends_on: [G3]
---

# Phase 2: G9 PWA Full Offline Mode (8h, P2)

## Mục tiêu

Staff/customer dùng app khi không có internet — xem menu, tạo order, queue tự động sync khi online.

## Existing (đã có)

| Feature | Location | Status |
|---------|----------|--------|
| Cache-first static assets | `public/sw.js:80-83` | ✅ Working |
| Network-first API + offline queue | `public/sw.js:119-150` | ✅ Working |
| Background sync (sync-orders) | `public/sw.js:216-236` | ✅ Working |
| Retry queued API requests | `public/sw.js:238-261` | ✅ Working |
| Push notifications | `public/sw.js:176-213` | ✅ Working |
| manifest.json | `public/manifest.json` | ✅ Exists |

## Thiếu

1. **Offline menu cache** — pre-cache menu data vào IndexedDB lúc online, render khi offline
2. **Offline order queue UI** — hiển thị "đang chờ sync" cho orders tạo khi offline
3. **Offline detection banner** — thông báo "Bạn đang offline" ở top of page
4. **Menu + categories offline** — cache menu và categories vào IndexedDB

## Implementation

### Step 1: IndexedDB wrapper (NEW: `src/lib/offline-db.ts`)

```typescript
// Minimal IndexedDB wrapper for offline data
interface OfflineDB {
  menus: { id: string; data: MenuItem[]; cachedAt: number };
  orders: { id: string; data: OrderInput; createdAt: number; synced: boolean };
}
```

### Step 2: Menu pre-cache (modify existing data-fetching)

Trong page menu (`src/pages/menu.tsx`), khi online → save to IndexedDB:

```typescript
// Sau khi fetch menu thành công:
if ('serviceWorker' in navigator && navigator.onLine) {
  await saveMenuToOfflineDB(menuData);
}
```

### Step 3: Offline detection banner (NEW: `src/components/pwa/offline-banner.tsx`)

```typescript
// Detect online/offline + show banner
navigator.onLine → hidden
navigator.onLine → show "Không có kết nối — các thay đổi sẽ đồng bộ sau"
```

### Step 4: Offline order submission

Khi offline, order được lưu vào IndexedDB queue → SW retry khi online:

```typescript
const submitOrder = async (order: OrderInput) => {
  if (!navigator.onLine) {
    await offlineDB.orders.add({ data: order, synced: false });
    return { queued: true };
  }
  // Normal submit
};
```

### Step 5: PWA update prompt (optional, 1h)

Detect SW update + prompt "Có bản cập nhật mới":

```typescript
navigator.serviceWorker.addEventListener('controllerchange', () => {
  if (confirm('Có bản cập nhật mới. Tải lại?')) location.reload();
});
```

## Files

| Action | File |
|--------|------|
| CREATE | `src/lib/offline-db.ts` — IndexedDB wrapper |
| CREATE | `src/components/pwa/offline-banner.tsx` — offline banner |
| MODIFY | `src/pages/menu.tsx` — cache menu when online |
| MODIFY | `src/hooks/use-order-store.ts` — queue orders when offline |

## Risk

- IndexedDB quota (50-80% disk) — menu data nhỏ, không vấn đề
- Background Sync API chỉ hoạt động khi browser đang mở — không phải mobile-app-level
