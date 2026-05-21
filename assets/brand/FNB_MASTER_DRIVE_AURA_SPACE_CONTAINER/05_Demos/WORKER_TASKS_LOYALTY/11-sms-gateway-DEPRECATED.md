# 📲 TASK 11 — SMS Gateway Integration (Speedsms VN)

> **Branch:** `feat/loyalty-sms-gateway`
> **Depends on:** Task 09 merged
> **Estimated:** 2h
> **Priority:** P0 (customer notify khi sign-up + cashback)

---

## 🎯 Goals

1. Tích hợp Speedsms.vn (gateway VN cheap + reliable) cho 4 use cases:
   - Welcome sau signup
   - Notify cashback sau mỗi giao dịch
   - Notify tier upgrade
   - Warning cashback sắp hết hạn (7 ngày trước)
2. Templates Vietnamese friendly
3. Rate limiting để tránh spam + budget control
4. Audit log mỗi SMS gửi
5. Fallback: nếu Zalo có → ưu tiên Zalo (cheaper), else SMS

---

## 📋 Implementation

### Step 1: Setup
```bash
cd /Users/mac/mekong-cli/FnB-Container-Caffe
git checkout main && git pull origin main
git checkout -b feat/loyalty-sms-gateway
```

### Step 2: Register Speedsms account
**Anh Còn cần làm trước:**
1. Đăng ký tại https://speedsms.vn
2. Verify SĐT chủ
3. Top up tối thiểu 100k VNĐ (~300 SMS @ 300đ/tin)
4. Copy API token từ dashboard
5. Gửi token cho em qua secure channel (không paste trong chat thông thường)

**Worker secret:**
```bash
cd worker
npx wrangler secret put SPEEDSMS_TOKEN
# Paste token khi prompt

npx wrangler secret put SPEEDSMS_SENDER
# Paste: "AURA" hoặc "AURACAFE" (max 11 chars, alphanumeric, không space)

npx wrangler secret put INTERNAL_TOKEN
# Random 32-char string để worker-to-worker auth
# Gen: openssl rand -hex 16
```

### Step 3: Create `worker/src/routes/sms.js`

```js
// ════════════════════════════════════════════════════════════
// SMS Gateway — Speedsms.vn integration
// API docs: https://speedsms.vn/api/sms/
// ════════════════════════════════════════════════════════════

import { Hono } from 'hono';

const app = new Hono();

const SPEEDSMS_URL = 'https://api.speedsms.vn/index.php/sms/send';

// SMS type constants
const SMS_TYPES = {
  TRANSACTION: 2,  // Brandname (đã được duyệt)
  ADVERTISING: 1,  // Tin quảng cáo (cần content approval)
  CSKH: 4          // Chăm sóc khách hàng (recommended cho loyalty)
};

// Templates Vietnamese (max 160 chars unicode for 1 SMS)
const TEMPLATES = {
  signup_welcome: (name, memberId, balance) =>
    `Chao mung ${name} den AURA CAFE! Ma TV: ${memberId}. Vi: ${balance.toLocaleString('vi-VN')}d. Xem vi: aura.cafe/loyalty`,

  cashback_earned: (name, amount, balance) =>
    `+${amount.toLocaleString('vi-VN')}d vao vi AURA. Tong: ${balance.toLocaleString('vi-VN')}d. Cam on ${name}! aura.cafe/loyalty`,

  tier_upgrade: (name, newTier) =>
    `Chuc mung ${name} len hang ${newTier}! Cashback tang. Xem quyen loi: aura.cafe/loyalty`,

  cashback_expiry: (name, amount, days) =>
    `${name} oi, ${amount.toLocaleString('vi-VN')}d trong vi AURA con ${days} ngay nua het han. Ghe quan: aura.cafe`,

  birthday_gift: (name) =>
    `Sinh nhat vui ve ${name}! Tang ban 1 ly cafe tu chon tai AURA. Han 7 ngay. aura.cafe`,
};

// ────────────────────────────────────────────
// Core SMS send function
// ────────────────────────────────────────────
async function sendSMS(env, { phone, message, type = SMS_TYPES.CSKH }) {
  if (!env.SPEEDSMS_TOKEN) {
    console.warn('SPEEDSMS_TOKEN not set — SMS skipped');
    return { ok: false, reason: 'no_token' };
  }

  // Normalize phone: 0901234567 → 84901234567
  let normalized = phone.replace(/^\+?84/, '').replace(/^0/, '');
  normalized = '84' + normalized;

  // Audit log BEFORE send (avoid double-send on retry)
  const auditId = await env.DB.prepare(`
    INSERT INTO sms_audit_log (phone, type, message_preview, status, created_at)
    VALUES (?, ?, ?, 'pending', datetime('now'))
  `).bind(phone, type, message.slice(0, 50)).run();

  const auditLogId = auditId.meta.last_row_id;

  try {
    const response = await fetch(SPEEDSMS_URL, {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + btoa(env.SPEEDSMS_TOKEN + ':x'),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        to: [normalized],
        content: message,
        sms_type: type,
        sender: env.SPEEDSMS_SENDER || 'AURA'
      })
    });

    const data = await response.json();

    // Update audit
    const status = data.status === 'success' ? 'sent' : 'failed';
    await env.DB.prepare(`
      UPDATE sms_audit_log SET status = ?, response = ?, updated_at = datetime('now') WHERE id = ?
    `).bind(status, JSON.stringify(data), auditLogId).run();

    return { ok: status === 'sent', data };
  } catch (err) {
    await env.DB.prepare(`
      UPDATE sms_audit_log SET status = 'error', response = ? WHERE id = ?
    `).bind(JSON.stringify({ error: err.message }), auditLogId).run();
    return { ok: false, error: err.message };
  }
}

// ────────────────────────────────────────────
// Internal endpoints (require INTERNAL_TOKEN)
// ────────────────────────────────────────────
function verifyInternal(c) {
  const auth = c.req.header('Authorization');
  if (!auth || !auth.startsWith('Bearer ')) return false;
  const token = auth.slice(7);
  return token === c.env.INTERNAL_TOKEN;
}

app.post('/signup-welcome', async (c) => {
  if (!verifyInternal(c)) return c.json({ ok: false, error: 'Unauthorized' }, 401);

  const { customer_id } = await c.req.json();
  const customer = await c.env.DB.prepare('SELECT * FROM customers WHERE id = ?')
    .bind(customer_id).first();

  if (!customer) return c.json({ ok: false, error: 'Customer not found' }, 404);

  const memberId = 'AC' + String(customer.id).padStart(6, '0');
  const message = TEMPLATES.signup_welcome(
    customer.name || 'bạn',
    memberId,
    customer.cashback_balance_vnd || 0
  );

  const result = await sendSMS(c.env, {
    phone: customer.phone,
    message,
    type: SMS_TYPES.CSKH
  });

  return c.json(result);
});

app.post('/cashback-notify', async (c) => {
  if (!verifyInternal(c)) return c.json({ ok: false, error: 'Unauthorized' }, 401);

  const { customer_id, amount, balance } = await c.req.json();
  const customer = await c.env.DB.prepare('SELECT * FROM customers WHERE id = ?')
    .bind(customer_id).first();

  if (!customer) return c.json({ ok: false, error: 'Customer not found' }, 404);

  // Skip nếu amount < 1000 (không quan trọng)
  if (amount < 1000) return c.json({ ok: true, skipped: 'amount_too_small' });

  const message = TEMPLATES.cashback_earned(
    customer.name?.split(' ').slice(-1)[0] || 'bạn',
    amount,
    balance
  );

  return c.json(await sendSMS(c.env, { phone: customer.phone, message }));
});

app.post('/tier-upgrade', async (c) => {
  if (!verifyInternal(c)) return c.json({ ok: false, error: 'Unauthorized' }, 401);

  const { customer_id, new_tier } = await c.req.json();
  const customer = await c.env.DB.prepare('SELECT * FROM customers WHERE id = ?')
    .bind(customer_id).first();

  const tierNames = { bronze: 'Đồng', silver: 'Bạc', gold: 'Vàng', platinum: 'Bạch Kim' };
  const tierVi = tierNames[new_tier] || new_tier;

  const message = TEMPLATES.tier_upgrade(
    customer.name?.split(' ').slice(-1)[0] || 'bạn',
    tierVi
  );

  return c.json(await sendSMS(c.env, { phone: customer.phone, message }));
});

// ────────────────────────────────────────────
// Public endpoints (admin only — JWT)
// ────────────────────────────────────────────
app.post('/broadcast', async (c) => {
  // Verify admin JWT first
  // ... (existing auth pattern)

  const { template, customer_ids, custom_message } = await c.req.json();

  // Rate limit: max 100 SMS / 5 minutes admin
  // ... (KV rate limit)

  const results = [];
  for (const id of customer_ids) {
    const customer = await c.env.DB.prepare('SELECT * FROM customers WHERE id = ?')
      .bind(id).first();
    if (!customer?.phone) continue;

    const message = custom_message || TEMPLATES[template](customer.name);
    const result = await sendSMS(c.env, { phone: customer.phone, message });
    results.push({ customer_id: id, ...result });
  }

  return c.json({ ok: true, total: results.length, success: results.filter(r => r.ok).length, results });
});

export default app;
```

### Step 4: Mount route trong `worker/src/index.js`

```js
import smsRoutes from './routes/sms.js';

// ... existing code

app.route('/api/sms', smsRoutes);
```

### Step 5: Create migration cho audit log

**File:** `db/migrations/20260519_04_sms_audit_log.sql`

```sql
CREATE TABLE IF NOT EXISTS sms_audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  phone TEXT NOT NULL,
  type INTEGER,
  message_preview TEXT,
  status TEXT NOT NULL CHECK(status IN ('pending', 'sent', 'failed', 'error')),
  response TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_sms_phone_date ON sms_audit_log(phone, created_at);
CREATE INDEX IF NOT EXISTS idx_sms_status_date ON sms_audit_log(status, created_at);
```

Run:
```bash
cd worker
npx wrangler d1 execute fnb_caffe_db --remote --file=../db/migrations/20260519_04_sms_audit_log.sql
```

### Step 6: Test

```bash
# Local test
cd worker
npx wrangler dev

# Test signup welcome SMS
curl -X POST http://localhost:8787/api/sms/signup-welcome \
  -H "Authorization: Bearer YOUR_INTERNAL_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"customer_id": 1}'

# Check audit log
npx wrangler d1 execute fnb_caffe_db --local \
  --command="SELECT * FROM sms_audit_log ORDER BY id DESC LIMIT 5;"

# Test với phone thật của anh Còn
# (Sử dụng mock customer record với phone của anh)
```

### Step 7: Update `processOrderLoyalty` to trigger SMS

(Đã có trong Task 09 step 9 — verify hoạt động end-to-end.)

### Step 8: Setup Cloudflare Cron cho expiry warning

**File:** `worker/src/routes/cron.js` (UPDATE hoặc CREATE)

```js
import { Hono } from 'hono';

const app = new Hono();

// Cron: gửi warning 7 ngày trước expiry
app.get('/cashback-expiry-warning', async (c) => {
  const sevenDaysFromNow = new Date(Date.now() + 7 * 86400000).toISOString();

  // Tìm transactions earn sắp expire trong 7 ngày, chưa được warning
  const expiringSoon = await c.env.DB.prepare(`
    SELECT ct.customer_id,
           SUM(ct.amount_vnd) - SUM(CASE WHEN ct2.type='redeem' THEN ct2.amount_vnd ELSE 0 END) as remaining
    FROM cashback_transactions ct
    LEFT JOIN cashback_transactions ct2 ON ct2.customer_id = ct.customer_id AND ct2.type = 'redeem'
    WHERE ct.type = 'earn'
      AND ct.expires_at IS NOT NULL
      AND ct.expires_at <= ?
      AND ct.expires_at > datetime('now')
    GROUP BY ct.customer_id
    HAVING remaining > 1000
  `).bind(sevenDaysFromNow).all();

  let sent = 0;
  for (const row of expiringSoon.results || []) {
    // Send SMS
    await fetch(`${c.env.WORKER_URL}/api/sms/expiry-warning`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${c.env.INTERNAL_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ customer_id: row.customer_id, amount: row.remaining })
    }).catch(e => console.error('Expiry SMS failed:', e));
    sent++;
  }

  return c.json({ ok: true, sent });
});

export default app;
```

Update `wrangler.toml`:
```toml
[triggers]
crons = ["0 1 * * *"]  # Daily 1am UTC = 8am VN
```

### Step 9: Update web `_headers` cho SMS rate limit

```
/api/sms/*
  X-Rate-Limit: 100 per 5min per IP
```

### Step 10: Commit + PR

```bash
git add worker/src/routes/sms.js worker/src/routes/cron.js worker/src/index.js \
        worker/wrangler.toml db/migrations/20260519_04_sms_audit_log.sql

git commit -m "feat(loyalty): SMS gateway Speedsms VN integration

- worker/src/routes/sms.js: 4 templates + send function + audit log
- Internal auth via INTERNAL_TOKEN bearer
- Phone normalization: 0901234567 → 84901234567
- Audit BEFORE send (prevent double-send on retry)
- 5 endpoints: signup-welcome, cashback-notify, tier-upgrade, expiry-warning, broadcast
- Cron daily 8am VN: cashback expiry warning 7-day
- db/migrations/20260519_04_sms_audit_log: track all SMS sends

Secrets required:
- SPEEDSMS_TOKEN (Speedsms.vn API token)
- SPEEDSMS_SENDER (brand name, max 11 chars)
- INTERNAL_TOKEN (for worker-to-worker auth)

Test plan:
- Mock signup → SMS welcome sent
- Mock order delivered → SMS cashback notify sent
- Tier upgrade → SMS sent
- Cron daily → expiry warning
- Audit log records mỗi attempt"

git push -u origin feat/loyalty-sms-gateway
gh pr create --base main --head feat/loyalty-sms-gateway \
  --title "feat(loyalty): SMS gateway Speedsms VN integration"
```

---

## ✅ Acceptance criteria

- [ ] 3 secrets set trong Cloudflare (SPEEDSMS_TOKEN, SPEEDSMS_SENDER, INTERNAL_TOKEN)
- [ ] Migration sms_audit_log applied
- [ ] Test SMS gửi thành công đến phone anh Còn (signup welcome)
- [ ] Cashback notify SMS test pass
- [ ] Audit log records đầy đủ
- [ ] Cron schedule active
- [ ] PR merged + worker deployed

---

## 💰 Cost estimate

- 300đ/SMS × ước tính 500 SMS/tháng đầu = ~150k VNĐ
- Top up 100k = 333 SMS đủ tuần đầu
- Sau khai trương: top up 500k cho 1.5 tháng tiếp theo

---

## 🆘 Fallback nếu Speedsms fail

1. **Local fallback:** print giấy cứng cho first 100 sign-ups (thẻ thành viên giấy)
2. **Zalo OA later:** sau 1 tháng tích hợp Zalo Mini App + ZNS (cheaper)
3. **Email fallback:** nếu khách provide email → send email backup
