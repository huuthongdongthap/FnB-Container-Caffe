---
title: "Pha 4: Khach Hang Dau Tien — First Client Deployment"
status: pending
priority: P1
tags: [deployment, pilot, validation, client, dogfood]
hours: 5-8
---

# Phase 4: First Client Deployment -- Khach Hang Dau Tien

**Date:** 2026-07-03
**Status:** Planned
**Prerequisite:** Phase 1 (branding isolation), Phase 2 (aura-deploy CLI), Phase 3 (documentation + support process) must be complete. The CLI tool must be tested in dry-run mode. Client docs must be ready for handover.

---

## 4.1 Find First Client -- Strategy / Tim Khach Hang Dau Tien (1h)

**Files tao moi:**
- `docs/productization/client-prospecting.md` -- Prospecting script + outreach templates

**Tieu chi khach hang muc tieu / Target client profile:**
- Independent F&B business in Vietnam (cafe, container cafe, tea house, juice bar) / Quan an, qua ca phe doc lap
- Currently using paper/manual ordering OR a generic POS they dislike / Dang dung giay to hoac may POS cu
- Has at least 10-15 seats (QR ordering provides clear value) / Co it nhat 10-15 ban
- Owner is tech-curious but not technical / Chu quan ham cong nghe nhung khong phai chuyen gia IT
- Located within accessible distance for on-site setup (HCMC preferred) / Gan khu vuc co the den onsite

**Mau tin nhan Zalo / Outreach script (Vietnamese):**

> "Anh/chi oi, em ben ben AURA CAFE, ben minh dang mo thu nghiem he thong goi mon bang QR code cho cac quan ca phe. Chi can 1 ma QR tren ban, khach tu goi mon bang dien thoai, khong can app, khong can POS dat tien. Ben minh dang tim 1-2 quan de dung thu mien phi trong thang dau. Anh/chi co quan tam khong a?"

**Kenh tim kiem / Identification channels:**
- Google Maps search for container cafes / indie cafes in HCMC
- Facebook groups (cafe owner communities) / Hoi nhom chu quan
- Zalo groups (F&B networking)
- Walk-in visits to nearby cafes / Di tham truc tiep cac quan gan do

**Acceptance Criteria / Tieu Chi Chap Nhan:**
- Target: Contact 10-15 cafes, aim for 1-2 serious conversations, close 1
- Target: Lien he 10-15 quan, dat 1-2 cuoc noi chuyen, chot 1 quan
- Decision criteria for first client / Tieu chi chon khach hang dau tien:
  - Willing to let us use their cafe for real deployment / Dong y cho trien khai that
  - Has stable internet (WiFi for QR ordering) / Co WiFi on dinh
  - Accepts digital payments (or willing to set up PayOS) / Chap nhan thanh toan dien tu
  - Understands this is a pilot -- may have rough edges / Hieu day la phien ban thu

**Implementation Steps:**
1. Write the client profile with specific examples of ideal cafes
2. Draft cold outreach messages for Zalo and Facebook (Vietnamese)
3. Create a simple tracking sheet (Google Sheets or markdown table) for prospects
4. Prepare the pricing conversation script (15-30M setup, 2-5M/month support)

**Rui ro / Risks:** Low effort, high uncertainty. Mitigation: Start outreach early in Phase 3 so conversations are warm by Phase 4.

---

## 4.2 Dogfood Deployment -- Real Cafe / Trien Khai Thuc Te (3h)

**Files tao moi:**
- `logs/deployments/first-client-deployment-log.md` -- Timestamped deployment log (nhat ky trien khai)
- `deployments/{client-slug}/` -- Generated deployment files (from Phase 2 CLI)

**Acceptance Criteria / Tieu Chi Chap Nhan:**
- Select a real non-AURA cafe (not AURA CAFE itself) for deployment / Chon mot quan ca phe that (khong phai AURA CAFE)
- Run the full `aura-deploy init` workflow with the cafe's actual info:
  - Cafe name, brand colors, logo / Ten quan, mau sac thuong hieu, logo
  - Admin email and password / Email va mat khau quan tri
  - Domain (auraspace.cafe subdomain or custom)
  - PayOS account credentials / Tai khoan PayOS
- Complete deployment to Cloudflare (Worker + D1 + Pages)
- Verify deployment output: URLs are live, admin login works
- Seed initial data: categories and menu items based on the cafe's actual menu
- Customize brand tokens to match cafe's visual identity
- Print QR codes for each table (at least 5-10) / In ma QR cho moi ban
- Deploy time: Under 2 hours from start to functional / Duoi 2 tieng tu khi bat dau
- Document any deviations from the expected flow in the deployment log
- Screenshots taken at each stage for documentation updates

**Cac buoc thuc hien / On-site checklist:**
1. Coordinate with cafe owner: schedule a 2-hour block when they are least busy / Hen lich 2 tieng luc quan vang
2. Prepare on-site: laptop, QR code printer (or print ahead), measurement tape for QR placement / Chuan bi may tinh, may in ma QR, thuoc do
3. Run `aura-deploy init` with cafe owner present to collect info / Chay CLI cung chu quan
4. Wait for Cloudflare deployment to complete (2-5 min)
5. Log in as admin and verify: dashboard loads, menu editor works
6. Input 10-15 actual menu items from the cafe's current menu / Nhap 10-15 mon tu thuc don that
7. Test QR ordering flow: scan QR code from a phone, place a test order / Kiem tra: quet QR, dat mon thu
8. Test KDS: verify order appears on the kitchen screen
9. Test payment: process a test transaction (if PayOS is set up)
10. Place QR codes on tables and train staff (5 min walkthrough) / Dat ma QR va huong dan nhan vien
11. Write deployment log with timestamps, issues, resolutions

**Rui ro / Risks:**
- **Medium**: Cafe's internet may be unreliable. Mitigation: Test WiFi speed on arrival; have 4G hotspot backup.
- **Medium**: PayOS setup may have issues. Mitigation: Test PayOS sandbox first; have manual backup payment process.
- **Low**: Cafe may change their mind mid-setup. Mitigation: Keep setup fast; have clear communication.
- **Low**: Cloudflare deploy fails due to account limits. Mitigation: Use the operator's CF account if client's has issues.

---

## 4.3 Validate All Features / Xac Nhan Tat Ca Tinh Nang (1.5h)

**Files tao moi:**
- `logs/deployments/first-client-validation-checklist.md` -- Validation checklist with pass/fail

**Acceptance Criteria / Tieu Chi Chap Nhan:**

Systematic validation of all 30+ features in the new deployment:

**Khach hang / Customer-facing:**
- [ ] Home page loads with cafe branding (logo, colors, name) / Trang chu hien thi dung thuong hieu
- [ ] Menu displays with correct categories and items / Thuc don hien thi dung danh muc va mon
- [ ] QR code scanning opens correct table menu / Quet QR mo dung menu ban
- [ ] Add items to cart works / Them mon vao gio hoat dong
- [ ] Cart modification (quantity change, remove) works / Chinh sua gio hoat dong
- [ ] Checkout flow works / Thanh toan hoat dong
- [ ] PayOS payment redirect works (if configured) / Chuyen huong thanh toan hoat dong
- [ ] Order confirmation screen displays / Man hinh xac nhan don hang hien thi
- [ ] Multiple languages toggle works (VN/EN) / Chuyen doi ngon ngu hoat dong

**Quan tri / Admin panel:**
- [ ] Admin login with configured credentials / Dang nhap voi tai khoan da tao
- [ ] Dashboard shows accurate metrics / Dashboard hien thi thong tin dung
- [ ] Menu CRUD (add/edit/delete categories and items) / Them/sua/xoa thuc don
- [ ] Order management (view, mark ready, complete) / Quan ly don hang
- [ ] KDS displays incoming orders in real time / KDS hien thi don hang thoi gian that
- [ ] Customer list populates after orders / Danh sach khach hang cap nhat
- [ ] Loyalty configuration (tiers, points) / Cau hinh khach hang than thiet
- [ ] Report generation (sales, popular items) / Tao bao cao
- [ ] QR code management (generate, reprint) / Quan ly ma QR
- [ ] Payment history / Lich su thanh toan
- [ ] Settings (cafe info, tax, hours) / Cai dat

**Van hanh / Operations:**
- [ ] Staff can log in / Nhan vien dang nhap duoc
- [ ] Order flow: customer -> QR -> admin -> KDS -> complete / Luong don hang day du
- [ ] Receipt/order printing (if configured) / In hoa don
- [ ] Notification/broadcast works / Thong bao hoat dong

Each feature tested and marked pass/fail. Fails documented with actual vs expected behavior.

**Kiem tra toan dien / End-to-end flows:**
1. Happy path: scan QR -> browse -> order -> pay -> KDS -> serve -> complete
2. Edge case: empty cart -> add -> remove -> add -> order -> cancel

**Implementation Steps:**
1. Create the validation checklist as a markdown document
2. Walk through each feature systematically on the live deployment
3. Test from both customer and admin perspectives
4. Document any issues immediately with screenshots
5. For each failing feature, determine: is this a branding isolation bug, a new deployment issue, or a pre-existing AURA bug?

**Rui ro / Risks:** Low. Features already have 1184 tests. Main risk is branding isolation breaking something. Mitigation: Phase 1 tests catch this; on-site validation is the safety net.

---

## 4.4 Document Issues and Fixes / Tai Lieu Van De Va Sua Chua (1h)

**Files tao moi:**
- `docs/productization/deployment-lessons-learned.md` -- Lessons learned from first deployment
- `plans/260703-2104-productization/phase-04-fixes.md` -- Fix plan for identified issues

**Acceptance Criteria / Tieu Chi Chap Nhan:**

Full retrospective document with sections:

1. **Tom tat trien khai / Deployment summary**: Cafe name, date, total time, who was involved
2. **Nhung gi tot / What went well**: Smooth aspects of the process
3. **Nhung gi chua tot / What went wrong**: Issues encountered, severity, root cause
4. **Cai tien CLI / CLI improvements**: Changes needed to aura-deploy based on real usage
5. **Thieu hut tai lieu / Doc gaps**: What was missing or unclear in Phase 3 docs
6. **Phan hoi khach hang / Client feedback**: Direct quotes or paraphrased feedback from the cafe owner
7. **Thieu hut tinh nang / Feature gaps**: Features the client asked for that don't exist yet
8. **Phan hoi gia / Pricing feedback**: Client's reaction to pricing model

For each issue, document: title, root cause, fix applied (or pending), recurrence prevention.
Prioritized fix plan with effort estimates.

**Implementation Steps:**
1. Immediately after deployment, write the deployment summary while details are fresh
2. Review all validation failures from 4.3 and categorize them
3. Interview the cafe owner (5 min): "What was confusing? What would you change?" / "Co gi kho hieu? Muon thay doi gi khong?"
4. Review the Phase 3 docs against the real experience and note gaps
5. Produce the fix plan with prioritized issues

**Rui ro / Risks:** Low. Time-boxed to 1h; don't over-document.

---

## 4.5 Client Handover Checklist / Danh Sach Ban Giao (1h)

**Files tao moi:**
- `docs/productization/client-handover-checklist.md` -- Standardized handover template (mau ban giao chuan)
- `docs/productization/handover-log-first-client.md` -- Completed handover for the first client

**Acceptance Criteria / Tieu Chi Chap Nhan:**

**Truoc khi ban giao / Before handover:**
- [ ] Deployment complete and live (URL verified) / Trien khai hoan tat
- [ ] All 30+ features validated (from 4.3 checklist) / Tat ca tinh nang da kiem tra
- [ ] Branding verified (logo, colors, name across all pages) / Thuong hieu da dung
- [ ] Menu fully populated with actual items and prices / Thuc don da nhap day du
- [ ] QR codes printed and placed on tables / Ma QR da in va dat tren ban
- [ ] PayOS payment integration tested (sandbox or live) / Thanh toan da kiem tra
- [ ] Admin credentials documented (password reset recommended) / Tai khoan da ghi lai
- [ ] Staff accounts created (if applicable) / Tai khoan nhan vien da tao
- [ ] Backup menu (printed) available in case system goes down / Thuc don in du phong

**Buoi ban giao / Handover session:**
- [ ] Schedule 30-minute training with cafe owner + 1-2 staff / Lich tap huan 30 phut
- [ ] Walk through admin panel (dashboard, menu editor, orders) / Huong dan quan tri
- [ ] Show staff how the KDS works / Huong dan nhan vien dung KDS
- [ ] Demonstrate a full order flow / Trinh dien luong don hang hoan chinh
- [ ] Show how to handle problems (network down, wrong order, refund) / Huong din xu ly su co
- [ ] Give the setup guide and admin manual (printed + digital) / Dua tai lieu in va dien tu
- [ ] Save Zalo support number in their phone / Luu so dien thoai ho tro Zalo
- [ ] Explain SLA and escalation path / Giai thich SLA va quy trinh leo thang
- [ ] Collect feedback (what's unclear, what's missing) / Thu thap phan hoi

**Sau ban giao / After handover:**
- [ ] Send handover confirmation email with all URLs, credentials, and docs / Gui email xac nhan
- [ ] Add client to support system (Zalo contact list) / Them khach hang vao danh sach ho tro
- [ ] Set a 3-day follow-up check-in / Hen kiem tra sau 3 ngay
- [ ] Set a 2-week follow-up review / Hen danh gia sau 2 tuan
- [ ] Invoice for setup fee (if applicable) / Xuat hoa don phi thiet lap

**Implementation Steps:**
1. Write the reusable handover checklist template (bilingual)
2. Complete it for the first client during the handover session
3. Print (or have ready) the setup guide and admin manual for the cafe owner
4. Conduct the 30-min training session
5. Send the confirmation email/post-handover summary
6. Schedule the follow-up check-ins

**Rui ro / Risks:** Low. The checklist is a template; each client reuse reduces risk.

---

## Total Hours / Tong Gio

| Task / Cong Viec | Hours / Gio |
|------|-------|
| 4.1 Find first client / Tim khach hang dau tien | 1.0 |
| 4.2 Dogfood deployment / Trien khai thuc te | 3.0 |
| 4.3 Validate all features / Xac nhan tinh nang | 1.5 |
| 4.4 Document issues and fixes / Tai lieu van de | 1.0 |
| 4.5 Client handover checklist / Danh sach ban giao | 1.0 |
| Buffer follow-up / Du phong | 0.5 |
| **Total / Tong cong** | **8.0** |

---

## File Inventory / Danh Sach File

```
docs/productization/
  client-prospecting.md                 # Target profile, outreach templates (VN)
  client-handover-checklist.md          # Standardized handover checklist template (VN+EN)
  handover-log-first-client.md          # Completed handover for first client
  deployment-lessons-learned.md         # Lessons learned from first deployment
logs/deployments/
  first-client-deployment-log.md        # Timestamped deployment record
  first-client-validation-checklist.md  # Pass/fail for every feature
plans/260703-2104-productization/
  phase-04-fixes.md                     # Prioritized fix plan from issues found
deployments/{client-slug}/
  (generated by Phase 2 CLI)
```

## Dependencies / Phu Thuoc

- Phase 1 complete (branding isolation) -- hard prerequisite
- Phase 2 complete (aura-deploy CLI) -- hard prerequisite
- Phase 3 complete (docs + support process) -- needed for handover
- A valid Cloudflare account (operator's or client's)
- PayOS merchant account for the client (or operator-assisted setup)
- QR code printer or print shop access
- 4G hotspot as backup internet

## Quality Gates / Tieu Chuan Chat Luong

- [ ] First client deployment is a real cafe (not AURA CAFE itself)
- [ ] All 30+ features validated and documented
- [ ] Deployment log captures all timestamps, issues, and resolutions
- [ ] Client handover checklist completed and signed off
- [ ] Lessons learned document produced and shared with the team
- [ ] Fix plan produced with prioritized issues for immediate execution
- [ ] Cafe owner can independently place a test order after training / Chu quan tu dat mon duoc sau tap huan
- [ ] No regression introduced to AURA CAFE (original instance still works) / Khong anh huong den AURA CAFE

## Rollback Notes / Ghi Chu Khoi Phuc

- If deployment fails catastrophically, the cafe's operations are unaffected (they use their existing system) / Neu that bai, quan van dung he thong cu
- Cloudflare deployment can be deleted: `wrangler delete --name {slug}`
- D1 database can be deleted via Cloudflare Dashboard
- No changes to the AURA CAFE production instance / Khong thay doi AURA CAFE
- Client handover is reversible: remove QR codes, revert to previous system
- The first client is a pilot -- offer a free first month to lower their risk / Khach hang dau tien la pilot -- mien phi thang dau
