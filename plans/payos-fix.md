# /cook Plan — PayOS Payment Integration Fix

## Intent: Fix + Check luồng PayOS

## Architecture Hiện Tại

```
Checkout.html → POST /api/payment/create-link → PayOS API (VietQR)
                                                      ↓
                                                User pays QR
                                                      ↓
PayOS Webhook → POST /api/webhook/payos → D1 payments table updated
                                                      ↓
                                        success.html / track-order.html
```

## Trạng thái hiện tại

| Component | File | Status |
|-----------|------|--------|
| **Worker create-link** | `worker/src/routes/payment.js` | ✅ Code done — HMAC-SHA256, Hono router |
| **Worker webhook** | `worker/src/routes/webhooks.js` | ✅ Code done — IPN handler, signature verify |
| **Worker routing** | `worker/src/index.js` | ⚠️ Need to verify payment route mounted |
| **Checkout UI** | `checkout.html` L189-193 | ❌ PayOS card disabled (`pointer-events:none`, "Sắp ra mắt") |
| **Worker env vars** | Cloudflare dashboard | ❌ `PAYOS_CLIENT_ID`, `PAYOS_API_KEY`, `PAYOS_CHECKSUM_KEY` — chưa verify |
| **PayOS account** | [my.payos.vn](https://my.payos.vn) | ⚠️ Cần confirm credentials active |
| **Webhook URL** | PayOS dashboard | ❌ Chưa set `https://aura-space-worker.../api/webhook/payos` |
| **CSP headers** | `_headers` | ⚠️ Need `api-merchant.payos.vn` in `connect-src` |

---

## Tasks cho CTO

### Task 0: D1 Schema Migration — `payments` table (BLOCKER 🔴)
- **Vấn đề**: `payments` table thiếu column `gateway` → `payment.js` INSERT fails
- **SQL cần chạy**:
  ```sql
  ALTER TABLE payments ADD COLUMN gateway TEXT DEFAULT 'cod';
  ```
- **Command**: `npx wrangler d1 execute AURA_DB --command "ALTER TABLE payments ADD COLUMN gateway TEXT DEFAULT 'cod';" --remote`
- **Verify**: Re-run curl test: `curl -X POST .../api/payment/create-link ...`

### Task 1: Verify Worker PayOS Routes (5min)
- **Check** `worker/src/index.js` — confirm `paymentRouter` and `webhookRouter` are mounted
- **Check** routes: `POST /api/payment/create-link`, `GET/POST /api/webhook/payos`
- **Test**: `curl -X POST https://aura-space-worker.sadec-marketing-hub.workers.dev/api/payment/create-link -H "Content-Type: application/json" -d '{"order_id":"test","amount":10000}'`
- **Expected**: `{"success":false,"error":"PayOS env vars not configured"}` = routes OK, env missing

### Task 2: Configure Worker Env Vars [⚠️ OWNER ACTION]
> [!IMPORTANT]
> Cần Owner đăng nhập Cloudflare dashboard để set secrets

- **Cloudflare Dashboard** → Workers → `aura-space-worker` → Settings → Variables
- Set secrets:
  ```
  PAYOS_CLIENT_ID = <from payos.vn dashboard>
  PAYOS_API_KEY = <from payos.vn dashboard>  
  PAYOS_CHECKSUM_KEY = <from payos.vn dashboard>
  ```
- **Verify**: Re-run curl từ Task 1, should now return `checkoutUrl`

### Task 3: Set Webhook URL in PayOS Dashboard [⚠️ OWNER ACTION]
- Login [my.payos.vn](https://my.payos.vn) → Settings → Webhook
- Set URL: `https://aura-space-worker.sadec-marketing-hub.workers.dev/api/webhook/payos`
- Click **"Test Webhook"** — should return 200 OK
- **Verify**: Check worker logs for `[PayOS Webhook] Test probe / empty payload — ack 200`

### Task 4: Enable PayOS in Checkout UI (CTO can code)
- **File**: `checkout.html` line 189-193
- **Remove**: `style="opacity:0.4;pointer-events:none;position:relative;"`
- **Change** label from "Sắp ra mắt" to "Chuyển khoản QR"
- **Add** PayOS flow logic:
  - When user selects PayOS + clicks "Thanh Toán":
    1. `POST /api/orders` → create order (get `order_id`)
    2. `POST /api/payment/create-link` → get `checkoutUrl`
    3. `window.location.href = checkoutUrl` → redirect user to PayOS QR page
- **Return flow**: PayOS redirects to `returnUrl` = `track-order.html?success=true&order_id=XXX`

### Task 5: Update CSP Headers (CTO can code)
- **File**: `_headers`
- Add to `connect-src`: `https://api-merchant.payos.vn`
- Add to `frame-src`: `https://pay.payos.vn` (if using embedded QR)

### Task 6: E2E Test Flow
1. Menu → add item → Checkout
2. Select "PayOS" → click Thanh Toán
3. Should redirect to PayOS QR page
4. Scan QR → Pay
5. Redirected back to `track-order.html?success=true`
6. Check D1: `payments` table has `status=completed`
7. Check admin dashboard: order shows `payment_status=paid`

### Task 7: Error Handling Audit
- **Timeout**: PayOS API call timeout handling
- **Cancelled**: User cancels → redirects to `cancelUrl`
- **Failed**: Payment declined → handle in return page
- **Duplicate orderCode**: `Date.now() % 100000000` may collide — add random suffix
- **Webhook retry**: Worker returns 200 even on error to prevent PayOS retry storms ✅

---

## CTO Command

```bash
cd ~/mekong-cli/FnB-Container-Caffe
bash ../scripts/cto-worker.sh "Execute tasks 1,4,5,6,7 from plans/payos-fix.md. Tasks 2,3 are OWNER-only. Follow RULES."
```

## RULES

1. **Không đổi Worker bindings** — D1/KV schema giữ nguyên
2. **Không refactor** — chỉ enable + connect PayOS flow
3. **Atomic commits** — 1 task = 1 commit
4. **Test payment với amount nhỏ** — dùng PayOS sandbox/test mode
5. **Backup trước** — `git branch backup-payos`
6. **CSP phải update TRƯỚC khi enable UI** — tránh CSP block

## Deploy SOP

```bash
rm -rf /tmp/fnb-deploy
rsync -av --exclude='export.pdf' --exclude='*.pen' --exclude='node_modules' \
  --exclude='.git' --exclude='*.sqlite*' --exclude='.DS_Store' \
  --exclude='worker/.wrangler' --exclude='_archive' --exclude='plans' \
  --exclude='tasks-done' --exclude='tests' --exclude='docs' \
  --exclude='designs' --exclude='scripts' --exclude='*.txt' \
  --exclude='lighthouse-report.html' --exclude='package-lock.json' \
  . /tmp/fnb-deploy/
npx wrangler pages deploy /tmp/fnb-deploy/ --project-name=fnb-caffe-container --branch=main
```
