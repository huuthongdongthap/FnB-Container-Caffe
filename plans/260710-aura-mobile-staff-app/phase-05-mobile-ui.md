# Phase 5: Mobile UI Screens

**Duration:** 3h | **Agent:** frontend-device

## Context

Mobile-first UI, 375px viewport primary, scales to 430px. Bazi v5.1 theme carries over from customer app.

## Screens

### MobileLogin
- PIN entry (4-digit, per-device; owner assigns PIN during onboarding)
- "Remember this device" checkbox (stores device token in IndexedDB)
- Role badge shown after login ("Bếp / Kitchen", "Phục vụ / Waiter")
- Bazi dark theme by default

### KitchenDisplay (for `staff` role)
- Cards: order_id, table, items list, elapsed timer (red > 15min, orange > 10min)
- Status flow: [⏳ Chờ | 🔥 Đang làm | ✅ Phục vụ] — tap to advance
- Sound on new order (Web Audio API beep, muted by default)
- Pull-to-refresh (re-fetch KDS list)

### WaiterOrders (for `waiter` role)
- List of today's orders grouped by table
- "Create order" FAB → quick item search + quantity
- Update delivery status after kitchen marks served
- Attach notes per item ("ít đường" etc.)

### TableManager (for `waiter` + `manager`)
- Grid: table number + status dot (green/yellow/red)
- Tap table → detail (active order, total, elapsed)
- Swipe/button to change status
- "Merge table" for group dining (manager only)

### OfflineQueue
- Shown as badge count in bottom nav when >0 pending
- Tap → expandable list of pending mutations
- Auto-close on sync complete

### MobileLayout (shell)
- Bottom navigation: 3 items max (KDS | Orders | Tables)
- Role-based nav: kitchen shows only KDS + Queue; waiter shows Tables + Orders
- Header: "AURA CAFE" + wifi indicator + sync badge
- FAB context-sensitive

## Components

```
src/pages/mobile/
  MobileLogin.tsx
  KitchenDisplay.tsx
  WaiterOrders.tsx
  TableManager.tsx
  OfflineQueue.tsx
  MobileLayout.tsx

src/components/mobile/
  OrderCard.tsx
  TableGrid.tsx
  SyncIndicator.tsx
  StatusChip.tsx
```

## Effort Estimate

| Screen | Complexity | Lines |
|--------|-----------|-------|
| MobileLogin | Low | 120 |
| MobileLayout | Low | 80 |
| KitchenDisplay | Medium | 200 |
| WaiterOrders | Medium | 180 |
| TableManager | Medium | 200 |
| Total | — | ~780 |
