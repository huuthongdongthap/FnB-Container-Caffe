# 🚀 MERGE 3 PRs + DEPLOY — Final Commands

> 🎉 Worker đã hoàn thành ALL 5 P0 tasks trong 1 đêm
> Cập nhật deep check 27/05 — PR #27/#28/#29 đã có squash commits trên `main`; production deploy còn bị chặn bởi network/token trong shell hiện tại.

---

## 🔎 Deep check 27/05/2026

| Hạng mục | Kết quả | Bằng chứng |
|---|---|---|
| PR #27 Signup page + QR | DONE trên `main` | `81ddccb feat(loyalty): public signup page + QR generator (Task 10) (#27)` |
| PR #28 Card + POS wallet | DONE trên `main` | `f68dbd7 feat(loyalty): membership card + POS wallet display (#28)` |
| PR #29 Admin dashboard | DONE trên `main` | `1c6ec44 feat(admin): loyalty dashboard 8 widgets + CSV export (#29)` |
| Worker source | Clean | `git status --short worker worker/src worker/wrangler.toml` không trả dòng nào |
| Local tests | PASS | `npm --silent test -- --runInBand --silent` → 22 tests passed |
| Frontend build | PASS with warnings | `npm --silent run build` exit 0; còn 102 lint warnings và 1 parse warning trong `loyalty-calculator.html` |
| Worker dry-run deploy | PASS | `WRANGLER_LOG_PATH=/private/tmp/wrangler-logs npx wrangler deploy --dry-run` → bundle 212 KiB, gzip 46.74 KiB |
| Worker production deploy | DONE | User terminal deployed `aura-space-worker`, version `72ca8229-a779-4bb5-86ed-3376e626f4a3` |
| Pages production deploy | DONE | User terminal deployed Pages preview `https://8182d373.fnb-caffe-container.pages.dev` |

Ghi chú: remote feature branches `origin/feat/loyalty-signup-page-qr`, `origin/feat/loyalty-card-pos-display`, `origin/feat/admin-loyalty-dashboard` vẫn còn tồn tại, nhưng không còn là bằng chứng PR open vì main đã có squash merge commits #27/#28/#29.

---

## 📊 Trạng thái hiện tại

| PR | Task | Branch | Schema | Status |
|---|---|---|---|---|
| ✅ #25 | 08 Schema v2 | merged | Migration #03 applied ✅ | DONE |
| ✅ #26 | 09 Campaigns + bug fixes | merged | — | DONE |
| 🔵 #27 | 10 Signup page + QR | feat/loyalty-signup-page-qr | Migration #04 applied ✅ | Open |
| 🔵 #28 | 11 Card + POS wallet | feat/loyalty-card-pos-display | — | Open |
| 🔵 #29 | 12 Admin dashboard | feat/admin-loyalty-dashboard | — | Open |

→ 3 PR cần merge + deploy worker

---

## ⚡ Quick Deploy Script (recommended — copy-paste 1 lần)

```bash
cd /Users/mac/mekong-cli/FnB-Container-Caffe && \
echo "═══════════════════════════════════════════" && \
echo "🔄 Step 1: Sync main + verify" && \
echo "═══════════════════════════════════════════" && \
git checkout main && git pull origin main && \
git status --short && \
echo "" && \
echo "═══════════════════════════════════════════" && \
echo "🟢 Step 2: Merge PR #27 (signup page + QR)" && \
echo "═══════════════════════════════════════════" && \
gh pr merge 27 --squash --delete-branch && \
git pull origin main && \
echo "" && \
echo "═══════════════════════════════════════════" && \
echo "🟢 Step 3: Merge PR #28 (POS wallet + card)" && \
echo "═══════════════════════════════════════════" && \
gh pr merge 28 --squash --delete-branch && \
git pull origin main && \
echo "" && \
echo "═══════════════════════════════════════════" && \
echo "🟢 Step 4: Merge PR #29 (admin dashboard)" && \
echo "═══════════════════════════════════════════" && \
gh pr merge 29 --squash --delete-branch && \
git pull origin main && \
echo "" && \
echo "═══════════════════════════════════════════" && \
echo "🚀 Step 5: Deploy worker production" && \
echo "═══════════════════════════════════════════" && \
cd worker && \
npx wrangler deploy && \
cd .. && \
echo "" && \
echo "═══════════════════════════════════════════" && \
echo "✅ All deployments complete!" && \
echo "═══════════════════════════════════════════"
```

→ Script chạy ~3-5 phút. Cloudflare Pages auto-deploy frontend từ main branch.

---

## 🔍 Verify production sau deploy

```bash
echo "" && \
echo "═══════════════════════════════════════════" && \
echo "🔍 Verify production endpoints" && \
echo "═══════════════════════════════════════════" && \
\
echo "1. Signup page accessible:" && \
curl -s -o /dev/null -w "  Status: %{http_code}\n" \
  https://fnb-caffe-container.pages.dev/dang-ky-thanh-vien && \
\
echo "" && \
echo "2. Active campaign endpoint:" && \
curl -s https://fnb-caffe-container.pages.dev/api/loyalty/active-campaign | jq '.campaign | {code, signup_bonus_vnd, signup_slots_left, end_date}' && \
\
echo "" && \
echo "3. Loyalty lookup endpoint (replace SDT thật của anh):" && \
curl -s "https://fnb-caffe-container.pages.dev/api/loyalty/lookup?phone=0901234567" | jq '.member | {member_id, tier_vi, balance: .cashback_balance, expiring_within_7d}' 2>/dev/null || echo "  (cần SDT thật để verify)" && \
\
echo "" && \
echo "4. Public tiers endpoint:" && \
curl -s https://fnb-caffe-container.pages.dev/api/loyalty/tiers | jq '.data[] | {tier_name, display_name_vi, cashback_rate, expiry_days}' && \
\
echo "" && \
echo "5. QR codes exist:" && \
curl -s -o /dev/null -w "  Standee: %{http_code}\n" https://fnb-caffe-container.pages.dev/public/qr/qr-signup-standee.png && \
curl -s -o /dev/null -w "  Leaflet: %{http_code}\n" https://fnb-caffe-container.pages.dev/public/qr/qr-signup-leaflet.png && \
curl -s -o /dev/null -w "  Receipt: %{http_code}\n" https://fnb-caffe-container.pages.dev/public/qr/qr-signup-receipt.png
```

---

## 🧪 End-to-end test (sau verify success)

### Test 1: Signup flow real
```bash
# Mở browser
open https://fnb-caffe-container.pages.dev/dang-ky-thanh-vien

# Test với SĐT của anh:
# - Nhập SĐT thật → submit
# - Verify success card hiển thị: member ID + ví 0đ (vì chưa trong window campaign 6/6)
# - Sau 6/6: signup → ví 50.000đ (50k campaign bonus)
```

### Test 2: Admin dashboard
```bash
# Mở admin dashboard
open https://fnb-caffe-container.pages.dev/admin/dashboard.html

# Login với admin account
# Click "💎 Loyalty Analytics" trong nav
# Verify 8 widgets load:
#   1. Members total + tier
#   2-3. Cashback issued/redeemed
#   4. Top 10 spenders
#   5. Expiring soon
#   6. Sign-ups by channel
#   7. Referral pairs
#   8. Active campaign progress
```

### Test 3: POS wallet display
```bash
# Mở POS
open https://fnb-caffe-container.pages.dev/admin/pos.html

# Login + nhập SĐT của test customer (từ Test 1)
# Verify wallet panel hiển thị:
#   - Balance ví
#   - Tier badge
#   - Tier progress bar
#   - Expiry warning (nếu < 7 ngày)
```

### Test 4: Membership card PDF generation
```bash
# Cần có ít nhất 1 customer trong D1 production
cd /Users/mac/mekong-cli/FnB-Container-Caffe
node scripts/generate-member-cards.js 5 designs/cards-test.pdf

# Verify PDF tạo được
open designs/cards-test.pdf
# → 1 sheet A4 với 5 thẻ 90×54mm
```

---

## 📋 Schema verify (đảm bảo migrations applied)

```bash
cd /Users/mac/mekong-cli/FnB-Container-Caffe/worker

# Verify migration 03 (Task 08) applied
npx wrangler d1 execute fnb-caffe-db --remote \
  --command="SELECT tier_name, display_name_vi, cashback_rate, expiry_days, sort_order FROM loyalty_tiers ORDER BY sort_order;"
# Expected 4 rows: bronze, silver, gold, platinum

# Verify migration 04 (Task 10) applied (date_of_birth, zalo, source columns)
npx wrangler d1 execute fnb-caffe-db --remote \
  --command="SELECT name FROM pragma_table_info('customers') WHERE name IN ('date_of_birth', 'zalo', 'source');"
# Expected 3 rows

# Verify campaign active
npx wrangler d1 execute fnb-caffe-db --remote \
  --command="SELECT code, signup_bonus_vnd, signup_bonus_cap, cashback_multiplier, start_date, end_date, active FROM bonus_campaigns WHERE code='GRAND_OPENING_6_6_2026';"
# Expected: active=1, multiplier=2, bonus=50000, cap=100

cd ..
```

---

## 🆘 Rollback options nếu lỗi

### Disable campaign (nếu cashback x2 cộng sai)
```bash
cd /Users/mac/mekong-cli/FnB-Container-Caffe/worker
npx wrangler d1 execute fnb-caffe-db --remote \
  --command="UPDATE bonus_campaigns SET active=0 WHERE code='GRAND_OPENING_6_6_2026';"
```

### Revert 1 PR cụ thể
```bash
gh pr view 27  # check merge commit SHA
git revert <merge-commit-sha>
git push origin main
cd worker && npx wrangler deploy
```

### Restore D1 từ backup
```bash
ls -la backups/  # find backup file
cd worker
npx wrangler d1 execute fnb-caffe-db --remote \
  --file=../backups/d1-backup-20260518-204022-pre-task08.sql
```

---

## 🎯 Task 13 (Zalo OA) — Roadmap

Sau khi launch 06/06 ổn định (~1 tuần):

```bash
# Khoảng 13-15/6: Anh đăng ký Zalo OA
# https://oa.zalo.me — submit GPKD + verify SĐT

# Khoảng 18-20/6: Apply 4 ZNS templates
# Wait 3-7 ngày approval

# Khoảng 25/6: Em dispatch task 13 cho worker
# → Worker code zalo.js + integration vào processOrderLoyalty + cron
```

→ Note: P1, không blocking launch 6/6.

---

## ✅ Summary

Sau khi chạy script trên, hệ thống loyalty AURA CAFE sẽ:

**Backend (Workers + D1):**
- ✅ 4 tier (Bronze/Silver/Gold/Platinum) với rate 3/5/7/10%
- ✅ Cashback expiry per tier (90/120/180/null days)
- ✅ Idempotency guard (UNIQUE index + early return)
- ✅ Campaign multiplier x2 ngày khai trương 06-08/6
- ✅ Signup bonus +50k cho first 100
- ✅ Auto-upgrade Silver khi spend ≥200k
- ✅ Audit log cho mọi action
- ✅ 14 endpoints (loyalty + admin)

**Frontend:**
- ✅ `/dang-ky-thanh-vien` mobile-first form
- ✅ POS wallet panel với tier progress + expiry warning
- ✅ Receipt template có loyalty section + QR
- ✅ Admin loyalty dashboard 8 widgets + CSV export

**Print materials:**
- ✅ 3 QR codes generated (standee/leaflet/receipt)
- ✅ Membership card 90×54mm template
- ✅ A1 standee "Cách dùng ví" SVG
- ✅ Script batch generate 100 thẻ PDF

**Còn lại trước 6/6:**
- [ ] In 2 standee từ qr-signup-standee.png (90×180cm)
- [ ] In 500 leaflet A5 với qr-signup-leaflet.png
- [ ] Test signup form từ phone thật (sau merge)
- [ ] Test POS lookup từ phone thật
- [ ] Test admin dashboard từ owner account
- [ ] Pre-print 100 thẻ giấy blank (script chạy sau 28/5 khi có data thật)

---

🎉 **Anh chạy script Quick Deploy ở đầu — em standby verify production.**
