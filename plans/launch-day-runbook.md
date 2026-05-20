# AURA CAFE — Launch Day Runbook
**Ngày khai trương:** Thứ 7, 07/06/2026 (campaign bắt đầu 06/06)
**Worker:** https://aura-space-worker.sadec-marketing-hub.workers.dev
**Pages:** https://fnb-caffe-container.pages.dev

---

## T-17 (2026-05-20) — Code Complete ✅

| Item | Status |
|------|--------|
| Loyalty schema v2 (4 tier Bronze/Silver/Gold/Platinum) | ✅ |
| Campaign GRAND_OPENING_6_6_2026 (50k bonus, 2x multiplier, cap 100) | ✅ |
| Signup page + QR codes (member + leaflet) | ✅ |
| Membership card generator | ✅ |
| POS wallet lookup | ✅ |
| Cashback earn flow (processOrderLoyalty via order.customer_phone) | ✅ FIXED |
| Spend-cashback idempotency | ✅ |
| Launch monitor dashboard (/admin/launch-monitor) | ✅ |
| Countdown timer on homepage | ✅ |
| Leaflet A5 print design | ✅ |
| E2E test suite 12/12 | ✅ |
| CSV injection fix (csvCell helper) | ✅ |
| XSS fix (loyalty.js _esc helper) | ✅ |
| Auth brute-force rate limit (20/5min/IP) | ✅ |
| Orders spam protection (5/10min/IP) | ✅ |
| Zalo ZNS scaffold (graceful no-op until OA) | ✅ |

---

## Owner Action Items (before 06/06)

### 1. GitHub CI/CD Secret (5 min) — T2 27/5
```
GitHub repo → Settings → Secrets and variables → Actions → New secret
Name: CLOUDFLARE_API_TOKEN
Value: <your CF API token with Pages:Edit permission>
```
After this: `git push` auto-deploys Pages without manual wrangler.

### 2. Zalo OA Registration (~20-25/6) — post-launch
1. Truy cập https://oa.zalo.me → Đăng ký tài khoản Doanh nghiệp
2. Upload GPKD, chờ duyệt 3-7 ngày
3. Submit 4 ZNS templates (welcome_signup, cashback_earned, tier_upgrade, cashback_expiry_warning)
4. Sau khi approved:
   ```bash
   cd worker
   npx wrangler secret put ZALO_ACCESS_TOKEN
   # Paste token từ Zalo OA dashboard
   ```
5. Update TEMPLATE_IDS trong `worker/src/routes/zalo.js` (4 placeholder IDs)
6. Test: `POST /api/test/zalo-zns` với owner JWT

---

## T4 04/06/2026 — Final Smoke Test

```bash
cd /Users/mac/mekong-cli/FnB-Container-Caffe
node scripts/test-loyalty-e2e.js
# Expected: 12/12 passed

# Manual cashback flow test:
# 1. POST /api/loyalty/phone-auth { phone: "0901234567" } → JWT
# 2. POST /api/orders { customer_phone: "0901234567", items: [...], total: 100000, ... }
# 3. PATCH /api/orders/{id} { status: "completed" } (với owner JWT)
# 4. Verify D1:
#    SELECT balance FROM cashback_wallets WHERE customer_id = (SELECT id FROM customers WHERE phone = '0901234567')
#    Expected: 3000 (3% of 100000 for bronze tier)
```

---

## T7 06/06/2026 — Launch Day SOP

### 8:00 SA — Pre-open check
```bash
# 1. Verify worker is live
curl https://aura-space-worker.sadec-marketing-hub.workers.dev/api/health

# 2. Verify campaign is now ACTIVE (ngày 06/06 campaign bắt đầu)
curl https://aura-space-worker.sadec-marketing-hub.workers.dev/api/loyalty/active-campaign
# Expected: { campaign: { code: "GRAND_OPENING_6_6_2026", signup_bonus_vnd: 50000, ... } }

# 3. Open launch monitor
open https://fnb-caffe-container.pages.dev/admin/launch-monitor
```

### During service
- Monitor: `/admin/launch-monitor` refresh mỗi 10 giây (auto)
- KDS: `/kds.html` — đơn mới hiện ngay
- Nếu có vấn đề → xem Cloudflare Workers → Logs

### Cuối ngày
```bash
# Generate member cards cho members mới đăng ký
node scripts/generate-member-cards.js 100
# Output: designs/member-cards-batch.pdf
```

---

## T8 07/06/2026 — D+1 Debrief

```bash
# Export member CSV
curl -H "Authorization: Bearer <owner_jwt>" \
  https://aura-space-worker.sadec-marketing-hub.workers.dev/api/admin/loyalty/export/members \
  -o reports/members-d1.csv

# Cashback flow summary
npx wrangler d1 execute fnb-caffe-db --remote --command="
  SELECT 
    COUNT(DISTINCT customer_id) as members_earned,
    SUM(amount) as total_cashback_issued,
    COUNT(*) as transactions
  FROM cashback_transactions 
  WHERE type='earn' AND created_at >= '2026-06-06'"
```

---

## Emergency Rollback

```bash
# Worker: redeploy previous commit
git log --oneline -5
git checkout <previous-sha>
cd worker && npx wrangler deploy --minify
git checkout main

# Pages: Cloudflare dashboard → fnb-caffe-container → Deployments → Rollback
```

---

## Rate Limits (production)

| Endpoint | Limit | Window | Response |
|----------|-------|--------|----------|
| POST /api/loyalty/phone-auth | 10 req/IP | 5 min | 429 |
| POST /api/auth/login | 20 req/IP | 5 min | 429 |
| POST /api/auth/register | 20 req/IP | 5 min | 429 |
| POST /api/auth/reset-password | 20 req/IP | 5 min | 429 |
| POST /api/orders | 5 req/IP | 10 min | 429 |

---

## System Capacity (Cloudflare Free Tier)

| Resource | Limit | Launch Day Estimate | Headroom |
|----------|-------|---------------------|----------|
| Worker requests | 100K/day | ~500-1000 | 99% free |
| D1 reads | 5M/day | ~5000 | 99.9% free |
| KV reads | 100K/day | ~2000 | 98% free |
| Pages bandwidth | Unlimited | — | ✅ |
