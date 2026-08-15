# AURA CAFE — SOP Vận Hanh Day Du

**Ngay tao:** 2026-08-15
**Trang thai:** DRAFT — cho user review
**Danh muc:** docs/sop/

## Muc tieu
Viet day du SOP van hanh cho AURA CAFE Sa Dec, bao quat toan bo quy trinh tu mo cua den dong cua, tu don hang den thanh toan, tu khach hang den nhan vien. Moi SOP duoc viet bang tieng Viet, format checklist co the in ra va su dung ngay.

## Tong quan he thong
- **Brand:** AURA CAFE — Container Space, Sa Dec, Dong Thap
- **Domain:** auraspace.cafe
- **Tech stack:** Cloudflare Pages + Workers + D1 + KV
- **Payment:** PayOS (chinh), COD, MoMo (keiem tra)
- **Loyalty:** 4 hang (Bronze/Silver/Gold/Platinum), cashback 3-10%, diem tich luy
- **KDS:** 3 loai (admin, mobile, public)
- **Staff roles:** Owner > Manager > Staff > Waiter

## Cac SOP se viet (8 phas)

| Phas | Noi dung | File |
|------|----------|------|
| 1 | **SOP Mo Cua & Dong Cua** — Quy trinh hang ngay | `phase-01-open-close.md` |
| 2 | **SOP Quan Ly Don Hang** — Tu dat den giao, KDS, theo doi | `phase-02-order-management.md` |
| 3 | **SOP Thanh Toan & Quy** — PayOS, COD, doi tien, khop ke toan | `phase-03-payment-cash.md` |
| 4 | **SOP Loyalty & Khach Hang** — Tich luy, doi diem, referral, sinh nhat | `phase-04-loyalty-customer.md` |
| 5 | **SOP Kho & Nguyen Vat Lieu** — Kho hang, cong/thu, ton kho, cong thuc | `phase-05-inventory-supply.md` |
| 6 | **SOP Quan Ly Nhan Vien** — Ca lam, phan quyen, dao tao, PBL | `phase-06-staff-management.md` |
| 7 | **SOP Dat Cho & Ban** — Quan ly ban, QR, dat truoc, check-in | `phase-07-reservation-table.md` |
| 8 | **SOP Khuyen Mai & Marketing** — Chien dich, broadcast, Zalo, social | `phase-08-marketing-promotions.md` |

## Nguon du lieu da xac minh
- `docs/08_BUSINESS_MODEL.md` — Mo hinh kinh doanh, AOV 125k, COGS 30%
- `docs/loyalty_grand_opening_handbook.md` — Loyalty v2, cashback, voucher
- `docs/productization/support-process.md` — SLA, escalation, pricing tiers
- `docs/productization/deployment-checklist.md` — Checklist trien khai
- `docs/05_TASKS/*.md` — 8 file spec cho orders, loyalty, payments, menu, reservations, admin, integration, infrastructure
- `config/brand.json` — Brand config, zones, contact
- `worker/src/index.ts` — 153+ API endpoints
- `db/schema.sql` + migrations — 40+ bang du lieu
- `src/routes/*.tsx` — 60+ frontend routes

## Yeu cau format
- Tieng Viet, gon gang, co the in ra A4
- Checklist checkbox cho moi buoc
- Thoi gian uoc tinh moi buoc
- Cam xuc / luu y quan trong
- Fax loi khong thanh cong
- Mau bang / flow diagram don gian

## Success criteria
- Owner co the in toan bo SOP va huong dan staff ngay
- Moi quy trinh co checklist ro rang, khong mo ho
- Phu het 100% tinh nang he thong da trien khai
- Cap nhat theo business model hien tai (khong phai roadmap)
