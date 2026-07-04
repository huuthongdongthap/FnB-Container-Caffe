# AURA CAFE — Gap Report & Roadmap 90-Ngay

> **Phan tich:** BizPlan OS
> **Du an:** AURA CAFE — Container Caffe & Space
> **Dia diem:** 39 Nguyen Tat Thanh, Sa Dec, Dong Thap
> **Stage:** PMF → Early Scale (khach hang tra tien, 30+ features, deployed)
> **Ngay:** 2026-07-05
> **Report path:** `/Users/macbook/FnB-Container-Caffe/plans/260705-0105-aura-cafe-ideation/reports/gap-report.md`

---

## 1. Current State (Thuc Trang)

### 1.1 He Thong Da Co

| Lop | Trang thai | Chi tiet |
|------|-------------|---------|
| **Frontend** | SAN SANG | Vite + React 19 + TypeScript + Tailwind CSS, deployed tren Cloudflare Pages |
| **Backend** | SAN SANG | Hono + Cloudflare Workers + D1 (SQLite), 50+ API routes |
| **Auth** | SAN SANG | JWT (better-auth), phan quyen Owner/Manager/Staff |
| **Thanh toan** | SAN SANG | PayOS QR + COD, split bill, webhook |
| **Domain** | **CHUA DUNG** | `auraspace.cafe` DNS tro ve Cloudflare (A: 104.21.59.83, 172.67.219.86) nhung chua duoc cau hinh custom domain tren Pages |
| **Design System** | CO BAN | DESIGN.md + brand-tokens.css (Bazi v5.1) — Dark Navy + Chrome/Bac + Bronze |
| **Stitch Designs** | 5 screens | Home, Menu, Mobile App, Admin Dashboard, KDS |
| **30+ Features** | DEPLOYED | Customer (20) + Admin (22) + Infrastructure (10) |

### 1.2 So Lieu Hien Tai

| Metric | Gia tri |
|--------|---------|
| Unit tests | 1.063 |
| E2E tests | 129 |
| Stitch React components | ~28 TSX components |
| Admin pages (functional) | 23 (components trong `src/pages/admin/` + `src/components/admin/`) |
| Customer pages | ~20 pages |
| API routes | 50+ |
| Database tables (D1) | 24+ |
| Hinh thuc thanh toan | PayOS QR, COD (MoMo chua active) |
| ERPNext | BYOK — da tich hop |

---

## 2. Gap Analysis (Khoang Cach)

### 2.1 Stitch Design Coverage (28 screens thieu design)

#### Customer Pages Can Design (10 screens)

| # | Page | Route | Trang thai | Uu tien |
|---|------|-------|-----------|---------|
| 1 | Order Failure | `/order-failure` | ❌ No Stitch design | Medium |
| 2 | Promotions | `/promotions` | ❌ No Stitch design | Medium |
| 3 | Check-in | `/checkin` | ❌ No Stitch design | High |
| 4 | Contact | `/contact` | ❌ No Stitch design | Low |
| 5 | Loyalty Calculator | `/loyalty-calculator` | ❌ No Stitch design | Medium |
| 6 | Track Order | `/track-order` | ❌ No Stitch design | High |
| 7 | Table Reservation | `/table-reservation` | ❌ No Stitch design | High |
| 8 | TV Menu | `/tv-menu` | ❌ No Stitch design | Low |
| 9 | Subscriptions | `/subscriptions` | ❌ No Stitch design | Medium |
| 10 | Brand Guideline | `/brand` | ❌ No Stitch design | Low |

#### Admin Pages Can Design (18 screens)

| # | Page | Route | Trang thai | Uu tien |
|---|------|-------|-----------|---------|
| 1 | Dashboard | `/admin` | ❌ No Stitch design | **CRITICAL** |
| 2 | Staff Manager | `/admin/staff` | ❌ No Stitch design | High |
| 3 | Customers | `/admin/customers` | ❌ No Stitch design | High |
| 4 | Menu Manager | `/admin/manage-menu` | ❌ No Stitch design | High |
| 5 | Promotions Manager | `/admin/promotions` | ❌ No Stitch design | Medium |
| 6 | Subscriptions | `/admin/subscriptions` | ❌ No Stitch design | Medium |
| 7 | Sales Reports | `/admin/sales-reports` | ❌ No Stitch design | Medium |
| 8 | Broadcast | `/admin/broadcasts` | ❌ No Stitch design | Medium |
| 9 | Campaigns | `/admin/campaigns` | ❌ No Stitch design | Medium |
| 10 | Chat Inbox | `/admin/chat` | ❌ No Stitch design | High |
| 11 | Check-in Approve | `/admin/checkin-approve` | ❌ No Stitch design | High |
| 12 | Birthday Config | `/admin/birthday-config` | ❌ No Stitch design | Low |
| 13 | ERPNext Sync | `/admin/erpnext-sync` | ❌ No Stitch design | Medium |
| 14 | Invoice History | `/admin/invoice-history` | ❌ No Stitch design | Low |
| 15 | QR Generator | `/admin/generate-qr` | ❌ No Stitch design | Low |
| 16 | Metrics | `/admin/metrics` | ❌ No Stitch design | Medium |
| 17 | Reservations | `/admin/reservations` | ❌ No Stitch design | High |
| 18 | Audit Logs | `/admin/audit-logs` | ❌ No Stitch design | Low |

**Tong gap Stitch:** 28 screens thieu design (10 customer + 18 admin)

### 2.2 Infrastructure Gaps

| # | Gap | Trang thai | Severity |
|---|-----|-----------|----------|
| 1 | **Custom domain auraspace.cafe** chua cau hinh dung tren Cloudflare Pages | DNS A records ton tai nhung chua lien ket Pages | **HIGH** |
| 2 | **Admin directory** rong (`admin/`) — khong tim thay file nao | Can xac dinh la admin duoc serve qua Vite SPA | Low |
| 3 | **MoMo payment** chua active — chi co PayOS + COD | Medium |
| 4 | **PWA manifest** — can kiem tra full support | Unknown |
| 5 | **i18n** — can kiem tra trang thai bilingual (Vie/Eng) | Unknown |
| 6 | **SEO** — da co meta tags, Open Graph, JSON-LD, can verify | Medium |
| 7 | **Daily backup** — Cloudflare D1 backup can configured | Medium |

### 2.3 Feature Gaps (Tinh Nang Thieu/Can Cai Thien)

| # | Feature | Mo ta | Uu tien |
|---|---------|-------|---------|
| 1 | **Staff Mobile App** | Nhan vien can app di dong de nhan don, cap nhat trang thai | High |
| 2 | **Inventory Management** | Quan ly ton kho nguyen lieu, canh bao sap het | High |
| 3 | **MoMo / Bank Transfer** | Them phuong thuc thanh toan pho bien | High |
| 4 | **Customer Feedback System** | Feedback sau don hang, NPS score | Medium |
| 5 | **Email Marketing** | Tu dong email marketing campaigns | Medium |
| 6 | **Social Media Integration** | Post tu dong len Facebook, Instagram | Medium |
| 7 | **Multi-branch Support** | Ho tro nhieu chi nhanh (neu mo rong) | Long-term |
| 8 | **Staff Scheduling** | Lich lam viec, xin nghi, doi ca | Medium |
| 9 | **Auto Reminder** | Nhan tin tu dong nhac khach quay lai | Medium |
| 10 | **Heatmap Analytics** | Ban do nhiet do ban ghe, gio cao diem vat ly | Low |

### 2.4 Quality & Testing Gaps

| # | Gap | Trang thai |
|---|-----|-----------|
| 1 | Stitch components coverage tests | Chua co test cho ~28 Stitch components |
| 2 | E2E tests cho admin pages | Con thieu coverage |
| 3 | Load testing | Chua co benchmark cho 100+ concurrent users |
| 4 | Security audit | Chua co STRIDE/FULL audit |
| 5 | Accessibility (a11y) audit | WCAG AA chua verified cho admin pages |
| 6 | Responsive testing mobile | Can verify mobile-first cho admin pages |

---

## 3. Roadmap 90 Ngay (Uu Tien Hoa)

### Giai doan 1: Foundation Fix (Ngay 1-14)

**Muc tieu:** Lap day infrastructure gaps, fix domain, design spec thong nhat.

| Task | Effort | Nguoi lam | Phu thuoc |
|------|--------|-----------|-----------|
| **P0: Fix custom domain** — Cau hinh auraspace.cafe tren Cloudflare Pages custom domain | 2h | Dev | None |
| **P0: Stitch Design Spec** — Tao UI Design Spec JSON cho toan bo 28 screens | 4h | Designer | None |
| **P1: Admin Dashboard Stitch** — Thiet ke Dashboard (Stitch generate) | 3h | Designer | Spec |
| **P1: Admin Login Stitch** — Thiet ke login page | 2h | Designer | Spec |
| **Generate Stitch Admin Login** da co, can update design system + chuyen doi | 2h | Dev | Spec |
| **Verify PWA support** | 1h | Dev | None |
| **Verify i18n coverage** | 1h | Dev | None |

**Deliverables:**
- auraspace.cafe hoat dong chinh thuc
- UI Design Spec JSON hoan chinh
- Admin Dashboard + Admin Login Stitch design hoan tat

---

### Giai doan 2: Customer Pages War (Ngay 15-35)

**Muc tieu:** Generate Stitch design + convert React components cho 10 customer pages.

| # | Page | Stitch Design | React Conversion | Testing |
|---|------|--------------|-----------------|---------|
| 1 | Track Order | Ngay 15-16 | Ngay 17-18 | Ngay 19 |
| 2 | Table Reservation | Ngay 17-18 | Ngay 19-20 | Ngay 21 |
| 3 | Check-in | Ngay 19-20 | Ngay 21-22 | Ngay 22 |
| 4 | Order Failure | Ngay 21-22 | Ngay 22-23 | Ngay 23 |
| 5 | Promotions | Ngay 22-23 | Ngay 23-24 | Ngay 24 |
| 6 | Loyalty Calculator | Ngay 23-24 | Ngay 24-25 | Ngay 25 |
| 7 | Subscriptions | Ngay 24-25 | Ngay 25-26 | Ngay 26 |
| 8 | Contact | Ngay 25 | Ngay 25-26 | Ngay 26 |
| 9 | TV Menu | Ngay 26 | Ngay 26-27 | Ngay 27 |
| 10 | Brand Guideline | Ngay 27 | Ngay 27-28 | Ngay 28 |

> **Phuong phap:** Chay Stitch MCP (`stitch-mcp-generate-screen-from-text`) + `stitch-react-components` cho moi page.
> **Batch song song:** Toi da 2 page cung luc.

**Deliverables:**
- 10 Stitch design + React components moi
- 100% test coverage cho customer pages
- Responsive verified

---

### Giai doan 3: Admin Pages Overhaul (Ngay 36-65)

**Muc tieu:** Generate Stitch design + convert React components cho 18 admin pages.

| # | Page | Stitch Design | React Conversion | Testing |
|---|------|--------------|-----------------|---------|
| 1 | Staff Manager | Ngay 36-37 | Ngay 38-39 | Ngay 39 |
| 2 | Customers | Ngay 37-38 | Ngay 39-40 | Ngay 40 |
| 3 | Menu Manager | Ngay 38-39 | Ngay 40-41 | Ngay 41 |
| 4 | Chat Inbox | Ngay 39-40 | Ngay 41-42 | Ngay 42 |
| 5 | Check-in Approve | Ngay 40-41 | Ngay 42-43 | Ngay 43 |
| 6 | Reservations | Ngay 41-42 | Ngay 43-44 | Ngay 44 |
| 7 | Promotions | Ngay 42-43 | Ngay 44-45 | Ngay 45 |
| 8 | Subscriptions | Ngay 43-44 | Ngay 45-46 | Ngay 46 |
| 9 | Broadcast | Ngay 44-45 | Ngay 46-47 | Ngay 47 |
| 10 | Campaigns | Ngay 45-46 | Ngay 47-48 | Ngay 48 |
| 11 | Sales Reports | Ngay 46-47 | Ngay 48-49 | Ngay 49 |
| 12 | Metrics | Ngay 47-48 | Ngay 49-50 | Ngay 50 |
| 13 | ERPNext Sync | Ngay 48-49 | Ngay 50-51 | Ngay 51 |
| 14 | Birthday Config | Ngay 49 | Ngay 51 | Ngay 52 |
| 15 | Invoice History | Ngay 49 | Ngay 51-52 | Ngay 52 |
| 16 | QR Generator | Ngay 50 | Ngay 52 | Ngay 52 |
| 17 | Audit Logs | Ngay 50 | Ngay 52 | Ngay 53 |
| 18 | Dashboard | Ngay 51-52 | Ngay 53-54 | Ngay 55 |

**Deliverables:**
- 18 admin Stitch design + React components
- Admin panel UI consistent voi customer pages
- Full responsive admin

---

### Giai doan 4: Feature Enhancements (Ngay 66-80)

**Muc tieu:** Bo sung tinh nang con thieu, cai thien UX.

| # | Feature | Effort | Uu tien |
|---|---------|--------|---------|
| 1 | **MoMo/Bank Transfer payment** | 3 days | High |
| 2 | **Inventory Management** (add to admin) | 5 days | High |
| 3 | **Customer Feedback System** + NPS | 3 days | Medium |
| 4 | **Staff Scheduling** | 3 days | Medium |
| 5 | **Staff Mobile App** (PWA-based) | 5 days | High |
| 6 | **Auto Reminder** (SMS/Zalo) | 2 days | Medium |

---

### Giai doan 5: Quality & Hardening (Ngay 81-90)

**Muc tieu:** Kiem tra chat luong, security, performance.

| # | Task | Effort |
|---|------|--------|
| 1 | **Full E2E test suite** cho all pages | 3 days |
| 2 | **Load test** (k6) — 100+ concurrent users | 2 days |
| 3 | **Security audit** (STRIDE-based) | 2 days |
| 4 | **Accessibility audit** (WCAG AA) | 1 day |
| 5 | **SEO re-verify** + Google Search Console | 1 day |
| 6 | **Performance optimization** (Lighthouse 90+) | 2 days |
| 7 | **Final verification** (build + test + deploy) | 1 day |

---

## 4. Resource Estimates

### Staffing

| Role | Full-time | Part-time |
|------|-----------|-----------|
| **Stitch Designer** (UI generation + prompt engineering) | 1 (Ngay 1-65) | — |
| **React/TypeScript Developer** (component conversion) | 1 (Ngay 1-65) | — |
| **Backend Developer** (feature enhancements) | — | 1 (Ngay 66-80) |
| **QA Engineer** (testing + verification) | 1 (Ngay 1-90) | — |

### Budget (Estimate)

| Item | Estimated cost |
|------|---------------|
| Stitch MCP usage (28 screens generation + iterations) | ~$30-60 |
| Cloudflare Workers (already on free tier) | $0 |
| Dev time (80h design + 80h dev + 40h qa = 200h) | Internal |
| Domain auraspace.cafe renewal (nam) | ~$15 |
| Third-party APIs (PayOS, SpeedSMS, Resend) | Theo usage |

---

## 5. Risks & Mitigation

| Risk | Xac suat | Tac dong | Giai phap |
|------|----------|----------|-----------|
| Stitch generation quality khong dong nhat | Medium | High | Iterate variants, edit screens cho den khi dep |
| Admin pages phuc tap kho generate Stitch | Medium | Medium | Tao wireframe truoc, generate tung phan |
| Custom domain delay do DNS propagation | Low | Medium | Set up truoc, cho 24-48h, dung pages.dev tam |
| Stitch component khong match existing layout | Medium | Medium | Edit screens hoac custom CSS override |
| Test suite chay cham | Low | Low | Chay parallel, chi regression cho critical paths |

---

## 6. Success Criteria

Den ngay 90, can dat:

| Criterion | Target | Measure |
|-----------|--------|---------|
| **Stitch design coverage** | 28/28 screens | So luong design da generate |
| **React component conversion** | 28/28 screens | Component files tao moi |
| **Custom domain** | auraspace.cafe active | HTTPS 200 OK + SHA match |
| **Test coverage** | 100% pass | `npm test` + `npm run build` |
| **Payment options** | 3 methods | PayOS + COD + MoMo |
| **Staff tools** | Mobile KDS + scheduling | Feature shipped |
| **Lighthouse score** | 90+ (all categories) | Chrome Lighthouse |

---

## 7. Appendices

### A. Current Stitch Component Inventory

Components da convert (28 files trong `src/components/stitch/`):

```
StitchAbout.tsx            StitchEventsNew2.tsx      StitchMenuNew.tsx        StitchReferralNew1.tsx
StitchAccountDashNew.tsx   StitchFooter.tsx          StitchMobileOrderNew.tsx  StitchReferralNew2.tsx
StitchAccountNew.tsx        StitchHeader.tsx          StitchOrderMgmtNew.tsx    StitchReviewsNew.tsx
StitchAdminLoginNew.tsx     StitchHeroNew.tsx         StitchOrderSuccessNew.tsx  StitchStoryNew.tsx
StitchAdminTerminalNew.tsx  StitchKDSNew.tsx          StitchPOSNew.tsx
StitchAppLayout.tsx         StitchLandingNew.tsx      StitchMenu2New.tsx
StitchCheckoutNew.tsx       StitchLoyaltyNew.tsx      StitchContainerNew1.tsx
StitchEventsNew1.tsx        StitchContainerNew2.tsx
```

### B. Stitch Export Directories (da co design raw)

```
stitch-exports/about/          stitch-exports/home/           stitch-exports/menu/
stitch-exports/account/        stitch-exports/kds/            stitch-exports/menu-v2/
stitch-exports/admin/          stitch-exports/landing-v2/     stitch-exports/mobile/
stitch-exports/admin-login/    stitch-exports/loyalty/        stitch-exports/mobile-v2/
stitch-exports/admin-orders/   stitch-exports/order-success/  stitch-exports/referral/
stitch-exports/admin-pos/      stitch-exports/checkout/       stitch-exports/reviews/
stitch-exports/admin-v2/       stitch-exports/events/         stitch-exports/landing/
stitch-exports/stitch_aura_cafe/  (50+ concept designs)
```

### C. Key Files

| File | Path |
|------|------|
| CEO Handover | `/Users/macbook/FnB-Container-Caffe/CEO-HANDOVER.md` |
| Design System Master | `/Users/macbook/FnB-Container-Caffe/design-system/MASTER.md` |
| DESIGN.md (tokens) | `/Users/macbook/FnB-Container-Caffe/DESIGN.md` |
| PROJECT.md (milestones) | `/Users/macbook/FnB-Container-Caffe/PROJECT.md` |
| Stitch TO-DO | `/Users/macbook/FnB-Container-Caffe/plans/260704-2227-stitch-screens-to-design-TO-DO.md` |
| Deployment Guide | `/Users/macbook/FnB-Container-Caffe/docs/deployment-guide.md` |
| README | `/Users/macbook/FnB-Container-Caffe/README.md` |
| Stitch React components | `/Users/macbook/FnB-Container-Caffe/src/components/stitch/` |
| Admin page components | `/Users/macbook/FnB-Container-Caffe/src/pages/admin/` |
| Stitch exports | `/Users/macbook/FnB-Container-Caffe/stitch-exports/` |

---

*Generated by BizPlan OS — Gap Report & Roadmap for AURA CAFE*
*Next review: Ngay 14 (2026-07-19) — sau giai doan 1*
