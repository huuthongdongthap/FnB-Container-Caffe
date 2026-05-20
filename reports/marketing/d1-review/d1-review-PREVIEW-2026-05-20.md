# AURA CAFE — D+1 Post-Launch Review
**Ngày D0:** 2026-06-06 (preview với test data từ 2026-05-20) | **Generated:** 2026-05-20 12:45:00
**Campaign:** GRAND_OPENING_6_6_2026

> **NOTE:** Đây là preview report dùng test data hôm nay.
> Chạy lại ngày 07/06 sau launch: `node scripts/d1-review.js 2026-06-06 --owner-email=YOUR@EMAIL --owner-pass=YOUR_PASS`

---

## KPI Dashboard

| Metric | Target | Actual (D0) | Progress |
|--------|--------|-------------|----------|
| Signups D0 | 100 | **?** | Chờ 06/06 |
| Orders D0 | 150 | **?** | Chờ 06/06 |
| Cashback issued | 5.000.000đ | **?** | Chờ 06/06 |

---

## Data Validation (test queries — 2026-05-20)

Các SQL queries đã được verify trực tiếp trên D1:

| Query | Kết quả |
|-------|---------|
| Signups hôm nay | 12 (stress-test accounts) |
| Orders hôm nay | 19 đơn, 945.000đ revenue |
| Cashback giao dịch | 0 (campaign chưa active) |
| Bonus granted | 0 (campaign start: 06/06) |
| Channel attribution | stress-test: 11, unknown: 1 |

Tất cả queries SQL **hoạt động đúng** trên schema thực.

---

## API Endpoints Ready

| Endpoint | Auth | Status |
|----------|------|--------|
| `GET /api/reports/summary?date=YYYY-MM-DD` | owner/staff JWT | ✅ Live |
| `GET /api/reports/signups?date=YYYY-MM-DD` | owner/staff JWT | ✅ Live |
| `GET /api/reports/cashback?date=YYYY-MM-DD` | owner/staff JWT | ✅ Live |
| `GET /api/reports/orders?date=YYYY-MM-DD` | owner/staff JWT | ✅ Live |

---

## D+1 SOP — 07/06/2026 (Chủ Nhật, 09:00)

```bash
# Bước 1: Pull full D+1 report
node scripts/d1-review.js 2026-06-06 \
  --owner-email=YOUR_OWNER_EMAIL \
  --owner-pass=YOUR_OWNER_PASS

# Bước 2: Xem output
cat reports/marketing/d1-review/d1-review-2026-06-06.md

# Bước 3: Export member list (để gửi cảm ơn)
curl -s "https://aura-space-worker.sadec-marketing-hub.workers.dev/api/admin/loyalty/export/members" \
  -H "Authorization: Bearer $TOKEN" -o exports/members-d1.csv

# Bước 4: Check campaign cap
curl -s "https://aura-space-worker.sadec-marketing-hub.workers.dev/api/loyalty/active-campaign"
```

---

## Anomaly Checklist (ngày 07/06)

- [ ] Signup bonus: số lượng granted = số khách có cashback_transactions type='bonus'
- [ ] Không có duplicate bonus (1 phone = max 1 bonus)
- [ ] Cashback earned khớp với orders × tier rate × multiplier 2x
- [ ] Cap 100 suất chưa bị vượt (kiểm tra signup_bonus_log count)
- [ ] Không có fraud signup (nhiều đơn từ 1 SĐT trong < 1 phút)

---

*Generated: 2026-05-20 | Preview only — run d1-review.js on 07/06 for real D+1 data*
