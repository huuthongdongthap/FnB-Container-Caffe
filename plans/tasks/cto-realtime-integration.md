# CTO Feature Plan: Real-time Order ↔ KDS ↔ Track Order Integration

## Vấn Đề Hiện Tại

| Component | Status | Vấn đề |
|-----------|--------|--------|
| **Checkout → Worker** | ✅ Hoạt động | POST /api/orders tạo order + set KV flag `latest_order_ts` |
| **Worker KDS endpoint** | ✅ Có route | `/api/kds/orders/latest` trả timestamp, `/api/kds/orders/` trả orders |
| **KDS Frontend (kds-app.js)** | ⚠️ Broken | Vẫn có WebSocket dead code, chưa dùng `KdsPollClient` đúng cách |
| **KDS Poll (kds-poll.js)** | ✅ Code tốt | `KdsPollClient` poll 3s interval, nhưng chưa được kết nối vào `kds-app.js` |
| **Track Order (track-order.js)** | ❌ Broken | Dùng WebSocket stubs (server đã xóa), không poll Worker API |
| **Order Status Change** | ⚠️ Partial | PATCH /api/orders/:id/status hoạt động + set KV flag, nhưng frontend không nhận |
| **Success Page** | ⚠️ Static | Hiện order success nhưng không theo dõi status realtime |

## Kiến Trúc Mục Tiêu

```
Customer Order Flow:
  checkout.html → POST /api/orders → D1 + KV flag
       ↓
  success.html → poll GET /api/orders/:id (5s) → hiện status realtime
       ↓
  track-order.html → poll GET /api/orders/:id (5s) → timeline status

Kitchen Flow:
  kds.html → KdsPollClient → GET /api/kds/orders/latest (3s)
       ↓ (new orders detected)
       → GET /api/kds/orders?status=pending,preparing&include=items
       ↓ (staff thay đổi status)
       → PATCH /api/orders/:id/status → D1 + KV flag
       ↓
  Customer thấy status mới via poll
```

---

## CTO Tasks (6 tasks tuần tự)

### Task RT-1: Kết nối KDS Frontend với KdsPollClient
**File sửa:** `js/kds-app.js`
- Xóa toàn bộ WebSocket dead code (`kdsWebSocket`, `connectWS`, v.v.)
- Import và khởi tạo `KdsPollClient` từ `js/kds-poll.js` 
- Khi `onUpdate` fired → gọi `fetchKDSOrdersAPI()` để refresh danh sách orders
- Khi staff bấm chuyển status → gọi `updateOrderStatusAPI()` → refresh orders

### Task RT-2: Fix Track Order thành HTTP Polling
**File sửa:** `js/track-order.js`
- Xóa toàn bộ WebSocket code (`trackingWS`, `connectWS`)
- Thay bằng `setInterval` poll `GET /api/orders/:orderId` mỗi 5s
- Khi status thay đổi → cập nhật UI timeline + hiệu ứng animation
- Khi status = `delivered` hoặc `cancelled` → dừng poll

### Task RT-3: Success Page Realtime Status
**File sửa:** `success.html`  
- Thêm poll `GET /api/orders/:orderId` mỗi 5s sau khi đặt hàng
- Hiện status bar: Chờ → Xác nhận → Chế biến → Sẵn sàng → Giao
- Khi status chuyển → animate thanh progress + hiện thông báo

### Task RT-4: KDS Stats Realtime  
**File sửa:** `js/kds/kds-api.js`
- `fetchKDSStats()` phải gọi thực API `/api/kds/orders?status=pending,preparing,ready`
- Trả về count thực từ D1, không hardcode
- Cập nhật stats cards mỗi khi poll detect thay đổi

### Task RT-5: Order Status Sound Notification
**File sửa:** `js/kds-app.js`
- Khi có order mới (pending) → play notification sound
- Khi order chuyển sang `ready` → play completion sound
- Dùng Web Audio API (sine wave beep), không cần file audio

### Task RT-6: Integration Test E2E
**Verify flow:**
1. Mở kds.html trên tab 1
2. Mở checkout.html trên tab 2, đặt 1 đơn COD
3. Verify: kds.html tự hiện order mới trong ≤5s
4. Trên kds.html, chuyển status → preparing → ready
5. Mở track-order.html, nhập order ID → verify status đúng
6. Commit tất cả: `feat: realtime order-kds-tracking integration`

---

## Rules
- KHÔNG thêm WebSocket server mới — chỉ dùng HTTP polling qua KV flag
- KHÔNG thay đổi Worker API routes (đã đủ)
- KHÔNG thêm dependencies mới
- Giữ poll interval: KDS 3s, Track/Success 5s
- Tất cả API calls dùng dynamic `API_BASE` (không hardcode localhost)
