# Go-Live Deep Check Plan — AURA CAFE Khai Trương 06/06

**Date:** 2026-05-27  
**Launch date:** 2026-06-06  
**Mode:** `/cook` deep check  
**Scope:** production readiness for grand opening, loyalty signup, cashback, staff ops, marketing ops, rollback

---

## 1. Executive Status

| Area | Status | Evidence |
|---|---|---|
| Worker deploy | Ready / deployed by user terminal | `aura-space-worker`, version `72ca8229-a779-4bb5-86ed-3376e626f4a3` |
| Pages deploy | Ready / deployed by user terminal | Preview URL `https://8182d373.fnb-caffe-container.pages.dev` |
| Agent production curl | Blocked by agent DNS | Agent shell cannot resolve `*.workers.dev` / `*.pages.dev`; user terminal must run final curl checks |
| Unit tests | Pass | `npm --silent test -- --runInBand --silent` → 22 passed |
| Worker package dry-run | Pass | `wrangler deploy --dry-run` → 212.28 KiB, gzip 46.82 KiB |
| Launch docs | Updated | Runbook/checklist now use 06/06, `/api/health`, real campaign endpoint, auth headers |
| Token security | P0 open | Cloudflare token was exposed in transcript; revoke and replace before go-live |

Decision: **No code blocker found for the loyalty/cashback go-live path.** The only hard P0 before go-live is token rotation plus production verification from a network that can reach Cloudflare.

---

## 2. Campaign Source Of Truth

| Field | Value |
|---|---|
| Campaign code | `GRAND_OPENING_6_6_2026` |
| Campaign window | `2026-06-06 00:00:00` to `2026-06-08 23:59:59` |
| Signup bonus | `50.000đ` cashback wallet credit |
| Signup cap | First `100` new members |
| Signup liability cap | `5.000.000đ` |
| Cashback multiplier | `x2` during launch window |
| Tier base cashback | Bronze 3%, Silver 5%, Gold 7%, Platinum 10% |
| Launch effective cashback | Bronze 6%, Silver 10%, Gold 14%, Platinum 20% |
| Min order for cashback earn | `30.000đ` |
| Campaign cashback earn cap | `100.000đ/order` |
| Auto upgrade | Bronze to Silver for campaign order spend `>=200.000đ` |

Public wording must be:

> Đăng ký nhận ngay 50.000đ vào ví cho 100 thành viên đầu tiên. Từ 06/06 đến 08/06, mọi đơn đủ điều kiện được x2 cashback theo hạng thành viên.

Do not publish “flat 20% cashback first transaction”.

---

## 3. Verified Artifacts

| Artifact | Status |
|---|---|
| Signup page | `dang-ky-thanh-vien.html` exists and advertises 50K + x2 |
| Launch monitor | `admin/launch-monitor.html` exists and reads active campaign progress |
| Admin loyalty dashboard | `admin/loyalty-dashboard.html` exists |
| POS wallet view | `admin/pos.html` + `js/pos.js` exist |
| KDS | `kds.html` exists |
| QR assets | `public/qr/qr-signup-standee.png`, `qr-signup-leaflet.png`, `qr-signup-receipt.png` exist |
| Member card generator | `scripts/generate-member-cards.js` exists |
| D+1 review script | `scripts/d1-review.js` exists |
| Launch docs | `plans/launch-day-runbook.md`, `reports/marketing/campaign/launch-checklist.md` updated |

---

## 4. Technical Gates

### Gate A — Token Security

Owner action before any further deployment:

1. Revoke the exposed Cloudflare token.
2. Create a replacement token scoped to account `b69fee03bdd94234eea8e4114cfc36ab`.
3. Required permissions:
   - Account > Workers Scripts: Edit
   - Account > Cloudflare Pages: Edit
   - Account > D1: Edit
   - Account > Workers KV Storage: Edit
4. Save the new token as GitHub Actions secret `CLOUDFLARE_API_TOKEN`.
5. Use the new token locally only as an environment variable, not pasted in chat/docs.

### Gate B — Production Smoke

Run from the owner terminal/network:

```bash
curl -s https://aura-space-worker.sadec-marketing-hub.workers.dev/api/health
curl -s https://aura-space-worker.sadec-marketing-hub.workers.dev/api/loyalty/active-campaign
curl -s -o /dev/null -w "signup:%{http_code}\n" https://fnb-caffe-container.pages.dev/dang-ky-thanh-vien
curl -s -o /dev/null -w "monitor:%{http_code}\n" https://fnb-caffe-container.pages.dev/admin/launch-monitor
curl -s -o /dev/null -w "qr:%{http_code}\n" https://fnb-caffe-container.pages.dev/qr/qr-signup-standee.png
```

Expected on 2026-05-27:

- `/api/health` returns `status: ok`
- `/api/loyalty/active-campaign` returns 200; `campaign: null` is acceptable before 2026-06-06
- Pages endpoints return 200

Expected on 2026-06-06 through 2026-06-08:

- `campaign.code = GRAND_OPENING_6_6_2026`
- `signup_bonus_vnd = 50000`
- `cashback_multiplier = 2`

### Gate C — D1 Schema

Run before launch:

```bash
cd /Users/mac/mekong-cli/FnB-Container-Caffe/worker

npx wrangler d1 execute fnb-caffe-db --remote \
  --command="SELECT code, signup_bonus_vnd, signup_bonus_cap, cashback_multiplier, start_date, end_date, active FROM bonus_campaigns WHERE code='GRAND_OPENING_6_6_2026';"

npx wrangler d1 execute fnb-caffe-db --remote \
  --command="SELECT tier_name, display_name_vi, cashback_rate, expiry_days, sort_order FROM loyalty_tiers ORDER BY sort_order;"

npx wrangler d1 execute fnb-caffe-db --remote \
  --command="SELECT name FROM pragma_table_info('customers') WHERE name IN ('date_of_birth','zalo','source','lifetime_points');"

npx wrangler d1 execute fnb-caffe-db --remote \
  --command="SELECT name FROM sqlite_master WHERE type='index' AND name='idx_cbtxn_order_earn_unique';"
```

Pass criteria:

- Campaign row exists, `active=1`, `signup_bonus_vnd=50000`, `signup_bonus_cap=100`, `cashback_multiplier=2`
- 4 tiers exist: bronze, silver, gold, platinum
- Customer signup fields exist
- Idempotency index exists

---

## 5. Operational Timeline

### D-10 to D-7: 2026-05-27 to 2026-05-30

- Revoke and replace exposed Cloudflare token.
- Add new token to GitHub Actions secret.
- Print 2 standees, 500 leaflets, receipt QR.
- Scan all three QR assets from a real phone.
- Confirm owner/staff login works.
- Brief staff script:
  > Anh/chị quét QR đăng ký thành viên giúp em nhé. 100 người đầu nhận 50.000đ vào ví, từ hôm nay đến 08/06 còn được x2 cashback cho đơn đủ điều kiện.

### D-3: 2026-06-03

- Run Gate B and Gate C.
- Open `/admin/launch-monitor`, `/admin/pos.html`, `/kds.html`.
- Test one real staff POS order without cashback spend.
- Confirm social assets queued: Facebook, Zalo, TikTok, leaflet handout.

### D-1: 2026-06-05

- Backup D1.
- Verify `GRAND_OPENING_6_6_2026` schedule.
- Test one QR signup with a real phone.
- Confirm owner can export members CSV.
- Confirm rollback command is ready.

### D0: 2026-06-06

At 08:00:

```bash
curl -s https://aura-space-worker.sadec-marketing-hub.workers.dev/api/loyalty/active-campaign
```

Pass criteria:

- Campaign is active.
- Signup page works on phone.
- POS lookup works from one test phone.
- Launch monitor loads and shows campaign block.

During service:

- Owner checks launch monitor every 2 hours.
- Staff invites QR signup for every customer.
- CTO watches Cloudflare Worker logs for errors.
- If signup cap reaches 80%, decide whether to extend cap or switch messaging to x2 cashback only.

### D+1: 2026-06-07

Generate D+1 report:

```bash
cd /Users/mac/mekong-cli/FnB-Container-Caffe
node scripts/d1-review.js 2026-06-06 --owner-email=OWNER_EMAIL --owner-pass=OWNER_PASS
```

Review:

- Signup count vs target 100
- Orders vs target 150
- Cashback liability vs 5M cap
- Channel source split
- Fraud/anomaly: duplicate phones, abnormal cashback, repeated IP patterns

---

## 6. Rollback / Kill Switch

Disable campaign only:

```bash
cd /Users/mac/mekong-cli/FnB-Container-Caffe/worker
npx wrangler d1 execute fnb-caffe-db --remote \
  --command="UPDATE bonus_campaigns SET active=0 WHERE code='GRAND_OPENING_6_6_2026';"
```

Rollback Worker:

```bash
cd /Users/mac/mekong-cli/FnB-Container-Caffe
git log --oneline -5
git checkout <previous-sha>
cd worker && WRANGLER_LOG_PATH=/private/tmp/wrangler-logs npx wrangler deploy
git checkout main
```

Rollback Pages:

Cloudflare Dashboard → Pages → `fnb-caffe-container` → Deployments → Rollback previous deployment.

---

## 7. Current Open Items

| Priority | Item | Owner | Deadline |
|---|---|---|---|
| P0 | Revoke leaked Cloudflare token and create a replacement | Owner | Now |
| P0 | Run production curl smoke from owner terminal | CTO/Owner | Now |
| P0 | Run D1 schema verification | CTO/Owner | D-3 |
| P1 | Add replacement token to GitHub Actions secret | Owner | D-7 |
| P1 | Print and scan QR materials | Owner/Staff | D-7 |
| P1 | Staff training and role assignment | Owner | D-1 |
| P2 | Zalo OA/ZNS production setup | Owner/CTO | Post-launch |

---

## 8. Go / No-Go Rule

Go-live is approved when all P0 items pass:

- New Cloudflare token is active and old exposed token is revoked.
- Worker `/api/health` returns 200.
- Pages signup and launch monitor return 200.
- D1 campaign/tier/schema checks pass.
- Owner/staff can log in.
- One real-phone signup test succeeds.
- Rollback command is ready.

No-go if any of these fail on D-1 or D0:

- Campaign row missing or inactive.
- Signup page unavailable.
- Worker health unavailable.
- POS cannot lookup member phone.
- Owner cannot access launch monitor.
- Cashback earn creates duplicate transactions for one order.

