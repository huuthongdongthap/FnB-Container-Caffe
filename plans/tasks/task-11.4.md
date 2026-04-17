# Task 11.4 — DEEP FIX: Loyalty CSS + Checkout Payment (Combined)

## ⚠️ QUAN TRỌNG: 2 bug đã báo nhiều lần, phải fix ĐÚNG lần này

---

## BUG 1: Loyalty Page — Nền trắng, mất toàn bộ style

### Root Cause (KHÔNG phải thiếu file CSS!)
CSS files **LOAD THÀNH CÔNG** (48KB, 3 files). Nhưng toàn bộ CSS dùng **M3 Light Theme** vars:
```css
/* styles.css đang set: */
:root { --md-sys-color-background: #fffbfe; }  /* = TRẮNG */
body { background-color: var(--md-sys-color-background); }  /* → TRẮNG */
```

Trong khi đó, `loyalty-styles.css` reference dark theme vars **CHƯA ĐƯỢC ĐỊNH NGHĨA**:
```css
.loyalty-hero { background: var(--glass-background); }  /* ← UNDEFINED → transparent */
.glass-card { color: var(--text-primary); }  /* ← UNDEFINED → đen trên trắng = mất */
```

Trang `index.html` hoạt động đúng vì nó có `css/index.css` chứa block `:root` dark theme riêng.

### Fix
Thêm **vào đầu** `css/loyalty-styles.css`:
```css
:root {
  --bg-dark: #0A0A0A;
  --bg-surface: #1A1A1A;
  --glass-background: rgba(255, 255, 255, 0.05);
  --glass-blur: 20px;
  --glass-border: rgba(255, 255, 255, 0.08);
  --text-primary: #f5f5f5;
  --text-secondary: rgba(245, 245, 245, 0.7);
  --text-dim: rgba(245, 245, 245, 0.4);
  --warm-amber: #C9A962;
  --warm-gold: #D4AF37;
  --warm-coral: #E07A5F;
  --cyber-glow: rgba(201, 169, 98, 0.3);
}
body {
  background-color: #0A0A0A !important;
  color: #f5f5f5 !important;
}
```

### Kiểm tra tương tự cho các trang khác
```bash
for f in checkout.html about-us.html contact.html reservation.html; do
  echo "=== $f ==="
  grep -c 'glass-background\|text-primary\|bg-dark' "css/$(basename $f .html)*.css" 2>/dev/null || echo "⚠️ Thiếu dark vars"
done
```

---

## BUG 2: Checkout — Nút "Thanh Toán →" không gọi Backend

### Root Cause
Luồng hiện tại:
1. ✅ Menu page → Cart drawer → "Thanh Toán →" → Saves cart vào `localStorage` → Redirect `checkout.html`
2. ✅ `checkout.html` → Form điền info → "Xác Nhận Đặt Hàng" → POST `/api/orders` → Server trả `order`
3. ❌ **Payment processing STUB** — Sau khi tạo order:
   ```javascript
   // js/api-client.js (dòng 173-175) — CẢ 3 ĐỀU RETURN NULL!
   export async function createPayOSPayment(data) { return null; }
   export async function createVNPayPayment(data) { return null; }
   export async function createMoMoPayment(data) { return null; }
   ```

Backend có route `/api/payment` (worker/src/routes/payment.js) nhưng frontend **KHÔNG BAO GIỜ GỌI ĐẾN**.

### Phân tích chi tiết `checkout.js:290-310`
```javascript
const response = await fetch(`${API_BASE}/orders`, { method: 'POST', ... });
const result = await response.json();
if (result.success) {
  if (order.payment_method === 'cod') { await handleCODSuccess(order); }  // ← OK
  else if (order.payment_method === 'payos') { await handlePayOSPayment(order); }  // ← Gọi nhưng PayOS = null
}
```

### Fix Plan
**Option A: Chỉ hỗ trợ COD (Tiền mặt) cho v1** — Đơn giản nhất
1. Trong `checkout.html` form, chỉ hiện option COD, ẩn PayOS/MoMo/VNPay
2. `handleCODSuccess()` đã hoạt động — show order confirmation + redirect success page

**Option B: Wire PayOS** — Cần có PayOS API key
1. Đăng ký tại https://payos.vn (hoặc dùng sandbox key)
2. Set env var `PAYOS_CLIENT_ID`, `PAYOS_API_KEY`, `PAYOS_CHECKSUM_KEY` trên Cloudflare Worker
3. Implement `createPayOSPayment()` trong `api-client.js` → call `/api/payment/payos/create`
4. Update `worker/src/routes/payment.js` để handle PayOS create + callback

### Khuyến nghị: Chọn Option A trước (ship nhanh), Option B phase sau.

---

## Deploy
```bash
npm run build
cd worker && npx wrangler deploy && cd ..
npx wrangler pages deploy dist --project-name=fnb-caffe-container
```

## Verify
- [ ] `/loyalty` — Nền đen (#0A0A0A), glass cards hiển thị, text trắng, tier badges có màu
- [ ] `/menu` → Thêm đồ vào giỏ → "Thanh Toán →" → Redirect checkout.html thành công
- [ ] `/checkout` → Điền form → Chọn COD → "Xác Nhận" → Order được tạo thành công
- [ ] `/checkout` → Payment methods PayOS/MoMo bị ẩn hoặc hiện "Sắp ra mắt"
- [ ] `/` — Trang chủ vẫn OK
- [ ] `/dashboard/admin` — Đơn hàng mới xuất hiện trong danh sách
