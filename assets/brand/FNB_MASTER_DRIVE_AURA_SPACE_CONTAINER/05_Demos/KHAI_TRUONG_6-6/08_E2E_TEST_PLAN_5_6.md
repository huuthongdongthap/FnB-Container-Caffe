# 🧪 E2E TEST PLAN — D-1 (T6 05/06/2026)

> **Mục đích:** Verify TOÀN BỘ luồng loyalty v3 + check-in + trà sữa hoạt động đúng trên production trước launch 6/6
> **Thời gian thực hiện:** 09:00 - 11:00 T6 05/06 (2 tiếng)
> **Người làm:** Anh Còn + Cường + Khánh (em standby remote)
> **Production URL:** `aura-space-worker.sadec-marketing-hub.workers.dev`

---

## 🎯 OBJECTIVE

Phát hiện bugs trước launch 6/6 — nếu pass 100%, em + anh yên tâm ngủ ngon T6 và sáng T7 đón khách.

**Pass criteria:** Tối thiểu 9/10 scenarios pass. Critical scenarios 1, 2, 7, 8 BẮT BUỘC pass.

---

## ⚙️ PRE-TEST SETUP (09:00 - 09:15)

### 1. Verify production live

```bash
# Worker API
curl -s https://aura-space-worker.sadec-marketing-hub.workers.dev/api/health
# Expected: { "status": "ok", "ts": "..." }

# Frontend Pages
open https://fnb-caffe-container.pages.dev/checkin.html
# Expected: trang load đẹp với logo AURA + form SĐT

open https://fnb-caffe-container.pages.dev/admin/checkin-approve.html
# Expected: trang admin (cần login staff trước)
```

### 2. Login staff (Khánh) + lấy JWT

```bash
# Login bằng POS hoặc admin/login.html
# Save JWT vào biến shell cho curl tests:
export STAFF_TOKEN="eyJhbGc...(token thật)"
```

### 3. Backup D1 production trước test

```bash
cd /Users/mac/mekong-cli/FnB-Container-Caffe/worker
mkdir -p ../backups
npx wrangler d1 export fnb_caffe_db --remote \
  --output=../backups/d1-pretest-$(date +%Y%m%d-%H%M%S).sql
```

### 4. Tạo 3 test customers (em sẽ chuẩn bị)

**Test customer A:** Khách "Test A" SĐT 0900000001 (referrer)
**Test customer B:** Khách "Test B" SĐT 0900000002 (referred)
**Test customer C:** Khách "Test C" SĐT 0900000003 + birthday 1995-05-15 (birthday test)

```bash
# Pre-register qua signup page:
open https://fnb-caffe-container.pages.dev/dang-ky-thanh-vien?phone=0900000001
# Repeat for 0900000002 và 0900000003

# Hoặc qua curl:
curl -X POST https://aura-space-worker.sadec-marketing-hub.workers.dev/api/loyalty/signup \
  -H "Content-Type: application/json" \
  -d '{"phone":"0900000001","name":"Test A","date_of_birth":"1990-01-01"}'
```

---

## 🧪 10 TEST SCENARIOS

### ⭐ Scenario 1: New signup → ví = 0đ (KHÔNG có signup_bonus) — CRITICAL

**Why:** Anh quyết bỏ signup_bonus. Cần verify code tuân thủ.

**Steps:**
1. Mở `https://fnb-caffe-container.pages.dev/dang-ky-thanh-vien`
2. Nhập SĐT mới (chưa tồn tại): `0900000999`
3. Nhập tên + DOB + submit
4. Sau success → check ví trên POS lookup

**Expected:**
- Customer tạo thành công
- Ví = **0đ** (KHÔNG phải 30k hay 50k)
- Loyalty tier = `bronze`

**SQL verify:**
```sql
SELECT c.id, c.name, cw.balance
FROM customers c
LEFT JOIN cashback_wallets cw ON cw.customer_id = c.id
WHERE c.phone = '0900000999';
-- Expected: balance = 0
```

**Pass criteria:** Ví = 0đ ✅

---

### ⭐ Scenario 2: Order ≥ 20k → cashback earned đúng tier rate — CRITICAL

**Why:** Core loyalty function. Phải đúng từ đầu.

**Steps (Khánh tại POS):**
1. Khách Test A (Bronze, 3% rate) order 1 cf sữa đá 25k + 1 trà chanh 30k = 55k tổng
2. Khánh nhập SĐT 0900000001 → POS lookup → confirm Bronze
3. Process payment → order chuyển `completed`

**Expected:**
- Cashback earned: 55,000 × 3% = **1,650đ** (làm tròn 1,700 hoặc 1,650?)
- Trong tuần khai trương (campaign x2): 55,000 × 6% = **3,300đ**
- Ví Test A sau order = 3,300đ

**SQL verify:**
```sql
SELECT amount, multiplier_applied, type, description
FROM cashback_transactions
WHERE customer_id = (SELECT id FROM customers WHERE phone='0900000001')
ORDER BY created_at DESC LIMIT 3;
```

**Pass criteria:** Số tiền cashback đúng + multiplier x2 áp dụng ✅

---

### Scenario 3: Order < 20k → KHÔNG cashback (min order rule)

**Steps:** Order 1 ly nước suối 15k cho Test A

**Expected:** Không có cashback transaction mới (do < 20k min)

**Pass:** No new earn tx ✅

---

### ⭐ Scenario 4: Dùng ví → cap 50% bill enforce — CRITICAL

**Why:** Bug-prone area. Cần verify cap 50% áp dụng đúng.

**Setup:** Test A có ví 50,000đ từ scenario 2 + thêm 1 order khác

**Steps:**
1. Test A order 60k → trên POS chọn "Dùng tối đa ví"
2. POS tự calc max wallet = min(50000, 60000 × 0.5) = **30,000đ**

**Expected:**
- Ví trừ 30,000đ (không 50,000đ)
- Khách trả cash 30,000đ
- Ví còn lại = 20,000đ

**Pass:** Wallet deduction = 30k (= 50% of 60k bill) ✅

---

### Scenario 5: Refer flow — happy path (≥20k order)

**Why:** Verify v3 refer cashback 10k hook orders.js.

**Steps:**
1. Test A get referral code: GET `/api/loyalty/referral/code` với token A
2. Copy code (vd: FNB-ABC123)
3. Test B register + apply code (POST `/api/loyalty/referral/apply` với token B + code)
4. Test B order 50k → process payment → order completed
5. Check Test A wallet

**Expected:**
- `referrals` row: status='pending' → 'completed', cashback_awarded_vnd=10000
- Test A ví +10,000đ
- Audit log: action='referral_cashback'

**SQL verify:**
```sql
SELECT r.status, r.cashback_awarded_vnd, r.first_order_id, r.first_order_amount
FROM referrals r
WHERE r.referred_customer_id = (SELECT id FROM customers WHERE phone='0900000002');
-- Expected: status='completed', cashback_awarded_vnd=10000, first_order_amount=50000

SELECT cw.balance FROM cashback_wallets cw
WHERE cw.customer_id = (SELECT id FROM customers WHERE phone='0900000001');
-- Test A balance phải tăng +10k so với trước
```

**Pass:** Test A nhận đúng 10k cashback ✅

---

### Scenario 6: Refer flow — order < 20k → KHÔNG grant

**Steps:**
1. Test customer D (phone 0900000004) register + apply Test A code
2. Test D order 25k → process completed
3. Check referrals + ví Test A

**Expected:**
- `referrals` row: status='pending' (chưa completed)
- Test A ví KHÔNG tăng

**Pass:** Status vẫn pending, không grant ✅

---

### ⭐ Scenario 7: Check-in eligibility — chưa check-in → eligible — CRITICAL

**Steps:**
1. Customer C (chưa check-in tháng này):
```bash
curl https://aura-space-worker.sadec-marketing-hub.workers.dev/api/loyalty/checkin/eligibility/{C.id}
```

**Expected:**
```json
{
  "success": true,
  "eligible": true,
  "campaign": {
    "code": "CHECKIN_WEEK_6_6",
    "reward_type": "POINTS_20K",
    "reward_value": 20000
  },
  "message": "Đủ điều kiện check-in nhận 20k vào ví!"
}
```

**Pass:** eligible=true + campaign đúng ✅

---

### ⭐ Scenario 8: Check-in approve → ví +20k — CRITICAL

**Steps (Khánh on admin/checkin-approve.html):**
1. Khánh lookup SĐT Test C
2. Confirm eligible
3. Select platform FB, paste link post (mock: `https://fb.com/test`)
4. Click "Approve check-in"

**Expected:**
- Response success với `reward_type=POINTS_20K, reward_value=20000`
- `checkin_log` row insert
- Ví Test C +20,000đ
- Cashback transaction type='bonus', amount=20000
- Audit log action='checkin_bonus'

**SQL verify:**
```sql
SELECT cl.reward_type, cl.reward_value, cl.post_platform, cl.staff_id
FROM checkin_log cl
WHERE cl.customer_id = (SELECT id FROM customers WHERE phone='0900000003');

SELECT cw.balance FROM cashback_wallets cw
WHERE cw.customer_id = (SELECT id FROM customers WHERE phone='0900000003');
-- Expected balance >= 20000
```

**Pass:** Ví +20k + log đầy đủ ✅

---

### ⭐ Scenario 9: Check-in re-try same month → 409 conflict — CRITICAL

**Why:** Verify UNIQUE INDEX enforce 1 lần/khách/tháng.

**Steps:**
1. Khánh thử approve Test C lần 2 (cùng ngày)
2. Submit

**Expected:**
- HTTP 409
- Error: `already_checked_in_this_month`
- Message: "Khách đã check-in tháng này"
- KHÔNG có row mới trong `checkin_log`
- Ví KHÔNG tăng thêm

**Pass:** Reject + không double-grant ✅

---

### Scenario 10: Birthday discount — endpoint trả đúng

**Why:** Verify POS có thể query birthday discount.

**Steps:**
```bash
# Test C có date_of_birth 1995-05-15 (tháng 5, current month)
curl https://aura-space-worker.sadec-marketing-hub.workers.dev/api/loyalty/birthday/{C.id}
```

**Expected (nếu hôm nay tháng 5):**
```json
{
  "success": true,
  "eligible": true,
  "customer": { "id": "...", "name": "Test C", "loyalty_tier": "bronze" },
  "discount_pct": 5,
  "birth_month": 5,
  "message": "🎂 Chúc mừng sinh nhật Test C! Tặng giảm 5% (tier Đồng)"
}
```

**Note:** Nếu test ngày 5/6 (đã sang tháng 6), Test C tháng 5 → KHÔNG eligible. Để test đúng, em đề xuất tạo Test C2 với DOB tháng 6 (vd 1995-06-15).

**Pass:** Eligible=true với discount đúng theo tier ✅

---

## 📊 RESULT TRACKING

```
┌──────┬─────────────────────────────────────────┬────────┬───────────┐
│  #   │ Scenario                                │ Status │ Note      │
├──────┼─────────────────────────────────────────┼────────┼───────────┤
│  1 ⭐ │ New signup → ví=0                      │ ☐      │           │
│  2 ⭐ │ Order ≥20k → cashback đúng tier x2     │ ☐      │           │
│  3   │ Order <20k → no cashback                │ ☐      │           │
│  4 ⭐ │ Ví dùng → cap 50% enforce               │ ☐      │           │
│  5   │ Refer ≥20k → A nhận 10k                 │ ☐      │           │
│  6   │ Refer <30k → status pending             │ ☐      │           │
│  7 ⭐ │ Check-in eligibility public             │ ☐      │           │
│  8 ⭐ │ Check-in approve → ví +20k              │ ☐      │           │
│  9 ⭐ │ Check-in re-try → 409                   │ ☐      │           │
│ 10   │ Birthday endpoint trả đúng              │ ☐      │           │
└──────┴─────────────────────────────────────────┴────────┴───────────┘

⭐ = Critical (must pass)
```

---

## 🚨 IF ANY CRITICAL TEST FAILS

### Severity 1 (BLOCK LAUNCH): Scenario 2, 7, 8 fail

**Action:**
1. Anh chat em qua Cowork NGAY
2. Em debug + push hotfix PR trong < 2h
3. Re-test sau hotfix
4. Nếu không fix kịp → revert PR #40/#41/#42, dùng schema cũ tạm thời

### Severity 2 (Workaround): Scenario 1, 4, 9 fail

**Action:**
1. Document workaround cho Khánh (vd: nếu cap 50% fail → enforce thủ công trên POS)
2. Hotfix sau launch
3. Vẫn launch 6/6

### Severity 3 (Non-blocking): Scenario 3, 5, 6, 10 fail

**Action:**
1. Log issue
2. Fix sau launch trong tuần
3. Không ảnh hưởng launch

---

## 🆘 ROLLBACK PLAN nếu nhiều test fail

```bash
# Restore D1 từ backup pre-test
cd /Users/mac/mekong-cli/FnB-Container-Caffe/worker
LATEST=$(ls -t ../backups/d1-pretest-*.sql | head -1)
npx wrangler d1 execute fnb_caffe_db --remote --file="$LATEST"

# Revert worker code (về trước PR #41/#42):
cd ..
git revert <PR41-merge-sha> <PR42-merge-sha>
cd worker && npx wrangler deploy
```

---

## ✅ SIGN-OFF

Sau khi 10/10 (hoặc 9/10) pass, anh + em ký vào file này:

```
Date: __/__/2026  Time: __:__
Anh Còn:  ______________
Em (Claude): ______________ (via chat confirmation)

Status: ☐ GO LAUNCH 6/6  ☐ HOLD — fix issue trước

Notes:
________________________________
________________________________
```

---

## 📞 ESCALATION CONTACTS

- **Anh Còn:** 097xxxxxxxx
- **Em (Claude):** Standby qua chat Cowork 24/7 cuối tuần
- **Em (Claude) emergency:** Khẩn nhất, em response < 15p từ chat ping

---

🎯 **Tóm tắt 1 câu:** 2 tiếng test sáng T6 5/6 — 10 scenarios — pass 9/10 = GO LAUNCH ngày mai.
