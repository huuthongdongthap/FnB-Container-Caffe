# AURA CAFE — Ops & Governance Report (Steps 19-23)

**Date:** 2026-07-05
**Project:** AURA CAFE — Container Caffe & Space, 39 Nguyen Tat Thanh, Sa Dec, Dong Thap
**Stage:** PMF -> Early Scale
**Context:** 5-zone industrial-luxury container cafe, 30+ digital features deployed, 3 revenue streams (F&B / Events / Subscription)
**Previous Reports:** [GO/NO-GO](./go-nogo-report.md) | [BMC](./bmc.md) | [PRD](./prd.md) | [Personas](./personas.md) | [Unit Economics](./unit-economics.md) | [Gap Report](./gap-report.md) | [Marketing Strategy](./marketing-strategy.md)

---

## Table of Contents

1. [Step 19 — OKR Framework: Q3 2026](#step-19-okr-framework-q3-2026)
2. [Step 20 — Governance: Financial Controls & Compliance](#step-20-governance-financial-controls--compliance)
3. [Step 21 — ESG/Impact: Sustainability & Community](#step-21-esgimpact-sustainability--community)
4. [Step 22 — Crisis: Fire Safety, Food Safety, Data Breach](#step-22-crisis-fire-safety-food-safety-data-breach)
5. [Step 23 — Agentic Architecture: QR->KDS->POS->Loyalty Flow](#step-23-agentic-architecture-qr-kds-pos-loyalty-flow)

---

# Step 19 — OKR Framework: Q3 2026

## 19.1 OKR Philosophy

OKRs for AURA CAFE follow the **3-tier structure**: Company OKRs (C-level) -> Functional OKRs (manager) -> Individual OKRs (staff). All OKRs are bilingual (Vietnamese + English) for frontline staff comprehension.

**Cadence:**
- Q3 OKRs set: 2026-07-05 (this document)
- Mid-quarter check-in: 2026-08-15
- Final review: 2026-09-30
- Q4 OKRs set: 2026-10-01

---

## 19.2 Company OKRs (C-Level)

### O1: Establish AURA CAFE as the #1 experiential cafe in Dong Thap

| KR | Metric | Baseline | Target Q3 | Owner | Mo ta (VN) |
|----|--------|----------|-----------|-------|------------|
| KR1.1 | Monthly orders | 0 (pre-launch) | 3,000 | Operations | Dat 3.000 don/thang — chung to PMF |
| KR1.2 | Average ticket | — | 45,000 VND | Menu/Pricing | Gia tri don hang trung binh dat 45k |
| KR1.3 | Repeat rate (D30) | — | >55% | Marketing/Loyalty | Hon 55% khach quay lai trong 30 ngay |
| KR1.4 | Google Maps reviews | 0 | >50 reviews, avg 4.3+ | Marketing | Danh gia Google Maps >50, trung binh 4.3 sao |
| KR1.5 | TikTok brand mentions | 0 | >500 mentions/month | Content | AURA duoc tag tren TikTok >500 lan/thang |

### O2: Build a sustainable, profitable operation

| KR | Metric | Baseline | Target Q3 | Owner | Mo ta (VN) |
|----|--------|----------|-----------|-------|------------|
| KR2.1 | Gross margin | — | >60% | F&B Operations | Bien lai gop >60% |
| KR2.2 | Net profit | — | Positive (Month 2+) | Finance | Co lai tu thang thu 2 |
| KR2.3 | Subscription members | 0 | 200 Premium + 5 Enterprise | Product | 200 Premium + 5 Enterprise subscribers |
| KR2.4 | Staff retention | — | >85% (no voluntary quit) | HR/Operations | Giud chan nhan vien >85%, khong co nghi viec tu nguyen |
| KR2.5 | Food waste | — | <5% of COGS | Kitchen/Warehouse | That thuc thuc pham <5% COGS |

### O3: Launch the agentic digital platform

| KR | Metric | Baseline | Target Q3 | Owner | Mo ta (VN) |
|----|--------|----------|-----------|-------|------------|
| KR3.1 | QR ordering adoption | — | >70% of orders | Product/Dev | Hon 70% don hang qua QR (khong phai COD tai ban) |
| KR3.2 | KDS uptime | — | 99.9% | Dev | KDS hoat dong 99.9% thoi gian |
| KR3.3 | Loyalty active rate | — | >60% of signups | Product | Hon 60% khach dung diem trong 30 ngay |
| KR3.4 | System incident MTTR | — | <30 min | Dev | Thoi gian xu ly su co <30 phut |
| KR3.5 | CRM data completeness | — | >80% customer profiles have phone + preferences | Data | Hon 80% ho so khach hang co SDT + so thich |

---

## 19.3 Functional OKRs

### Operations (Quan ly van hanh)

| O | KR | Target | Mo ta |
|---|----|--------|-------|
| **O4: Zero-downtime daily operations** | Order fulfillment time | <5 min from QR scan to drink in hand | Thoi gian tu quet QR -> co do uong <5 phut |
| | Staff schedule adherence | >95% | Ty le nhan vien dung lich >95% |
| | Table turnover (peak) | <45 min/table | Xoay ban gio cao diem <45 phut |
| | Inventory stockout rate | <2% of SKUs | Ton kho het hang <2% SKU |

### Marketing & Growth

| O | KR | Target | Mo ta |
|---|----|--------|-------|
| **O5: Build brand awareness in Dong Thap** | TikTok total views | 1M views/quarter | 1 trieu luot xem TikTok/quarter |
| | Facebook page likes | 5,000 by end of Q3 | 5.000 like Facebook |
| | Referral k-factor | >0.5 | He so lan toa >0.5 |
| | Cost per lead (CPL) | <10K VND | Chi phi moi khach hang tiem nang <10k |

### Product & Technology

| O | KR | Target | Mo ta |
|---|----|--------|-------|
| **O6: Complete Stitch design coverage** | Customer pages designed | 10/10 by Week 5 | 10/10 customer pages co Stitch design |
| | Admin pages designed | 18/18 by Week 10 | 18/18 admin pages co Stitch design |
| | Stitch->React conversion | 100% by Week 12 | 100% chuyen doi Stitch sang React |
| | System uptime | 99.9% (Cloudflare SLA) | Thoi gian hoat dong 99.9% |

### Finance & Admin

| O | KR | Target | Mo ta |
|---|----|--------|-------|
| **O7: Financial discipline from day 1** | Daily cash reconciliation | 100% within 24h | Doi chieu tien mat trong 24h |
| | Expense vs budget variance | <10% | Chenh lech chi phi so voi du toan <10% |
| | Tax filing compliance | 100% on time | Nop thue dung han 100% |
| | Payroll accuracy | 100% | Luong chinh xac 100% |

---

## 19.4 OKR Tracking Cadence

```
Weekly (Monday 9:00):
  - 15-min standup: KR progress
  - Red/Yellow/Green status per KR
  - Flag blockers immediately

Monthly (Last Friday):
  - 45-min review: OKR health check
  - Adjust tactics (OKRs stay fixed for Q3)
  - Resource reallocation if needed

Quarterly (End of Q3):
  - 2h full review: Scoring (0.0-1.0)
  - Lessons learned --> Q4 planning
  - Success celebration + failure analysis
```

### Score Definitions

| Score | Meaning | Action |
|-------|---------|--------|
| 0.0-0.3 | Missed target significantly | Root cause analysis; consider dropping KR in Q4 |
| 0.4-0.6 | Partial progress, on track | Continue with refined tactics |
| 0.7-0.9 | Near-complete; strong execution | Small adjustments to hit 1.0 |
| 1.0 | Target achieved or exceeded | Consider stretch goal for Q4 |

---

## 19.5 Q3 OKR Health Dashboard Template

```
Month 1 (July)          Month 2 (August)       Month 3 (September)
[  O1  ]  [  O1  ]  [  O1  ]
  KR1.1 [R]              KR1.1 [Y]              KR1.1 [G]
  KR1.2 [G]              KR1.2 [G]              KR1.2 [G]
  KR1.3 [Y]              KR1.3 [Y]              KR1.3 [G]
  KR1.4 [R]              KR1.4 [Y]              KR1.4 [G]
  KR1.5 [G]              KR1.5 [G]              KR1.5 [G]
  
[  O2  ]  [  O2  ]  [  O2  ]
  ...
```

---

# Step 20 — Governance: Financial Controls & Compliance

## 20.1 Financial Control Framework

### 20.1.1 Cash Management (Quan ly tien mat)

| Control | Procedure | Frequency | Owner | Mo ta (VN) |
|---------|-----------|-----------|-------|------------|
| **Daily cash reconciliation** | Compare POS transactions + QR payments (PayOS) + COD cash drawer against sales report | Daily at close | Shift lead | So sanh tien mat + QR + POS cuoi ngay |
| **Petty cash float** | Fixed float of 3M VND. Every withdrawal requires receipt + manager approval. | Weekly top-up | Admin | Quy tien mat co dinh 3M. Rut tien phai co hoa don + manager duyet. |
| **Bank reconciliation** | Match PayOS settlement reports + bank statements against system revenue | Weekly | Finance/Admin | Doi chieu PayOS + sao ke ngan hang voi doanh thu he thong |
| **Cash withdrawal limit** | Maximum 500K refund/ticket without manager approval | Per transaction | All staff | Hoan tien toi da 500K, tren muc do can manager duyet |
| **Safe custody** | Dual-control: 2 staff must be present for safe open/close | Daily open/close | Shift lead + manager | 2 nguoi cung mo/ket thuc két |

### 20.1.2 Purchase & Procurement (Mua hang & Nhap hang)

| Control | Procedure | Mo ta (VN) |
|---------|-----------|------------|
| **Approval matrix** | <1M: Staff can order. 1-5M: Manager approval. >5M: Owner approval. | <1M: Nhan vien tu order. 1-5M: Manager duyet. >5M: Chu quan duyet. |
| **3-quote rule** | All purchases >2M require 3 written quotes from different suppliers | Tat ca mua hang >2M can 3 bao gia tu 3 nha cung cap |
| **Supplier onboarding** | New suppliers require tax ID, bank account, and contract with payment terms | Nha cung cap moi can MST, so TK, hop dong dieu khoan thanh toan |
| **Invoice matching** | Pay only against 3-way match: PO -> Delivery Receipt -> Invoice | Chi thanh toan khi co PO + Phieu nhap + Hoa don khop nhau |
| **Inventory threshold** | Auto reorder when stock <7-day supply (digital trigger via ERPNext) | Tu dong dat lai khi ton kho <7 ngay (qua ERPNext) |

### 20.1.3 Revenue Assurance (Dam bao doanh thu)

| Control | Procedure | Mo ta (VN) |
|---------|-----------|------------|
| **QR-only pricing** | All published prices via QR match system prices. No oral pricing allowed. | Tat ca gia qua QR khop voi he thong. Khong duoc bao gia bang mieng. |
| **Void/cancel audit** | Every voided/canceled order requires comment and is logged in admin audit trail. | Moi don huy phai co ly do, duoc ghi lai trong audit log admin. |
| **Happy hour validation** | Discounts auto-applied by system based on time window. Manual override disabled. | Giam gia tu dong theo khung gio. Vo hieu hoa chinh tay. |
| **Monthly flash audit** | Owner randomly audits 20 orders/month: cross-check POS timestamp vs KDS prep timestamp vs CCTV. | Chu quan kiem tra ngau nhien 20 don/thang: POS time vs KDS time vs camera. |
| **Gratis/complimentary log** | All free drinks must be logged with reason (staff meal, quality issue, VIP comp). Cap: 2% of monthly COGS. | Tat ca do uong mien phi phai co ly do. Gioi han: 2% COGS/thang. |

---

## 20.2 Compliance Checklist (Tuan thu phap ly)

### 20.2.1 Pre-Launch Requirements (Truoc khai truong)

| Item | Status | Deadline | Responsible | Mo ta (VN) |
|------|--------|----------|-------------|------------|
| Business registration (Dang ky kinh doanh) | [ ] | Before opening | Owner | Dang ky GPKD tai UBND Sa Dec |
| Food safety certificate (Giay chung nhan VSATTP) | [ ] | Before opening | Owner | Giay phep an toan thuc pham tu So Y Te |
| Fire safety approval (Phong chay chua chay - PCCC) | [ ] | Before opening | Owner + contractor | Tham dinh PCCC tu Cong An Phong chay chua chay |
| Tax registration (Ma so thue) | [ ] | Before opening | Owner | Dang ky thue khoan hoac mon bai |
| Fire extinguisher inspection (Kiem tra binh chua chay) | [ ] | Monthly | Manager | Kiem tra binh PCCC theo quy dinh |
| Labor contract + social insurance (HDLD + BHXH) | [ ] | Before first payroll | Owner | Hop dong lao dong + BHXH cho nhan vien chinh thuc |
| Signage permit (Giay phep bang hieu) | [ ] | Before external signage | Owner | Xin phep treo bang hieu quang cao |
| Music copyright (Quyen tac gia am nhac) | [ ] | Before live music events | Owner | Dang ky VCPMC neu co nhac song |
| Alcohol license (Giay phep ban ruou bia) | [ ] | Before evening service | Owner | Giay phep ban ruou, bia tai cho |
| CCTV system inspection (Kiem tra camera) | [ ] | Weekly | Manager | Camera hoat dong, luu tru toi thieu 30 ngay |

### 20.2.2 Ongoing Compliance (Duy tri tuan thu)

| Item | Frequency | Penalty if Missed | Mo ta (VN) |
|------|-----------|-------------------|------------|
| Tax filing (Ba cao thue) | Monthly (by 20th) | Fine + interest (0.03%/day) | Nop to khai thue hang thang truoc ngay 20 |
| VAT payment | Monthly (by 20th) | Fine + interest | Nop thue GTGT |
| PIT declaration | Monthly/Quarterly | Fine + interest | Khau tru thue thu nhap ca nhan cho nhan vien |
| Social insurance payment | Monthly (by last day) | Fine + employee complaint | Nop BHXH, BHYT, BHTN |
| Fire safety self-inspection | Monthly | Revocation of PCCC cert | Tu kiem tra PCCC hang thang |
| Food safety self-check | Weekly | Fine, closure | Tu kiem tra ATTP |
| Labor law compliance | Quarterly | Fine, lawsuit | Dam bao luong toi thieu, nghi phep, tang ca |

### 20.2.3 Tax Structure Summary (A Uoc tinh)

| Tax Type | Rate | Monthly Est. (at 150M revenue) | Mo ta (VN) |
|----------|------|-------------------------------|------------|
| **VAT output** (Thue GTGT dau ra) | 8% (reduced, 2026) | 12M | Thue GTGT tren doanh thu (giam 2% theo chinh sach 2026) |
| **VAT input** (Thue GTGT dau vao) | 8% on purchases | -5.6M | Khau tru thue GTGT dau vao (nguyen lieu, dien, nuoc,...) |
| **Net VAT payable** | — | ~6.4M | Thue GTGT phai nop |
| **PIT** (Thue TNCN) | Progressive | ~1-3M | Khau tru cho nhan vien |
| **Business license tax** (Le phi mon bai) | Annual: 1M-3M | ~167K/month | Tu 1-3 trieu/nam (theo doanh thu) |

**Total estimated monthly tax burden:** ~8-10M VND (~5-7% of target revenue)

---

## 20.3 Fraud Prevention (Phong chong gian lan)

| Risk | Control | Severity | Mo ta (VN) |
|------|---------|----------|------------|
| **Cash theft from register** | POS + QR-only ordering. Cash minimized. Daily reconciliation. | CRITICAL | Giam thieu tien mat trong quay. QR ordering la chinh. Doi chieu cuoi ngay. |
| **Inventory shrinkage** | Weekly inventory count by 2 staff (one counts, one records). Variance >2% investigated. | HIGH | Kiem ke hang tuan, 2 nhan vien (1 dem, 1 ghi). Chenh lech >2% dieu tra. |
| **Fake discounts** | Discounts require manager approval. Audit log shows who approved what. | MEDIUM | Giam gia can manager duyet. Audit log ghi lai ai duyet, bao nhieu. |
| **Ghost employees** | Payroll roster cross-checked with shift clock-in logs every month. | HIGH | So sanh bang luong voi log cham cong hang thang. |
| **Supplier collusion** | Purchasing rotation: no single staff member owns all supplier relationships. | MEDIUM | Xoay vong mua hang: khong de 1 nhan vien quan ly toan bo nha cung cap. |
| **E-transaction fraud** | PayOS webhook signed + verified server-side. Refund requires manager + owner dual approval. | CRITICAL | Webhook PayOS co chu ky + verify server-side. Hoan tien can ca manager + owner duyet. |

---

# Step 21 — ESG/Impact: Sustainability & Community

## 21.1 Environmental (Moi truong)

### 21.1.1 Carbon Footprint Reduction

AURA CAFE's container architecture inherently reduces embodied carbon vs brick-and-mortar (~30% less concrete, ~50% less steel foundation). This section codifies ongoing environmental commitments.

| Initiative | Target Q3 | Mo ta (VN) | Cost/Impact |
|------------|----------|------------|-------------|
| **Single-use plastic elimination** | 0 plastic cups by Month 2 | Khong su dung coc nhua dung 1 lan. Chuyen sang giay/kim loai tai su dung. | +2K/cup cost, -95% plastic waste |
| **Straws: paper/compostable only** | 100% from Day 1 | Ong hut giay hoac phan huy sinh hoc. Chi cho khi khach yeu cau. | +0.5K/straw cost |
| **Ingredient sourcing (local)** | >70% of ingredients from Dong Thap + neighbor provinces | Nguyen lieu >70% tu Dong Thap + cac tinh lan can (Ca Mau coffee, Ben Tre coconut, Tra Vinh sugar) | -15% COGS (less transport), +local economy |
| **Energy efficiency** | LED lighting 100%. AC setpoint 24-26C. | Den LED 100%. Dieu hoa nhiet do 24-26C. Timer for outdoor zone AC. | -20% energy bill vs baseline |
| **Water conservation** | Low-flow faucets + rainwater collection for plants | Voi nuoc tiet kiem + thu nuoc mua tuoi cay | -15% water usage |
| **Waste segregation** | 3-bin system: Organic / Recyclable / General | Thung rac phan loai: Huu co / Tai che / Thong thuong | Minimal cost, required by law |
| **Coffee ground recycling** | Collect used grounds -> give to local farmers as fertilizer | Buon ca phe da pha -> tang nong dan lam phan bon | Zero cost, community goodwill |

### 21.1.2 Green Operations Playbook

```
Area                 Action                                     Who             Check
------               ------                                     ---             -----
[Cups]               Use compostable cups. Return scheme for    Barista         Daily
                     reusable cups (deposit 5K).
[Straws]             Paper straws by default. Offer only on     Server          Every order
                     request.
[Napkins]            Recycled unbleached paper. Single sheet    Server          Per table
                     per person (not stack).
[Cleaning]           Eco-friendly cleaning products (enzyme-    Cleaner         Weekly order
                     based, Vietnamese brands like Bio-Clean).
[Takeaway bags]      Brown kraft paper. No plastic bags ever.  Packing station  Daily
[Menu boards]        Digital menus (QR). No printed menu       Manager         Monthly
                     update. Print once only.
[Herbs/garnish]      Grow mint, basil, lemongrass in Sky Deck  Barista         Weekly
                     planter boxes. Zero garnish waste.
[AC schedule]        Off-peak AC reduction. Natural airflow    Manager         Daily check
                     zones (Sky Deck) get no AC.
```

---

## 21.2 Social (Xa hoi)

### 21.2.1 Community Programs

| Program | Description | Frequency | Budget | Mo ta (VN) |
|---------|-------------|-----------|--------|------------|
| **"Coffee for Students"** | Free drip coffee for students during exam season (May-June, Dec-Jan) at Jade Counter, 8:00-10:00. Limit: 30 cups/day. | Exam seasons | ~150K/day (COGS only) | Cafe mien phi cho sinh vien mua thi tai Jade Counter |
| **"Weekend Art Market"** | Free table space for local artists/students to display & sell (paintings, handmade crafts, plants) on Sky Deck every Sunday morning. | Weekly | 0 (lost table revenue ~500K/week) | Cho nghe thuat cuoi tuan mien phi cho nghe si dia phuong |
| **"Cafe Talks"** | Monthly talk series: local entrepreneurs, farmers, artists share stories. Free entry. Drink purchase optional. | Monthly | 1M (speaker honorarium + setup) | Chia se cau chuyen doanh nhan/nong dan/nghe si dia phuong hang thang |
| **"Adopt a Planter"** | Customers can adopt a Sky Deck planter for 99K/month. Nameplate on planter. Includes 4 free drinks. | Ongoing | -99K/month = drink revenue | 99K/thang "nhan nuoi" 1 chau cay. Ten khach tren bang ten. Kem 4 ly cafe. |
| **Staff Development Fund** | 5% of monthly net profit set aside for staff training (barista certification, English class, management skills). | Monthly after profit | 5% net profit | 5% loi nhuan hang thang cho dao tao nhan vien |

### 21.2.2 Local Economic Impact

| Metric | Q3 Target | Mo ta (VN) |
|--------|----------|------------|
| Local suppliers engaged | 5+ direct suppliers from Dong Thap | Nha cung cap dia phuong: ca phe, sua tuoi, banh, nghe thuat |
| Jobs created | 4-6 FTE + 2-3 part-time | Vice lam: barista, phuc vu, bao ve, lau don, quan ly |
| Average staff wage vs. Sa Dec minimum | 120%+ of regional minimum wage | Luong trung binh cao hon luong toi thieu vung it nhat 20% |
| Local event partnerships | 3+ (artist collab, school event, Tet fair) | Hop tac su kien voi truong hoc, nghe si, hoi cho Tet |
| Customer referral from locals | >60% of new customers from word-of-mouth | >60% khach moi tu gioi thieu (KPI for local love) |

---

## 21.3 Governance (Quan tri)

### 21.3.1 ESG Reporting

| Report | Frequency | Audience | Content |
|--------|-----------|----------|---------|
| **Monthly ESG Scorecard** | Monthly (internal) | Owner + Manager | Plastic use, waste volume, local sourcing %, staff hours, community events |
| **Quarterly Sustainability Report** | End of Q3 | Public (social media + website) | ESG highlights, carbon impact, community programs, photos |
| **Annual Impact Summary** | Year-end | Public + potential partners | Full year ESG data, staff development results, CO2 avoided vs brick-and-mortar |

### 21.3.2 ESG KPI Dashboard

```
Environmental                            Social                              Governance
-------------                           ------                              ----------
Plastic avoided:    [ 12,000 cups ]     Staff trained:      [ 3            ]  ESG report:       [ Monthly ✓ ]
Local sourcing %:   [ 72%          ]     Community events:   [ 2            ]  Tax compliance:   [ 100%     ]
Energy kWh/month:   [ 1,800        ]     Local jobs:         [ 7            ]  Audit findings:   [ 0        ]
Water L/month:      [ 12,000       ]     Student drinks:     [ 180          ]  Supplier code:    [ Draft    ]
Waste diversion:    [ 45%          ]     Fund % profit:      [ 5%           ]  Policy reviewed:  [ Monthly  ]
```

### 21.3.3 ESG Commitments (AURA CAFE Charter)

```
AURA CAFE cam ket (pledges):

1.  Net-zero single-use plastic by Month 2.
    He thong khong su dung nhua dung mot lan tu thang 2.

2.  Uu tien nha cung cap dia phuong.
    Prefer local suppliers within Dong Thap + 100km radius.

3.  5% loi nhuan cho dao tao nhan vien.
    5% of net profit to staff training and development.

4.  Khong gian mien phi cho cong dong.
    Free community space for local arts, talks, and markets.

5.  Minh bach ve tac dong moi truong.
    Transparent environmental impact reporting quarterly.
```

---

# Step 22 — Crisis: Fire Safety, Food Safety, Data Breach

## 22.1 Crisis Management Framework

**Principle:** All crises follow the same 5-step protocol. Domain-specific details below.

```
5-Step Crisis Protocol:

1. DETECT   -> Phat hien su co
2. CONTAIN  -> Kiem che thiet hai
3. RESPOND  -> Phan ung (theo loai su co)
4. RECOVER  -> Phuc hoi hoat dong
5. REVIEW   -> Danh gia + cai thien
```

### Crisis Communication Chain

```
CRITICAL (immediate danger to life/property)
  -> Staff calls 115/114
  -> Manager notified immediately
  -> Owner notified within 5 min
  
HIGH (revenue/operations impact >10M or reputation risk)
  -> Manager notified immediately
  -> Owner notified within 15 min
  -> Decision within 1h

MEDIUM (impact <10M, no safety risk)
  -> Manager resolves
  -> Log in daily report
  -> Owner notified at end-of-day
```

---

## 22.2 Fire Safety (Phong chay chua chay - PCCC)

### 22.2.1 PCCC Equipment Inventory

| Equipment | Location | Qty | Inspection Frequency | Mo ta (VN) |
|-----------|----------|-----|---------------------|------------|
| CO2 fire extinguisher | Kitchen (near cooking area) | 1 | Monthly | Binh CO2 cho khu bep (chay dien/chay dau) |
| Powder fire extinguisher (ABC) | Each zone (Jade, Noir, VIP, Aura, Sky) | 5 (1/zone) | Monthly | Binh bot ABC cho moi khong gian |
| Fire blanket | Kitchen + Sky Deck grill area | 2 | Quarterly | Chan chua chay cho bep + nuong |
| Smoke detector | Each zone + kitchen + storage | 7 | Quarterly (battery check monthly) | Dau bao chay cho moi khu vuc |
| Emergency exit sign | Each zone + main entrance + back exit | 7 | Monthly | Bien bao loi thoat hiem |
| Emergency light | Each zone (battery backup) | 5 | Monthly (test discharge quarterly) | Den chieu sang khan cap |
| Fire hose / hydrant | Main entrance (building external) | 1 | Annual (by building owner) | Voif chua chay ngoai toa nha |
| Fire alarm panel | Manager office / near entrance | 1 | Quarterly | Bang dieu khien bao chay trung tam |

### 22.2.2 Fire Response Procedure (Quy trinh chua chay)

```
Phat hien chay (Fire detected):
  1. HO TO: "CHAY! CHAY!" (Shout fire 3x)
  2. Goi 114: "Chay tai 39 Nguyen Tat Thanh, Sa Dec. Container cafe. Co nguoi ben trong."
  3. CAT DIEN: Ngat CB tong (Cut main breaker)
  4. SO TAN: Huong khach ra loi thoat hiem (Evacuate customers)
     - Diem tap trung: Mat tien nha, cach building 20m
     - Kiem tra so nguoi: Staff count head
  5. CHUA: Dung binh PCCC neu chay nho (Extinguish if small fire)
  6. BAO CAO: Bao manager + owner (Report)

So do so tan (Evacuation Map):
  
  [Sky Deck] (roof)
      |
  [Aura Lounge] -- [Noir Cabin]
      |                 |
  [Jade Counter] -- [VIP Steel Nest]
      |                 |
  [Main Entrance]   [Back Exit]
  
  * Sky Deck: Di xuong cau thang -> Main Entrance
  * Noir/VIP: Di thang ra Back Exit
  * Jade/Aura: Di thang ra Main Entrance
  
### 22.2.3 Fire Prevention (Phong ngua chay)

| Rule | Detail | Mo ta (VN) |
|------|--------|------------|
| No smoking inside any container zone | Smoking only in designated outdoor area (Sky Deck corner). Fine for staff violation: 100K. | Chi hut thuoc tai Sky Deck. Phat 100k neu nhan vien vi pham. |
| Kitchen gas safety | Gas tank outside building. Valve off when not in use. Check hose monthly. | Binh gas de ngoai building. Khoa van khi khong dung. Kiem tra day dan hang thang. |
| Electrical load monitoring | No daisy-chaining power strips. Max 1 heater/appliance per outlet. | Khong noi nhieu o cam. Toi da 1 thiet bị/1 o cam. |
| Flammable storage | Cleaning chemicals stored in ventilated cabinet, away from kitchen. | Hoa chat lau don de tu thong gio, xa bep. |
| Exit route clear | Emergency exits NEVER blocked. Daily check by shift lead. | Loi thoat hiem KHONG duoc de do dac. Kiem tra moi ca. |
| Fire drill | Quarterly: full evacuation drill. Measure: <2 min clear time. | Tap tran PCCC moi quy. Thoi gian so tan <2 phut. |

---

## 22.3 Food Safety (An toan thuc pham - ATTP)

### 22.3.1 HACCP-based Controls for AURA Cafe Kitchen

| Control Point | Hazard | Critical Limit | Monitoring | Corrective Action | Mo ta (VN) |
|---------------|--------|----------------|------------|-------------------|------------|
| **Receiving** (Nhap hang) | Spoiled ingredients | Milk: <4C. Eggs: no cracks. Coffee beans: bag sealed, roast date <30 days | Visual + temp check. Log every delivery. | Reject & return. Record in waste log. | Kiem tra nhiet do + hinh thuc khi nhap hang |
| **Storage** (Bao quan) | Bacterial growth | Fridge: 0-5C. Freezer: -18C. Dry storage: <30C, <60% humidity. FIFO applied. | Temp log twice daily. Fridge/freezer alarm. | >5C for >2h: discard food. Call repair. | Giam sat nhiet do 2 lan/ngay. Thuc pham >5C qua 2h: bo. |
| **Prep** (So che) | Cross-contamination | Separate cutting boards: green (vegetables), red (meat), blue (seafood). Hand wash every 30 min. | Visual check. Handwash timer. | Re-wash. Replace contaminated board. Replace gloves. | Bang cat rieng tung loai. Rua tay moi 30 phut. |
| **Cooking** (Che bien) | Undercooked food | Milk: >72C for 15s (pasteurization temp). Coffee brew: >92C water. Reheat snacks: >75C core. | Probe thermometer. Log temp of each batch. | Reheat to correct temp. If unsure: discard. | Nhiet do nau chin: sua >72C, ca phe >92C. Do nhiet. |
| **Holding** (Giu nong) | Bacterial growth. Hot food: >60C. Cold food: <5C. | Digital temp display on warmers/fridges. Check every 2h. | Discard if out of temp >1h. Reduce quantity prepared. | Thuc an nong: >60C. Thuc an lanh: <5C. Bo neu qua 1h ngoai nhiet do. |
| **Serving** (Phuc vu) | Contamination by server | Gloves for pastry/food handling. No bare-hand contact with ready-to-eat food. | Visual check. Gloves available at all stations. | Replace gloves immediately. Re-plate affected item. | Mang bao tay khi lam banh/thuc an. Khong cham tay vao thuc an. |
| **Cleaning** (Ve sinh) | Chemical residue | 3-step sink: wash (45C + detergent) -> rinse (clean water) -> sanitize (chlorine 100ppm, 2 min contact). Towel changed every 4h. | Log cleaning cycle. Color-coded towels (blue: counter, yellow: floor, red: restroom). | Rewash. Replace chemical if concentration off. Refresher training. | Rua bang 3 buoc. Khuan mau rieng cho tung khu vuc. |

### 22.3.2 Food Safety Record Keeping

| Record | Frequency | Retention | Mo ta (VN) |
|--------|-----------|-----------|------------|
| Receiving log (Nhat ky nhap hang) | Per delivery | 6 months | Ghi lai nhiet do, nha cung cap, lo hang |
| Fridge/freezer temp log | Twice daily | 6 months | Nhiet do tu lanh/ dong lanh sang-chieu |
| Kitchen cleaning log | Per shift | 3 months | Ve sinh bep: be mat, thiet bi, san |
| Handwash monitoring | By manager, random | 3 months | Giam sat rua tay nhan vien |
| Pest control log | Monthly | 12 months | Kiem tra con trung, thu gay hai |
| Staff health declaration | Daily (before shift) | 3 months | Khai bao suc khoe dau ca: sot, ho, tieu chay |
| Food waste log | Daily | 3 months | Thuc pham bo: ly do, so luong |
| Allergen declaration (menu) | Updated quarterly | Permanent (keep old version) | Khai bao chat gay di ung trong menu |

### 22.3.3 Staff Food Safety Training

| Training | Frequency | Audience | Content | Mo ta (VN) |
|----------|-----------|----------|---------|------------|
| **Basic Hygiene** | Onboarding (first day) | All new staff | Handwash, glove use, uniform, health check | Ve sinh co ban cho nhan vien moi |
| **HACCP Foundation** | Within 1 week | Kitchen staff | Critical limits, temp logging, cross-contamination | HACCP co ban cho nhan vien bep |
| **Allergen Awareness** | Monthly | All F&B staff | Top 7 allergens (milk, egg, peanut, soy, wheat, shellfish, fish) | Nhan biet chat gay di ung |
| **Fire + Safety Refresher** | Quarterly | All staff | Evacuation, extinguisher use, first aid | On tap PCCC + so cap cuu |
| **Customer Complaint Handling** | Monthly (first week) | All staff | How to handle "foreign object," "food poisoning," allergy reaction | Cach xu ly khieu nai ve thuc pham |

### 22.3.4 Food Poisoning/Allergy Response

```
SUSPECTED FOOD POISONING (Ngo doc thuc pham):
  1. STOP serving suspect item immediately
  2. PRESERVE: Save sample of suspect item (sealed bag, labeled, dated)
  3. MEDICAL: If symptoms (vomiting, diarrhea, fever): 
     - Guide customer to nearest clinic (Benh Vien Da Khoa Sa Dec, 5 min)
     - Or call 115 if severe
  4. REPORT: Notify Manager -> Owner within 10 min
  5. TRACE: Review prep logs, ingredient batch, shift staff
  6. RECORD: Full incident report (time, item, symptoms, outcome)
  7. REPORT TO AUTHORITY: If 2+ cases from same meal -> report to So Y Te within 24h

ALLERGY REACTION (Di ung thuc pham):
  1. Identify allergen if known
  2. If mild (rash, itching): Antihistamine (staff first-aid trained)
  3. If severe (swelling, difficulty breathing): Call 115 IMMEDIATELY
  4. Customer has own Epipen? Assist them with use
  5. Record incident + update menu allergen info if needed
```

---

## 22.4 Data Breach / Cybersecurity

### 22.4.1 AURA CAFE Data Inventory

| Data Type | Where Stored | Sensitivity | Regulation | Mo ta (VN) |
|-----------|-------------|-------------|------------|------------|
| Customer phone number | D1 (Cloudflare), CRM | HIGH | Decree 13/2023 (personal data protection) | SDT khach hang — du lieu ca nhan |
| Customer name | D1 | MEDIUM | Decree 13/2023 | Ten khach hang |
| Order history | D1 | MEDIUM | Decree 13/2023 | Lich su don hang |
| Payment transaction ID | D1 + PayOS | HIGH | State Bank regulations | Ma giao dich thanh toan |
| Staff ID/phone | D1, payroll | HIGH | Decree 13/2023 + Labor law | Thong tin ca nhan nhan vien |
| Staff bank account | Owner's computer (air-gapped) | HIGH | — | So tai khoan ngan hang cua nhan vien |
| ERPNext connection | Cloudflare env vars | HIGH | BYOK model — no AURA liability | Api key ERPNext |
| PayOS API keys | Cloudflare env vars (encrypted) | CRITICAL | — | Api key PayOS (da ma hoa) |
| CCTV footage | Local DVR | MEDIUM | Decree 13/2023 | Hinh anh camera |

### 22.4.2 System Security Controls

| Control | Implementation | Mo ta (VN) |
|---------|---------------|------------|
| **API key encryption** | All API keys stored in Cloudflare Workers secrets (not env vars in source code) | Khoa API duoc ma hoa boi Cloudflare, khong de trong code |
| **HTTPS only** | Cloudflare edge terminates TLS. HSTS enabled. | Tat ca truy cap qua HTTPS. HSTS bat. |
| **PayOS webhook HMAC** | Webhook signature verified server-side before processing | Chu ky webhook duoc xac thuc truoc khi xu ly |
| **CORS restriction** | Only auraspace.cafe and admin subdomain allowed | Chi domain auraspace.cafe + admin duoc goi API |
| **Rate limiting** | 100 requests/min per IP. 5 login attempts/min. | Gioi han 100 request/phut/IP. 5 lan dang nhap/phut. |
| **Auth session TTL** | JWT expires after 24h. Refresh token rotation. | JWT het han sau 24h. Lam moi token. |
| **Admin audit log** | All admin actions logged: who, what, when, IP. Immutable (append-only). | Tat ca hanh dong admin duoc ghi log: ai, lam gi, luc nao, IP. |
| **Admin IP whitelist** | Admin panel accessible only from known IPs (Sa Dec ISP, owner's phone 4G, staff WiFi) | Admin panel chi truy cap tu IP da duyet. |
| **D1 backup** | Daily automated D1 backup to R2. 7-day retention. | Backup D1 hang ngay len R2. Giu 7 ngay. |

### 22.4.3 Data Breach Response Plan

```
Phat hien vi pham (Breach detected):
  Level 1 (Customer phone list exposed):
    - Identify: Which database, which records, how many
    - CONTAIN: Revoke compromised API key. Block IP. Rotate secrets.
    - NOTIFY: Affected customers via Zalo/SMS within 24h
    - REPORT: Department of Public Security within 72h (Decree 13/2023)
    - REVIEW: Root cause + fix → implement within 48h

  Level 2 (Payment data or admin credentials compromised):
    - All Level 1 steps +:
    - LOCK: Immediate password reset for ALL admin accounts
    - FREEZE: Temporarily disable payment processing if PayOS key exposed
    - FORENSIC: Engage cybersecurity professional (external)
    - NOTIFY: All customers + staff via multiple channels
    - REPORT: State Bank (if payment system involved) within 24h

  Level 3 (Full system compromise):
    - All Level 1 + 2 steps +:
    - SHUTDOWN: Take system offline. Switch to manual POS (prepared register)
    - RECOVER: Restore from last known-good backup (max 2h loss)
    - COMMUNICATE: Full public disclosure + press statement if media picks up
    - LEGAL: Lawyer consultation + regulatory reporting cascade

### 22.4.4 Incident Contact Sheet

| Role | Name | Phone | Backup | Mo ta (VN) |
|------|------|-------|--------|------------|
| Owner | [Founder name] | [Phone] | [Co-owner/partner] | Chu quan |
| Shift Manager | [Manager name] | [Phone] | [Asst manager] | Quan ly ca |
| IT Emergency | [Dev phone] | [Phone] | [Backup dev] | Ho tro ky thuat |
| PCCC (Fire dept) | 114 | 114 | — | So cuu hoa |
| Ambulance (Cap cuu) | 115 | 115 | — | So cuu thuong |
| Police (Cong an) | 113 | 113 | — | So canh sat |
| Electricity (Dien luc) | [Sa Dec EVN] | 1900 1906 | — | Dien luc |
| Nearest clinic | Benh Vien Da Khoa Sa Dec | [02773 861 035] | — | Benh vien gan nhat |
| Data protection hotline | Bo Cong An (A05) | [069 234 8569] | — | Duong day bao ve du lieu |

### 22.4.5 Privacy Compliance (Decree 13/2023 ND-CP)

| Requirement | AURA Compliance | Mo ta (VN) |
|-------------|----------------|------------|
| **Consent collection** | Phone number collected only at QR ordering with checkbox: "Toi dong y nhan thong bao khuyen mai" | Thu thap SDT co su dong y |
| **Data minimization** | Only collect phone, name (optional), order history. No ID, no address, no biometric. | Chi thu thap toi thieu du lieu can thiet |
| **Data deletion** | Customer can request deletion via admin: "Xoa du lieu" button in loyalty profile. 48h SLA. | Khach hang co the yeu cau xoa du lieu. Hoan tat trong 48h. |
| **Data protection officer** | Owner serves as DPO. Contact: [owner email] | Chu quan la nhan vien bao ve du lieu |
| **Breach notification** | To affected data subjects within 72h. To A05 (Bo Cong An) within 72h. | Thong bao vi pham trong 72h. |
| **Cross-border transfer** | All data stored on Cloudflare D1 (US/EU servers). Consent obtained in TOS. | Du lieu luu tru tren Cloudflare. Co su dong y trong dieu khoan. |

---

# Step 23 — Agentic Architecture: QR->KDS->POS->Loyalty Flow

## 23.1 Vision: The Autonomous Cafe

AURA CAFE operates on an **agentic loop** — from the moment a customer scans a QR code to the moment they earn loyalty points, the system coordinates autonomously across 4 subsystems with minimal human intervention.

```
                      AUTONOMOUS CAFE LOOP
                      
     [CUSTOMER]           [SYSTEM AGENTS]        [STAFF]
         |                      |                   |
         v                      |                   |
    [QR Scan]  ─────>   Order Agent              
     (menu)                create cart             |
         |                      |                   |
         v                      v                   |
    [Select Items] ───>   Pricing Agent             |
     (cart)                calc total              |
         |                  apply discounts         |
         v                      |                   |
    [Payment]  ──────>   Payment Agent             |
     (PayOS/COD)           verify payment          |
         |                  issue receipt           |
         |                      |                   |
         |                      v                   |
         |              Orchestration Agent         |
         |              route to KDS + POS          |
         |                      |                   |
         +──────────────────────+──────────────────>|
                                 v                  v
                            [KDS Display]      [POS Terminal]
                            (barista sees       (admin sees
                             order + prep        revenue + 
                             timer)              analytics)
                                |                   |
                                v                   v
                           [Loyalty Agent]     [Inventory Agent]
                            auto-credit          deduct stock
                            points to            trigger reorder
                            customer             if low
                                |                   |
                                v                   v
                          [Data Agent]     ───>  [Reporting]
                           analyze all            daily dash
                           events                 auto insights
```

---

## 23.2 Subsystem Architecture

### 23.2.1 QR Ordering Agent (Customer-Facing)

**Trigger:** Customer scans QR code at table

```
Inputs:
  - Table number (from QR metadata)
  - Menu data (from D1/cache)
  - Customer phone (from previous visit or new entry)
  - Time of day (for day-part menu)

Processing:
  1. Menu Agent loads cached menu from KV (sub-50ms)
  2. Day-Part Agent filters menu by time window (morning/lunch/afternoon/evening)
  3. Personalization Agent checks customer history:
     - Past orders -> recommended items
     - Loyalty tier -> applicable discounts
  4. Cart Agent manages state (add/remove/update)
  5. Checkout Agent orchestrates payment flow

Outputs:
  - Order created in D1 (status: PENDING_PAYMENT)
  - Payment QR (PayOS) generated or COD option displayed
  - Estimated prep time displayed to customer
```

**Agent State Machine:**

```
[IDLE] -> [SCAN] -> [MENU_BROWSE] -> [CART] -> [CHECKOUT]
                                                    |
                                            +------->--------+
                                            |                 |
                                    [PAYMENT_OK]        [CANCELLED/FAILED]
                                            |                 |
                                            v                 v
                                    [ORDER_PLACED]      [RETURN_TO_CART]
                                            |
                                            v
                                    [IN_KDS_QUEUE]
```

### 23.2.2 KDS Agent (Kitchen-Facing)

**Trigger:** Order status changes to PAID (or COD: ORDER_CONFIRMED)

```
Inputs:
  - Order details (items, modifiers, table number)
  - Prep time per item (from menu config)
  - Current kitchen load (items in queue)
  - Staff priority (which barista is assigned to which zone)

Processing:
  1. Queue Agent:
     - Inserts order into KDS queue
     - Sorts by priority (VIP orders first, then FIFO)
     - Estimates completion time based on current load
  2. Assignment Agent:
     - Routes drink orders to main barista
     - Routes food orders to pastry station
     - Routes evening cocktail orders to bar station (if separate)
  3. Timer Agent:
     - Starts per-order countdown
     - Alerts if prep time exceeds threshold (>8 min = yellow, >12 min = red)
     - Escalates: if red >3 min -> manager notification on POS
  4. Notification Agent:
     - Updates order status to READY when barista confirms
     - Triggers push notification to customer's phone (Zalo/SMS/web)
     - Updates table display ("Order #42 ready!")
```

**KDS Visual State:**

```
┌─────────────────────────────────────────────────────┐
│  KDS — AURA CAFE                     [12:34:56]     │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ⚪ NEW ORDERS (3)                [Prep Timer]      │
│  ┌─────────────────────────────────────────────┐    │
│  │ Order #042  | Table B3  | 12:33:00          │    │
│  │  1x Matcha Dusk             2:30 / 4:00     │    │
│  │  1x Cold Brew               1:15 / 3:00     │    │
│  │  Note: Less ice                          │    │
│  │  [START PREP]                              │    │
│  └─────────────────────────────────────────────┘    │
│                                                     │
│  🟡 IN PROGRESS (2)              [Timer Running]    │
│  ┌─────────────────────────────────────────────┐    │
│  │ Order #039  | Table A1  | 12:31:15          │    │
│  │  1x Espresso Tonic            5:30 / 5:00   │    │
│  │  ⚠️ Overdue by 30s                          │    │
│  │  [MARK COMPLETE]                             │    │
│  └─────────────────────────────────────────────┘    │
│                                                     │
│  🟢 READY FOR PICKUP (4)                            │
│  ┌─────────────────────────────────────────────┐    │
│  │ #037 (B7)  #038 (A4)  #040 (Sky)  #041 (B2)│    │
│  └─────────────────────────────────────────────┘    │
│                                                     │
│  Load: 65%  |  Avg Prep: 4:12  |  Escalations: 0   │
└─────────────────────────────────────────────────────┘
```

### 23.2.3 POS Agent (Admin-Facing)

**Trigger:** Order lifecycle events (CREATE, PAY, COMPLETE, CANCEL, REFUND)

```
Inputs:
  - All order data (from QR + KDS)
  - Payment settlement data (from PayOS)
  - Staff clock-in data (shift management)
  - Inventory data (from ERPNext or manual)

Processing:
  1. Revenue Agent:
     - Real-time revenue aggregation by zone, by hour, by menu item
     - Cash vs QR vs COD split
     - Tax calculation per invoice
  2. Shift Agent:
     - Track which staff handled which orders (via assignment)
     - Calculate tips/promotion if applicable
     - Shift close summary (revenue, cash drawer variance, voids)
  3. Inventory Agent:
     - Deduct ingredients from inventory when order completed
     - Alert when stock < threshold ("Matcha powder: 2 days remaining")
     - Suggest reorder quantity
  4. Alert Agent:
     - Monitor for anomalies (void rate >5%, refund amount >500K)
     - Notify manager on POS screen + optional Zalo notification

**POS Dashboard:**

```
┌────────────────────────────────────────────────────────────┐
│  POS — AURA CAFE                  [12:35]  [Staff: Chi]    │
├────────────────────────────────────────────────────────────┤
│ [Orders] [Menu] [Staff] [Inventory] [Reports] [Settings]   │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  TODAY: 07/05/2026                                         │
│                                                            │
│  Revenue:    8,245,000 ₫     (+23% vs last Thu)           │
│  Orders:     187              Avg ticket: 44,091 ₫        │
│  Active:     42               Peak: 12:00-13:00            │
│                                                            │
│  ZONE BREAKDOWN:                                           │
│  Jade Counter   2,150,000 ₫  (48 orders)  ████████░░ 80%   │
│  Sky Deck       1,890,000 ₫  (35 orders)  ███████░░░ 70%   │
│  Aura Lounge    1,620,000 ₫  (32 orders)  ██████░░░░ 60%   │
│  Noir Cabin     1,450,000 ₫  (40 orders)  ██████░░░░ 58%   │
│  VIP Steel Nest 1,135,000 ₫  (32 orders)  █████░░░░░ 50%   │
│                                                            │
│  ⚠ ALERTS:                                                 │
│  • Matcha powder stock: 2 days remaining → Order now      │
│  • Fridge temp alert: Noir zone fridge at 6.2°C (limit 5) │
│  • 2 orders overdue (>12 min): #042 (3:20), #044 (0:45)   │
└────────────────────────────────────────────────────────────┘
```

### 23.2.4 Loyalty Agent (Retention-Facing)

**Trigger:** Order status changes to COMPLETED

```
Inputs:
  - Customer phone (from order)
  - Order value
  - Current loyalty tier
  - Points balance
  - Referral status (was this order referred?)

Processing:
  1. Points Engine:
     - Calculate points earned: floor(order_value * tier_multiplier)
     - Tier multipliers: Bronze 2%, Silver 5%, Gold 8%, Diamond 10%
     - Bonus points: birthday (2x), event attendance (50 bonus), first visit (100 bonus)
  2. Tier Engine:
     - Check if customer crossed next tier threshold
     - If yes: trigger "Welcome to Silver/Gold/Diamond!" notification
     - Apply tier benefits immediately
  3. Referral Engine:
     - If referred order: credit referrer + friend
     - Check referral completion status (friend spent >100k?)
     - If yes: credit referrer bonus
  4. Nudge Engine:
     - Check if customer hasn't visited in 7+ days -> "We miss you!" trigger
     - Check if points expiring in 30 days -> "Use your points!" trigger
     - Check if birthday in next 7 days -> "Birthday bonus ready!" trigger
```

**Loyalty Agent Decision Flow:**

```
Order Completed
    │
    v
[Calculate Points] ───>[Check Tier Progress] ───>[Check Referral]
    │                        │                         │
    v                        v                         v
Credit Points          If tier up:               If referral:
to customer             trigger welcome           credit both
    │                   + apply benefits           parties
    v                        │                         │
[Check Nudge Conditions] <───┘─────────────────────────┘
    │
    v
┌───┬───┬───┬───┬───┬───┐
│7d │14d│30d│Pts│Bday│Evt│
│noc│noc│noc│Exp│Soon│Soon│
└───┴───┴───┴───┴───┴───┘
    │    │    │    │    │    │
    v    v    v    v    v    v
[                   ZNS/WEBHOOK QUEUE                  ]
```

---

## 23.3 Cross-Agent Orchestration

### 23.3.1 Event Bus Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                       EVENT BUS (Cloudflare Queues)                  │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Events Published:                                                    │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐     │
│  │order.created│  │order.paid  │  │order.prepped│  │order.complete│    │
│  └─────┬──────┘  └─────┬──────┘  └─────┬──────┘  └──────┬──────┘     │
│        │               │               │                │             │
│        v               v               v                v             │
│  ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────────┐       │
│  │KDS Agent │   │POS Agent │   │Loyalty   │   │Inventory     │       │
│  │subscribe │   │subscribe │   │subscribe │   │Agent subscribe│       │
│  └──────────┘   └──────────┘   └──────────┘   └──────────────┘       │
│                                                                      │
│  No direct point-to-point. All communication through events.         │
│  Each agent subscribes to the events it cares about.                 │
└──────────────────────────────────────────────────────────────────────┘
```

### 23.3.2 Event Definitions

| Event | Publisher | Subscribers | Payload |
|-------|-----------|-------------|---------|
| `order.created` | QR Agent | KDS Agent, POS Agent | `{ orderId, items, table, total, paymentMethod }` |
| `order.paid` | Payment Agent | KDS Agent, POS Agent | `{ orderId, amount, method, payosTxId? }` |
| `order.prepped` | KDS Agent | POS Agent, Notification Agent | `{ orderId, prepTime, baristaId }` |
| `order.served` | KDS Agent | Loyalty Agent, Inventory Agent | `{ orderId, customerPhone, items, value }` |
| `order.completed` | POS Agent | Loyalty Agent, Inventory Agent, Data Agent | `{ orderId, customerPhone, value, zone }` |
| `inventory.low` | Inventory Agent | POS Agent, Manager | `{ itemId, name, remaining, reorderQty }` |
| `customer.first_visit` | Loyalty Agent | Marketing Agent | `{ phone, source, firstOrderValue }` |
| `tier.upgrade` | Loyalty Agent | Notification Agent, Marketing Agent | `{ phone, oldTier, newTier }` |
| `shift.started` | POS Agent | All agents | `{ staffId, zone, timestamp }` |
| `anomaly.detected` | POS Agent | Manager (Zalo/SMS) | `{ type, value, threshold, action }` |

### 23.3.3 Single-Order Trace (End-to-End)

```
Follow order #042 by customer "Thanh" on 2026-07-05 at 12:30:

TIME     AGENT          ACTION
─────    ─────          ──────
12:30:00 QR Agent       Thanh scans QR at Table A1 (Sky Deck)
12:30:03 Menu Agent     Returns day-part menu (afternoon: Matcha Dusk available)
12:30:15 Cart Agent     Thanh adds: 1x Matcha Dusk (29k), 1x Cold Brew (25k)
12:30:22 Personalization Agent  Checks: Thanh is Gold tier → 8% discount applied
12:30:25 Payment Agent  Generates PayOS QR: 54,000 VND (after 8% Gold discount)
12:30:28 —              Thanh scans PayOS QR, pays via MoMo
12:30:32 Payment Agent  PayOS webhook received: status=SUCCESS, txId=payos_abc123
12:30:32 Event Bus      PUBLISH: order.paid { orderId: 42, amount: 54000, ... }
12:30:33 KDS Agent      SUBSCRIBE: order.paid → Insert order #042 into KDS queue
12:30:33 KDS Agent      Display: "Order #042 → Sky Deck → Matcha Dusk + Cold Brew"
12:30:35 Event Bus      PUBLISH: order.created (for POS) 
12:30:36 POS Agent      SUBSCRIBE: order.created → Add to today's revenue tally
12:30:40 KDS Agent      Barista "Minh" taps [START PREP] on KDS
12:30:45 KDS Agent      Prep timer starts: Matcha Dusk 4:00, Cold Brew 3:00
12:33:45 KDS Agent      Minh taps [COMPLETE] on Cold Brew (done in 3:15)
12:34:00 KDS Agent      Minh taps [COMPLETE] on Matcha Dusk (done in 3:20)
12:34:01 Event Bus      PUBLISH: order.prepped { orderId: 42, prepTime: 240s, ... }
12:34:02 Notification Agent  Send: "[AURA] Order #042 ready! Enjoy your Matcha Dusk ☕"
12:34:05 Agent KDS      Moved to READY state on KDS display
12:34:20 —              Customer picks up drinks from Sky Deck bar
12:34:30 KDS Agent      Minh taps [SERVED] (Order #042 delivered)
12:34:31 Event Bus      PUBLISH: order.served { orderId: 42, phone: "090xxxxxxx", value: 54000 }
12:34:32 Loyalty Agent  SUBSCRIBE: order.served
12:34:32 Loyalty Agent  Calculate: 54000 * 8% (Gold tier) = 432 points earned
12:34:33 Loyalty Agent  Update: Thanh_AURA points: 4,280 → 4,712
12:34:33 Loyalty Agent  Check: 4,712 points → Diamond threshold is 5,000
12:34:33 Loyalty Agent  Nudge: "Chi con 288 points nua la len Diamond! 🌟"
12:34:34 Event Bus      PUBLISH: order.completed { orderId: 42, ... }
12:34:35 Inventory Agent  SUBSCRIBE: order.completed
12:34:35 Inventory Agent  Deduct: Matcha powder -2 servings, Coffee beans -2 servings
12:34:36 Inventory Agent  Check: Matcha powder = 8 servings = 3 days left → OK
12:34:40 Data Agent      Log order #042 to analytics (hourly rollup)
12:34:45 —              Full cycle complete. 4 minutes 45 seconds from scan to loyalty credit.

TOTAL TOUCHPOINTS: 0 staff interactions (fully autonomous from order to loyalty)
TOTAL SYSTEM TIME: 4 min 45 sec
```

---

## 23.4 System Requirements Matrix

| Component | Technology | Scalability | Failure Mode | Backup |
|-----------|-----------|-------------|-------------|--------|
| **QR Agent** | Vite+React SPA (client) + Hono API (Worker) | 1000+ concurrent scans | QR scan fails | Staff writes manual order on POS |
| **Menu Agent** | D1 (read) + KV (cache) | Sub-50ms cache, unlimited read | Cache miss → D1 fallback | Static HTML menu printed |
| **Payment Agent** | PayOS API + Webhook | 100+ concurrent payments | Webhook timeout | Manual verify + COD override |
| **KDS Agent** | Hono SSE/WebSocket + D1 writes | 50 concurrent KDS screens | KDS offline | Staff uses mobile phone as KDS (PWA) |
| **POS Agent** | React SPA (admin panel) | 10 concurrent admin sessions | POS unavailable | Owner phone dashboard (read-only) |
| **Loyalty Agent** | D1 (write-heavy) | 10K+ members, millions of points | Points delay | Points credited on next order (catch-up) |
| **Inventory Agent** | D1 + ERPNext (optional) | 500+ SKUs | Sync fail | Manual check continues |
| **Event Bus** | Cloudflare Queues | Unlimited (cloudflare managed) | Queue backlog | Direct API calls fallback |

---

## 23.5 Fallback Modes (Redundancy)

### 23.5.1 Internet Outage (Mat mang)

| Scenario | Duration | Procedure | Mo ta (VN) |
|----------|----------|-----------|------------|
| Cloudflare Workers offline | <10 min | Retry. Workers auto-recover. | Doi Workers tu phuc hoi. |
| Cloudflare Workers offline | >10 min | Switch to offline mode: pre-generated PayOS QR codes + manual cash register | Dung QR da in san + thu ban tay. |
| Internet cut (ISP down) | <30 min | Use 4G backup router (SIM in manager's office) | Dung router 4G du phong. |
| Internet cut (ISP down) | >30 min | Full offline mode: paper menu, cash only, manual order pad, reconcile later | Menu giay, tien mat, ghi don tay. |
| Payment gateway (PayOS) down | <1h | COD only. Record customers who want to pay later for follow-up. | Chi COD. Ghi lai khach muon thanh toan sau. |
| Payment gateway down | >1h | Switch to backup bank transfer QR (MomO ACB account). Manual verify. | Dung chuyen khoan du phong. Xac nhan thu cong. |

### 23.5.2 KDS Failure

```
KDS Screen White/Off:
  1. Barista opens admin AURA PWA on personal phone -> KDS mode
  2. PWA auto-connects to same event stream as hardware KDS
  3. Orders still come through. Prep continues.
  4. Fix hardware: reboot Raspberry Pi / Android tablet running KDS

Long-term fix:
  - KDS runs on secondary device as standby
  - If primary KDS fails, switch to secondary in <60 seconds
```

### 23.5.3 Database (D1) Failure

```
D1 Unavailable:
  1. Read operations: KV cache serves menu data (read-only mode)
  2. Write operations: Orders queued in Cloudflare Queues (persistent)
  3. When D1 recovers: Process backlog from queue
  4. Customer experience: QR ordering still works (read menu from KV, queue order)
  5. Staff: KDS may show "queue mode" status (no historical data)
  6. Recovery target: <5 min D1 restore from R2 backup

Note: D1 has 99.95% SLA in production. Real-world failure is extremely rare.
```

---

## 23.6 Agentic Architecture Summary

| Dimension | Assessment | Mo ta (VN) |
|-----------|-----------|------------|
| **Autonomy level** | Level 3 (Conditional Automation — orders flow end-to-end with zero staff touch) | Cap do 3: Tu dong hoa co dieu kien. Don hang tu dong chay tu QR den Loyalty. |
| **Fallback depth** | Multiple: offline mode, PWA KDS, queue buffer, manual override | Nhieu phuong an du phong cho tung su co. |
| **Event-driven** | Yes. Cloudflare Queues decouples all agents. No direct point-to-point calls. | Kien truc event-driven. Cac agent giao tiep qua event bus. |
| **Real-time** | KDS + POS use SSE/WebSocket for live updates | KDS + POS cap nhat thoi gian thuc qua SSE/WebSocket. |
| **Resilience** | No single point of failure. Each agent can operate independently. | Khong co diem loi duy nhat. Moi agent co the chay doc lap. |
| **Observability** | Centralized event log + audit trail + real-time dashboard | Log su kien trung tam + audit trail + dashboard thoi gian thuc. |

---

## Implementation Priority

```
| Section | Action | Timeline | Impact | Effort | Owner |
|---------|--------|----------|--------|--------|-------|
| 19 (OKR) | Set Q3 OKRs, communicate to team, set up tracking dashboard | Week 1 | HIGH | LOW | Owner |
| 20 (Governance) | Implement cash controls, set up procurement process, verify compliance checklist | Week 1-2 | HIGH | MEDIUM | Owner + Manager |
| 20 (Tax/legal) | Register tax, get PCCC approval, sign staff contracts | Pre-launch | CRITICAL | LOW | Owner |
| 21 (ESG) | Source eco-friendly packaging, set up waste segregation, launch community programs | Week 2-3 | MEDIUM | MEDIUM | Manager |
| 22 (Crisis) | Procure PCCC equipment, print procedures, train staff on fire + food safety | Pre-launch | CRITICAL | MEDIUM | Owner + Manager |
| 22 (Data) | Configure backup, review security controls, test incident response | Week 1 | HIGH | MEDIUM | Dev |
| 23 (Agentic) | Finalize event bus, test end-to-end order trace, document fallback procedures | Week 2 | HIGH | MEDIUM | Dev + Manager |
```

---

## Open Questions (Cho y kien founder)

1. **OKR stretch targets**: Month 1 target of 1,500 orders vs unit economics break-even of 2,500. Should Q3 target be 2,500 (break-even) or 3,000 (aggressive)? The difference affects staffing spend.

2. **Staff training budget**: 5% of net profit for staff training is proposed. Is this committed even if net profit is negative in Month 1?

3. **Local sourcing premium**: Local ingredients may cost 5-15% more than Saigon wholesale. Is the sustainability premium acceptable, or should we prioritize margin?

4. **Offline mode complexity**: Full offline mode (paper + cash) requires training on manual reconciliation. Is the owner comfortable with manual processes as backup, or invest in a secondary internet line?

5. **Data breach DPO**: Owner as DPO is simplest for launch. Should we engage a part-time data protection consultant quarterly for compliance reviews?

6. **Alcohol license**: Evening cocktail sales require separate alcohol license (bier/ruou tai cho). Estimated timeline: 2-4 weeks. Should evening sales be deferred if license is delayed, or launch with soft drinks only?

7. **Event bus vs direct calls**: Current implementation uses Cloudflare Queues. If Queue usage costs exceed $20/month, should we fall back to direct D1 writes + WebSocket broadcast? This reduces resilience but lowers cost.

---

**Status:** DONE
**Summary:** Complete operations and governance report for AURA CAFE covering Q3 2026 OKRs (3 company-level, 4 functional: 17 KRs), financial governance (cash controls, procurement, fraud prevention, tax compliance), ESG framework (environmental initiatives, community programs, governance charter), crisis management protocols (fire safety with PCCC equipment + evacuation plan, HACCP-based food safety system, data breach response aligned with Decree 13/2023), and the agentic architecture (event-driven autonomous loop: QR->Order Agent->Payment Agent->KDS Agent->POS Agent->Loyalty Agent->Inventory Agent, with full fallback modes and end-to-end order trace example covering complete 4:45 cycle from scan to loyalty credit).
