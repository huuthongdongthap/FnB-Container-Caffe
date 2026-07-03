# Deployment Checklist / Danh Sach Trieu Khai

> **AURA CAFE** -- White-label deployment checklist for new client instances.
> Danh sach kiem tra khi trien khai client moi.

---

## Section A: Pre-Deployment / Truoc Khi Trieu Khai

Checklist of client info and prerequisites needed before deployment starts.
Danh sach thong tin va dieu kien can co truoc khi bat dau trien khai.

| # | Item / Muc | Status | Notes / Ghi Chu |
|---|---|---|---|
| 1 | **Client cafe name confirmed** / Ten quan da xac nhan | [ ] | Exact name for subdomain, branding |
| 2 | **Client logo received (SVG/PNG)** / Logo nhan duoc | [ ] | Prefer SVG; min 512x512 for PNG |
| 3 | **Brand colors confirmed** / Mau sac thuong hieu da xac nhan | [ ] | Hex codes or brand image reference |
| 4 | **Admin email received** / Email admin nhan duoc | [ ] | Used for first admin account |
| 5 | **Menu items/categories list received** / Danh sach mon/nhom mon nhan duoc | [ ] | Name, price, category, optional photo |
| 6 | **Client has Cloudflare account** / Khach hang co tai khoan Cloudflare | [ ] | Or use `*.auraspace.cafe` subdomain |
| 7 | **Client has PayOS account** / Khach hang co tai khoan PayOS | [ ] | For payment processing |
| 8 | **Client's WiFi is stable** / WiFi khach hang on dinh | [ ] | Needed for QR demo and handover |
| 9 | **QR codes template ready** / Mau QR code san sang | [ ] | Table-number mapping confirmed |

> **Note:** If any item is missing, pause deployment and request from client via Zalo/email.
> **Luu y:** Neu thieu muc nao, tam dung va yeu cau khach hang gui qua Zalo/email.

---

## Section B: Deployment Steps / Cac Buoc Trieu Khai

Execute these steps in order during the deployment session.
Thuc hien theo thu tu trong phien trien khai.

### Phase 1: Initialize / Khoi Tao

- [ ] **Run `aura-deploy init` with client info** / Chay init voi thong tin khach hang
  - Command: `aura-deploy init --name "<cafe-name>" --domain "<subdomain>" --logo "<path>" --colors "<hex>" --email "<admin-email>"`
  - Verify no errors in output
- [ ] **Verify `brand.json` generated correctly** / Kiem tra brand.json
  - Path: `config/brand.json` or equivalent
  - Check: all fields populated, colors valid hex, logo path exists
- [ ] **Check generated assets** / Kiem tra assets da tao
  - Favicon, OG image, app icons present
  - Manifest file has correct cafe name

### Phase 2: Deploy Infrastructure / Trieu Khai Ha Tang

- [ ] **Deploy worker to Cloudflare** / Trieu khai worker len Cloudflare
  - Run: `npm run deploy:worker` or equivalent
  - Verify: `curl -s https://<subdomain>.auraspace.cafe/api/health` returns 200
- [ ] **Deploy frontend to Cloudflare Pages** / Trieu khai frontend len Cloudflare Pages
  - Run: `npm run deploy:pages` or equivalent
  - Verify: pages.dev URL loads with correct branding
- [ ] **Configure custom domain** / Cau hinh domain rieng (if client has one)
  - Add CNAME record in client's DNS
  - Configure Cloudflare Pages custom domain
  - Wait for SSL provisioning
- [ ] **Set up SSL certificate** / Thiet lap SSL
  - Cloudflare auto-provisions (check status)
  - Verify: browser padlock shows secure
- [ ] **Verify DNS propagation** / Kiem tra DNS
  - Use `dig <domain>` to confirm A/AAAA records
  - Check both `auraspace.cafe` subdomain and custom domain (if any)
  - Test in incognito browser window

### Phase 3: Configure Client / Cau Hinh Khach Hang

- [ ] **Create admin account** / Tao tai khoan admin
  - Open admin URL, register with client-provided email
  - Set strong initial password (generate + send securely)
  - Verify login works
- [ ] **Add initial menu items** / Them mon vao menu
  - Import or manually add categories + items from client's list
  - Verify prices, names, images display correctly
  - Test on mobile viewport
- [ ] **Add staff accounts** / Tao tai khoan nhan vien (if needed)
  - Create per-staff accounts with limited permissions
  - Share login instructions with client
- [ ] **Configure PayOS API keys** / Cau hinh PayOS
  - Navigate to Settings > Payment > PayOS
  - Enter client's PayOS API key, secret, and checksum key
  - Save and verify connection status shows "Connected"

### Phase 4: Test End-to-End / Kiem Tra Tu Dau Den Cuoi

- [ ] **Test payment flow** / Kiem tra luong thanh toan
  - Create a test order via admin panel
  - Complete payment via PayOS (use test card)
  - Verify order status updates after payment
  - Check receipt/invoice generated
- [ ] **Test QR ordering end-to-end** / Kiem tra QR ordering
  - Scan a table QR code with mobile phone
  - Browse menu, add item to cart
  - Place order (simulate customer flow)
  - Verify order appears on KDS (Kitchen Display System)
  - Mark order as completed
  - Verify payment reflects in reports
- [ ] **Print and place QR codes on tables** / In va dan QR tren ban
  - Generate QR codes per table from admin
  - Export as printable PDF
  - Print on sticker paper or cardstock
  - Place on tables (visible, clean surface)

> **Validation gate:** If any test fails, stop deployment and fix before proceeding.
> **Cong kiem tra:** Neu bat ky kiem tra nao that bai, tam dung va sua truoc khi tiep tuc.

---

## Section C: Handover Checklist / Danh Sach Ban Giao

Deliverables and walkthrough to complete after deployment.
Cac mon ban giao va huong dan sau khi trien khai.

### Phase 5: Handover / Ban Giao

- [ ] **Send admin URLs and credentials** / Gui URL va thong tin dang nhap
  - Admin URL: `https://<cafe-domain>/admin`
  - Customer menu URL: `https://<cafe-domain>/menu`
  - Username/email + temporary password
  - **Via secure channel** (Zalo or encrypted email)
- [ ] **Walk through `admin-manual.md` with client** / Huong dan client doc admin-manual
  - Go through each section: dashboard, menu, orders, QR codes, settings
  - Let client try each action themselves
  - Answer questions as they arise
- [ ] **Show staff how to use KDS** / Huong dan nhan vien su dung KDS
  - Open KDS on tablet/phone
  - Place a test order, show it appearing on KDS
  - Show how to mark order: received -> preparing -> done -> served
  - Practice with staff member
- [ ] **Show staff how to process payments** / Huong dan nhan vien xu ly thanh toan
  - Walk through payment flow on admin panel
  - Show manual payment (cash) recording
  - Show PayOS QR payment processing
  - Practice with a real scan
- [ ] **Confirm client can create and manage orders** / Xac nhan client co the tao va quan ly don
  - Client creates an order independently
  - Client modifies order (add/remove items)
  - Client marks order complete
  - Client views daily report
- [ ] **Provide support contact (Zalo)** / Cung cap thong tin lien he ho tro
  - Share Zalo QR code or phone number
  - Explain support hours and SLA
  - Add client to support channel
- [ ] **Schedule first follow-up** / Lich theo doi lan dau
  - Schedule for **3 days after deployment** / Sau 3 ngay
  - Set calendar reminder
  - Purpose: check if everything running smoothly
- [ ] **Collect feedback and log issues** / Thu thap phan hoi va ghi nhan van de
  - Ask: "Is everything working as expected?" / "Moi thu hoat dong nhu mong doi?"
  - Note any issues in client file
  - Assign resolution if needed
  - Get verbal confirmation of satisfaction

---

## Section D: Post-Deployment Follow-Up / Theo Doi Sau Trieu Khai

| Milestone / Moc | Time / Thoi Gian | Action / Hanh Dong |
|---|---|---|
| **First check-in** / Kiem tra lan 1 | Day 3 / Ngay 3 | Call/Zalo: verify system running, any issues |
| **Second check-in** / Kiem tra lan 2 | Day 7 / Ngay 7 | Check order volume, payment success rate |
| **Monthly review** / Danh gia hang thang | Day 30 / Ngay 30 | Review usage, suggest optimizations |
| **Quarterly business review** / Danh gia quy | Day 90 / Ngay 90 | Full performance review, feature updates |

---

## Quick Reference / Tham Chieu Nhanh

### Common deployment values / Gia tri trien khai thuong gap

| Parameter / Tham So | Default / Mac Dinh | Notes / Ghi Chu |
|---|---|---|
| Subdomain | `{cafe-slug}.auraspace.cafe` | Lowercase, no spaces |
| Admin path | `/admin` | |
| Customer menu path | `/menu` | |
| KDS path | `/kds` | Kitchen Display System |
| API health endpoint | `/api/health` | Returns 200 when worker is alive |
| Default support hours | 07:00 -- 22:00 daily | Vietnam time (GMT+7) |

### Tools needed during deployment / Cong cu can trong trien khai

- Browser with DevTools (Chrome preferred)
- Smartphone with camera (for QR testing)
- Zalo installed on phone
- `dig` or DNS checker tool
- Sticker printer or print shop access for QR codes

---

*Document version: 1.0 | Last updated: 2026-07-03*
*Tai lieu phien ban 1.0 | Cap nhat lan cuoi: 03-07-2026*
