# 🎁 TASK 09 — Bonus Campaigns Logic + Fix Critical Bugs

> **Target repo:** `huuthongdongthap/FnB-Container-Caffe`
> **Branch:** `feat/loyalty-bonus-campaigns`
> **Depends on:** Task 08 merged
> **Estimated:** 3h worker autonomous
> **Priority:** P0 (CRITICAL — fix double-credit bug + enable khai trương x2)

---

## 🎯 Goals

1. **CRITICAL FIX:** Xóa dead code `triggerAutoCashback()` trong `orders.js` (risk double-credit nếu sau này tạo bảng `loyalty_members`)
2. **CRITICAL FIX:** Add idempotency cho `processOrderLoyalty()` — chống cộng cashback 2 lần khi order chuyển delivered→completed
3. **NEW LOGIC:** Apply campaign multiplier x2 cho cashback trong window khai trương 6-8/6
4. **NEW LOGIC:** Signup bonus +50k cho first 100 ngày 6/6 (theo signup_bonus_log + campaign.signup_bonus_cap)
5. **NEW LOGIC:** Set `expires_at` mỗi cashback earn (90/120/180 days theo tier)
6. **NEW LOGIC:** Auto-upgrade Silver khi spend ≥200k ngày 6/6
7. **NEW LOGIC:** Cap max cashback 50k/giao dịch (theo campaign config)
8. **NEW LOGIC:** Refer bonus +50k thay vì 20k trong window khai trương
9. **VALIDATION:** Min order 30k để áp cashback, min 30k khi dùng ví

---

## 📋 Implementation

### Step 1: Setup branch
```bash
cd /Users/mac/mekong-cli/FnB-Container-Caffe
git checkout main && git pull origin main
git checkout -b feat/loyalty-bonus-campaigns
```

### Step 2: Fix `worker/src/routes/orders.js` — Remove dead code

Tìm function `triggerAutoCashback` + tất cả invocation → XÓA HẾT.

```js
// XÓA:
// async function triggerAutoCashback(orderId, env) { ... }
// await triggerAutoCashback(orderId, env);

// GIỮ:
await processOrderLoyalty(orderId, env); // ✅ Đây mới đúng
```

Đồng thời ADD idempotency check trước khi gọi `processOrderLoyalty`:

```js
// Trong updateOrder, branch khi status === 'delivered' OR 'completed':
const existingEarn = await env.DB.prepare(
  "SELECT id FROM cashback_transactions WHERE order_id = ? AND type = 'earn' LIMIT 1"
).bind(orderId).first();

if (!existingEarn) {
  await processOrderLoyalty(orderId, env);
} else {
  console.log(`Order ${orderId} already processed loyalty, skipping`);
}
```

### Step 3: Refactor `processOrderLoyalty` trong `worker/src/routes/loyalty.js`

```js
// ════════════════════════════════════════════════════════
// Process order loyalty: cashback + points + tier upgrade
// Idempotent: dùng UNIQUE (order_id, type='earn') chống double-credit
// Apply active campaign multiplier nếu có
// ════════════════════════════════════════════════════════
export async function processOrderLoyalty(orderId, env) {
  // 1. Get order + customer
  const order = await env.DB.prepare(
    "SELECT * FROM orders WHERE id = ?"
  ).bind(orderId).first();

  if (!order || !order.customer_id) {
    console.log(`Order ${orderId} has no customer, skip loyalty`);
    return { ok: false, reason: 'no_customer' };
  }

  // 2. Check idempotency
  const existingEarn = await env.DB.prepare(
    "SELECT id FROM cashback_transactions WHERE order_id = ? AND type = 'earn' LIMIT 1"
  ).bind(orderId).first();

  if (existingEarn) {
    return { ok: false, reason: 'already_processed', existing_id: existingEarn.id };
  }

  // 3. Check min order applicability (30k)
  const MIN_ORDER_FOR_CASHBACK = 30000;
  if (order.total_vnd < MIN_ORDER_FOR_CASHBACK) {
    return { ok: false, reason: 'below_min_order' };
  }

  // 4. Get customer + tier
  const customer = await env.DB.prepare(
    "SELECT * FROM customers WHERE id = ?"
  ).bind(order.customer_id).first();

  const tier = await env.DB.prepare(
    "SELECT * FROM loyalty_tiers WHERE name = ?"
  ).bind(customer.loyalty_tier || 'bronze').first();

  // 5. Get active campaign (if any window match)
  const now = new Date().toISOString();
  const campaign = await env.DB.prepare(`
    SELECT * FROM bonus_campaigns
    WHERE active = 1 AND start_date <= ? AND end_date >= ?
    ORDER BY id DESC LIMIT 1
  `).bind(now, now).first();

  const multiplier = campaign?.cashback_multiplier ?? 1.0;
  const maxCap = campaign?.max_cap_per_customer_vnd ?? 50000;

  // 6. Calculate cashback
  const baseRate = tier.cashback_rate; // 0.03 - 0.10
  const rawCashback = Math.floor(order.total_vnd * baseRate * multiplier);
  const cashback = Math.min(rawCashback, maxCap);

  // 7. Calculate expiry
  const expiryDays = tier.expiry_days;
  const expiresAt = expiryDays
    ? new Date(Date.now() + expiryDays * 86400000).toISOString()
    : null;

  // 8. Calculate points (giữ logic cũ nếu có)
  const points = Math.floor(order.total_vnd / 1000); // 1 point/1k VND

  // 9. Batch insert (atomic)
  try {
    const stmts = [
      // Cashback earn transaction
      env.DB.prepare(`
        INSERT INTO cashback_transactions
        (customer_id, order_id, type, amount_vnd, balance_after, expires_at, multiplier_applied, campaign_id, created_at)
        VALUES (?, ?, 'earn', ?, ?, ?, ?, ?, datetime('now'))
      `).bind(
        customer.id, orderId, cashback,
        (customer.cashback_balance_vnd || 0) + cashback,
        expiresAt, multiplier, campaign?.id || null
      ),

      // Update customer wallet
      env.DB.prepare(`
        UPDATE customers
        SET cashback_balance_vnd = COALESCE(cashback_balance_vnd, 0) + ?,
            loyalty_points = COALESCE(loyalty_points, 0) + ?,
            total_spent_vnd = COALESCE(total_spent_vnd, 0) + ?,
            updated_at = datetime('now')
        WHERE id = ?
      `).bind(cashback, points, order.total_vnd, customer.id),

      // Update orders với cashback_earned + points_earned
      env.DB.prepare(`
        UPDATE orders
        SET cashback_earned = ?, points_earned = ?, updated_at = datetime('now')
        WHERE id = ?
      `).bind(cashback, points, orderId),

      // Audit log
      env.DB.prepare(`
        INSERT INTO loyalty_audit_log (customer_id, action, amount_vnd, order_id, metadata)
        VALUES (?, 'cashback_earn', ?, ?, ?)
      `).bind(
        customer.id, cashback, orderId,
        JSON.stringify({ tier: tier.name, multiplier, campaign: campaign?.code || null, raw: rawCashback, capped: cashback < rawCashback })
      ),
    ];

    await env.DB.batch(stmts);

    // 10. Check tier upgrade
    const newTotalSpent = (customer.total_spent_vnd || 0) + order.total_vnd;

    // Special: campaign auto-upgrade (6/6 spend ≥200k → Silver)
    if (campaign?.auto_upgrade_tier && campaign?.auto_upgrade_min_spend &&
        order.total_vnd >= campaign.auto_upgrade_min_spend &&
        customer.loyalty_tier === 'bronze') {
      await upgradeTier(customer.id, campaign.auto_upgrade_tier, env, 'campaign_auto');
    } else {
      // Normal threshold upgrade
      const newTier = await getTierForSpend(newTotalSpent, env);
      if (newTier && newTier.name !== customer.loyalty_tier) {
        await upgradeTier(customer.id, newTier.name, env, 'spend_threshold');
      }
    }

    // 11. Notify (Phase 2: Zalo OA — Task 13)
    // Phase 1 (launch 6/6): notify qua POS visual + receipt print
    // Phase 2 (~25/6): tích hợp Zalo ZNS template "cashback_earned"
    if (env.ZALO_ACCESS_TOKEN) {
      const { notifyMember } = await import('./zalo.js').catch(() => ({}));
      if (notifyMember) {
        await notifyMember(env, {
          customer_id: customer.id,
          template_key: 'cashback_earned',
          data: { amount: cashback, balance: (customer.cashback_balance_vnd || 0) + cashback, order_id: orderId }
        }).catch(e => console.error('Zalo notify failed:', e));
      }
    }

    return {
      ok: true,
      cashback_earned: cashback,
      points_earned: points,
      multiplier_applied: multiplier,
      campaign: campaign?.code || null,
      tier_upgraded: false // updated below
    };
  } catch (err) {
    // UNIQUE constraint violation = idempotency working
    if (err.message?.includes('UNIQUE constraint failed')) {
      return { ok: false, reason: 'idempotency_block' };
    }
    throw err;
  }
}

// Helper
async function getTierForSpend(totalSpent, env) {
  return await env.DB.prepare(`
    SELECT * FROM loyalty_tiers
    WHERE min_spent_vnd <= ?
      AND (max_spent_vnd IS NULL OR max_spent_vnd > ?)
    ORDER BY min_spent_vnd DESC LIMIT 1
  `).bind(totalSpent, totalSpent).first();
}

async function upgradeTier(customerId, newTier, env, reason) {
  await env.DB.prepare(`
    UPDATE customers SET loyalty_tier = ?, tier_upgraded_at = datetime('now') WHERE id = ?
  `).bind(newTier, customerId).run();

  await env.DB.prepare(`
    INSERT INTO loyalty_audit_log (customer_id, action, metadata)
    VALUES (?, 'tier_upgrade', ?)
  `).bind(customerId, JSON.stringify({ new_tier: newTier, reason })).run();
}
```

### Step 4: Update `phone-auth` endpoint với signup bonus

Trong `loyalty.js`, tìm `phone-auth` (POST) → khi tạo customer mới:

```js
// Sau khi insert customer mới...
const customerId = result.meta.last_row_id;

// Check active campaign signup bonus
const campaign = await env.DB.prepare(`
  SELECT * FROM bonus_campaigns
  WHERE active = 1 AND start_date <= datetime('now') AND end_date >= datetime('now')
  ORDER BY id DESC LIMIT 1
`).first();

let bonusGranted = 0;
let bonusMessage = null;

if (campaign && campaign.signup_bonus_vnd > 0) {
  // Check cap (first 100 chỉ)
  const grantedCount = await env.DB.prepare(`
    SELECT COUNT(*) as count FROM signup_bonus_log WHERE campaign_id = ?
  `).bind(campaign.id).first();

  if (!campaign.signup_bonus_cap || grantedCount.count < campaign.signup_bonus_cap) {
    bonusGranted = campaign.signup_bonus_vnd;

    // Atomic: grant bonus + log + audit
    await env.DB.batch([
      env.DB.prepare(`
        INSERT INTO cashback_transactions
        (customer_id, type, amount_vnd, balance_after, expires_at, campaign_id, created_at)
        VALUES (?, 'bonus', ?, ?, datetime('now', '+90 days'), ?, datetime('now'))
      `).bind(customerId, bonusGranted, bonusGranted, campaign.id),

      env.DB.prepare(`
        UPDATE customers SET cashback_balance_vnd = ? WHERE id = ?
      `).bind(bonusGranted, customerId),

      env.DB.prepare(`
        INSERT INTO signup_bonus_log (customer_id, campaign_id, bonus_vnd)
        VALUES (?, ?, ?)
      `).bind(customerId, campaign.id, bonusGranted),

      env.DB.prepare(`
        INSERT INTO loyalty_audit_log (customer_id, action, amount_vnd, metadata)
        VALUES (?, 'signup_bonus', ?, ?)
      `).bind(customerId, bonusGranted, JSON.stringify({ campaign: campaign.code, position: grantedCount.count + 1 }))
    ]);

    bonusMessage = `🎉 Chúc mừng! Bạn được tặng ${bonusGranted.toLocaleString('vi-VN')}đ vào ví khai trương AURA.`;
  }
}

return c.json({
  ok: true,
  customer_id: customerId,
  bonus_granted: bonusGranted,
  bonus_message: bonusMessage,
  campaign: campaign?.code || null,
  // ... existing fields
});
```

### Step 5: Update `spend-cashback` endpoint

Tìm endpoint POST `/api/loyalty/spend-cashback` → ADD validation:

```js
const MIN_ORDER_FOR_REDEEM = 30000;
if (body.order_total_vnd < MIN_ORDER_FOR_REDEEM) {
  return c.json({ ok: false, error: `Đơn tối thiểu ${MIN_ORDER_FOR_REDEEM.toLocaleString('vi-VN')}đ để dùng ví cashback` }, 400);
}

// Existing 50% cap check giữ nguyên
// ADD max cashback redeem per transaction
const MAX_REDEEM_PER_TX = 50000;
const actualRedeem = Math.min(requested, balance, halfOfBill, MAX_REDEEM_PER_TX);
```

### Step 6: Update referrals.js — refer bonus campaign-aware

Trong `referrals.js`, tìm logic khi referral pending → completed:

```js
// Get active campaign refer bonus
const campaign = await env.DB.prepare(`
  SELECT refer_bonus_vnd FROM bonus_campaigns
  WHERE active = 1 AND start_date <= datetime('now') AND end_date >= datetime('now')
  ORDER BY id DESC LIMIT 1
`).first();

const referBonus = campaign?.refer_bonus_vnd ?? 20000; // default 20k, campaign 50k

// Apply to both referrer + referee
```

### Step 7: Test E2E
```bash
cd worker
npx wrangler dev
# Open terminal 2:

# Test 1: Sign up trong window campaign → expect +50k bonus
curl -X POST http://localhost:8787/api/loyalty/phone-auth \
  -H "Content-Type: application/json" \
  -d '{"phone":"0901234567","name":"Test User"}'

# Test 2: Create order + mark delivered → expect cashback x2 (multiplier)
# ... (mock order flow)

# Test 3: Mark same order delivered AGAIN → expect "already_processed" (idempotency)

# Test 4: Spend cashback bill 25k → expect 400 "min 30k"

# Test 5: Verify audit log có entries
npx wrangler d1 execute fnb_caffe_db --local --command="SELECT * FROM loyalty_audit_log ORDER BY id DESC LIMIT 10;"
```

### Step 8: Commit + PR

```bash
git add worker/src/routes/orders.js worker/src/routes/loyalty.js worker/src/routes/referrals.js
git commit -m "$(cat <<'EOF'
feat(loyalty): bonus campaigns + idempotency + critical bug fixes

CRITICAL FIXES:
- Remove dead code triggerAutoCashback (orders.js) — risk double-credit
- Add idempotency check trước processOrderLoyalty — chống cộng 2 lần
- Validate cashback expiry_at theo tier (90/120/180/null days)

NEW FEATURES (campaign-aware):
- Apply cashback multiplier (x2 ngày khai trương 6-8/6)
- Signup bonus +50k cho first 100 (capped via signup_bonus_log)
- Auto-upgrade Silver khi spend ≥200k ngày 6/6
- Refer bonus campaign-aware (+50k thay vì 20k khi khai trương)
- Min order 30k để áp cashback
- Max cashback 50k per transaction
- Audit log staff_id + IP + metadata mỗi giao dịch

Depends on: PR #25 (schema v2)
Spec: 01_LOYALTY_CASHBACK_PROGRAM.md
EOF
)"

git push -u origin feat/loyalty-bonus-campaigns

gh pr create --base main --head feat/loyalty-bonus-campaigns \
  --title "feat(loyalty): bonus campaigns + idempotency + critical bug fixes" \
  --body "$(cat <<'EOF'
## Summary
Implement campaign logic + fix 2 critical bugs trước khai trương 6/6.

## Critical fixes
1. Remove dead code `triggerAutoCashback` → chống nguy cơ double-credit
2. Idempotency guard cho `processOrderLoyalty` → chống cộng 2 lần khi order chuyển delivered→completed

## New features
- Cashback x2 trong window 6-8/6 (auto từ DB campaign config)
- Signup bonus +50k cho first 100 ngày 6/6 (capped)
- Auto-upgrade Silver khi spend ≥200k
- Refer bonus +50k trong window
- Min/Max validation đầy đủ
- Audit log per transaction

## Test plan
- [ ] Idempotency: 2 lần delivered same order → 1 lần cashback
- [ ] Campaign window: cashback x2 khi 6/6
- [ ] Out of window: cashback x1 bình thường
- [ ] Signup #100 → tracked, #101 → no bonus
- [ ] Spend bill 25k → error min 30k
- [ ] Max cap: bill 5tr (Platinum 10%) → cap 50k đúng
- [ ] Audit log có entries cho mỗi action

## Depends on
PR #25 (schema v2 merged)
EOF
)"
```

---

## ✅ Acceptance criteria

- [ ] `triggerAutoCashback` xóa hết khỏi orders.js
- [ ] `processOrderLoyalty` có idempotency check
- [ ] Campaign multiplier áp đúng trong window
- [ ] Signup bonus seed đúng + capped first 100
- [ ] expires_at set đúng theo tier
- [ ] Auto-upgrade Silver hoạt động khi đủ điều kiện
- [ ] Min order 30k validation
- [ ] Max cashback 50k cap
- [ ] Audit log entries per action
- [ ] PR merged + worker deployed

---

## 🆘 Rollback

```bash
git revert <merge-commit-sha>
git push origin main
npx wrangler deploy
```

Hoặc disable campaign tạm:
```sql
UPDATE bonus_campaigns SET active = 0 WHERE code = 'GRAND_OPENING_6_6_2026';
```
