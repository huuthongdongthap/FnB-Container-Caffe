# 🎉 KHAI TRƯƠNG AURA CAFE — 06/06/2026

> Plan chi tiết khai trương quán Container Rooftop AURA CAFE tại Sa Đéc, Đồng Tháp.
> Hybrid 2 phases · Budget 15tr · Loyalty + Cashback activate cùng ngày.

---

## 📂 Files trong folder

| # | File | Mô tả | Trạng thái |
|---|---|---|---|
| 1 | [00_MASTER_PLAN.md](00_MASTER_PLAN.md) | Tổng quan + timeline 12 ngày + run-of-show + KPI | ✅ |
| 2 | [01_LOYALTY_CASHBACK_PROGRAM.md](01_LOYALTY_CASHBACK_PROGRAM.md) | Chi tiết chương trình thành viên 4 tier + cashback rules | ✅ |
| 3 | [02_BUDGET_DETAIL.md](02_BUDGET_DETAIL.md) | Breakdown 15tr ngân sách + cashflow timing | ✅ |
| 4 | [03_DAILY_CHECKLIST.md](03_DAILY_CHECKLIST.md) | Task list từng ngày 16-8/6 + owner + deadline | ✅ |
| 5 | [04_MARKETING_PLAYBOOK.md](04_MARKETING_PLAYBOOK.md) | Content + posts + KOL brief + caption templates | ✅ |
| 6 | 05_RUN_OF_SHOW.md | Timeline ngày 6/6 phút-by-phút | ⏳ Optional |
| 7 | 06_RISK_MITIGATION.md | Plan backup từng rủi ro chi tiết | ⏳ Optional |

---

## ⚡ Quick start

### Hôm nay 18/5 anh cần làm (còn 19 ngày):
1. ✅ Đọc qua [00_MASTER_PLAN.md](00_MASTER_PLAN.md) — 5 phút
2. ✅ Confirm budget 15tr trong [02_BUDGET_DETAIL.md](02_BUDGET_DETAIL.md)
3. ✅ Confirm tier rates trong [01_LOYALTY_CASHBACK_PROGRAM.md](01_LOYALTY_CASHBACK_PROGRAM.md)
4. ✅ List 10 KOL Sa Đéc → reach out 3 đầu tiên ngay
5. ✅ Đặt 2 standee in tại Sa Đéc (nhận 19-20/5)
6. ✅ Em dispatch Task 08 (loyalty schema v2) chiều nay

### Theo dõi mỗi ngày:
→ Mở [03_DAILY_CHECKLIST.md](03_DAILY_CHECKLIST.md) check task của ngày hôm đó

---

## 🎯 Tóm tắt sự kiện 6/6

```
PHASE 1 — SOFT LAUNCH (Family & Friends)
07:00 - 11:00 · ~60 khách VIP
→ Activate Platinum cards · Tour quán · Content shooting
                                ↓
PHASE 2 — GRAND OPENING (Public)
16:00 - 22:00 · ~150 khách public
→ Welcome drink free 100 ly · Lễ cắt băng 18:30
→ Acoustic live music 17:30 + 19:00 · Lì xì 20 phong
```

---

## 💰 Budget snapshot

```
┌─────────────────────────────────────┐
│  AURA CAFE — Khai trương 6/6       │
│  Total: 15.000.000đ                 │
├─────────────────────────────────────┤
│  Decor & setup       4.500.000đ 30% │
│  Offers & cashback   4.500.000đ 30% │
│  Marketing           3.000.000đ 20% │
│  Music & photo       1.500.000đ 10% │
│  Buffer              1.500.000đ 10% │
└─────────────────────────────────────┘
```

---

## 🎫 Loyalty snapshot

```
🥉 Bronze   0 - 500k        3% cashback
🥈 Silver   500k - 2tr      5% cashback
🥇 Gold     2tr - 5tr       7% cashback
💎 Platinum >5tr           10% cashback

🎁 Bonus 6-8/6: Cashback x2 cho mọi tier
🎁 Sign-up bonus: +50k (first 100) / +30k / +20k
🎁 Refer-a-friend: +50k mỗi friend (max 5)
```

---

## 📈 Success metrics target

| KPI | Target | Stretch |
|---|---|---|
| Sign-ups ngày 6/6 | 100 | 200 |
| Sign-ups tháng đầu | 500 | 1000 |
| Day-1 revenue | 10tr | 15tr |
| Month-1 retention | 30% | 50% |
| FB page like (new) | 500 | 1000 |
| Hashtag posts | 100 | 500 |

---

## ✅ Next steps cho em (developer side)

Em sẽ làm song song:
1. Dispatch task `08-loyalty-launch-prep.md` cho Mekong CLI worker:
   - Seed `loyalty_tiers` D1
   - Setup `bonus_campaigns` table + insert "Grand Opening" record
   - Update `/api/cashback/calculate` endpoint với multiplier logic
   - Create `/dang-ky-thanh-vien` public page
   - Integrate SMS gateway (Speedsms VN)
   - Test E2E 10 mock customers

2. Tạo content visual cho marketing:
   - Leaflet A5 mockup
   - Standee X "Coming Soon"
   - 5 Facebook post images (cinematic cobalt navy)
   - Reel 30s template

3. Update web hero countdown timer (12 ngày)

---

## 🆘 Liên lạc emergency 6/6

- **Anh Còn** (chủ quán): 09xx.xxx.xxx
- **Em** (dev support): standby remote
- **Manager** (on-site): TBD
- **POS hotline**: TBD

---

Anh đọc kỹ → confirm → em dispatch loyalty dev task ngay tối nay (16/5).
