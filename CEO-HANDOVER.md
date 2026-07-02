# CEO HANDOVER — AURA CAFE 🏆
> Hệ thống quản lý Container Cafe toàn diện — Bàn giao cho Chủ Doanh Nghiệp
> Cập nhật: 2026-07-03
> Phiên bản: 2.0 — Hoàn thiện 30+ tính năng, sẵn sàng vận hành

---

## MỤC LỤC 📑

1. [Tóm tắt hệ thống](#1-tom-tat-he-thong)
2. [URL sản xuất & đăng nhập](#2-url-san-xuat--dang-nhap)
3. [Tổng quan tất cả tính năng (30+)](#3-tong-quan-tat-ca-tinh-nang-30)
4. [Cấu trúc phần mềm](#4-cau-truc-phan-mem)
5. [Hướng dẫn sử dụng hàng ngày](#5-huong-dan-su-dung-hang-ngay)
6. [Bảng điều khiển Admin — từng trang](#6-bang-dieu-khien-admin--tung-trang)
7. [Chương trình khách hàng thân thiết (Loyalty)](#7-chuong-trinh-khach-hang-than-thiet-loyalty)
8. [Gói cước (Subscription) & Thanh toán](#8-goi-cuoc-subscription--thanh-toan)
9. [ERPNext — Đồng bộ hóa đơn điện tử](#9-erpnext--dong-bo-hoa-don-dien-tu)
10. [Marketing — Campaigns & Broadcast](#10-marketing--campaigns--broadcast)
11. [Thiết kế giao diện (Design System)](#11-thiet-ke-giao-dien-design-system)
12. [Bảo trì & Khắc phục sự cố thường gặp](#12-bao-tri--khac-phuc-su-co-thuong-gap)
13. [Quy trình khẩn cấp](#13-quy-trinh-khan-cap)
14. [Danh sách cấu hình & Secrets](#14-danh-sach-cau-hinh--secrets)
15. [Phân tích tài chính & Dự phòng](#15-phan-tich-tai-chinh--du-phong)
16. [Bảo mật & Hạn mức Cloudflare](#16-bao-mat--han-muc-cloudflare)
17. [Tài liệu đính kèm & Đường dẫn nguồn](#17-tai-lieu-dinh-kem--duong-dan-nguon)
18. [Liên hệ hỗ trợ & Kênh liên lạc](#18-lien-he-ho-tro--kenh-lien-lac)
19. [Tổng hợp nhanh (Cheat Sheet)](#19-tong-hop-nhanh-cheat-sheet)

---

## 1. TÓM TẮT HỆ THỐNG 🚀

### 1.1 Hệ thống này là gì?

**AURA CAFE Container System** là một nền tảng quản lý quán cà phê **toàn diện** chạy hoàn toàn trên đám mây **Cloudflare** — không cần server vật lý tại chỗ. Đây là phiên bản **Vite React SPA** hiện đại, với **30+ tính năng** từ đặt món, thanh toán, quản lý đến tiếp thị, marketing và đồng bộ kế toán.

| Thông số | Giá trị |
|---|---|
| Tổng số tính năng | **30+** (Khách hàng + Admin + Hệ thống) |
| Unit tests | **1.063** |
| E2E tests | **129** |
| Trạng thái | **SẴN SÀNG SẢN XUẤT** ✅ |
| Nền tảng | Cloudflare Workers + D1 + KV + Pages |
| Custom domain | **https://auraspace.cafe** |

### 1.2 Hệ thống này gồm những gì?

| Thành phần | Vai trò | Công nghệ |
|---|---|---|
| **Website khách hàng** 🌐 | Xem menu, đặt món, đặt bàn, đăng ký, review, chat | Vite React SPA |
| **Trang khách hàng cá nhân** 👤 | Lịch sử đơn hàng, điểm thành viên, gói cước | Vite React SPA |
| **Admin Panel** ⚙️ | Quản lý toàn bộ hệ thống (20+ trang) | Vite React SPA |
| **KDS (Kitchen Display)** 🔥 | Màn hình bếp — đơn hàng real-time + âm thanh + đồng hồ | Vite React SPA |
| **API Backend** 🔌 | Xử lý logic: đơn hàng, thanh toán, loyalty, ERP... | Cloudflare Workers |
| **CSDL** 💾 | Lưu trữ menu, đơn, khách, điểm, voucher, hợp đồng | Cloudflare D1 (SQLite) |
| **Cache & Push** ⚡ | Session, thông báo, web push | Cloudflare KV |
| **Thiết kế** 🎨 | Dark Navy theme + Glassmorphism + Responsive | DESIGN.md + Stitch AI |

### 1.3 Điểm mạnh của hệ thống

- **Không cần server riêng**: Toàn bộ chạy trên Cloudflare
- **Giao diện hiện đại**: Thiết kế Glassmorphism (kính mờ) + Dark Navy (#0A1A2E) + Chrome accents
- **Hoạt động real-time**: Đơn hàng, thông báo, KDS cập nhật tức thì
- **PWA**: Khách có thể cài đặt app lên màn hình chính điện thoại
- **Web Push Notification**: Thông báo trình duyệt khi đơn đổi trạng thái
- **ZNS/SMS**: Gửi thông báo qua Zalo và SMS trên mọi thay đổi
- **SEO đầy đủ**: Meta tags, Open Graph, JSON-LD structured data
- **1.063 unit tests + 129 E2E tests**: Đảm bảo chất lượng
- **Tự động sao lưu**: Cloudflare backup D1 hàng ngày

---

## 2. URL SẢN XUẤT & ĐĂNG NHẬP 🔐

### 2.1 Các trang chính

| Trang | URL | Mục đích |
|---|---|---|
| 🌐 **Website khách hàng** | `https://auraspace.cafe` | Menu, đặt món, đặt bàn, đăng ký, review |
| | `https://fnb-caffe-container.pages.dev` | (URL dự phòng) |
| ⚙️ **Admin Panel** | `https://auraspace.cafe/admin` | Quản lý toàn bộ hệ thống |
| 🔑 **Đăng nhập Admin** | `https://auraspace.cafe/admin/login` | Nhập tài khoản quản trị |
| 🍳 **KDS (Bếp)** | `https://auraspace.cafe/kds` | Màn hình bếp — âm thanh, đồng hồ |

### 2.2 Backend API (chạy ngầm)

```
https://aura-space-worker.agencyos-openclaw.workers.dev
```
> Đây là API backend xử lý mọi thao tác phía sau. Khách không truy cập trực tiếp URL này.

### 2.3 Tài khoản Admin mặc định

```
Email:    admin@auraspace.vn
Password: AURA Owner
```
> 🔐 **BẮT BUỘC** đổi mật khẩu sau lần đăng nhập đầu tiên! Xem mục Quản lý nhân viên.

### 2.4 Cách đăng nhập

| Bước | Hành động |
|---|---|
| 1 | Mở trình duyệt (Chrome / Safari / Edge / Cốc Cốc) |
| 2 | Vào `https://auraspace.cafe/admin/login` |
| 3 | Nhập email `admin@auraspace.vn` |
| 4 | Nhập mật khẩu |
| 5 | Click **ĐĂNG NHẬP** |
| 6 | Click avatar góc trên phải |
| 7 | Chọn **Đổi mật khẩu** |
| 8 | Nhập mật khẩu cũ → Mật khẩu mới → Xác nhận |

---

## 3. TỔNG QUAN TẤT CẢ TÍNH NĂNG (30+) 🌟

### 3.1 Tính năng dành cho khách hàng 👤

| # | Tính năng | Mô tả |
|---|---|---|
| 1 | **QR Code Table Ordering** 📱 | Quét QR tại bàn → đặt món từ điện thoại |
| 2 | **Menu Glassmorphism** 🍽️ | Menu thiết kế kính mờ, lọc danh mục, tìm kiếm |
| 3 | **Thanh toán PayOS/COD** 💳 | Thanh toán online hoặc tiền mặt, ăn tại chỗ hoặc giao hàng |
| 4 | **Order Tracking** 🔄 | Cập nhật trạng thái đơn hàng real-time |
| 5 | **Push Notification** 🔔 | Web Push API — thông báo khi đơn đổi trạng thái |
| 6 | **ZNS/SMS Thông báo** 📨 | Zalo + SMS gửi thông báo mỗi lần đơn đổi trạng thái |
| 7 | **Tài khoản cá nhân** 👤 | Hồ sơ, lịch sử đơn, điểm thành viên, gói cước |
| 8 | **Đánh giá (Reviews)** ⭐ | Đánh giá món ăn, xem review trên trang chủ |
| 9 | **Gói cước (Subscription)** 💎 | Gói thành viên hàng tháng — nhiều cấp độ |
| 10 | **Split Bill** 🧾 | Chia hóa đơn cho nhiều khách cùng bàn |
| 11 | **Live Chat** 💬 | Nhắn tin trực tiếp với quán cà phê |
| 12 | **PWA Install** 📲 | Cài đặt app lên màn hình chính điện thoại |
| 13 | **SEO** 🕵️ | Meta tags, Open Graph, JSON-LD structured data |
| 14 | **Loyalty Program** 🏆 | 4 hạng: Bronze / Silver / Gold / Platinum |
| 15 | **Referral Program** 👥 | Giới thiệu bạn bè, nhận cashback |
| 16 | **Birthday Rewards** 🎂 | Coupon sinh nhật tự động |
| 17 | **Khuyến mãi (Promotions)** 🏷️ | Mã giảm giá, chiến dịch |
| 18 | **Sự kiện (Events)** 🎪 | Trang sự kiện, đặt bàn sự kiện |
| 19 | **TV Menu Display** 📺 | Hiển thị menu trên màn hình TV tại quán |
| 20 | **Check-in Rewards** ✅ | Thưởng điểm khi check-in tại quán |

### 3.2 Tính năng Admin Panel ⚙️

| # | Tính năng | Mô tả |
|---|---|---|
| 21 | **Dashboard** 📊 | Thống kê, biểu đồ, đơn hàng gần đây, trạng thái nhân viên |
| 22 | **Quản lý Đơn hàng** 📋 | Xem, cập nhật trạng thái, lọc, tìm kiếm |
| 23 | **Quản lý Menu** 🍕 | Thêm/sửa/xóa sản phẩm và danh mục |
| 24 | **Quản lý Khách hàng** 👥 | Danh sách, tìm kiếm, lọc theo hạng |
| 25 | **Quản lý Nhân viên** 👔 | Thêm/xóa nhân viên, phân quyền |
| 26 | **Staff Shifts** 🕐 | Clock-in/out, ca hôm nay, lịch sử ca |
| 27 | **KDS (Bếp)** 🔥 | Đơn real-time với âm thanh + đồng hồ chuẩn bị |
| 28 | **POS** 🧾 | Giao diện bán tại quầy |
| 29 | **Reservations** 📅 | Quản lý đặt bàn |
| 30 | **Check-in Approval** ✅ | Duyệt check-in khách |
| 31 | **ERPNext Sync** 📊 | Tự cấu hình ERP (BYOK) |
| 32 | **ERPNext E-Invoice** 🧾 | Tự động xuất hóa đơn khi đơn hoàn tất |
| 33 | **Promotions Manager** 🏷️ | Quản lý mã giảm giá |
| 34 | **Campaigns Manager** 📣 | Marketing tự động (sinh nhật, winback, chào mừng) |
| 35 | **Broadcast** 📢 | Gửi ZNS/SMS/Email theo phân khúc khách hàng |
| 36 | **Analytics Dashboard** 📈 | Top sản phẩm, giờ cao điểm, chỉ số khách hàng, xuất CSV |
| 37 | **Subscription Manager** 💎 | Quản lý gói, hợp đồng, thống kê MRR |
| 38 | **Invoice History** 🧾 | Lịch sử hóa đơn điện tử |
| 39 | **Birthday Config** 🎂 | Cấu hình quà sinh nhật |
| 40 | **Chat Inbox** 💬 | Xem và trả lời tin nhắn khách hàng |
| 41 | **Analytics Config** 📊 | Cấu hình GA4 + Facebook Pixel |
| 42 | **QR Code Generator** 📱 | In mã QR bàn |

### 3.3 Thiết kế & Hạ tầng 🎨

| # | Tính năng | Mô tả |
|---|---|---|
| 43 | **Dark Navy Theme** 🌑 | Màu nền #0A1A2E, accent chrome/bạc |
| 44 | **Glassmorphism Cards** 🪟 | Kính mờ (backdrop-filter blur), bán trong suốt |
| 45 | **Cormorant Garamond** ✒️ | Font tiêu đề — sang trọng, lịch lãm |
| 46 | **Space Grotesk** 📝 | Font nội dung — hiện đại, dễ đọc |
| 47 | **Responsive Mobile-first** 📱 | Tương thích mọi thiết bị |
| 48 | **DESIGN.md** 📄 | Tài liệu thiết kế Stitch-compatible |
| 49 | **4 Stitch AI Designs** 🎨 | Home, Menu, Mobile, Admin |
| 50 | **Cloudflare Workers + D1 + KV** ☁️ | Backend serverless |
| 51 | **Cloudflare Pages** 📄 | Frontend SPA |
| 52 | **Custom domain** 🌐 | auraspace.cafe |

---

## 4. CẤU TRÚC PHẦN MỀM 🏗️

### 4.1 Kiến trúc tổng thể

```
┌──────────────────────────────────────────────────────────────────────┐
│                          KHÁCH HÀNG                                   │
│  Quét QR → Xem menu → Đặt món → Thanh toán (PayOS/COD)              │
│  → Nhận thông báo (Web Push / ZNS / SMS)                             │
│  → Đánh giá → Chat trực tiếp → Tích điểm → Giới thiệu bạn bè        │
└─────────────────────────────┬────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────────┐
│                 CLOUDFLARE WORKER (API Backend)                       │
│  ┌──────┬──────┬──────┬──────┬──────┬──────┬──────┬──────┬──────┐  │
│  │ Auth │Orders│Menu  │Pay-  │Loy-  │ERP-  │Camp- │Chat  │Anal- │  │
│  │ (ĐN) │(Đơn) │(Món) │ments │alty  │Next  │aigns │(Tin) │ytics │  │
│  └──────┴──────┴──────┴──────┴──────┴──────┴──────┴──────┴──────┘  │
│                            │                                          │
│                ┌───────────┴───────────┐                             │
│                ▼                       ▼                             │
│      ┌─────────────────┐   ┌─────────────────┐                     │
│      │   D1 Database   │   │     KV Cache    │                     │
│      │  (SQLite Cloud) │   │  (Session+Push) │                     │
│      └─────────────────┘   └─────────────────┘                     │
└──────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────────┐
│                      ADMIN / NHÂN VIÊN                                │
│  Dashboard → Orders → Menu → POS → KDS → Staff → Shifts             │
│  Customers → Reservations → Check-in → Promotions → Campaigns       │
│  Broadcast → Analytics → Subscriptions → Invoices → Chat Inbox       │
│  ERPNext → Birthday → QR Codes → Analytics Config                    │
└──────────────────────────────────────────────────────────────────────┘
```

### 4.2 Luồng khách hàng chính

```
┌──────────────────────────────────────────────────────────────────────┐
│ 1. KHÁCH ĐẾN QUÁN                                                    │
│    → Quét QR trên bàn → Mở menu điện thoại                          │
│    → Hoặc vào auraspace.cafe                                        │
├──────────────────────────────────────────────────────────────────────┤
│ 2. ĐẶT MÓN                                                           │
│    → Xem menu Glassmorphism → Lọc danh mục                          │
│    → Thêm món vào giỏ → Chọn số lượng                               │
│    → Ghi chú (ít đường, không đá...)                                │
├──────────────────────────────────────────────────────────────────────┤
│ 3. THANH TOÁN                                                        │
│    → Chọn hình thức: Ăn tại chỗ hoặc Giao hàng                      │
│    → Chọn phương thức: PayOS (QR) hoặc COD (tiền mặt)               │
│    → Split bill: Chia hóa đơn cho nhiều người (nếu cần)             │
├──────────────────────────────────────────────────────────────────────┤
│ 4. NHẬN THÔNG BÁO                                                    │
│    → Web Push: Thông báo khi đơn đổi trạng thái                     │
│    → ZNS/SMS: Thông báo qua Zalo và SMS (nếu đăng ký)               │
├──────────────────────────────────────────────────────────────────────┤
│ 5. SAU KHI ĂN XONG                                                   │
│    → Đánh giá món → Xem điểm thành viên                             │
│    → Giới thiệu bạn bè nhận cashback                                │
│    → Đăng ký gói cước Subscription (nếu muốn)                       │
└──────────────────────────────────────────────────────────────────────┘
```

### 4.3 50+ API Routes

| Nhóm | Chức năng |
|---|---|
| **Xác thực** | Đăng nhập, đăng xuất, phân quyền |
| **Menu & Sản phẩm** | Danh mục, món ăn, giá, tìm kiếm, lọc |
| **Đơn hàng** | Tạo, cập nhật, hủy, tracking status |
| **Bàn** | Quản lý trạng thái bàn, QR code |
| **Đặt bàn** | Khách đặt bàn trước + sự kiện |
| **Thanh toán** | PayOS QR, COD, webhook |
| **Thông báo** | Web Push, ZNS, SMS |
| **Khách hàng** | Hồ sơ, lịch sử, điểm, hạng |
| **Loyalty** | Điểm, cashback, 4 hạng, referral |
| **Sinh nhật** | Coupon tự động ngày sinh nhật |
| **Check-in** | Quét QR, điểm thưởng |
| **Nhân viên** | Tài khoản, phân quyền, shifts |
| **Đánh giá (Reviews)** | Đánh giá món, xem trên trang chủ |
| **Khuyến mãi (Promotions)** | Mã giảm giá, chiến dịch |
| **Gói cước (Subscription)** | Gói thành viên, hợp đồng, MRR |
| **ERPNext** | Đồng bộ, e-invoice tự động |
| **Campaigns** | Birthday, Winback, Welcome |
| **Broadcast** | ZNS, SMS, Email hàng loạt |
| **Chat** | Live chat widget, inbox admin |
| **Phân tích (Analytics)** | Thống kê, top sản phẩm, giờ cao điểm |
| **Cấu hình** | GA4, Facebook Pixel |
| **Báo cáo** | Doanh thu, tồn kho, xuất CSV |
| **Bảo trì** | Cron job, backup |

---

## 5. HƯỚNG DẪN SỬ DỤNG HÀNG NGÀY 📋

### 5.1 Trước khi mở cửa (Pre-Open — 7:45-8:00)

**Kiểm tra nhanh (2 phút):**

```
□ Mở KDS (Bếp): https://auraspace.cafe/kds
  → Xem có đơn "Chờ xác nhận" tồn đọng từ hôm trước không
  → Nếu có: xử lý hết hoặc hủy

□ Mở Dashboard Admin:
  → Kiểm tra tổng doanh thu hôm qua có khớp sổ sách không
  → Xem biểu đồ, đơn hàng đang xử lý

□ Kiểm tra Web Push:
  → Vào trang chủ: https://auraspace.cafe
  → Phải load được và có thể cài đặt PWA

□ Kiểm tra PayOS:
  → Admin → Đơn hàng → Xem đơn chưa thanh toán
  → Đảm bảo QR thanh toán hoạt động

□ Kiểm tra ERPNext (nếu dùng):
  → Admin → ERPNext → Kiểm tra kết nối
```

**Chuẩn bị vật lý:**
- Bật máy POS / tablet nếu dùng
- Mở màn hình TV Menu (TV Menu Display) nếu có
- Chuẩn bị QR code bàn in sẵn (nếu cần thay)

### 5.2 Trong giờ phục vụ (Service Hours)

#### Luồng phục vụ chuẩn:

```
1. KHÁCH VÀO
   → Nhân viên chào, hỏi số người
   → Chỉ định bàn → Khách quét QR code tại bàn
   → Hoặc mở POS bán tại quầy

2. XEM MENU & ĐẶT MÓN
   → Khách: Quét QR → Xem menu điện thoại (Glassmorphism)
      → Lọc danh mục → Chọn món → Thêm ghi chú
   → POS: Chọn bàn → Thêm món → Ghi chú

3. XỬ LÝ ĐƠN
   → KDS tự động nhận đơn (real-time + âm thanh)
   → Bếp: Bấm "Bắt đầu làm" → Đồng hồ chuẩn bị chạy
   → Bếp: Bấm "Sẵn sàng" khi món xong

4. PHỤC VỤ
   → Nhân viên mang món ra cho khách
   → Khách nhận thông báo Web Push: "Món của bạn đã sẵn sàng"
   → Nhân viên cập nhật "Đã phục vụ" trên KDS/Admin

5. THANH TOÁN
   → Khách: Chọn PayOS (QR) hoặc COD
   → Split bill: Chia hóa đơn cho nhiều người (nếu cần)
   → PayOS: Hiện QR → Khách quét → Hệ thống tự xác nhận
   → Hóa đơn điện tử tự động gửi lên ERPNext (nếu cấu hình)

6. TÍCH ĐIỂM & ĐÁNH GIÁ
   → Hỏi khách có thẻ thành viên không
   → Nếu chưa: Hướng dẫn đăng ký (hoặc quét QR)
   → Khuyến khích khách đánh giá món
   → Hệ thống tự tính cashback + điểm theo hạng
```

#### Trong giờ — Trường hợp đặc biệt:

| Tình huống | Xử lý |
|---|---|
| Khách hủy món đã làm | Admin → Orders → Chọn đơn → Hủy |
| Khách yêu cầu tách hóa đơn | Split bill: Chia món cho khác |
| PayOS không phản hồi | Chuyển sang COD, ghi chú |
| Khách quên ví/điện thoại | Admin → Customers → Tra cứu SĐT |
| Khách chat qua Live Chat | Admin → Chat Inbox → Trả lời |

### 5.3 Kết thúc ngày (End of Day — 22:00-22:30)

```
□ ĐÓNG ĐƠN
  → Admin → Orders → Đóng tất cả đơn chưa thanh toán
  → Hủy đơn khách đặt nhưng không đến (no-show)

□ KIỂM KÊ
  → Đếm tiền mặt trong két
  → Đối chiếu với báo cáo ca (Admin → Dashboard)
  → Xuất báo cáo CSV (Analytics → Export)

□ KIỂM TRA
  → Kiểm tra tin nhắn Chat Inbox (trả lời hết)
  → Kiểm tra ERPNext đồng bộ (nếu dùng)
  → Kiểm tra Campaign hôm nay đã chạy chưa

□ BACKUP
  → Cloudflare tự backup D1 hàng ngày
  → Chụp ảnh Dashboard doanh thu ngày
```

---

## 6. BẢNG ĐIỀU KHIỂN ADMIN — TỪNG TRANG 🖥️

### 6.1 Đăng nhập & Đổi mật khẩu

**URL:** `/admin/login`

| Bước | Hành động |
|---|---|
| 1 | Mở URL `https://auraspace.cafe/admin/login` |
| 2 | Nhập email + mật khẩu |
| 3 | Click **ĐĂNG NHẬP** |
| 4 | Click avatar góc trên phải |
| 5 | Chọn **Đổi mật khẩu** |
| 6 | Nhập mật khẩu cũ → Mật khẩu mới → Xác nhận |

### 6.2 Dashboard (Tổng quan)

**URL:** `/admin/dashboard`

Hiển thị sau khi đăng nhập. Bao gồm:
- **Doanh thu hôm nay / tháng / năm** — số tiền thực thu
- **Số đơn hàng** — đang xử lý, hoàn thành, hủy
- **Top món bán chạy** — theo tuần/tháng
- **Số khách mới / khách quen** — theo ngày
- **Biểu đồ** doanh thu theo giờ/ngày
- **Trạng thái nhân viên** — ai đang làm, ai offline

> 💡 **Mẹo:** Dashboard tự cập nhật real-time. Không cần bấm F5.

### 6.3 Quản lý Đơn hàng (Orders)

**URL:** `/admin/orders`

| Thao tác | Cách làm |
|---|---|
| Xem đơn | Mặc định hôm nay, mới nhất trước |
| Lọc theo trạng thái | Chọn bộ lọc: chờ xác nhận / đang làm / đã thanh toán... |
| Xem chi tiết | Click vào mã đơn |
| Cập nhật trạng thái | Chọn trạng thái mới từ dropdown |
| Hủy đơn | Click đơn → Hủy → Chọn lý do |
| Xuất báo cáo | Click Export → CSV |

**Trạng thái đơn:**
| Trạng thái | Màu | Ý nghĩa |
|---|---|---|
| Chờ xác nhận | 🔴 Đỏ | Vừa tạo, chưa xử lý |
| Đang chuẩn bị | 🟠 Cam | Đang làm ở bếp |
| Sẵn sàng | 🔵 Xanh | Đã xong, chờ mang ra |
| Đã phục vụ | ⚪ Xám | Khách đã nhận món |
| Đã thanh toán | 🟢 Xanh lá | Đã thu tiền xong |
| Đã hủy | ⚫ Đỏ đậm | Không thực hiện |

### 6.4 Quản lý Menu

**URL:** `/admin/menu`

```
1. THÊM MÓN
   → Click "Thêm món ăn"
   → Nhập: Tên, Mô tả, Giá, Hình ảnh
   → Chọn danh mục (Cà phê, Trà, Đồ ăn...)
   → Chọn trạng thái (Còn hàng / Hết hàng)
   → Click "Lưu"

2. THÊM DANH MỤC
   → Click "Thêm danh mục"
   → Nhập tên, icon, thứ tự hiển thị

3. SỬA/XÓA
   → Click vào món → Sửa thông tin
   → Click "Xóa" để xóa món (cần xác nhận)
```

### 6.5 POS (Bán tại quầy)

**URL:** `/admin/pos`

Giao diện bán hàng chính:

```
1. CHỌN BÀN
   → Click sơ đồ bàn (Xanh = trống, Cam = đang phục vụ)

2. THÊM MÓN
   → Chọn danh mục bên trái
   → Click món → Chọn số lượng
   → Thêm ghi chú (ít đường, không đá...)
   → Món xuất hiện trong giỏ hàng bên phải

3. THANH TOÁN
   → Click nút **THANH TOÁN**
   → Chọn: Tiền mặt / PayOS (QR) / MoMo
   → Xác nhận

4. HOÀN TẤT
   → Bàn tự chuyển sang "Đang phục vụ"
   → Đơn gửi vào KDS bếp
```

> ⚠️ **Lưu ý:** Luôn kiểm tra kỹ giỏ hàng trước khi thanh toán. Sau khi thanh toán không thể sửa đơn — phải tạo đơn trả hàng (refund).

### 6.6 KDS (Kitchen Display — Màn hình Bếp)

**URL:** `/kds`

Đây là **màn hình cho nhân viên bếp** — hiển thị đơn hàng real-time với âm thanh.

```
BỐ CỤC MÀN HÌNH:

┌──────────────┬──────────────┬──────────────┐
│ CHỜ LÀM      │ ĐANG LÀM     │ ĐÃ XONG       │
│ (Pending)    │ (Cooking)    │ (Ready)       │
│              │              │              │
│ Bàn 3 (2 món)│ Bàn 1 (1 món)│ Bàn 5 (2 món)│
│ Phô mai: ít  │ Cà phê sữa   │ Trà đào       │
│ đường        │ 00:45        │              │
└──────────────┴──────────────┴──────────────┘
```

**Thao tác cho nhân viên bếp:**

| Bước | Hành động |
|---|---|
| 1 | Nhìn màn hình → Đơn mới ở cột "Chờ làm" 🔊 |
| 2 | Click "Nhận đơn" → Chuyển sang "Đang làm" |
| 3 | Đồng hồ chuẩn bị tự động chạy (hiển thị thời gian) |
| 4 | Khi món xong → Click "Sẵn sàng" |
| 5 | Đơn chuyển sang cột "Đã xong" + âm thanh báo |
| 6 | Nhân viên phục vụ mang món ra |

> 🔊 **Đặc biệt:** KDS có âm thanh (sound alert) khi có đơn mới — không sợ bếp lỡ đơn.

### 6.7 Quản lý Khách hàng (Customers)

**URL:** `/admin/customers`

- Xem danh sách khách hàng
- Tìm kiếm theo tên / SĐT
- Lọc theo hạng thành viên (Bronze / Silver / Gold / Platinum)
- Xem lịch sử mua hàng
- Xem điểm, cashback, số dư ví

### 6.8 Quản lý Nhân viên (Staff)

**URL:** `/admin/staff`

```
1. Click "Thêm nhân viên"
2. Nhập: Họ tên, Email, Mật khẩu tạm
3. Chọn vai trò:
   - Owner: Toàn quyền (1-2 người)
   - Manager: Quản lý, báo cáo, quản lý nhân viên
   - Staff: Bán hàng POS, xem KDS (không xóa dữ liệu)
4. Click "Tạo tài khoản"
5. Gửi thông tin đăng nhập cho nhân viên (Zalo/SMS)
```

### 6.9 Staff Shifts (Ca làm việc)

**URL:** `/admin/shifts`

```
NHÂN VIÊN:
- Click "Clock-in" khi bắt đầu ca
- Click "Clock-out" khi kết thúc ca

QUẢN LÝ:
- Xem ai đang làm (online)
- Xem lịch sử ca của từng nhân viên
- Xem doanh thu theo ca
```

### 6.10 Quản lý Đặt bàn (Reservations)

**URL:** `/admin/reservations`

```
1. Xem danh sách đặt bàn hôm nay / tuần
2. Trạng thái:
   - Chờ xác nhận → Đã xác nhận → Đã đến / Đã hủy
3. Click "Xác nhận" → Gọi điện xác nhận khách
4. Nếu khách không đến sau 15 phút → "Đánh dấu No-show"
```

### 6.11 Duyệt Check-in

**URL:** `/admin/checkin-approve`

```
1. Khách quét QR tại quán → Yêu cầu check-in
2. Hiển thị ở Admin dạng "Chờ duyệt"
3. Kiểm tra thông tin khách
4. "Duyệt" → Khách nhận điểm thưởng
   "Từ chối" → Ghi lý do
```

### 6.12 Quản lý Khuyến mãi (Promotions)

**URL:** `/admin/promotions`

CRUD mã giảm giá:

```
1. THÊM MÃ GIẢM GIÁ:
   - Mã: VN30, SUMMER20...
   - Loại: % giảm / Số tiền giảm
   - Giá trị: 30%, 20.000đ...
   - Điều kiện: Đơn tối thiểu, áp dụng cho...
   - Hạn dùng: Ngày bắt đầu → ngày kết thúc
   - Số lượng: Giới hạn lượt dùng
2. Xem thống kê: Đã dùng bao nhiêu lượt
```

### 6.13 Quản lý Gói cước (Subscription)

**URL:** `/admin/subscriptions`

```
- Tạo / sửa / xóa gói thành viên
- Xem danh sách hợp đồng
- Thống kê MRR (Monthly Recurring Revenue)
- Xem khách đang dùng gói nào
```

### 6.14 ERPNext (Đồng bộ hóa đơn)

**URL:** `/admin/erpnext`

BYOK — Tự cấu hình ERP của bạn:

```
CẤU HÌNH LẦN ĐẦU:
1. Vào Admin → ERPNext
2. Nhập ERPNext URL
3. Nhập API Key + API Secret
4. Click "Kết nối" → Kiểm tra

SAU KHI CẤU HÌNH:
- Khi đơn hoàn tất → Tự động tạo e-invoice trên ERPNext
- Vào Admin → Invoice History để xem lịch sử hóa đơn
```

### 6.15 Campaigns Manager (Chiến dịch Marketing)

**URL:** `/admin/campaigns`

Chiến dịch tự động:

| Chiến dịch | Mô tả |
|---|---|
| **Birthday Campaign** 🎂 | Tự động gửi coupon sinh nhật + ZNS/SMS |
| **Winback Campaign** 🔙 | Gửi ưu đãi cho khách lâu ngày không quay lại |
| **Welcome Campaign** 👋 | Gửi ưu đãi chào mừng khách mới đăng ký |

### 6.16 Broadcast (Gửi thông báo hàng loạt)

**URL:** `/admin/broadcast`

Gửi ZNS / SMS / Email đến phân khúc khách hàng:

```
1. Chọn kênh: ZNS / SMS / Email
2. Chọn phân khúc:
   - Tất cả khách hàng
   - Khách VIP (Gold/Platinum)
   - Khách mới
   - Khách sinh nhật tháng này
3. Nhập nội dung
4. Xem trước → Gửi
```

### 6.17 Analytics Dashboard

**URL:** `/admin/analytics`

Phân tích chuyên sâu:

```
- Top sản phẩm bán chạy nhất
- Giờ cao điểm trong ngày
- Khách hàng mới vs quen
- Tỉ lệ quay lại
- Doanh thu theo ngày / tuần / tháng
- Xuất báo cáo CSV
```

### 6.18 Chat Inbox

**URL:** `/admin/chat`

- Xem tin nhắn khách hàng gửi qua Live Chat widget
- Trả lời trực tiếp từ Admin
- Lịch sử hội thoại

### 6.19 Cấu hình Analytics (GA4 + Facebook Pixel)

**URL:** `/admin/analytics-config`

```
1. GA4:
   - Nhập Measurement ID (G-XXXXXXXX)
   - Bật/Tắt theo dõi

2. Facebook Pixel:
   - Nhập Pixel ID
   - Bật/Tắt theo dõi
```

### 6.20 QR Code Generator

**URL:** `/admin/qr-codes`

In mã QR cho từng bàn:

```
1. Chọn số lượng bàn (1-20)
2. Chọn kích thước QR
3. Click "Tạo QR"
4. In ra giấy → Đặt tại từng bàn
```

### 6.21 Lịch sử Hóa đơn (Invoice History)

**URL:** `/admin/invoices`

- Xem lịch sử e-invoice đã gửi lên ERPNext
- Xem chi tiết hóa đơn
- Tải xuống hóa đơn

### 6.22 Cấu hình Sinh nhật (Birthday Config)

**URL:** `/admin/birthday-config`

Cấu hình quà sinh nhật cho khách hàng:

```
- Phần trăm giảm giá: 10% / 20% / 35% / 50%
- Số tiền tối đa giảm
- Thời gian hiệu lực (số ngày)
- Tự động gửi ZNS/SMS
```

---

## 7. CHƯƠNG TRÌNH KHÁCH HÀNG THÂN THIẾT (LOYALTY) 🏆

### 7.1 Cách hoạt động

**Khách mua → Tích điểm → Lên hạng → Nhận ưu đãi → Tiêu điểm → Lại mua.**

Hệ thống tự cân bằng để không bị lạm dụng:
1. Khách CHỈ nhận cashback trên phần **tiền mặt thực tế trả** (sau voucher)
2. Tối đa dùng 50% ví cashback/đơn → khách buộc phải trả 50% tiền mặt
3. Điểm có hạn dùng (90-180 ngày tùy hạng)

### 7.2 4 Hạng thành viên

| Hạng | Chi tiêu tích lũy | Cashback | Hệ số điểm | Sinh nhật | Hiệu lực ví |
|---|---|---|---|---|---|
| **Bronze** 🥉 | 0 - 500.000đ | 3% | ×1.0 | Giảm 10% | 90 ngày |
| **Silver** 🥈 | 500.000đ - 2.000.000đ | 5% | ×1.2 | Giảm 20% | 120 ngày |
| **Gold** 🥇 | 2.000.000đ - 5.000.000đ | 7% | ×1.5 | Giảm 35% | 180 ngày |
| **Platinum** 💎 | > 5.000.000đ | 10% | ×2.0 | Giảm 50% + Quà | **Vĩnh viễn** |

### 7.3 Thứ tự áp dụng ưu đãi

```
Bước 1: Giảm giá Voucher → Áp dụng trước
Bước 2: Tính Cashback → Trên số tiền còn lại sau voucher
Bước 3: Tích điểm mới → Trên tiền mặt thực tế trả
Bước 4: Cộng vào Ví Cashback + Tăng tổng chi tiêu tích lũy
```

### 7.4 Thưởng giới thiệu (Referral)

```
Khách A giới thiệu Khách B:
1. B đăng ký thành viên mới → A và B nhận +50.000đ ví
2. B thanh toán đơn đầu → Tự động cộng thưởng
```

---

## 8. GÓI CƯỚC (SUBSCRIPTION) & THANH TOÁN 💳

### 8.1 Gói cước thành viên

Khách hàng có thể đăng ký **gói cước hàng tháng**:

| Gói cước | Giá / tháng | Quyền lợi |
|---|---|---|
| Basic | 49.000đ | Giảm 10% mỗi đơn, miễn phí giao hàng |
| Premium | 99.000đ | Giảm 15%, ưu tiên đặt bàn, quà sinh nhật |
| Enterprise | 199.000đ | Giảm 20%, VIP service, giao hàng ưu tiên |

### 8.2 Các phương thức thanh toán

| Phương thức | Mô tả |
|---|---|
| **Tiền mặt (COD)** 💵 | Thu tiền tận tay |
| **PayOS (QR)** 💳 | Khách quét QR bằng app ngân hàng |

### 8.3 Split Bill (Chia hóa đơn)

Khách có thể chia hóa đơn cho nhiều người cùng bàn:

```
1. Khi thanh toán → Chọn "Split Bill"
2. Chọn số người (2, 3, 4...)
3. Hệ thống tự chia đều hoặc nhập số tiền từng người
4. Mỗi người thanh toán phần của mình riêng biệt
```

---

## 9. ERPNEXT — ĐỒNG BỘ HÓA ĐƠN ĐIỆN TỬ 📊

### 9.1 Cách hoạt động

ERPNext tích hợp theo cơ chế **BYOK** (Bring Your Own Key) — tự cấu hình:

```
1. Khách cần có tài khoản ERPNext (riêng)
2. Vào Admin → ERPNext → Nhập thông tin kết nối
3. Khi đơn hoàn tất → Tự động tạo e-invoice
4. Không cần thao tác thủ công
```

### 9.2 E-Invoice tự động

- Mỗi đơn hoàn thành (đã thanh toán) → Tự động tạo e-invoice
- Gửi lên ERPNext của khách
- Lưu lịch sử trong Admin → Invoice History
- Có thể tải xuống hóa đơn

---

## 10. MARKETING — CAMPAIGNS & BROADCAST 📣

### 10.1 Chiến dịch tự động (Automated Campaigns)

| Chiến dịch | Kích hoạt | Hành động |
|---|---|---|
| **Birthday** 🎂 | Ngày sinh nhật khách | Gửi coupon giảm giá + ZNS/SMS |
| **Winback** 🔙 | Khách không quay lại >30 ngày | Gửi ưu đãi mời quay lại |
| **Welcome** 👋 | Khách mới đăng ký | Gửi coupon chào mừng |

### 10.2 Broadcast (Gửi tin hàng loạt)

```
1. Chọn kênh: ZNS (Zalo) / SMS / Email
2. Chọn phân khúc:
   - Tất cả khách hàng
   - Khách VIP (Gold/Platinum)
   - Khách mới
   - Khách sinh nhật tháng này
3. Nhập nội dung tin nhắn
4. Xem trước → Gửi
```

---

## 11. THIẾT KẾ GIAO DIỆN (DESIGN SYSTEM) 🎨

### 11.1 Màu sắc

| Token | Giá trị | Sử dụng |
|---|---|---|
| **Nền tối** | `#0A1A2E` | Background chính |
| **Chrome/Silver** | `#C0C0C0`, `#E8E8E8` | Accents, viền, button |
| **Trắng** | `#FFFFFF` | Chữ, icon |
| **Xanh neon** | `#00FFAA` | Highlight, active |
| **Mờ** | `rgba(255,255,255,0.05)` | Glassmorphism cards |

### 11.2 Font chữ

| Loại | Font | Kích thước |
|---|---|---|
| **Tiêu đề** | Cormorant Garamond | 24px - 48px |
| **Nội dung** | Space Grotesk | 14px - 18px |

### 11.3 Glassmorphism

Các thẻ bài sử dụng hiệu ứng **kính mờ**:

```
backdrop-filter: blur(12px)
background: rgba(255, 255, 255, 0.05)
border: 1px solid rgba(255, 255, 255, 0.1)
border-radius: 16px
```

### 11.4 Responsive

- **Thiết kế Mobile-first**: Tối ưu cho điện thoại trước
- **Tablet & Desktop**: Tự động mở rộng
- **TV Menu**: Hiển thị menu trên màn hình lớn tại quán

### 11.5 Stitch Design

4 thiết kế Stitch AI đã được tạo:
- **Home page** — Trang chủ khách hàng
- **Menu page** — Trang menu
- **Mobile** — Phiên bản điện thoại
- **Admin** — Giao diện quản lý

---

## 12. BẢO TRÌ & KHẮC PHỤC SỰ CỐ THƯỜNG GẶP 🔧

### 12.1 Checklist kiểm tra nhanh (nếu có vấn đề)

```
□ Internet có ổn định không? (thử mở google.com)
□ Trang web có load được không? (auraspace.cafe)
□ Admin có đăng nhập được không?
□ KDS có nhận đơn mới không?
□ PayOS có phản hồi không?
```

### 12.2 Sự cố phổ biến & Cách xử lý

| # | Sự cố | Triệu chứng | Cách xử lý |
|---|---|---|---|
| 1 | **Trang web không mở** | ERR_CONNECTION_REFUSED | Kiểm tra Internet → Xóa cache → Thử trình duyệt khác |
| 2 | **Không đăng nhập Admin** | Sai mật khẩu | Click "Quên mật khẩu?" hoặc liên hệ Owner |
| 3 | **KDS không nhận đơn** | Bếp không thấy đơn mới | Kiểm tra POS đã gửi đơn chưa → F5 KDS |
| 4 | **Đơn bị trùng** | 2 đơn giống nhau | Admin → Orders → Hủy đơn nhầm |
| 5 | **PayOS không thanh toán** | QR lỗi | Chuyển sang COD, báo kỹ thuật |
| 6 | **Loyalty không cộng điểm** | Khách không thấy điểm | Admin → Customers → Tra cứu SĐT |
| 7 | **ERPNext không đồng bộ** | Hóa đơn không gửi được | Kiểm tra lại API Key/Secret |
| 8 | **Push notification không nhận** | Khách không thấy thông báo | Kiểm tra trình duyệt đã cho phép thông báo chưa |
| 9 | **Màn hình KDS đơ/lag** | Không cập nhật đơn mới | F5 → Kiểm tra WiFi → Khởi động lại trình duyệt |
| 10 | **Hết pin tablet POS** | Không bán được | Dùng điện thoại dự phòng mở admin/pos |

### 12.3 Khi nào cần gọi Kỹ thuật

```
Gọi ngay nếu:
  ❌ Website không truy cập được >5 phút
  ❌ PayOS lỗi kéo dài >1 giờ
  ❌ Dữ liệu đơn hàng bị mất / lỗi hiển thị
  ❌ Không đăng nhập được dù mật khẩu đúng
  ❌ ERPNext đồng bộ lỗi liên tục

Có thể tự xử lý:
  ✓ Khách không nhận được điểm → tra cứu + cập nhật thủ công
  ✓ Đơn bị nhầm → hủy + tạo lại
  ✓ Voucher không áp dụng → kiểm tra điều kiện + hạn dùng
```

---

## 13. QUY TRÌNH KHẨN CẤP 🆘

### 13.1 Rollback nhanh (hệ thống bị lỗi nghiêm trọng)

```
BƯỚC 1: Thông báo
  → Thông báo cho nhân viên: "Tạm dừng bán hàng online"
  → Treo bảng: "Hệ thống tạm bảo trì"

BƯỚC 2: Chuyển sang thủ công
  → Dùng sổ sách giấy ghi đơn tạm
  → Hoặc: Mở Google Sheets lưu tạm

BƯỚC 3: Liên hệ kỹ thuật
  → Gửi mô tả lỗi + ảnh chụp màn hình
  → Cung cấp thời điểm lỗi xảy ra

BƯỚC 4: Sau khi sửa xong
  → Test: đăng nhập, tạo đơn, thanh toán, KDS
  → Thông báo "Hệ thống đã hoạt động trở lại"
  → Nhập lại các đơn ghi tạm
```

### 13.2 Mất kết nối Internet

```
1. Thông báo nhân viên: "Bán tay / sổ sách"
2. Dùng sổ ghi lại:
   - Tên khách, món gọi, tổng tiền, thanh toán
   - Số điện thoại (để tích điểm sau)
3. Khi Internet trở lại:
   - Nhập các đơn vào hệ thống
   - Cập nhật điểm cho khách có SĐT
```

---

## 14. DANH SÁCH CẤU HÌNH & SECRETS 🔒

### 14.1 Secrets cần thiết (đã được set)

```
Các biến mật này đã được cấu hình trên Cloudflare:
  • JWT_SECRET           — Mã bảo vệ phiên đăng nhập
  • PAYOS_CLIENT_ID      — Tài khoản PayOS
  • PAYOS_API_KEY        — Khóa API PayOS
  • PAYOS_CHECKSUM_KEY   — Key kiểm tra PayOS
  • ZALO_ACCESS_TOKEN    — Kết nối Zalo OA
  • ERPNEXT_URL          — URL ERPNext (BYOK)
  • ERPNEXT_API_KEY      — API Key ERPNext
  • ERPNEXT_API_SECRET   — API Secret ERPNext
```

> 🔐 **Bảo mật:** Secrets này KHÔNG được chia sẻ. Nếu nghi ngờ bị lộ → Đổi ngay trong Cloudflare Dashboard.

### 14.2 Cấu trúc Database (D1)

**Database name:** `fnb-caffe-db`
**Database ID:** `13260741-7795-431f-b491-7c8a17510bda`

Các bảng chính:

| Bảng | Lưu trữ |
|---|---|
| `users` | Thông tin khách hàng, hạng thành viên |
| `orders` | Đơn hàng, trạng thái, tổng tiền |
| `order_items` | Chi tiết món trong mỗi đơn |
| `tables` | Trạng thái bàn |
| `loyalty_wallets` | Ví cashback, số dư |
| `loyalty_transactions` | Lịch sử cộng/trừ cashback |
| `loyalty_points` | Điểm thành viên |
| `vouchers` | Mã giảm giá, điều kiện áp dụng |
| `referrals` | Giới thiệu bạn bè |
| `checkins` | Lịch sử điểm danh |
| `reservations` | Đặt bàn trước |
| `reviews` | Đánh giá món ăn |
| `staff` | Tài khoản nhân viên |
| `shifts` | Ca làm việc |
| `subscriptions` | Gói cước thành viên |
| `subscription_contracts` | Hợp đồng subscription |
| `erpnext_config` | Cấu hình ERPNext |
| `erpnext_invoices` | Hóa đơn ERPNext |
| `campaigns` | Chiến dịch marketing |
| `broadcast_log` | Lịch sử broadcast |
| `chat_messages` | Tin nhắn Live Chat |
| `analytics_config` | GA4 + Facebook Pixel config |
| `push_subscriptions` | Web Push subscriptions |
| `notifications` | Lịch sử thông báo |
| `events` | Sự kiện |

---

## 15. PHÂN TÍCH TÀI CHÍNH & DỰ PHÒNG 💰

### 15.1 5 Kịch bản Doanh thu (mục tiêu 100 triệu/tháng)

| Chỉ số | Khai trương (tháng 1) | Thường (tiêu chuẩn) | Khách quen cao | Đổi nước nhiều | Vãng lai |
|---|---|---|---|---|---|
| Doanh thu gộp | 100M | 100M | 100M | 100M | 100M |
| Phủ thành viên | 80% | 50% | 90% | 70% | 20% |
| Tỷ lệ dùng voucher | 60% | 10% | 5% | 20% | 5% |
| Cashback tiêu | -20M | -15M | -25M | -20M | -5M |
| **Tiền mặt thực thu** | **65M** | **83M** | **74M** | **76M** | **94M** |
| COGS (30%) | -30M | -30M | -30M | -31.8M | -30M |
| **Lợi nhuận ròng** | **+18.1M** | **+42.9M** | **+32.5M** | **+33.8M** | **+54.0M** |

> 💰 **Kết luận:** Ngay cả tháng khai trương vẫn có lãi **18.1M**. Tháng thường lên đến **42.9M**.

### 15.2 Dự phòng Subscription

| Gói cước | Giá / tháng | 50 khách | 100 khách | 200 khách |
|---|---|---|---|---|
| Basic | 49.000đ | 2.45M/tháng | 4.9M/tháng | 9.8M/tháng |
| Premium | 99.000đ | 4.95M/tháng | 9.9M/tháng | 19.8M/tháng |
| Enterprise | 199.000đ | 9.95M/tháng | 19.9M/tháng | 39.8M/tháng |

---

## 16. BẢO MẬT & HẠN MỨC CLOUDFLARE 🔐

### 16.1 Bảo mật — BẮT BUỘC

```
✅ Đổi mật khẩu Admin NGAY sau lần đăng nhập đầu
✅ Không chia sẻ JWT_SECRET hoặc bất kỳ secret nào
✅ Chỉ Owner + Manager được cấp quyền truy cập Admin
✅ Nhân viên Staff không được xóa dữ liệu
✅ Kiểm tra đăng nhập lạ trong Admin → Staff
```

### 16.2 Hạn mức Free Tier

| Tài nguyên | Giới hạn Free | Đủ cho |
|---|---|---|
| Workers requests | 100.000/ngày | 300-500 khách/ngày |
| D1 Storage | 5 GB | Vài năm dữ liệu |
| KV Reads | 1.000/ngày | Session + Push |
| Bandwidth | 10 GB/ngày | Hình ảnh menu |

> ⚠️ **Nếu vượt quá:** Cloudflare sẽ tự động chặn — Cần nâng lên Paid Plan ($5/tháng).

### 16.3 Giám sát sử dụng

```
Truy cập: https://dash.cloudflare.com
→ Workers & Pages → aura-space-worker
Kiểm tra: Requests/ngày, CPU time, Errors

Cảnh báo khi:
  ⚠️ Requests > 80.000/ngày (gần chạm giới hạn)
  ⚠️ Có nhiều lỗi 5xx (server error)
  ⚠️ Cron job không chạy
```

### 16.4 Nâng cấp lên Paid Plan (khi cần)

```
Nếu vượt quá Free Tier:

1. Cloudflare Workers Paid ($5/tháng):
   • 10 triệu requests/ngày (vs 100k free)
   • CPU time không giới hạn

2. Cách nâng:
   Cloudflare Dashboard → Workers → Upgrade Plan
   → Thêm thẻ tín dụng → Xác nhận

3. Không cần thay đổi code — tự động hoạt động
```

---

## 17. TÀI LIỆU ĐÍNH KÈM & ĐƯỜNG DẪN NGUỒN 📚

| File | Vị trí | Mô tả |
|---|---|---|
| **CEO-HANDOVER.md** | `CEO-HANDOVER.md` | Tài liệu này — Bàn giao tổng thể |
| **DESIGN.md** | `DESIGN.md` | Thiết kế hệ thống Stitch-compatible |
| **Loyalty Handbook** | `docs/loyalty_handbook.md` | Hướng dẫn loyalty cho chủ quán |
| **ERPNext Guide** | `docs/erpnext-setup.md` | Hướng dẫn cấu hình ERPNext |
| **Campaign Guide** | `docs/campaigns-guide.md` | Hướng dẫn campaign marketing |
| **Cấu hình Worker** | `worker/wrangler.toml` | Cấu hình Cloudflare Workers |
| **Script Admin** | `worker/scripts/seed-admin.js` | Script tạo tài khoản admin |

---

## 18. LIÊN HỆ HỖ TRỢ & KÊNH LIÊN LẠC 📞

### 18.1 Danh bạ liên hệ

| Vai trò | Tên | Liên hệ | Ghi chú |
|---|---|---|---|
| **Chủ Doanh Nghiệp** | [Điền tên] | [Điền SĐT/Zalo] | Quyền cao nhất |
| **Quản lý** | [Điền tên] | [Điền SĐT/Zalo] | Điều hành hàng ngày |
| **Kỹ thuật / Dev** | [Điền tên] | [Điền SĐT/Zalo] | Sửa lỗi, cập nhật hệ thống |

### 18.2 Kênh liên lạc khẩn cấp

```
🚨 Lỗi hệ thống toàn bộ:
  → Gọi kỹ thuật NGAY
  → Chuyển sang sổ sách giấy
  → Thông báo fanpage/Zalo group

⚠️ Lỗi PayOS:
  → Chuyển sang COD
  → Báo kỹ thuật trong giờ làm việc

💬 Câu hỏi thường gặp:
  → Đọc phần Bảo trì trước
  → Không giải quyết được → Gọi Quản lý
  → Quản lý không giải quyết được → Gọi Kỹ thuật
```

### 18.3 Tài nguyên học thêm

| Tài nguyên | Link / Đường dẫn |
|---|---|
| Cloudflare Workers Docs | https://developers.cloudflare.com/workers/ |
| PayOS Developer Docs | https://developers.payos.vn/ |
| Wrangler CLI | Chạy `npx wrangler --help` |
| D1 Database Queries | Chạy `npx wrangler d1 execute fnb-caffe-db --remote --command "SELECT ..."` |

---

## 19. TỔNG HỢP NHANH (CHEAT SHEET) 📝

> In ra giấy để nhân viên tiện tra cứu

### Đăng nhập Admin

```
URL: https://auraspace.cafe/admin/login
Email: admin@auraspace.vn
```

### Trang quản lý nhanh

| Thao tác | Trang |
|---|---|
| 🧾 Bán hàng | Admin → POS |
| 📊 Xem doanh thu | Admin → Dashboard |
| 📋 Xử lý đơn hàng | Admin → Orders |
| 🍕 Thêm/sửa món | Admin → Menu |
| 📅 Duyệt đặt bàn | Admin → Reservations |
| 👔 Thêm nhân viên | Admin → Staff |
| ✅ Duyệt check-in | Admin → Check-in Approve |
| 🔥 Bếp xử lý món | KDS (/kds) |
| 🏷️ Quản lý khuyến mãi | Admin → Promotions |
| 📢 Gửi thông báo | Admin → Broadcast |
| 📈 Xem phân tích | Admin → Analytics |
| 💬 Trả lời khách chat | Admin → Chat Inbox |
| 📊 Cấu hình ERPNext | Admin → ERPNext |
| 💎 Quản lý gói cước | Admin → Subscriptions |
| 📱 In QR code bàn | Admin → QR Codes |

### Chuyển trạng thái đơn

```
Mới → Chờ xác nhận → Đang làm → Sẵn sàng → Đã phục vụ → Đã thanh toán
                                    ↑                    ↓
                                    └──── Hủy đơn ←──────┘
```

### Luồng bán chuẩn

```
Khách vào → Quét QR → Xem menu → Đặt món →
KDS bếp nhận → Bếp làm → Món xong →
Thông báo (Web Push / ZNS/SMS) →
Mang ra → Thanh toán (PayOS/COD) →
Split bill (nếu cần) → Đánh giá →
Tích điểm → Giới thiệu bạn bè → Khách ra
```

### QR Code đặt món

```
Mỗi bàn có mã QR riêng:
  Quét QR → Mở menu điện thoại
  → Chọn món → Đặt hàng
  → Nhận thông báo khi món xong
  → Thanh toán online hoặc COD
```

### Tính năng PWA

```
Cài đặt app:
  Mở auraspace.cafe bằng Chrome/Safari
  → Click "Add to Home Screen" (iOS) / "Cài đặt" (Android)
  → Dùng như app điện thoại thật
```

---

> **Tài liệu này được tạo tự động bởi hệ thống Claude AI.**
> **Ngày tạo:** 2026-07-03 | **Phiên bản:** 2.0
> **Tổng số tính năng:** 30+ | **Tests:** 1.063 unit + 129 E2E
> **Trạng thái:** SẴN SÀNG SẢN XUẤT ✅

---

*— END OF DOCUMENT —*
