# 🪪 TASK 11 — Membership Card Design + POS Wallet Display

> **Branch:** `feat/loyalty-card-pos-display`
> **Depends on:** Task 08, 09, 10 merged
> **Estimated:** 2h
> **Priority:** P0 (thay thế Task 11 SMS gateway cũ)

---

## 🎯 Goals

**Strategy:** Skip SMS gateway cho launch — thay bằng:
1. **Thẻ giấy cứng** (90×54mm) in cho 100 first sign-ups → tạo "vật lý hữu hình"
2. **POS hiển thị ví đẹp** khi staff quét SĐT → thay vai trò "push notification"
3. **Receipt template** in mã thành viên + ví hiện tại sau mỗi giao dịch
4. **Standee tại quầy** giải thích cách dùng ví + QR check ví

→ Tổng cost: 100k (in 100 thẻ) thay vì 150-200k/tháng SMS.

---

## 📋 Implementation

### Step 1: Setup
```bash
cd /Users/mac/mekong-cli/FnB-Container-Caffe
git checkout main && git pull origin main
git checkout -b feat/loyalty-card-pos-display
```

### Step 2: Thẻ giấy in template — `designs/membership-card-template.html`

**Design spec:**
- Size: 90 × 54mm (chuẩn name card)
- Material: giấy cứng 300gsm matte, lamination optional
- 2 mặt:
  - **Mặt trước:** Logo AURA + "THÀNH VIÊN" + mã thành viên + tên
  - **Mặt sau:** QR check ví + hướng dẫn 3 bước

```html
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <title>AURA CAFE — Membership Card Template</title>
  <style>
    @page {
      size: A4;
      margin: 10mm;
    }
    body {
      font-family: 'Cormorant Garamond', 'Inter', serif;
      margin: 0;
      padding: 0;
      background: #fff;
    }
    .sheet {
      width: 210mm;
      display: grid;
      grid-template-columns: repeat(2, 90mm);
      gap: 8mm;
      padding: 5mm;
    }
    .card {
      width: 90mm;
      height: 54mm;
      border-radius: 3mm;
      overflow: hidden;
      position: relative;
      box-shadow: 0 0 0 0.5pt #ccc;
      page-break-inside: avoid;
    }

    /* ─── Front of card ─── */
    .card-front {
      background: linear-gradient(135deg, #050D1A 0%, #0A1A2E 50%, #1A2A4E 100%);
      color: #E8EEF3;
      padding: 4mm 5mm;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }
    .card-front::before {
      content: '';
      position: absolute;
      top: -10mm;
      right: -10mm;
      width: 25mm;
      height: 25mm;
      background: radial-gradient(circle, rgba(45,90,158,.3) 0%, transparent 70%);
    }
    .brand-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
    }
    .brand-logo {
      width: 8mm;
      height: 8mm;
      border: 0.5pt solid #C9D6DF;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: 'Cormorant Garamond', serif;
      font-size: 12pt;
      font-weight: 600;
    }
    .brand-name {
      font-family: 'Cormorant Garamond', serif;
      font-size: 11pt;
      font-weight: 600;
      letter-spacing: 2pt;
      text-align: right;
    }
    .brand-sub {
      font-size: 5pt;
      letter-spacing: 1pt;
      color: #6B9FB8;
      text-transform: uppercase;
      text-align: right;
    }
    .member-row {
      display: flex;
      flex-direction: column;
      gap: 1mm;
    }
    .member-label {
      font-size: 5pt;
      letter-spacing: 1pt;
      color: #6B9FB8;
      text-transform: uppercase;
    }
    .member-id {
      font-family: 'JetBrains Mono', 'Courier New', monospace;
      font-size: 16pt;
      letter-spacing: 3pt;
      color: #E8EEF3;
    }
    .member-name {
      font-size: 9pt;
      font-weight: 600;
      letter-spacing: 0.5pt;
    }
    .tier-badge {
      position: absolute;
      bottom: 4mm;
      right: 5mm;
      padding: 1mm 3mm;
      border-radius: 2mm;
      font-size: 6pt;
      letter-spacing: 1pt;
      font-weight: 600;
      text-transform: uppercase;
      background: linear-gradient(135deg, #2D5A9E, #1B3A6B);
      color: #E8EEF3;
    }

    /* ─── Back of card ─── */
    .card-back {
      background: #FAFAFA;
      color: #2A3145;
      padding: 4mm 5mm;
      display: grid;
      grid-template-columns: 30mm 1fr;
      gap: 4mm;
      align-items: center;
    }
    .qr-box {
      width: 30mm;
      height: 30mm;
      background: #fff;
      border: 0.5pt solid #B8C0CC;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .qr-box img { width: 100%; height: 100%; }
    .qr-label {
      text-align: center;
      font-size: 5pt;
      color: #6B7280;
      letter-spacing: 1pt;
      margin-top: 1mm;
    }
    .instructions {
      font-size: 6pt;
      line-height: 1.6;
      color: #2A3145;
    }
    .instructions strong {
      color: #1B3A6B;
      font-size: 6.5pt;
      letter-spacing: 0.5pt;
    }
    .instructions ol {
      margin: 1mm 0 0;
      padding: 0 0 0 3mm;
    }
    .instructions li { margin-bottom: 0.5mm; }
    .back-footer {
      grid-column: 1 / -1;
      font-size: 5pt;
      color: #6B7280;
      text-align: center;
      border-top: 0.3pt dashed #B8C0CC;
      padding-top: 1mm;
      margin-top: 1mm;
    }
  </style>
</head>
<body>

<!-- Sheet 1: Front side (10 cards) -->
<div class="sheet">
  <!-- Card template: replace data via mail merge or print script -->
  <div class="card card-front">
    <div class="brand-row">
      <div class="brand-logo">A</div>
      <div>
        <div class="brand-name">AURA</div>
        <div class="brand-sub">CAFE · EST.2018</div>
      </div>
    </div>
    <div class="member-row">
      <div class="member-label">Thành viên</div>
      <div class="member-id">{{MEMBER_ID}}</div>
      <div class="member-name">{{MEMBER_NAME}}</div>
    </div>
    <div class="tier-badge">{{TIER}}</div>
  </div>
  <!-- Repeat 9 more cards on this sheet -->
</div>

<!-- Sheet 2: Back side -->
<div class="sheet" style="page-break-before: always">
  <div class="card card-back">
    <div>
      <div class="qr-box">
        <img src="/public/qr/qr-signup-leaflet.png" alt="QR"/>
      </div>
      <div class="qr-label">QUÉT QR</div>
    </div>
    <div class="instructions">
      <strong>Cách dùng ví AURA</strong>
      <ol>
        <li>Đọc SĐT khi order → tích cashback</li>
        <li>Quét QR → xem ví online</li>
        <li>Dùng ví trừ hóa đơn (max 50%)</li>
      </ol>
      <div class="back-footer">
        AURA CAFE · Sa Đéc · 09xx.xxx.xxx
      </div>
    </div>
  </div>
</div>

</body>
</html>
```

### Step 3: Script generate thẻ batch — `scripts/generate-member-cards.js`

```js
#!/usr/bin/env node
/**
 * Generate membership cards PDF batch
 * Reads 100 first sign-ups from D1 → fill template → export PDF
 *
 * Usage:
 *   node scripts/generate-member-cards.js [limit=100] [output=cards.pdf]
 *
 * Requirements: puppeteer (for PDF gen)
 */

import puppeteer from 'puppeteer';
import fs from 'fs/promises';
import path from 'path';

const LIMIT = parseInt(process.argv[2] || '100', 10);
const OUTPUT = process.argv[3] || 'designs/member-cards-batch.pdf';

// Fetch first 100 members từ D1 via wrangler
async function fetchMembers() {
  const { execSync } = await import('child_process');
  const json = execSync(
    `npx wrangler d1 execute fnb_caffe_db --remote --command="SELECT id, name, phone, loyalty_tier FROM customers ORDER BY id LIMIT ${LIMIT}" --json`,
    { encoding: 'utf-8' }
  );
  const data = JSON.parse(json);
  return data[0].results;
}

function renderCardHTML(member) {
  const memberId = 'AC' + String(member.id).padStart(6, '0');
  const tierVi = { bronze: 'Đồng', silver: 'Bạc', gold: 'Vàng', platinum: 'Bạch Kim' }[member.loyalty_tier] || 'Đồng';

  return `
    <div class="card card-front">
      <div class="brand-row">
        <div class="brand-logo">A</div>
        <div>
          <div class="brand-name">AURA</div>
          <div class="brand-sub">CAFE · EST.2018</div>
        </div>
      </div>
      <div class="member-row">
        <div class="member-label">Thành viên</div>
        <div class="member-id">${memberId}</div>
        <div class="member-name">${(member.name || '').toUpperCase()}</div>
      </div>
      <div class="tier-badge">${tierVi}</div>
    </div>
  `;
}

async function main() {
  const members = await fetchMembers();
  console.log(`✅ Found ${members.length} members`);

  // Read template
  const template = await fs.readFile('designs/membership-card-template.html', 'utf-8');

  // Generate 10 cards per A4 sheet
  let cardsHtml = '';
  let sheetIndex = 0;
  for (let i = 0; i < members.length; i++) {
    if (i % 10 === 0 && i > 0) {
      cardsHtml += '</div><div class="sheet" style="page-break-before: always">';
    }
    cardsHtml += renderCardHTML(members[i]);
  }

  const finalHtml = template.replace(
    '<!-- Repeat 9 more cards on this sheet -->',
    cardsHtml
  );

  // PDF gen
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.setContent(finalHtml, { waitUntil: 'networkidle0' });
  await page.pdf({
    path: OUTPUT,
    format: 'A4',
    printBackground: true,
    margin: { top: '10mm', bottom: '10mm', left: '10mm', right: '10mm' }
  });
  await browser.close();

  console.log(`✅ PDF generated: ${OUTPUT}`);
  console.log(`   In tại shop in Sa Đéc — giấy cứng 300gsm matte, lamination optional`);
  console.log(`   Cost ~80-100k cho 100 thẻ (10 sheets A4)`);
}

main().catch(console.error);
```

Install puppeteer:
```bash
npm install puppeteer --save-dev
node scripts/generate-member-cards.js 100 designs/cards-batch-1.pdf
```

### Step 4: POS Wallet Display — Update `js/pos.js`

Tìm logic khi staff quét/nhập SĐT → enhance UI:

```js
// ────────────────────────────────────────────
// Render member wallet panel sau khi lookup
// ────────────────────────────────────────────
function renderMemberWallet(member) {
  const memberId = 'AC' + String(member.id).padStart(6, '0');
  const tierVi = { bronze: 'Đồng', silver: 'Bạc', gold: 'Vàng', platinum: 'Bạch Kim' }[member.loyalty_tier] || 'Đồng';
  const tierColor = { bronze: '#A5703F', silver: '#9CA8B5', gold: '#D4AF37', platinum: '#E8EEF3' }[member.loyalty_tier];

  // Cashback expiring soon?
  const expiringSoon = member.expiring_within_7d > 0;

  return `
    <div class="member-panel ${expiringSoon ? 'has-warning' : ''}">
      <div class="member-header">
        <div class="member-id-badge">${memberId}</div>
        <div class="member-tier" style="color: ${tierColor}">${tierVi}</div>
      </div>
      <div class="member-name-row">
        <span class="greeting">Xin chào,</span>
        <span class="name">${member.name || 'Khách'}</span>
      </div>

      <div class="wallet-display">
        <div class="wallet-label">Ví Cashback</div>
        <div class="wallet-amount">${formatVND(member.cashback_balance_vnd)}</div>
        <div class="wallet-hint">Dùng tối đa 50% bill / Min 30.000đ</div>
      </div>

      ${expiringSoon ? `
        <div class="expiry-warning">
          ⚠️ ${formatVND(member.expiring_amount)} sắp hết hạn trong 7 ngày — nên dùng hôm nay
        </div>
      ` : ''}

      <div class="member-stats">
        <div class="stat">
          <span class="stat-label">Tổng chi</span>
          <span class="stat-value">${formatVND(member.total_spent_vnd)}</span>
        </div>
        <div class="stat">
          <span class="stat-label">Cashback đã nhận</span>
          <span class="stat-value">${formatVND(member.lifetime_cashback)}</span>
        </div>
      </div>

      ${member.tier_progress ? `
        <div class="tier-progress">
          <div class="progress-label">
            Còn ${formatVND(member.tier_progress.to_next)} để lên ${member.tier_progress.next_tier_vi}
          </div>
          <div class="progress-bar">
            <div class="progress-fill" style="width: ${member.tier_progress.percent}%"></div>
          </div>
        </div>
      ` : ''}
    </div>
  `;
}

// CSS để thêm vào pos.css:
const POS_WALLET_CSS = `
.member-panel {
  background: linear-gradient(135deg, #0A1A2E, #1A2A4E);
  color: #E8EEF3;
  border-radius: 8px;
  padding: 20px;
  border: 1px solid #6B9FB8;
}
.member-panel.has-warning {
  border-color: #FFA500;
  box-shadow: 0 0 20px rgba(255,165,0,.3);
}
.wallet-display {
  text-align: center;
  margin: 20px 0;
  padding: 16px;
  background: rgba(45,90,158,.2);
  border-radius: 6px;
}
.wallet-amount {
  font-family: 'Cormorant Garamond', serif;
  font-size: 36px;
  font-weight: 600;
  color: #FAFAFA;
  margin: 4px 0;
}
.wallet-label {
  font-size: 11px;
  letter-spacing: 2px;
  color: #6B9FB8;
  text-transform: uppercase;
}
.expiry-warning {
  background: rgba(255,165,0,.15);
  border: 1px solid #FFA500;
  color: #FFD580;
  padding: 8px 12px;
  border-radius: 4px;
  font-size: 12px;
  margin-top: 12px;
}
.tier-progress {
  margin-top: 16px;
  padding-top: 12px;
  border-top: 1px dashed #3A6B80;
}
.progress-bar {
  height: 6px;
  background: rgba(255,255,255,.1);
  border-radius: 3px;
  overflow: hidden;
  margin-top: 4px;
}
.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #2D5A9E, #6B9FB8);
  transition: width .5s ease;
}
.member-stats {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-top: 12px;
  font-size: 12px;
}
.stat-label { color: #6B9FB8; }
.stat-value { color: #E8EEF3; font-weight: 600; margin-left: 4px; }
`;
```

### Step 5: Update Receipt Template — `receipt-template.html`

Add member info + ví balance vào receipt:

```html
<!-- Sau total amount -->
{{#if customer}}
<div class="receipt-loyalty">
  <div class="loyalty-header">═══ AURA THÀNH VIÊN ═══</div>
  <div class="loyalty-row">
    <span>Mã TV:</span>
    <span>{{customer.member_id}}</span>
  </div>
  <div class="loyalty-row">
    <span>Hạng:</span>
    <span>{{customer.tier_vi}}</span>
  </div>
  <div class="loyalty-row highlight">
    <span>Cashback nhận:</span>
    <span>+{{format_vnd customer.cashback_earned}}</span>
  </div>
  {{#if customer.bonus_message}}
  <div class="loyalty-bonus">
    🎁 {{customer.bonus_message}}
  </div>
  {{/if}}
  <div class="loyalty-row total">
    <span>Ví hiện tại:</span>
    <span>{{format_vnd customer.cashback_balance_after}}</span>
  </div>
  <div class="loyalty-qr">
    <img src="/public/qr/qr-signup-receipt.png" />
    <div>Quét QR — xem ví online</div>
  </div>
</div>
{{/if}}
```

### Step 6: Standee Wallet Guide — `designs/standee-cach-dung-vi.svg`

(Em tạo standee A1 minh họa 3 bước dùng ví — em làm trong scripts/designs/ riêng.)

Content:
- Bước 1: Đọc SĐT khi order
- Bước 2: Nhận thẻ AURA + ví 50k (first 100)
- Bước 3: Quét QR để xem ví / dùng cho lần sau

### Step 7: Update `worker/src/routes/loyalty.js` — Enhance lookup response

```js
// GET /api/loyalty/lookup?phone=...
app.get('/lookup', async (c) => {
  const phone = c.req.query('phone');
  const customer = await c.env.DB.prepare(
    'SELECT * FROM customers WHERE phone = ?'
  ).bind(phone).first();

  if (!customer) return c.json({ ok: false, error: 'Không tìm thấy thành viên' }, 404);

  // Lifetime cashback total
  const lifetime = await c.env.DB.prepare(`
    SELECT COALESCE(SUM(amount_vnd), 0) as total
    FROM cashback_transactions
    WHERE customer_id = ? AND type IN ('earn', 'bonus')
  `).bind(customer.id).first();

  // Cashback expiring within 7 days
  const expiring = await c.env.DB.prepare(`
    SELECT COALESCE(SUM(amount_vnd), 0) as total, COUNT(*) as count
    FROM cashback_transactions
    WHERE customer_id = ?
      AND type IN ('earn', 'bonus')
      AND expires_at IS NOT NULL
      AND expires_at <= datetime('now', '+7 days')
      AND expires_at > datetime('now')
  `).bind(customer.id).first();

  // Tier progress (cần spend thêm bao nhiêu để lên hạng)
  const currentTier = await c.env.DB.prepare(
    'SELECT * FROM loyalty_tiers WHERE name = ?'
  ).bind(customer.loyalty_tier).first();

  const nextTier = await c.env.DB.prepare(`
    SELECT * FROM loyalty_tiers
    WHERE min_spent_vnd > ?
    ORDER BY min_spent_vnd ASC LIMIT 1
  `).bind(currentTier.min_spent_vnd).first();

  let tierProgress = null;
  if (nextTier) {
    const needed = nextTier.min_spent_vnd - (customer.total_spent_vnd || 0);
    const range = nextTier.min_spent_vnd - currentTier.min_spent_vnd;
    const filled = range - needed;
    tierProgress = {
      next_tier: nextTier.name,
      next_tier_vi: { silver: 'Bạc', gold: 'Vàng', platinum: 'Bạch Kim' }[nextTier.name],
      to_next: needed,
      percent: Math.max(0, Math.min(100, (filled / range) * 100))
    };
  }

  return c.json({
    ok: true,
    member: {
      ...customer,
      member_id: 'AC' + String(customer.id).padStart(6, '0'),
      tier_vi: { bronze: 'Đồng', silver: 'Bạc', gold: 'Vàng', platinum: 'Bạch Kim' }[customer.loyalty_tier],
      lifetime_cashback: lifetime.total,
      expiring_amount: expiring.total,
      expiring_within_7d: expiring.count,
      tier_progress: tierProgress
    }
  });
});
```

### Step 8: Commit + PR

```bash
git add designs/membership-card-template.html \
        designs/standee-cach-dung-vi.svg \
        scripts/generate-member-cards.js \
        js/pos.js receipt-template.html \
        worker/src/routes/loyalty.js \
        package.json

git commit -m "feat(loyalty): membership card + POS wallet display

Replace SMS gateway (deprecated) với physical + POS-driven UX:

1. designs/membership-card-template.html
   - 90x54mm card template (front + back)
   - Front: AURA brand + member ID + tier badge
   - Back: QR code + 3-step usage guide
   - A4 sheet layout (10 cards per sheet)

2. scripts/generate-member-cards.js
   - Batch generate PDF từ D1 first 100 members
   - puppeteer-based PDF gen

3. js/pos.js + pos.css
   - Wallet panel hiển thị khi staff lookup phone
   - Large balance, tier progress bar, expiry warning
   - Brand v6 navy + cobalt styling

4. receipt-template.html
   - Add loyalty section: member ID, tier, cashback earned,
     bonus message, balance after, QR check ví

5. worker/src/routes/loyalty.js /lookup enhanced
   - Lifetime cashback total
   - Expiring within 7d count + amount
   - Tier progress calculation

6. designs/standee-cach-dung-vi.svg
   - A1 standee minh họa 3 bước dùng ví

Cost: ~100k in 100 thẻ (vs 150-200k/tháng SMS)
Effort: 2h dev + 1h print
Better UX: vật lý hữu hình + POS visual real-time"

git push -u origin feat/loyalty-card-pos-display
gh pr create
```

### Step 9: Print cards day-of

Sau khi 100 first sign-ups xong ngày 6/6:
```bash
# Tối 6/6 hoặc sáng 7/6
node scripts/generate-member-cards.js 100 designs/cards-batch-1.pdf

# Mang PDF ra shop in Sa Đéc
# Yêu cầu: giấy cứng 300gsm matte, cắt rời 90x54mm
# Cost: ~80-100k cho 100 thẻ (10 sheets A4)

# Phát thẻ qua đường bưu điện hoặc đợi khách quay lại
# Cách 2: in trước 100 thẻ blank, viết tay member ID + tên tại quán
```

---

## ✅ Acceptance criteria

- [ ] Template thẻ giấy render đẹp PDF
- [ ] Script batch generate works với D1 data
- [ ] POS hiển thị ví đẹp với tier progress + expiry warning
- [ ] Receipt template có loyalty section + QR
- [ ] /api/loyalty/lookup return enhanced data
- [ ] Standee SVG ready in
- [ ] PR merged

---

## 📅 Phase 2: Zalo OA — sau 1 tháng (xem Task 13)

Sau khi launch ổn định (khoảng 25/6):
- Đăng ký Zalo Official Account Business
- Apply ZNS template 4 types (welcome, cashback, expiry, birthday)
- Approval 3-7 ngày
- Replace POS-only notify bằng Zalo notify cho khách có Zalo
- POS giữ cho khách không Zalo

→ Chi tiết ở `13-zalo-oa-zns.md` (em tạo riêng sau).

---

## 💡 Why this beats SMS

| Aspect | SMS Speedsms | **Thẻ giấy + POS** |
|---|---|---|
| Cost | 150-200k/tháng | 100k one-time + 0 recurring |
| Setup time | 1-3 ngày | 2h dev |
| Brand impression | "OK" (text) | ✅ **Premium** (vật lý hữu hình) |
| Customer trust | Medium | ✅ **High** (cầm thẻ trong ví) |
| Internet needed | No (SMS works) | Phone optional (POS at store) |
| Rich content | ❌ Text only | ✅ Logo + tier + QR |
| Long-term value | Recurring cost | ✅ One-time + brand loyalty |

Cafe tỉnh lẻ Sa Đéc — **thẻ vật lý + staff personal touch** đáng giá hơn SMS spam nhiều.
