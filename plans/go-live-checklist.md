# GO-LIVE CHECKLIST — AURA SPACE
Generated: 2026-04-18

## 🔴 BLOCKER (phải hoàn thành trước deploy)

### DB Migration
- [ ] `ALTER TABLE payments ADD COLUMN gateway TEXT DEFAULT 'cod';` (nếu chưa có — schema đã có)
- [ ] Chạy `schema.sql` mới: `CREATE TABLE promotions` + `CREATE TABLE staff_shifts`
- [ ] Seed promotions: FIRSTORDER/WELCOME10/SADEC20/CONTAINER (đã có trong schema)
- [ ] Command: `npx wrangler d1 execute AURA_DB --file=./db/schema.sql --remote`

### PayOS (Owner Action)
- [ ] Set `PAYOS_CLIENT_ID` / `PAYOS_API_KEY` / `PAYOS_CHECKSUM_KEY` trên Cloudflare Workers
- [ ] Set webhook URL tại `my.payos.vn` → `https://aura-space-worker.../api/webhook/payos`
- [ ] Test webhook: Click "Test Webhook" trên dashboard → confirm 200

### Seed Owner Account
- [ ] Chạy `worker/scripts/seed-admin.js` để tạo owner account đầu tiên

## 🟡 CODE FIXES (đã xong code, cần deploy)

- [x] `js/utils.js` — fix 4 catch syntax errors (L126/141/153/210)
- [x] `js/menu.js` — escape XSS trong toast
- [x] `js/kds-poll.js` — wrap console.log với AURA_DEBUG
- [x] `js/checkout.js` — remove hardcoded discount codes, dùng `/api/promotions/validate`
- [x] `worker/src/routes/orders.js` — state machine validation
- [x] `worker/src/routes/payment.js` — orderCode anti-collision
- [x] `worker/src/routes/auth.js` — PBKDF2 + salt + auto-migrate legacy SHA-256
- [x] `worker/src/routes/promotions.js` — NEW: validate/redeem/list
- [x] `worker/src/routes/shifts.js` — NEW: clock-in/out/current/list
- [x] `db/schema.sql` — thêm bảng `promotions` + `staff_shifts`

## 🆕 NEW PAGES

- [x] `kds.html` — Kitchen Display (bind `/js/kds-app.js`)
- [x] `admin/pos.html` — POS tại quầy (table select, cart, in bill)
- [x] `admin/staff.html` — Quản lý nhân viên (owner only)

## 🟢 OPTIONAL (post-launch)

- [ ] `dashboard/admin.html` — refactor hardcoded peak hours L466-570 (cần xin Zone)
- [ ] JWT → HttpOnly cookie (scope lớn)
- [ ] CSRF double-submit cookie (scope lớn)
- [ ] Reservation email/SMS confirm (cần Twilio/Mailgun)
- [ ] Web Push notify staff khi order mới
- [ ] Xóa files deprecated: `kitchen-display.html`, `test-reviews.html`, `lighthouse-report.html` (permission issue)

## DEPLOY SOP

```bash
# 1. Staging build
rm -rf /tmp/fnb-deploy
rsync -av \
  --exclude='export.pdf' --exclude='*.pen' --exclude='node_modules' \
  --exclude='.git' --exclude='*.sqlite*' --exclude='.DS_Store' \
  --exclude='worker/.wrangler' --exclude='_archive' --exclude='plans' \
  --exclude='tasks-done' --exclude='tests' --exclude='docs' \
  --exclude='designs' --exclude='scripts' --exclude='*.txt' \
  --exclude='lighthouse-report.html' --exclude='package-lock.json' \
  . /tmp/fnb-deploy/

# 2. Run D1 migration (once)
cd worker
npx wrangler d1 execute AURA_DB --file=../db/schema.sql --remote

# 3. Deploy Worker
npx wrangler deploy --minify

# 4. Deploy Pages
cd ..
npx wrangler pages deploy /tmp/fnb-deploy/ --project-name=fnb-caffe-container --branch=main
```

## E2E TEST PLAN (sau deploy)

### Customer flow
1. Mở `/menu.html` → add 2 items → cart
2. Checkout → nhập info → apply promo `FIRSTORDER` → verify giảm 10%
3. Chọn PayOS → click Thanh Toán → redirect PayOS QR
4. Quét QR thanh toán → redirect `/track-order.html?success=true&order_id=XXX`
5. Verify D1 `payments.status = completed`, `orders.payment_status = paid`

### Staff flow (POS)
1. Login owner tại `/dashboard/login.html`
2. Mở `/admin/pos.html` → chọn bàn → thêm món → Thanh Toán tiền mặt
3. Verify modal success → click In Hóa Đơn → printer
4. Mở `/kds.html` → thấy đơn mới ở cột "pending"
5. Click "Bắt đầu" → đơn chuyển sang "preparing"

### Admin
1. `/admin/staff.html` (owner) → tạo staff account
2. Login staff → `/admin/pos.html` chỉ được truy cập, KHÔNG truy cập được `/admin/staff.html`
3. `/dashboard/admin.html` → kiểm tra orders list live

### Shift tracking
1. `POST /api/shifts/clock-in` → verify ghi record
2. `POST /api/shifts/clock-out` → verify close shift
3. `GET /api/shifts/current` → null khi chưa clock-in, object khi đã

## ROLLBACK PLAN

```bash
# Pages: rollback via Cloudflare dashboard (previous deployment)
# Worker: redeploy previous commit
git checkout <previous-commit>
cd worker && npx wrangler deploy --minify
```

## VERIFICATION CHECKLIST

- [ ] `curl /api/health` → 200 OK
- [ ] `curl /api/menu` → items array
- [ ] `curl /api/promotions` → 4 active codes
- [ ] `curl -X POST /api/promotions/validate -d '{"code":"FIRSTORDER","subtotal":200000}'` → `{percent:10, amount:20000}`
- [ ] `curl /api/payment/create-link` với PayOS secrets → `{checkoutUrl: ...}`
- [ ] Login owner → `/api/auth/me` trả về role=owner
- [ ] Clock-in → `/api/shifts/current` có record
- [ ] Console không có error trên mọi trang
