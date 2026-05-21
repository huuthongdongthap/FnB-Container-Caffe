# 📝 TASK 10 — Public Signup Page `/dang-ky-thanh-vien` + QR Generator

> **Branch:** `feat/loyalty-signup-page-qr`
> **Depends on:** Task 09 merged (campaign signup bonus logic)
> **Estimated:** 2h
> **Priority:** P0 (blocker cho leaflet + standee QR + 6/6 sign-ups)

---

## 🎯 Goals

1. Tạo public page `/dang-ky-thanh-vien.html` — mobile-first form đăng ký thành viên
2. Form: SĐT (bắt buộc), Họ tên, DOB (optional), Zalo (optional)
3. Submit → POST `/api/loyalty/phone-auth` với extra fields
4. Success page hiển thị: mã thành viên, ví balance (có +50k bonus nếu trong campaign)
5. Generate QR code → standee + leaflet
6. Validation tiếng Việt thân thiện

---

## 📋 Implementation

### Step 1: Setup
```bash
cd /Users/mac/mekong-cli/FnB-Container-Caffe
git checkout main && git pull origin main
git checkout -b feat/loyalty-signup-page-qr
```

### Step 2: Create `dang-ky-thanh-vien.html`

```html
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Đăng ký thành viên — AURA CAFE</title>
  <meta name="description" content="Đăng ký thành viên AURA CAFE — Tặng 50.000đ vào ví cho 100 người đầu khai trương 6/6/2026.">

  <link rel="stylesheet" href="css/brand-tokens.css">
  <link rel="stylesheet" href="css/sections-mineral-v6.css">

  <style>
    body {
      margin: 0;
      font-family: 'Inter', system-ui, sans-serif;
      background: var(--noir-deep);
      color: var(--chrome-bright);
      min-height: 100vh;
    }
    .signup-container {
      max-width: 420px;
      margin: 0 auto;
      padding: 24px 20px;
    }
    .signup-header {
      text-align: center;
      margin-bottom: 32px;
    }
    .logo {
      width: 80px;
      height: 80px;
      margin: 0 auto 16px;
    }
    .signup-header h1 {
      font-family: 'Cormorant Garamond', serif;
      font-size: 32px;
      font-weight: 600;
      margin: 0 0 8px;
      letter-spacing: 2px;
    }
    .signup-header p {
      color: var(--chrome-mid);
      font-size: 14px;
      margin: 0;
    }
    .campaign-banner {
      background: linear-gradient(90deg, var(--cobalt-deep), var(--cobalt-mid));
      border: 1px solid var(--cobalt-bright);
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 24px;
      text-align: center;
    }
    .campaign-banner .gift-icon {
      font-size: 32px;
      margin-bottom: 4px;
    }
    .campaign-banner .gift-text {
      font-family: 'Cormorant Garamond', serif;
      font-size: 18px;
      font-weight: 600;
      color: var(--chrome-bright);
      margin: 0;
    }
    .campaign-banner .gift-meta {
      font-size: 12px;
      color: var(--chrome-mid);
      margin-top: 4px;
    }
    .form-group {
      margin-bottom: 20px;
    }
    .form-group label {
      display: block;
      font-size: 13px;
      color: var(--chrome-mid);
      margin-bottom: 6px;
      letter-spacing: 1px;
      text-transform: uppercase;
    }
    .form-group input {
      width: 100%;
      padding: 14px 16px;
      background: var(--noir-mid);
      border: 1px solid var(--chrome-dark);
      border-radius: 4px;
      color: var(--chrome-bright);
      font-size: 16px; /* avoid iOS zoom on focus */
      font-family: inherit;
      box-sizing: border-box;
      transition: border-color .2s;
    }
    .form-group input:focus {
      outline: none;
      border-color: var(--cobalt-bright);
      box-shadow: 0 0 0 3px var(--cobalt-glow);
    }
    .form-group .hint {
      font-size: 12px;
      color: var(--chrome-dark);
      margin-top: 4px;
    }
    .form-group .error {
      font-size: 12px;
      color: #FF6B6B;
      margin-top: 4px;
      display: none;
    }
    .form-group.error input { border-color: #FF6B6B; }
    .form-group.error .error { display: block; }
    .submit-btn {
      width: 100%;
      padding: 16px;
      background: var(--cobalt-bright);
      color: var(--chrome-bright);
      border: none;
      border-radius: 4px;
      font-size: 15px;
      font-weight: 600;
      letter-spacing: 2px;
      text-transform: uppercase;
      cursor: pointer;
      transition: all .25s ease;
      margin-top: 8px;
    }
    .submit-btn:hover {
      background: var(--cobalt-mid);
      box-shadow: 0 0 20px var(--cobalt-glow);
    }
    .submit-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .submit-btn.loading::after {
      content: ' …';
    }
    .terms {
      font-size: 11px;
      color: var(--chrome-dark);
      text-align: center;
      margin-top: 16px;
      line-height: 1.5;
    }
    .terms a { color: var(--chrome-mid); }

    /* Success state */
    .success-card {
      display: none;
      background: linear-gradient(180deg, var(--mineral-cream), var(--mineral-pearl));
      border-radius: 8px;
      padding: 32px 24px;
      text-align: center;
      color: var(--mineral-text);
    }
    .success-card.active { display: block; }
    .success-card .check-icon {
      font-size: 64px;
      color: var(--cobalt-bright);
      margin-bottom: 16px;
    }
    .success-card h2 {
      font-family: 'Cormorant Garamond', serif;
      font-size: 24px;
      margin: 0 0 8px;
    }
    .success-card .member-id {
      font-family: 'JetBrains Mono', monospace;
      font-size: 18px;
      letter-spacing: 3px;
      background: var(--mineral-pearl);
      border: 1px solid var(--cobalt-mid);
      border-radius: 4px;
      padding: 12px;
      margin: 16px 0;
      display: inline-block;
    }
    .success-card .balance {
      font-size: 32px;
      font-weight: 600;
      color: var(--cobalt-bright);
      margin: 16px 0 8px;
    }
    .success-card .balance-label {
      font-size: 13px;
      color: var(--mineral-muted);
      text-transform: uppercase;
      letter-spacing: 2px;
    }
    .success-card .next-steps {
      margin-top: 24px;
      padding-top: 24px;
      border-top: 1px dashed var(--mineral-stone);
      font-size: 14px;
      color: var(--mineral-muted);
      line-height: 1.6;
    }
  </style>
</head>
<body>

<div class="signup-container">
  <header class="signup-header">
    <svg class="logo" viewBox="0 0 100 100">
      <!-- AURA logo placeholder; có thể replace bằng SVG thật -->
      <circle cx="50" cy="50" r="45" fill="none" stroke="#C9D6DF" stroke-width="2"/>
      <path d="M30,70 L50,25 L70,70 M37,55 L63,55" fill="none" stroke="#E8EEF3" stroke-width="3" stroke-linecap="round"/>
    </svg>
    <h1>AURA CAFE</h1>
    <p>Đăng ký thành viên — Tích cashback mỗi giao dịch</p>
  </header>

  <!-- Campaign banner (server-render hoặc JS fetch) -->
  <div id="campaign-banner" class="campaign-banner" style="display:none;">
    <div class="gift-icon">🎁</div>
    <p class="gift-text">Tặng <span id="bonus-amount">50.000đ</span> vào ví khai trương</p>
    <p class="gift-meta">Cho 100 người đầu tiên — Khai trương 06/06/2026</p>
  </div>

  <!-- Form -->
  <form id="signup-form" novalidate>
    <div class="form-group" id="g-phone">
      <label for="phone">Số điện thoại *</label>
      <input
        type="tel"
        id="phone"
        name="phone"
        inputmode="tel"
        autocomplete="tel"
        placeholder="0901234567"
        required
        maxlength="11"
        pattern="^(0|\+84)[0-9]{9,10}$"
      >
      <div class="hint">SĐT là mã thành viên — bạn dùng nó mỗi lần ghé quán</div>
      <div class="error">SĐT không hợp lệ. VD: 0901234567</div>
    </div>

    <div class="form-group" id="g-name">
      <label for="name">Họ và tên *</label>
      <input
        type="text"
        id="name"
        name="name"
        autocomplete="name"
        placeholder="Nguyễn Văn A"
        required
        maxlength="60"
      >
      <div class="error">Vui lòng nhập họ tên</div>
    </div>

    <div class="form-group" id="g-dob">
      <label for="dob">Ngày sinh (tặng quà sinh nhật ☕)</label>
      <input
        type="date"
        id="dob"
        name="dob"
        autocomplete="bday"
      >
      <div class="hint">Không bắt buộc — để tặng anh/chị 1 ly free vào sinh nhật</div>
    </div>

    <div class="form-group" id="g-zalo">
      <label for="zalo">Zalo (nhận voucher)</label>
      <input
        type="tel"
        id="zalo"
        name="zalo"
        inputmode="tel"
        placeholder="Cùng SĐT trên nếu giống nhau"
      >
    </div>

    <button type="submit" class="submit-btn" id="submit-btn">
      Đăng ký — Nhận quà khai trương
    </button>

    <p class="terms">
      Bằng việc đăng ký, bạn đồng ý với <a href="/dieu-khoan-thanh-vien">điều khoản</a>
      của AURA CAFE. Chúng tôi không spam.
    </p>
  </form>

  <!-- Success state -->
  <div class="success-card" id="success-card">
    <div class="check-icon">✓</div>
    <h2>Chào mừng <span id="success-name">bạn</span> đến AURA!</h2>
    <p>Mã thành viên của bạn:</p>
    <div class="member-id" id="member-id">AC000000</div>
    <div class="balance-label">Ví cashback ban đầu</div>
    <div class="balance" id="success-balance">0đ</div>
    <div class="next-steps">
      <p><strong>Bước tiếp theo:</strong></p>
      <p>📍 Ghé quán <strong>AURA CAFE Sa Đéc</strong> — đọc SĐT để dùng ví hoặc tích cashback</p>
      <p>🎉 Khai trương <strong>06/06</strong> — Cashback x2 trong 3 ngày!</p>
      <p style="margin-top:16px"><a href="/loyalty" style="color: var(--cobalt-bright)">Xem ví của tôi →</a></p>
    </div>
  </div>
</div>

<script src="/js/signup-loyalty.js" defer></script>
</body>
</html>
```

### Step 3: Create `js/signup-loyalty.js`

```js
(function() {
  'use strict';

  const API_BASE = '/api/loyalty';

  // Phone validation VN
  const PHONE_REGEX = /^(0|\+84)[0-9]{9,10}$/;

  // Show campaign banner nếu có active campaign
  async function loadCampaign() {
    try {
      const r = await fetch(`${API_BASE}/active-campaign`);
      if (!r.ok) return;
      const data = await r.json();
      if (data?.campaign?.signup_bonus_vnd > 0) {
        const banner = document.getElementById('campaign-banner');
        document.getElementById('bonus-amount').textContent =
          data.campaign.signup_bonus_vnd.toLocaleString('vi-VN') + 'đ';
        banner.style.display = 'block';
      }
    } catch (e) {
      console.warn('Campaign load failed:', e);
    }
  }

  // Validate single field
  function validate(field, value) {
    const group = document.getElementById(`g-${field}`);
    let valid = true;

    if (field === 'phone') {
      valid = PHONE_REGEX.test(value);
    } else if (field === 'name') {
      valid = value.trim().length >= 2;
    }

    group.classList.toggle('error', !valid);
    return valid;
  }

  // Form submit
  async function handleSubmit(e) {
    e.preventDefault();
    const form = e.target;
    const btn = document.getElementById('submit-btn');

    const phone = form.phone.value.trim();
    const name = form.name.value.trim();
    const dob = form.dob.value || null;
    const zalo = form.zalo.value.trim() || null;

    // Validate
    const pOk = validate('phone', phone);
    const nOk = validate('name', name);
    if (!pOk || !nOk) return;

    btn.disabled = true;
    btn.classList.add('loading');
    btn.textContent = 'Đang đăng ký';

    try {
      const r = await fetch(`${API_BASE}/phone-auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, name, dob, zalo, source: 'signup_page' })
      });

      const data = await r.json();

      if (!r.ok) {
        throw new Error(data.error || 'Lỗi đăng ký');
      }

      // Show success
      document.getElementById('signup-form').style.display = 'none';
      document.getElementById('campaign-banner').style.display = 'none';

      const card = document.getElementById('success-card');
      card.classList.add('active');
      document.getElementById('success-name').textContent = name.split(' ').slice(-1)[0]; // last name
      document.getElementById('member-id').textContent = `AC${String(data.customer_id).padStart(6, '0')}`;

      const balance = (data.bonus_granted || 0);
      document.getElementById('success-balance').textContent = balance.toLocaleString('vi-VN') + 'đ';

      // GA / FB Pixel event nếu có
      if (window.gtag) {
        window.gtag('event', 'signup_loyalty', { value: balance });
      }

      // Scroll to top
      window.scrollTo({ top: 0, behavior: 'smooth' });

    } catch (err) {
      alert(`Có lỗi: ${err.message}. Vui lòng thử lại.`);
      btn.disabled = false;
      btn.classList.remove('loading');
      btn.textContent = 'Đăng ký — Nhận quà khai trương';
    }
  }

  // Bind events
  document.addEventListener('DOMContentLoaded', () => {
    loadCampaign();
    document.getElementById('signup-form').addEventListener('submit', handleSubmit);

    // Real-time validation
    ['phone', 'name'].forEach(field => {
      document.getElementById(field).addEventListener('blur', e => {
        validate(field, e.target.value);
      });
    });
  });
})();
```

### Step 4: Add endpoint `GET /api/loyalty/active-campaign`

Trong `worker/src/routes/loyalty.js`:

```js
app.get('/active-campaign', async (c) => {
  const now = new Date().toISOString();
  const campaign = await c.env.DB.prepare(`
    SELECT id, code, name, description,
           cashback_multiplier, signup_bonus_vnd, signup_bonus_cap,
           refer_bonus_vnd, end_date
    FROM bonus_campaigns
    WHERE active = 1 AND start_date <= ? AND end_date >= ?
    ORDER BY id DESC LIMIT 1
  `).bind(now, now).first();

  if (!campaign) return c.json({ ok: true, campaign: null });

  // Add remaining signup slots
  if (campaign.signup_bonus_cap) {
    const granted = await c.env.DB.prepare(`
      SELECT COUNT(*) as count FROM signup_bonus_log WHERE campaign_id = ?
    `).bind(campaign.id).first();
    campaign.signup_slots_left = Math.max(0, campaign.signup_bonus_cap - granted.count);
  }

  return c.json({ ok: true, campaign });
});
```

### Step 5: Update `phone-auth` để accept extra fields

```js
// Trong phone-auth handler
const { phone, name, dob, zalo, source } = await c.req.json();

// Existing validation phone... CHỈNH regex thành VN-specific:
if (!/^(0|\+84)[0-9]{9,10}$/.test(phone)) {
  return c.json({ ok: false, error: 'SĐT không hợp lệ' }, 400);
}

// Existing customer lookup hoặc create
let customer = await c.env.DB.prepare(
  'SELECT * FROM customers WHERE phone = ?'
).bind(phone).first();

if (!customer) {
  // Create new với extra fields
  const result = await c.env.DB.prepare(`
    INSERT INTO customers (phone, name, date_of_birth, zalo, source, loyalty_tier, cashback_balance_vnd, created_at)
    VALUES (?, ?, ?, ?, ?, 'bronze', 0, datetime('now'))
  `).bind(phone, name, dob, zalo, source || 'unknown').run();

  customer = await c.env.DB.prepare('SELECT * FROM customers WHERE id = ?')
    .bind(result.meta.last_row_id).first();

  // Apply signup bonus (logic từ Task 09)
  // ... grant bonus + insert signup_bonus_log
}

return c.json({
  ok: true,
  customer_id: customer.id,
  bonus_granted: bonusGranted, // từ logic Task 09
  is_new: !!result?.meta?.last_row_id,
  // ...
});
```

### Step 6: Update `_redirects`

```
# Loyalty signup
/dang-ky-thanh-vien    /dang-ky-thanh-vien.html    200
/dang-ky               /dang-ky-thanh-vien.html    301
/membership            /dang-ky-thanh-vien.html    301
```

### Step 7: QR Code generator script

**File:** `scripts/generate-qr-signup.js`

```js
#!/usr/bin/env node
/**
 * Generate QR code PNG cho standee + leaflet
 * Usage: node scripts/generate-qr-signup.js
 * Output: public/qr-dang-ky-thanh-vien.png (high res)
 */

import QRCode from 'qrcode'; // npm i qrcode
import fs from 'fs';

const URL = 'https://fnb-caffe-container.pages.dev/dang-ky-thanh-vien';

const OUTPUT_DIR = 'public/qr';
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

// Standee print (large)
await QRCode.toFile(`${OUTPUT_DIR}/qr-signup-standee.png`, URL, {
  errorCorrectionLevel: 'H',
  type: 'png',
  width: 1200,
  margin: 4,
  color: {
    dark: '#0A1A2E',  // navy
    light: '#FAFAFA'  // pearl
  }
});

// Leaflet (medium)
await QRCode.toFile(`${OUTPUT_DIR}/qr-signup-leaflet.png`, URL, {
  errorCorrectionLevel: 'M',
  width: 600,
  margin: 3,
  color: { dark: '#0A1A2E', light: '#FFFFFF' }
});

// Receipt (small)
await QRCode.toFile(`${OUTPUT_DIR}/qr-signup-receipt.png`, URL, {
  errorCorrectionLevel: 'M',
  width: 300,
  margin: 2,
  color: { dark: '#000000', light: '#FFFFFF' }
});

console.log('✅ QR codes generated:');
console.log(`  - ${OUTPUT_DIR}/qr-signup-standee.png (1200x1200)`);
console.log(`  - ${OUTPUT_DIR}/qr-signup-leaflet.png (600x600)`);
console.log(`  - ${OUTPUT_DIR}/qr-signup-receipt.png (300x300)`);
```

Run:
```bash
npm install qrcode --save-dev
node scripts/generate-qr-signup.js
```

### Step 8: Commit + PR

```bash
git add dang-ky-thanh-vien.html js/signup-loyalty.js \
        worker/src/routes/loyalty.js \
        _redirects scripts/generate-qr-signup.js public/qr/

git commit -m "feat(loyalty): public signup page + QR generator

- /dang-ky-thanh-vien.html: mobile-first form (SĐT, Tên, DOB, Zalo)
- js/signup-loyalty.js: form validation + API integration + success state
- GET /api/loyalty/active-campaign: expose campaign info to frontend
- POST /api/loyalty/phone-auth: accept dob, zalo, source fields
- _redirects: /dang-ky, /membership → /dang-ky-thanh-vien
- scripts/generate-qr-signup.js: QR code generator (3 sizes)
- public/qr/: pre-generated PNG QR codes for print

Brand v6 styling (mineral + cobalt).
WCAG AA compliant.
Mobile-first responsive.

Depends on: PR #26 (campaigns logic)"

git push -u origin feat/loyalty-signup-page-qr
gh pr create --base main --head feat/loyalty-signup-page-qr \
  --title "feat(loyalty): public signup page + QR generator"
```

---

## ✅ Acceptance criteria

- [ ] `/dang-ky-thanh-vien.html` deployed + accessible
- [ ] Form validation works (phone regex VN, required fields)
- [ ] Submit → API success → success card with member ID + balance
- [ ] Campaign banner show khi có active campaign
- [ ] Mobile-first responsive (test trên iPhone)
- [ ] WCAG AA contrast
- [ ] 3 QR codes generated in public/qr/
- [ ] PR merged + Cloudflare deployed

---

## 🆘 Rollback

```bash
git revert <merge-commit-sha>
git push origin main
```

Page sẽ 404 → leaflet QR sẽ chỉ về 404 → KHẢ NĂNG marketing fail.

→ Khuyến nghị: test kỹ trước khi in leaflet 500 tờ (in sau khi page live ổn 24h).
