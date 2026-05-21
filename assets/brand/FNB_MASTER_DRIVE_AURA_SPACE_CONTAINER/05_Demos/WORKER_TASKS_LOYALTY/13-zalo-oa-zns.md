# 💬 TASK 13 — Zalo Official Account + ZNS Integration (Post-Launch Phase 2)

> **Branch:** `feat/loyalty-zalo-oa-zns`
> **Depends on:** All P0 tasks merged + launch 6/6 success
> **Estimated:** 4h dev + 3-7 ngày approval
> **Priority:** P1 (chạy khoảng 20-25/6, sau 1 tháng launch)

---

## 🎯 Why Zalo (vs SMS)

| Aspect | SMS Speedsms | **Zalo OA + ZNS** |
|---|---|---|
| Cost per message | 300đ | 200-400đ |
| Format | Text only (160 chars) | ✅ Rich: image + button + link |
| Approval time | 1-3 days | 3-7 days (template) |
| Penetration VN | 95% | **>90%** (đặc biệt 18-45) |
| Engagement | Low (skip after read) | **High** (button click → web) |
| Tracking | None | ✅ Click + open analytics |
| Brand presence | None | ✅ Official Account follower → reach lại được |

→ Sa Đéc khách đa số dùng Zalo. Sau khi launch ổn định, switch sang Zalo là move logic.

---

## 📋 Implementation

### Phase A: Đăng ký Zalo OA Business (anh Còn)

**Anh Còn cần làm:**
1. Truy cập https://oa.zalo.me
2. Đăng ký Official Account loại Business (KHÔNG phải Personal)
3. Verify thông tin doanh nghiệp:
   - Giấy phép kinh doanh (cần GPKD)
   - SĐT chính chủ
   - Logo brand (đẩy file PNG)
4. Activate gói **OA Business** (free để start)
5. Update profile:
   - Tên OA: "AURA CAFE"
   - Mô tả: "Container Rooftop Café tại Sa Đéc · Loyalty rewards & cashback"
   - Cover + Avatar (dùng brand v6 navy + chrome)
   - Địa chỉ, giờ mở cửa

**Apply ZNS (Zalo Notification Service):**
1. Tại Zalo Developers: https://developers.zalo.me
2. Đăng ký app + link với OA
3. Submit 4 templates:
   - `welcome_signup` — chào mừng member mới
   - `cashback_earned` — notify cashback sau giao dịch
   - `tier_upgrade` — chúc mừng lên hạng
   - `cashback_expiry_warning` — cảnh báo sắp hết hạn
4. Mỗi template chờ duyệt 3-7 ngày
5. Get `app_id`, `access_token`, `template_id` cho mỗi template

### Phase B: Worker code — `worker/src/routes/zalo.js`

```js
import { Hono } from 'hono';

const app = new Hono();

const ZALO_ZNS_URL = 'https://business.openapi.zalo.me/message/template';

// Templates với placeholders (sau approval)
const ZNS_TEMPLATES = {
  welcome_signup: {
    template_id: 'YOUR_WELCOME_TEMPLATE_ID',
    build_data: ({ name, member_id, balance, qr_url }) => ({
      customer_name: name,
      member_id: member_id,
      balance: balance.toLocaleString('vi-VN') + 'đ',
      qr_url: qr_url
    })
  },
  cashback_earned: {
    template_id: 'YOUR_CASHBACK_TEMPLATE_ID',
    build_data: ({ name, amount, balance, order_id }) => ({
      customer_name: name,
      amount_earned: amount.toLocaleString('vi-VN') + 'đ',
      new_balance: balance.toLocaleString('vi-VN') + 'đ',
      order_id: 'AC' + order_id
    })
  },
  tier_upgrade: {
    template_id: 'YOUR_TIER_TEMPLATE_ID',
    build_data: ({ name, new_tier_vi, new_rate }) => ({
      customer_name: name,
      new_tier: new_tier_vi,
      cashback_rate: (new_rate * 100) + '%'
    })
  },
  cashback_expiry_warning: {
    template_id: 'YOUR_EXPIRY_TEMPLATE_ID',
    build_data: ({ name, amount, days }) => ({
      customer_name: name,
      expiring_amount: amount.toLocaleString('vi-VN') + 'đ',
      days_remaining: days
    })
  }
};

async function sendZNS(env, { phone, template_key, data }) {
  if (!env.ZALO_ACCESS_TOKEN) {
    console.warn('ZALO_ACCESS_TOKEN not set');
    return { ok: false, reason: 'no_token' };
  }

  const template = ZNS_TEMPLATES[template_key];
  if (!template) return { ok: false, reason: 'unknown_template' };

  // Normalize phone: 0901234567 → 84901234567
  let normalized = phone.replace(/^\+?84/, '').replace(/^0/, '');
  normalized = '84' + normalized;

  try {
    const response = await fetch(ZALO_ZNS_URL, {
      method: 'POST',
      headers: {
        'access_token': env.ZALO_ACCESS_TOKEN,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        phone: normalized,
        template_id: template.template_id,
        template_data: template.build_data(data),
        tracking_id: `aura_${Date.now()}`
      })
    });

    const result = await response.json();

    // Audit log
    await env.DB.prepare(`
      INSERT INTO notification_audit_log (channel, phone, template_key, data, status, response, created_at)
      VALUES ('zalo_zns', ?, ?, ?, ?, ?, datetime('now'))
    `).bind(
      phone, template_key, JSON.stringify(data),
      result.error === 0 ? 'sent' : 'failed',
      JSON.stringify(result)
    ).run();

    return { ok: result.error === 0, result };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

// ────────────────────────────────────────────
// Smart routing: Zalo first, fallback POS-only
// ────────────────────────────────────────────
async function notifyMember(env, { customer_id, template_key, data }) {
  const customer = await env.DB.prepare(
    'SELECT * FROM customers WHERE id = ?'
  ).bind(customer_id).first();

  if (!customer) return { ok: false, reason: 'customer_not_found' };

  // Try Zalo if customer has zalo
  if (customer.zalo || customer.phone) {
    const zaloPhone = customer.zalo || customer.phone;
    const result = await sendZNS(env, {
      phone: zaloPhone,
      template_key,
      data: { ...data, name: customer.name }
    });

    if (result.ok) return { ok: true, channel: 'zalo' };

    // Log fallback
    console.log(`Zalo failed for ${customer.phone}, customer needs POS-only notify`);
  }

  return { ok: false, channel: 'pos_only' };
}

export { notifyMember };
export default app;
```

### Phase C: Migration audit log
**File:** `db/migrations/20260620_05_notification_audit.sql`

```sql
CREATE TABLE IF NOT EXISTS notification_audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  channel TEXT NOT NULL CHECK(channel IN ('zalo_zns', 'sms', 'email', 'pos_only')),
  phone TEXT,
  customer_id INTEGER,
  template_key TEXT,
  data TEXT,
  status TEXT NOT NULL CHECK(status IN ('pending', 'sent', 'failed', 'error')),
  response TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES customers(id)
);

CREATE INDEX idx_notif_customer_date ON notification_audit_log(customer_id, created_at);
CREATE INDEX idx_notif_channel_status ON notification_audit_log(channel, status);
```

### Phase D: Update `processOrderLoyalty` — trigger Zalo

Trong `worker/src/routes/loyalty.js`, replace SMS placeholder (deprecated) bằng Zalo notify:

```js
import { notifyMember } from './zalo.js';

// Sau khi cashback đã được credit:
await notifyMember(env, {
  customer_id: customer.id,
  template_key: 'cashback_earned',
  data: {
    amount: cashback,
    balance: (customer.cashback_balance_vnd || 0) + cashback,
    order_id: orderId
  }
});
```

### Phase E: Cron — expiry warning

Update `worker/src/routes/cron.js`:

```js
app.get('/cashback-expiry-warning-zalo', async (c) => {
  const sevenDaysFromNow = new Date(Date.now() + 7 * 86400000).toISOString();

  const expiringSoon = await c.env.DB.prepare(`
    SELECT c.id as customer_id, c.name, c.phone, c.zalo,
           SUM(ct.amount_vnd) as expiring_amount
    FROM customers c
    JOIN cashback_transactions ct ON ct.customer_id = c.id
    WHERE ct.type IN ('earn', 'bonus')
      AND ct.expires_at IS NOT NULL
      AND ct.expires_at <= ?
      AND ct.expires_at > datetime('now')
    GROUP BY c.id
    HAVING expiring_amount > 1000
  `).bind(sevenDaysFromNow).all();

  let sent = 0;
  for (const row of expiringSoon.results) {
    const result = await notifyMember(c.env, {
      customer_id: row.customer_id,
      template_key: 'cashback_expiry_warning',
      data: { amount: row.expiring_amount, days: 7 }
    });
    if (result.ok) sent++;
  }

  return c.json({ ok: true, sent, total: expiringSoon.results.length });
});
```

### Phase F: Secrets setup

```bash
cd worker
npx wrangler secret put ZALO_ACCESS_TOKEN
# Paste token từ Zalo Developers

# Update template_id constants in zalo.js sau khi approved
```

### Phase G: Test + monitor

```bash
# Test send 1 ZNS đến phone anh Còn
curl -X POST $WORKER_URL/api/zalo/test-send \
  -H "Authorization: Bearer ADMIN_JWT" \
  -d '{"phone":"0901234567","template":"welcome_signup"}'

# Monitor audit log
npx wrangler d1 execute fnb_caffe_db --remote \
  --command="SELECT channel, status, COUNT(*) FROM notification_audit_log WHERE created_at >= datetime('now', '-1 day') GROUP BY channel, status;"
```

---

## ✅ Acceptance criteria

- [ ] Zalo OA Business verified
- [ ] 4 ZNS templates approved
- [ ] Migration notification_audit_log applied
- [ ] `worker/src/routes/zalo.js` deployed
- [ ] Test ZNS gửi thành công đến phone anh Còn
- [ ] Customers existing migrated to use Zalo notify
- [ ] Cron expiry warning Zalo activated
- [ ] Audit log records correct

---

## 💰 Cost projection

- ZNS: 200-400đ/message (vs 300đ SMS)
- Volume: ước 1000 messages/tháng sau 1 tháng launch
- Cost: ~200-400k/tháng
- **NHƯNG**: rich content + tracking + brand presence → ROI cao hơn SMS

---

## 🎯 Why này là Phase 2 (sau 1 tháng)

1. **ZNS approval mất 3-7 ngày** → không kịp 6/6
2. **GPKD cần ổn định** mới apply OA Business được
3. **Volume thấp tháng đầu** → SMS hoặc POS đủ
4. **Test với thẻ giấy** xem khách feedback ra sao → quyết định ZNS có cần thiết không
5. **Sau 1 tháng** có data → biết khách nào active → target ZNS đúng

→ Hợp lý dispatch task này khoảng **20-25/6** (1 tháng sau launch).
