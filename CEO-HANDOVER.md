# CEO HANDOVER — AURA CAFE
> Hệ thống quản lý Container Café · Bàn giao cho Chủ Doanh Nghiệp
> Cập nhật: 2026-06-04

---

## 📌 MỤC LỤC

1. [Tóm tắt hệ thống](#1-tóm-tắt-hệ-thống)
2. [URL sản xuất & đăng nhập](#2-url-sản-xuất--đăng-nhập)
3. [Cấu trúc phần mềm (Architecture)](#3-cấu-trúc-phần-mềm)
4. [Hướng dẫn sử dụng hàng ngày](#4-hướng-dẫn-sử-dụng-hàng-ngày)
5. [Bảng điều khiển Admin — từng trang](#5-bảng-điều-khiển-admin--từng-trang)
6. [Chương trình khách hàng thân thiết (Loyalty)](#6-chương-trình-khách-hàng-thân-thiết)
7. [Thanh toán & Webhook PayOS](#7-thanh-toán--webhook-payos)
8. [Bảo trì & Khắc phục sự cố thường gặp](#8-bảo-trì--khắc-phục-sự-cố-thường-gặp)
9. [Quy trình khẩn cấp (Rollback & Escalation)](#9-quy-trình-khẩn-cấp)
10. [Danh sách cấu hình & Secrets](#10-danh-sách-cấu-hình--secrets)
11. [Checklist khởi chạy Launch Day (T-17 → D+1)](#11-checklist-khởi-chạy)
12. [Phân tích tài chính & Dự phòng](#12-phân-tích-tài-chính)
13. [Tài liệu đính kèm & Đường dẫn nguồn](#13-tài-liệu-đính-kèm)
14. [Lưu ý bảo mật & Hạn chế Free Tier](#14-lưu-ý-bảo-mật)
15. [Liên hệ hỗ trợ & Kênh liên lạc](#15-liên-hệ-hỗ-trợ)

---

## 1. TÓM TẮT HỆ THỐNG

### 1.1 Hệ thống này là gì?

AURA CAFE Container System là một nền tảng quản lý quán cà phê toàn diện chạy hoàn toàn trên **đám mây Cloudflare** — không cần server vật lý tại chỗ. Mọi thứ từ menu, đặt bàn, thanh toán, điểm thành viên đến bếp (KDS) đều hoạt động qua trình duyệt web.

### 1.2 Thành phần chính

| Thành phần | Vai trò | Công nghệ |
|---|---|---|
| **Frontend (Website)** | Trang khách xem menu, đặt bàn, đăng ký thành viên | HTML/CSS/JS, đóng gói tĩnh |
| **Admin Panel** | Giao diện quản lý cho chủ quán & nhân viên | HTML/CSS/JS (8 trang) |
| **KDS (Kitchen)** | Màn hình bếp — xem đơn, chuyển trạng thái món | HTML/CSS/JS real-time |
| **API Backend** | Xử lý mọi logic: đơn hàng, thanh toán, loyalty, điểm danh | Cloudflare Workers (Node.js) |
| **Cơ sở dữ liệu** | Lưu trữ menu, đơn, khách, điểm thành viên, voucher | Cloudflare D1 (SQLite) |
| **Cache xác thực** | Lưu session đăng nhập nhanh | Cloudflare KV |

### 1.3 Điểm mạnh của hệ thống

- **Không cần server riêng**: Toàn bộ chạy trên Cloudflare Free Tier — chi phí vận hành = $0
- **Tự động sao lưu**: Cloudflare backup D1 database hàng ngày
- **Tự động chạy mỗi 5 phút**: Cron job kiểm tra đơn quá hạn (SLA)
- **Truy cập mọi nơi**: Chỉ cần trình duyệt + mạng Internet, không cần cài đặt

### 1.4 Điểm cần lưu ý (Free Tier limits)

- **Workers**: 100.000 request/ngày (đủ cho quán cà phê ~300-500 khách/ngày)
- **D1 Database**: 5 GB lưu trữ (đủ cho vài năm dữ liệu)
- **KV Cache**: 1.000 lần đọc/ngày
- **Bandwidth**: 10 GB/ngày miễn phí (đủ cho hình ảnh menu)

> ⚠️ **Nếu vượt quá:** Cloudflare sẽ tự động chặn — cần nâng lên Paid Plan ($5/tháng).

---

## 2. URL SẢN XUẤT & ĐĂNG NHẬP

### 2.1 Các trang chính

| Trang | URL | Mục đích |
|---|---|---|
| 🌐 Website khách | `https://fnb-caffe-container.pages.dev` | Khách xem menu, đặt bàn, đăng ký thành viên |
| ⚙️ Admin Panel | `https://fnb-caffe-container.pages.dev/admin/` | Quản lý toàn bộ hệ thống |
| 🔑 Đăng nhập Admin | `https://fnb-caffe-container.pages.dev/admin/login.html` | Nhập tài khoản quản trị |
| 🍳 KDS (Bếp) | `https://fnb-caffe-container.pages.dev/kds.html` | Màn hình bếp — xử lý đơn món |
| 🧾 Hóa đơn công khai | `https://fnb-caffe-container.pages.dev/receipt-template.html` | Xem hóa đơn sau thanh toán |

### 2.2 Backend API (chạy ngầm)

```
https://aura-space-worker.sadec-marketing-hub.workers.dev
```
> Đây là API backend xử lý mọi thao tác phía sau. Khách không truy cập trực tiếp URL này.

### 2.3 Tài khoản Admin mặc định

```
Email:    admin@auraspace.vn
Password: AURA Owner
```
> 🔐 **BẮT BUỘC đổi mật khẩu sau lần đăng nhập đầu tiên!** Xem mục [Quản lý nhân viên](#52-quản-lý-nhân-viên).

### 2.4 Cách đăng nhập

1. Mở trình duyệt (Chrome/Safari/Edge)
2. Vào `https://fnb-caffe-container.pages.dev/admin/login.html`
3. Nhập email + mật khẩu
4. Tick "Ghi nhớ đăng nhập" nếu muốn giữ session 7 ngày
5. Click **ĐĂNG NHẬP**
6. Sau khi đổi mật khẩu: click avatar góc trên → **Đổi mật khẩu**

---

## 3. CẤU TRÚC PHẦN MỀM

### 3.1 Sơ đồ hoạt động

```
┌─────────────────────────────────────────────────────────┐
│                    KHÁCH HÀNG                            │
│  Xem menu → Đặt bàn → Chọn món → Thanh toán            │
│  → Nhận hóa đơn → Tích điểm thành viên                 │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│              CLOUDFLARE WORKER (API)                     │
│  ┌──────────┬──────────┬──────────┬──────────┐         │
│  │  Auth    │  Orders  │ Payments │  Loyalty │ ...     │
│  │  (ĐN)    │  (Đơn)   │ (Trả tiền│ (Điểm)   │         │
│  └──────────┴──────────┴──────────┴──────────┘         │
│                          │                               │
│              ┌───────────┴───────────┐                  │
│              ▼                       ▼                  │
│    ┌─────────────────┐   ┌─────────────────┐          │
│    │   D1 Database   │   │     KV Cache    │          │
│    │  (SQLite Cloud) │   │  (Session Auth) │          │
│    └─────────────────┘   └─────────────────┘          │
└─────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│              NHÂN VIÊN / CHỦ QUÁN                       │
│  Admin Panel → Quản lý đơn, bàn, nhân viên             │
│  KDS → Xử lý món ăn, chuyển trạng thái                 │
└─────────────────────────────────────────────────────────┘
```

### 3.2 25 API Routes (Backend)

| Nhóm | Routes | Chức năng |
|---|---|---|
| **Xác thực** | `auth.js` | Đăng nhập, đăng xuất, quên mật khẩu |
| **Menu & Sản phẩm** | `menu.js`, `products.js`, `categories.js` | Quản lý danh mục, món ăn, giá |
| **Đơn hàng** | `orders.js`, `orders-hono.js` | Tạo, cập nhật, hủy đơn |
| **Bàn** | `tables.js` | Quản lý trạng thái bàn |
| **Đặt bàn** | `reservations.js` | Khách đặt bàn trước |
| **Thanh toán** | `payment.js`, `webhooks.js` | Tích hợp PayOS, COD, xác nhận thanh toán |
| **Khách hàng** | `customers.js` | Quản lý thông tin khách |
| **Loyalty** | `loyalty.js`, `admin-loyalty.js`, `referrals.js` | Điểm, hạng, cashback, giới thiệu |
| **Sinh nhật** | `birthday.js` | Ưu đãi sinh nhật tự động |
| **Điểm danh** | `checkin.js` | Check-in khách, quét mã |
| **Nhân viên** | `staff.js` (qua admin) | Quản lý tài khoản nhân viên |
| **Ca làm việc** | `shifts.js` | Báo cáo ca, doanh thu ca |
| **Đánh giá** | `reviews.js` | Đánh giá món ăn |
| **Khuyến mãi** | `promotions.js` | Mã giảm giá, voucher |
| **Đăng ký mới** | `subscriptions.js` | Đăng ký thành viên mới |
| **Báo cáo** | `reports.js` | Thống kê doanh thu, bán chạy |
| **Liên hệ** | `contact.js` | Form liên hệ |
| **Cron** | `cron.js` | Tự động chạy mỗi 5 phút |
| **Zalo** | `zalo.js` | Tích hợp Zalo OA (sau launch) |

### 3.3 8 Trang Admin

| Trang | Đường dẫn | Chức năng |
|---|---|---|
| **Đăng nhập** | `admin/login.html` | Đăng nhập, đổi mật khẩu |
| **Dashboard** | `admin/dashboard.html` | Tổng quan doanh thu, biểu đồ |
| **Đơn hàng** | `admin/orders.html` | Xem, duyệt, hủy đơn hàng |
| **POS** | `admin/pos.html` | Bán tại quầy — chọn bàn, thêm món, thanh toán |
| **Đặt bàn** | `admin/reservations.html` | Xem, duyệt đặt bàn trước |
| **Nhân viên** | `admin/staff.html` | Thêm/sửa/xóa tài khoản nhân viên |
| **Duyệt điểm danh** | `admin/checkin-approve.html` | Duyệt check-in khách (quét QR) |
| **CSS chung** | `admin/shared.css` | Giao diện chung admin |

---

## 4. HƯỚNG DẪN SỬ DỤNG HÀNG NGÀY

### 4.1 Trước khi mở cửa (Pre-Open — 7:45-8:00)

**Kiểm tra nhanh (2 phút):**

```
1. Mở KDS: https://fnb-caffe-container.pages.dev/kds.html
   → Xem có đơn nào "Chờ xác nhận" tồn đọng từ hôm trước không
   → Nếu có: xử lý hết hoặc hủy

2. Mở Dashboard Admin:
   → Kiểm tra tổng doanh thu hôm trước có khớp sổ sách không

3. Kiểm tra kết nối Internet
   → Mở website: https://fnb-caffe-container.pages.dev
   → Phải load được trang chủ

4. Kiểm tra PayOS
   → Vào Admin → Đơn hàng → Xem đơn chưa thanh toán
   → Đảm bảo QR thanh toán hoạt động
```

**Chuẩn bị vật lý:**
- Bật máy POS/tablet nếu dùng
- Kiểm máy in hóa đơn (nếu có)
- Chuẩn bị số dư ví cashback cho khách VIP (nếu cần)

### 4.2 Trong giờ phục vụ (Service Hours)

#### Luồng phục vụ chuẩn:

```
1. KHÁCH VÀO
   → Nhân viên chào, hỏi số người
   → Mở Admin → POS (hoặc nhập tay nếu không có máy)

2. CHỌN BÀN & GỌI MÓN
   → POS: Chọn bàn trống → Thêm món → Ghi chú (ít đường, đá nhiều...)
   → Hoặc: Khách tự xem menu website → thêm vào giỏ → chọn PayOS/COD

3. GỬI ĐƠN VÀO BẾP
   → KDS tự động nhận đơn (real-time)
   → Bếp thấy đơn → bấm "Bắt đầu làm" → chuyển sang "Đang chuẩn bị"

4. PHỤC VỤ
   → Món xong → bếp bấm "Sẵn sàng"
   → Nhân viên mang món ra → bấm "Đã phục vụ" trên KDS

5. THANH TOÁN
   → POS: Chọn phương thức (COD / PayOS QR / Tiền mặt)
   → Nếu PayOS: Hiện QR → Khách quét → Hệ thống tự xác nhận
   → In hóa đơn (nếu có máy in)

6. TÍCH ĐIỂM THÀNH VIÊN
   → Hỏi khách có thẻ thành viên không
   → Nếu chưa có: Hướng dẫn quét QR đăng ký (trên hóa đơn)
   → Hệ thống tự tính cashback + điểm theo hạng
```

#### Trong giờ — Trường hợp đặc biệt:

| Tình huống | Xử lý |
|---|---|
| Khách hủy món đã làm | Admin → Orders → Chọn đơn → Hủy → Chọn lý do |
| Khách đổi món sau khi gửi bếp | Bấm nút hủy món trên KDS → Thêm món mới → Gửi lại bếp |
| Khách yêu cầu tách hóa đơn | Tạo đơn mới → Chuyển món sang đơn mới |
| PayOS không phản hồi | Chuyển sang COD, ghi chú "Chuyển sang thu tiền tay" |
| Khách quên ví/điện thoại | Admin → Loyalty → Tra cứu số điện thoại → Xem số dư |

### 4.3 Kết thúc ngày (End of Day — 22:00-22:30)

```
1. ĐÓNG ĐƠN
   → Admin → Orders → Đóng tất cả đơn chưa thanh toán
   → Hủy đơn đã đặt nhưng khách không đến (no-show)

2. KIỂM KÊ
   → Đếm tiền mặt trong két
   → Đối chiếu với báo cáo ca (Admin → Dashboard)
   → Lưu sổ sách

3. BACKUP NHANH
   → Cloudflare tự backup D1 hàng ngày (không cần làm gì thêm)
   → Chụp ảnh màn hình Dashboard doanh thu ngày

4. TẮT HỆ THỐNG
   → Đóng tất cả tab Admin/KDS
   → Không cần tắt server — Cloudflare tự quản lý
```

---

## 5. BẢNG ĐIỀU KHIỂN ADMIN — TỪNG TRANG

### 5.1 Đăng nhập & Đổi mật khẩu

**URL:** `admin/login.html`

| Bước | Hành động |
|---|---|
| 1 | Mở URL đăng nhập |
| 2 | Nhập email + mật khẩu |
| 3 | Click **ĐĂNG NHẬP** |
| 4 | Sau khi vào: Click avatar góc trên phải |
| 5 | Chọn **Đổi mật khẩu** |
| 6 | Nhập mật khẩu cũ → Mật khẩu mới → Xác nhận |

### 5.2 Dashboard (Tổng quan)

**URL:** `admin/dashboard.html`

Hiển thị sau khi đăng nhập. Bao gồm:
- **Doanh thu hôm nay / tháng / năm** — số tiền thực thu
- **Số đơn hàng** — đang xử lý, hoàn thành, hủy
- **Top món bán chạy** — theo tuần/tháng
- **Số khách mới / khách quen**
- **Biểu đồ** doanh thu theo giờ/ngày

> 💡 **Mẹo:** Dashboard tự cập nhật real-time. Không cần bấm F5 — dữ liệu tự động tải lại sau mỗi thao tác.

### 5.3 Quản lý Đơn hàng

**URL:** `admin/orders.html`

#### Xem đơn hàng:
- Mặc định hiển thị đơn **hôm nay** (mới nhất trước)
- Mỗi đơn có: Mã đơn, Bàn, Món ăn, Tổng tiền, Trạng thái, Thời gian

#### Trạng thái đơn:
| Trạng thái | Màu | Ý nghĩa |
|---|---|---|
| Chờ xác nhận | Đỏ | Vừa tạo, chưa xử lý |
| Đang chuẩn bị | Cam | Đang làm ở bếp |
| Sẵn sàng | Xanh | Đã xong, chờ mang ra |
| Đã phục vụ | Xám | Khách đã nhận món |
| Đã thanh toán | Xanh lá | Đã thu tiền xong |
| Đã hủy | Đỏ đậm | Không thực hiện |

#### Thao tác:
| Hành động | Cách làm |
|---|---|
| Xem chi tiết đơn | Click vào mã đơn |
| Hủy đơn | Click vào đơn → Nút **Hủy đơn** → Chọn lý do |
| Cập nhật trạng thái | Click đơn → Chọn trạng thái mới |
| In hóa đơn | Click đơn → Nút **In hóa đơn** |

### 5.4 POS (Bán tại quầy)

**URL:** `admin/pos.html`

Đây là màn hình bán hàng chính — tương tự máy POS tại quầy thu ngân.

#### Luồng bán hàng POS:

```
1. CHỌN BÀN
   → Click vào sơ đồ bàn (hoặc dropdown chọn tầng/bàn)
   → Bàn đang phục vụ = màu cam, Bàn trống = màu xanh

2. THÊM MÓN
   → Chọn danh mục (Cà phê, Trà, Đồ ăn...) ở cột trái
   → Click món → Chọn số lượng
   → Thêm ghi chú nếu cần (ít đường, không đá...)
   → Món xuất hiện trong giỏ hàng bên phải

3. XEM GIỎ HÀNG
   → Bên phải màn hình: danh sách món, số lượng, giá
   → Tổng cộng hiển thị ở dưới

4. THANH TOÁN
   → Click nút **THANH TOÁN**
   → Chọn phương thức:
     • 💵 Tiền mặt — Nhập số tiền nhận, hệ thống tính tiền thối
     • 💳 PayOS (QR) — Hiện mã QR, khách quét bằng app ngân hàng
     • 🟠 MoMo (nếu tích hợp)
   → Sau khi thanh toán: Hệ thống tự in hóa đơn + tạo QR thành viên

5. HOÀN TẤT
   → Bàn tự chuyển sang "Đang phục vụ"
   → Đơn gửi ngay vào KDS bếp
```

> ⚠️ **Lưu ý:** Luôn kiểm tra kỹ giỏ hàng trước khi thanh toán. Sau khi thanh toán không thể sửa đơn được — phải tạo đơn trả hàng (refund) mới.

### 5.5 Quản lý Đặt bàn

**URL:** `admin/reservations.html`

#### Luồng xử lý đặt bàn:

```
1. XEM DANH SÁCH
   → Hiển thị đặt bàn hôm nay/theo tuần/tháng
   → Mỗi đặt bàn: Tên khách, SĐT, Số người, Thời gian, Trạng thái

2. TRẠNG THÁI ĐẶT BÀN
   • Chờ xác nhận — Mới đặt, chưa xử lý
   • Đã xác nhận — Nhân viên đã gọi xác nhận
   • Đã đến — Khách đã đến quán
   • Đã hủy — Khách hủy hoặc không đến (no-show)

3. XỬ LÝ
   → Click đặt bàn → Nút "Xác nhận" → Gọi điện xác nhận khách
   → Nếu khách không đến sau 15 phút: "Đánh dấu No-show"
   → No-show 3 lần → Hệ thống tự cảnh báo
```

> 📱 **Mẹo:** Có thể gọi điện trực tiếp từ số điện thoại hiển thị trên đặt bàn (nếu dùng máy có tích hợp gọi).

### 5.6 Quản lý Nhân viên

**URL:** `admin/staff.html`

#### Thêm nhân viên mới:

```
1. Click "Thêm nhân viên"
2. Nhập thông tin:
   • Họ tên
   • Email (dùng để đăng nhập)
   • Mật khẩu tạm (nhân viên sẽ đổi ở lần đăng nhập đầu)
   • Vai trò:
     - Owner: Toàn quyền (chỉ 1-2 người)
     - Manager: Quản lý, không xóa được dữ liệu Owner
     - Staff/Nhân viên: Bán hàng, xem đơn (không xóa được)
3. Click "Tạo tài khoản"
4. Gửi thông tin đăng nhập cho nhân viên (qua Zalo/SMS)
```

#### Các vai trò (Roles):

| Vai trò | Quyền | Số lượng |
|---|---|---|
| **Owner** | Toàn quyền: thêm/xóa/sửa tất cả, xem báo cáo, quản lý secrets | 1-2 người |
| **Manager** | Xem/sửa đơn, quản lý nhân viên cấp dưới, báo cáo | Không giới hạn |
| **Staff** | Bán hàng POS, xem KDS, xem đơn (không xóa, không cài đặt) | Theo nhu cầu |

#### Khóa/Mở tài khoản:
- Click vào tên nhân viên → Toggle "Kích hoạt" để khóa/mở tài khoản
- Nhân viên bị khóa không thể đăng nhập nhưng dữ liệu vẫn giữ nguyên

### 5.7 Duyệt Check-in (Điểm danh khách)

**URL:** `admin/checkin-approve.html`

#### Luồng điểm danh:

```
1. Khách mở điện thoại → Quét QR tại quán
   → QR dẫn đến trang check-in của khách

2. Hệ thống tự động ghi nhận yêu cầu check-in
   → Hiện ở Admin → Check-in Approval dạng "Chờ duyệt"

3. Nhân viên xem xét:
   → Kiểm tra tên khách có khớp với đơn/đặt bàn không
   → Click "Duyệt" → Khách nhận được điểm thưởng
   → Click "Từ chối" → Ghi lý do (không khớp thông tin, gian lận...)
```

#### Thưởng check-in:
- Mỗi lần check-in duyệt: +10 điểm thành viên
- Check-in + chụp hình hashtag #AURACafeSaDec: Voucher 30.000đ

### 5.8 Giao diện Chung (Theme)

- Tất cả trang Admin có nút **🌓 Giao diện** góc dưới phải
- Click để chuyển **Dark Mode** ↔ **Light Mode**
- Lưu tự động vào trình duyệt — không cần chọn lại mỗi lần mở
- Phù hợp cho: nhân viên thích sáng, chủ quán thích tối

---

## 6. CHƯƠNG TRÌNH KHÁCH HÀNG THÂN THIẾT

### 6.1 Cách hoạt động (Giải thích cho nhân viên)

**Khách mua → Tích điểm → Lên hạng → Nhận ưu đãi → Tiêu điểm → Lại mua.**

Không có vòng lặp vô tận vì:
1. Khách CHỈ nhận cashback trên phần **tiền mặt thực tế trả** (sau khi trừ voucher)
2. Tối đa dùng 50% ví cashback/đơn → khách buộc phải trả 50% tiền mặt
3. Điểm thành viên có hạn dùng (90-180 ngày tùy hạng)

### 6.2 4 Hạng thành viên

| Hạng | Chi tiêu tích lũy | Cashback | Hệ số điểm | Sinh nhật | Hiệu lực ví |
|---|---|---|---|---|---|
| 🥉 **Bronze** (Đồng) | 0 — 500.000đ | 3% | ×1.0 | Giảm 10% | 90 ngày |
| 🥈 **Silver** (Bạc) | 500.000đ — 2.000.000đ | 5% | ×1.2 | Giảm 20% | 120 ngày |
| 🥇 **Gold** (Vàng) | 2.000.000đ — 5.000.000đ | 7% | ×1.5 | Giảm 35% | 180 ngày |
| 💎 **Platinum** (Bạch Kim) | > 5.000.000đ | 10% | ×2.0 | Giảm 50% + Quà | **Vĩnh viễn** |

### 6.3 Nguyên tắc xếp chồng ưu đãi (quan trọng!)

Thứ tự áp dụng — **không đảo lộn**:

```
Bước 1: Giảm giá Voucher (AURA20, AURA10, sinh nhật...) → Áp dụng trước
Bước 2: Tính Cashback → Trên số tiền còn lại sau voucher
Bước 3: Tích điểm mới → Trên số tiền mặt thực tế khách trả
Bước 4: Cộng vào Ví Cashback + Tăng tổng chi tiêu tích lũy
```

**Ví dụ thực tế:**

Khách hạng Silver mua 200.000đ, áp dụng voucher AURA10 (giảm 10% = 20.000đ):
```
1. Bill gốc:      200.000đ
2. Trừ voucher:  - 20.000đ  → Còn 180.000đ
3. Dùng ví:       - 45.000đ  (tối đa 50% × 5% cashback = 4.500đ mới)
4. Tiền mặt:       135.000đ
5. Cashback mới:    4.500đ   (10% × 45.000đ tiền mặt × 1.2 hệ số)
6. Điểm mới:        108 điểm  (135.000đ × 1.2 × 0.5/1000)
```

### 6.4 Voucher khai trương (6/6 - 13/6/2026)

| Mã | Ưu đãi | Điều kiện | Hạn dùng |
|---|---|---|---|
| **AURA20** | Giảm 20% (tối đa 50.000đ) | Tất cả thành viên | Ngày 6/6/2026 |
| **AURA10** | Giảm 10% (tối đa 30.000đ) | Tất cả thành viên | 7/6 - 13/6 |
| **CHECKIN30K** | Voucher 30.000đ cho lần sau | Check-in + hashtag #AURACafeSaDec | 50 lượt |
| **LOYALTY50** | Cộng 50.000đ vào ví | 100 khách đăng ký đầu tiên | Đến khi hết |

### 6.5 Thưởng giới thiệu (Referral)

```
Khách A giới thiệu Khách B:
1. B đăng ký thành viên mới → A và B cùng nhận +50.000đ ví
2. B thanh toán đơn đầu thành công → Hệ thống tự cộng thưởng
3. Chi tiêu ≥ 200.000đ trong 1 đơn ngày khai trương → Tự động lên Silver
```

### 6.6 Quy tắc quan trọng — KHÔNG ĐƯỢC VI PHẠM

| Quy tắc | Lý do | Xử lý nếu vi phạm |
|---|---|---|
| Không cho khách dùng >50% ví/đơn | Đảm bảo quán luôn thu được tiền mặt | Hệ thống tự chặn — không thể bỏ qua |
| Cashback tính sau voucher | Không trả tiền 2 lần trên cùng 1 đơn | Áp dụng theo thứ tự đã định |
| Điểm hết hạn không gia hạn | Duy trì quỹ loyalty bền vững | Hệ thống tự xóa điểm hết hạn hàng đêm |
| Không chồng voucher (1/đơn) | Tránh lỗ hổng giảm giá vô hạn | Chỉ áp dụng 1 voucher/đơn hàng |

---

## 7. THANH TOÁN & WEBHOOK PAYOS

### 7.1 Các phương thức thanh toán

| Phương thức | Mô tả | Lưu ý |
|---|---|---|
| 💵 **Tiền mặt (COD)** | Thu tiền tận tay, in hóa đơn | Phải đếm và ghi số tiền nhận/chốt |
| 💳 **PayOS (QR)** | Khách quét mã QR bằng app ngân hàng | Cần kết nối Internet, webhook tự xác nhận |
| 🏦 **Chuyển khoản** | (Nếu tích hợp) Khách chuyển → Xác nhận thủ công | Cần đối chiếu số tiền |

### 7.2 Luồng PayOS

```
1. Khách chọn "Thanh toán" → Hệ thống tạo đơn PayOS
2. Hiển thị mã QR (ảnh)
3. Khách quét bằng app ngân hàng → Nhập số tiền
4. PayOS xử lý → Gửi webhook về hệ thống (tự động)
5. Hệ thống nhận webhook → Cập nhật trạng thái đơn = "Đã thanh toán"
6. In hóa đơn, tích điểm thành viên
```

### 7.3 Khi PayOS bị lỗi

| Triệu chứng | Nguyên nhân khả dĩ | Xử lý |
|---|---|---|
| QR không hiện | Mất Internet hoặc PayOS API chậm | Chuyển sang COD, ghi chú |
| Khách đã trả tiền nhưng đơn vẫn "Chưa thanh toán" | Webhook bị delay | Kiểm tra lại sau 30 giây → Nếu vẫn lỗi → Xác nhận thủ công trong Admin → Đơn hàng |
| "Lỗi kết nối ngân hàng" | PayOS bảo trì | Dùng COD thay thế |

> ⚠️ **Không bao giờ** xóa đơn đã thanh toán để tạo lại. Nếu sai sót: dùng chức năng Hoàn tiền (Refund) trong Admin.

---

## 8. BẢO TRÌ & KHẮC PHỤC SỰ CỐ THƯỜNG GẶP

### 8.1 Checklist kiểm tra nhanh (nếu có vấn đề)

```
□ Internet có ổn không? (thử mở google.com)
□ Trang web có load được không? (fnb-caffe-container.pages.dev)
□ Admin có đăng nhập được không?
□ PayOS có phản hồi không? (thử tạo đơn test)
□ KDS có nhận đơn mới không?
```

### 8.2 Sự cố phổ biến & Cách xử lý

| # | Sự cố | Triệu chứng | Xử lý |
|---|---|---|---|
| 1 | **Trang web không mở** | ERR_CONNECTION_REFUSED / 404 | 1) Kiểm tra Internet 2) Xóa cache trình duyệt 3) Thử trang khác để loại trừ lỗi mạng |
| 2 | **Không đăng nhập được Admin** | Sai mật khẩu / Token hết hạn | 1) Click "Quên mật khẩu?" 2) Nếu không nhận email: liên hệ Owner 3) Token hết hạn sau 7 ngày — đăng nhập lại |
| 3 | **KDS không nhận đơn** | Bếp không thấy đơn mới | 1) Kiểm tra POS đã gửi đơn chưa 2) F5 KDS 3) Kiểm tra Workers hoạt động (Xem mục 14) |
| 4 | **Đơn bị trùng / nhân đôi** | Khách thấy 2 đơn giống nhau | Admin → Orders → Hủy đơn nhầm → Ghi chú lý do |
| 5 | **PayOS không thanh toán được** | QR lỗi / không quét được | Chuyển sang COD, báo cho kỹ thuật nếu lỗi kéo dài |
| 6 | **Loyalty không cộng điểm** | Khách đăng ký nhưng không thấy điểm | Kiểm tra Admin → Loyalty → Tra tên/SĐT khách. Nếu vẫn không có: báo kỹ thuật |
| 7 | **Máy in hóa đơn không in** | Bấm in không ra giấy | 1) Kiểm tra kết nối USB/Bluetooth 2) Xem đúng driver máy in chưa 3) Thử in trang test 4) In tay nếu cần gấp |
| 8 | **Màn hình KDS đơ / lag** | Không cập nhật đơn mới | 1) F5 màn hình KDS 2) Kiểm tra mạng WiFi 3) Khởi động lại trình duyệt |
| 9 | **Sai giá / sai món trên hóa đơn** | Thông tin không khớp | Admin → Orders → Hủy đơn → Tạo đơn mới đúng → Hoàn tiền nếu đã thu |
| 10 | **Hết pin tablet POS** | Không bán được | Dùng điện thoại dự phòng → Mở admin/pos.html → Cắm sạc tablet |

### 8.3 Khi nào cần gọi Kỹ thuật

```
Gọi ngay nếu:
  ❌ Website không truy cập được >5 phút
  ❌ PayOS lỗi kéo dài >1 giờ (không thu được tiền)
  ❌ Dữ liệu đơn hàng bị mất / lỗi hiển thị
  ❌ Không đăng nhập được dù mật khẩu đúng (không phải do quên)
  ❌ Lỗi hiển thị đột ngột trên nhiều máy

Có thể tự xử lý:
  ✓ Khách không nhận được điểm → tra cứu lại + cập nhật thủ công
  ✓ Đơn bị nhầm → hủy + tạo lại
  ✓ Voucher không áp dụng → kiểm tra điều kiện + hạn dùng
```

---

## 9. QUY TRÌNH KHẨN CẤP

### 9.1 Rollback nhanh (hệ thống bị lỗi nghiêm trọng)

Nếu sau cập nhật hệ thống gặp lỗi lớn:

```
BƯỚC 1: Thông báo
  → Thông báo cho tất cả nhân viên: "Tạm dừng bán hàng online"
  → Treo biển / thông báo tại quầy: "Hệ thống tạm bảo trì, vui lòng quay lại sau"

BƯỚC 2: Chuyển sang thủ công
  → Dùng sổ sách giấy ghi đơn trong thời gian sửa
  → Hoặc: Mở file Excel/Google Sheets lưu tạm đơn hàng

BƯỚC 3: Liên hệ kỹ thuật
  → Gửi mô tả lỗi + ảnh chụp màn hình
  → Cung cấp thời điểm lỗi xảy ra

BƯỚC 4: Sau khi sửa xong
  → Test đầy đủ: đăng nhập, tạo đơn, thanh toán, KDS
  → Thông báo "Hệ thống đã hoạt động trở lại"
  → Nhập lại các đơn ghi tạm vào hệ thống (nếu cần)
```

### 9.2 Dữ liệu an toàn — không cần lo lắng

```
✅ Dữ liệu đơn hàng: Được lưu trên Cloudflare D1 (tự backup hàng ngày)
✅ Dữ liệu loyalty: Được lưu trên D1, không mất khi có lỗi
✅ Dữ liệu đặt bàn: Được lưu trên D1
✅ File đính kèm (ảnh, QR): Được lưu trên Cloudflare Pages + R2

❌ KHÔNG lưu dữ liệu quan trọng CHỈ trên máy tính cá nhân
❌ KHÔNG xóa trực tiếp dữ liệu trên Cloudflare nếu không chắc chắn
```

### 9.3 Mất kết nối Internet

```
Tình huống: Mất Internet tại quán

Hành động:
1. Thông báo nhân viên: "Hôm nay bán tay / sổ sách"
2. Dùng sổ sách giấy ghi lại:
   - Tên khách, món gọi, tổng tiền, thanh toán
   - Số điện thoại (để tích điểm sau)
3. Đối chiếu cuối ngày: Sổ tay = doanh thu thực tế
4. Khi Internet trở lại:
   - Nhập các đơn tay vào hệ thống
   - Cập nhật điểm thành viên cho khách có SĐT
   - Đánh dấu trong ghi chú: "Nhập lại sau mất mạng"
```

---

## 10. DANH SÁCH CẤU HÌNH & SECRETS

### 10.1 Secrets cần thiết (đã được set)

```
Các biến mật này đã được cấu hình trên Cloudflare:
  • JWT_SECRET           — Mã bảo vệ phiên đăng nhập
  • PAYOS_CLIENT_ID      — Tài khoản PayOS
  • PAYOS_API_KEY        — Khóa API PayOS
  • PAYOS_CHECKSUM_KEY   — Key kiểm tra tính toàn vẹn PayOS
  • ZALO_ACCESS_TOKEN    — (Sau launch) Kết nối Zalo OA
```

> 🔐 **BẢO MẬT:** Secrets này KHÔNG được chia sẻ cho bất kỳ ai. Nếu nghi ngờ bị lộ → Đổi ngay trong Cloudflare Dashboard.

### 10.2 Làm sao xem/đổi secrets

```
1. Mở terminal trên máy tính
2. Điều hướng đến thư mục project:
   cd /Users/macbook/FnB-Container-Caffe

3. Đổi secret:
   npx wrangler secret put JWT_SECRET
   npx wrangler secret put PAYOS_CLIENT_ID
   ...

4. Nhập giá trị mới khi được yêu cầu

5. Deploy lại:
   npx wrangler deploy
```

### 10.3 Tài khoản Admin — quản lý mật khẩu

```
Tạo tài khoản mới (script có sẵn):
  node worker/scripts/seed-admin.js

Biến môi trường cần set:
  ADMIN_EMAIL=email@example.com
  ADMIN_PASSWORD=matkhau
  KV_NAMESPACE_ID=789e7cf1894e4d4c9e8f8cd51b2dbe16
```

### 10.4 Cấu trúc Database (D1)

**Database name:** `fnb-caffe-db`
**Database ID:** `13260741-7795-431f-b491-7c8a17510bda`

Các bảng chính:
| Bảng | Lưu trữ |
|---|---|
| `users` | Thông tin khách hàng, hạng thành viên |
| `orders` | Đơn hàng, trạng thái, tổng tiền |
| `order_items` | Chi tiết món trong mỗi đơn |
| `tables` | Trạng thái bàn (trống/đang phục vụ) |
| `loyalty_wallets` | Ví cashback, số dư |
| `loyalty_transactions` | Lịch sử cộng/trừ cashback |
| `loyalty_points` | Điểm thành viên |
| `vouchers` | Mã giảm giá, điều kiện áp dụng |
| `referrals` | Giới thiệu bạn bè |
| `checkins` | Lịch sử điểm danh |
| `reservations` | Đặt bàn trước |
| `reviews` | Đánh giá món ăn |
| `staff` | Tài khoản nhân viên |
| `shifts` | Ca làm việc, báo cáo ca |

---

## 11. CHECKLIST KHỞI CHẠY

### 11.1 T-17 (17 ngày trước launch — đã hoàn thành)

```
✅ Code hoàn chỉnh — 25 API routes, 8 admin pages
✅ Database schema — D1 đã migrate
✅ Theme dark/light — Đã thêm vào 43/43 trang HTML
✅ Skeleton loading — Trang có dữ liệu tải chậm
✅ Mobile responsive — Tất cả trang xem được trên điện thoại
✅ SEO meta tags — Tất cả trang có title + description
✅ dist/ đồng bộ — Source và bản deploy giống nhau
```

### 11.2 T-7 (7 ngày trước — đã hoàn thành)

```
✅ PayOS đã setup + test thanh toán
✅ Admin account đã seed (admin@auraspace.vn)
✅ Loyalty system — 4 hạng + voucher + cashback + referral
✅ KDS board — 4 cột (pending/preparing/ready/served)
✅ POS flow — Đầy đủ chọn bàn → món → thanh toán
✅ Cron SLA — Chạy mỗi 5 phút kiểm tra đơn quá hạn
```

### 11.3 T-4 (4 ngày trước — đã hoàn thành)

```
✅ Smoke test đơn hàng — Tạo → Xử lý → Thanh toán ✅
✅ Smoke test loyalty — Đăng ký → Tích điểm → Tiers ✅
✅ Smoke test KDS — Gửi đơn → Chuyển trạng thái ✅
✅ Smoke test checkout — COD + PayOS QR ✅
✅ E2E test 25/25 scenarios — TẤT CẢ PASS ✅
```

### 11.4 T-1 (Hôm trước launch)

```
□ Treo biển "COMING SOON" tại quán
□ Test cuối: Tạo 1 đơn thật, thanh toán thật (nếu đã setup PayOS)
□ Kiểm tra máy in hóa đơn (nếu có)
□ Backup manual: Export dữ liệu mẫu từ Admin
□ Thông báo cho nhân viên: giờ mở cửa, cách dùng hệ thống
□ Chuẩn bị QR check-in in ra giấy, dán tại quán
```

### 11.5 LAUNCH DAY (06/06/2026)

```
08:00  MỞ CỬA
  ☐ Mở KDS, POS, Dashboard trên tất cả thiết bị
  ☐ Kiểm tra đơn đêm qua (nếu có) — xử lý hết
  ☐ Bật máy in, kiểm tra giấy

09:00  KHÁCH ĐẾN
  ☐ Hướng dẫn khách quét QR đăng ký thành viên
  ☐ Giới thiệu chương trình khai trương (voucher, cashback x2)
  ☐ Chụp hình check-in + hashtag #AURACafeSaDec

12:00  ĐIỂM DANH CA TRƯA
  ☐ Kiểm tra tổng doanh thu sáng
  ☐ Đảm bảo không có đơn nào bị kẹt

18:00  ĐIỂM DANH CA CHIỀU/TỐI
  ☐ Kiểm tra tổng doanh thu ngày
  ☐ Đảm bảo voucher còn đủ cho ngày mai

22:00  ĐÓNG CỬA
  ☐ Kiểm kê tiền mặt
  ☐ Đối chiếu doanh thu hệ thống vs sổ sách
  ☐ Đóng tất cả đơn chưa thanh toán
```

### 11.6 D+1 (Ngày sau launch)

```
  ☐ Chạy lệnh kiểm tra đơn quá hạn (SLA):
      npx wrangler dev (hoặc kiểm tra cron trên Cloudflare Dashboard)

  ☐ Debrief:
      - Doanh thu Launch Day vs mục tiêu
      - Sự cố gặp phải + cách xử lý
      - Feedback khách hàng
      - Điều chỉnh cho tuần sau

  ☐ Kiểm tra số voucher đã phát còn lại
  ☐ Xác nhận referral bonus được trả đúng
```

---

## 12. PHÂN TÍCH TÀI CHÍNH

### 12.1 5 Kịch bản Doanh thu (mục tiêu 100 triệu/tháng)

| Chỉ số | Khai trương (tháng 1) | Thường (tiêu chuẩn) | Khách quen cao | Đổi nước nhiều | Vãng lai |
|---|---|---|---|---|---|
| Doanh thu gộp | 100M | 100M | 100M | 100M | 100M |
| Phủ thành viên | 80% | 50% | 90% | 70% | 20% |
| Tỷ lệ dùng voucher | 60% | 10% | 5% | 20% | 5% |
| Cashback tiêu | -20M | -15M | -25M | -20M | -5M |
| **Tiền mặt thực thu** | **65M** | **83M** | **74M** | **76M** | **94M** |
| COGS (30%) | -30M | -30M | -30M | -31.8M | -30M |
| Lợi nhuận ròng | **+18.1M** | **+42.9M** | **+32.5M** | **+33.8M** | **+54.0M** |

> 💰 **Kết luận:** Ngay cả tháng khai trương (chi phí khuyến mãi cao nhất) vẫn có lãi **18.1M**. Tháng thường lên đến **42.9M** biên ròng. Hệ thống tự cân bằng tài chính — không lo thâm hụt.

### 12.2 Bảo chứng dòng tiền

Qua phân tích chi tiết chu kỳ Referral (A giới thiệu B):
```
Tổng dòng tiền mặt thu về: +110.000đ (DƯƠNG)

Quán KHÔNG bị thâm hụt vì:
1. Cashback tối đa 50% ví/đơn → Khách buộc trả 50% tiền mặt
2. COGS 30% được bù đắp hoàn toàn
3. Voucher giảm giá được giới hạn cap
```

### 12.3 Ngân sách khuyến mãi khai trương (3 ngày)

| Hạng mục | Số tiền | Ghi chú |
|---|---|---|
| Thưởng đăng ký (100 người × 50k) | 5.000.000đ | Cho 100 khách đầu |
| Thưởng referral (A+B) | Theo thực tế | Phát sinh khi khách mua |
| Cashback x2 | Theo doanh thu | Tự động từ hệ thống |
| Voucher AURA20 (ngày 6/6) | Tối đa 50k/đơn | Giới hạn cap |
| Voucher AURA10 (7/6-13/6) | Tối đa 30k/đơn | Giới hạn cap |

---

## 13. TÀI LIỆU ĐÍNH KÈM & ĐƯỜNG DẪN NGUỒN

| File | Vị trí | Mô tả |
|---|---|---|
| **CEO-HANDOVER.md** | `CEO-HANDOVER.md` | Tài liệu này — Bàn giao tổng thể |
| **Launch Day Runbook** | `plans/launch-day-runbook.md` | T-17 checklist, smoke tests, launch day SOP, rollback |
| **Go-Live Checklist** | `plans/go-live-checklist.md` | Deploy checklist, E2E test plan, verification |
| **Loyalty Handbook** | `docs/loyalty_grand_opening_handbook.md` | Hướng dẫn sử dụng loyalty cho chủ quán |
| **Tier Definitions** | `docs/loyalty_tier_definitions.md` | Chi tiết 4 hạng Bronze/Silver/Gold/Platinum |
| **Cashback Schema** | `docs/loyalty-cashback-schema.md` | Cấu trúc dữ liệu ví cashback |
| **Cart/Checkout Audit** | `docs/CART-CHECKOUT-AUDIT.md` | Audit luồng giỏ hàng → thanh toán |
| **Backend Proposals** | `docs/backend-proposals.md` | Roadmap tính năng backend |
| **CTO Handoff** | `plans/cto-handoff.md` | Checklist kỹ thuật chuyển giao cho dev |
| **Wrangler Config** | `worker/wrangler.toml` | Cấu hình Cloudflare Workers |
| **Admin Seed Script** | `worker/scripts/seed-admin.js` | Script tạo tài khoản admin |

---

## 14. LƯU Ý BẢO MẬT & HẠN MỨC FREE TIER

### 14.1 Bảo mật — BẮT BUỘC

```
✅ Đổi mật khẩu Admin mặc định NGAY SAU LẦN ĐĂNG NHẬP ĐẦU
✅ Không chia sẻ JWT_SECRET hoặc bất kỳ secret nào
✅ Không commit secrets vào Git
✅ Chỉ Owner + Manager được cấp quyền truy cập Admin
✅ Nhân viên Staff không được cấp quyền xóa dữ liệu
✅ Kiểm tra đăng nhập lạ trong Admin → Staff (nếu thấy tài khoản không rõ → khóa ngay)
✅ Cập nhật mật khẩu nhân viên khi nghỉ việc
```

### 14.2 Giám sát sử dụng Cloudflare Free Tier

```
Truy cập: https://dash.cloudflare.com
→ Workers & Pages → aura-space-worker
→ Kiểm tra:
  • Requests/ngày (giới hạn 100.000)
  • CPU time/ngày
  • Errors log

Cảnh báo khi:
  ⚠️ Requests > 80.000/ngày (gần chạm giới hạn)
  ⚠️ Có nhiều lỗi 5xx (server error)
  ⚠️ Cron job không chạy (kiểm tra mục Cron trên Dashboard)
```

### 14.3 Nâng cấp lên Paid Plan (khi cần)

```
Nếu vượt quá Free Tier:

1. Cloudflare Workers Paid ($5/tháng):
   • 10 triệu requests/ngày (vs 100k free)
   • CPU time không giới hạn

2. Cách nâng:
   Cloudflare Dashboard → Workers → Upgrade Plan
   → Thêm thẻ tín dụng → Xác nhận

3. Không cần thay đổi code gì — tự động hoạt động
```

---

## 15. LIÊN HỆ HỖ TRỢ & KÊNH LIÊN LẠC

### 15.1 Danh bạ liên hệ

| Vai trò | Tên | Liên hệ | Ghi chú |
|---|---|---|---|
| **Chủ Doanh Nghiệp** | [Điền tên] | [Điền SĐT/Zalo] | Quyền cao nhất |
| **Quản lý** | [Điền tên] | [Điền SĐT/Zalo] | Điều hành hàng ngày |
| **Kỹ thuật / Dev** | [Điền tên] | [Điền SĐT/Zalo/Telegram] | Sửa lỗi, cập nhật hệ thống |
| **Cloudflare Support** | cloudflare.com/support | support.cloudflare.com | Hỗ trợ hạ tầng |

### 15.2 Kênh liên lạc khẩn cấp

```
🚨 Lỗi hệ thống toàn bộ (không truy cập được):
  → Gọi kỹ thuật NGAY
  → Chuyển sang sổ sách giấy
  → Thông báo trên fanpage/Zalo group

⚠️ Lỗi PayOS (không thanh toán được):
  → Chuyển sang COD
  → Báo kỹ thuật trong giờ làm việc
  → Kiểm tra lại vào sáng hôm sau

💬 Câu hỏi thường gặp nhân viên:
  → Đọc phần [Bảo trì & Khắc phục sự cố](#8) trước
  → Nếu không giải quyết được → Gọi Quản lý
  → Quản lý không giải quyết được → Gọi Kỹ thuật
```

### 15.3 Tài nguyên học thêm

| Tài nguyên | Link / Đường dẫn |
|---|---|
| Cloudflare Workers Docs | https://developers.cloudflare.com/workers/ |
| PayOS Developer Docs | https://developers.payos.vn/ |
| Wrangler CLI | Chạy `npx wrangler --help` |
| D1 Database Queries | Chạy `npx wrangler d1 execute fnb-caffe-db --remote --command "SELECT ..."` |

---

## 📋 TÓM TẮT NHANH (CHEAT SHEET)

> In ra giấy để nhân viên tiện tra cứu

### Đăng nhập Admin
```
URL: https://fnb-caffe-container.pages.dev/admin/login.html
Email: admin@auraspace.vn
```

### Trang quản lý
| Thao tác | Trang |
|---|---|
| Xem đơn → xử lý → thanh toán | Admin → POS |
| Xem báo cáo doanh thu | Admin → Dashboard |
| Duyệt đặt bàn | Admin → Reservations |
| Thêm nhân viên | Admin → Staff |
| Duyệt check-in | Admin → Check-in Approve |
| Xem/Kiểm tra đơn | Admin → Orders |
| Bếp xử lý món | KDS (màn hình bếp) |

### Chuyển trạng thái đơn
```
Mới → Chờ xác nhận → Đang làm → Sẵn sàng → Đã phục vụ → Đã thanh toán
                                    ↑                    ↓
                                    └──── Hủy đơn ←──────┘
```

### Chuyển đổi giao diện
```
Click nút 🌓 góc dưới phải mọi trang → Toggle Dark/Light mode
```

### Voucher khai trương
```
AURA20  → Giảm 20% (ngày 6/6)
AURA10  → Giảm 10% (7/6 - 13/6)
CHECKIN30K → Voucher 30k (check-in + chụp hình)
LOYALTY50  → +50k ví (100 khách đầu)
```

### Luồng bán chuẩn
```
Khách vào → Chọn bàn → Gọi món → Gửi bếp (KDS) →
Món xong → Mang ra → Thanh toán → Tích điểm → Khách ra
```

---

> **Tài liệu này được tạo tự động bởi hệ thống Claude AI.**
> **Ngày tạo:** 2026-06-04 | **Phiên bản:** 1.0
> **Cập nhật lần cuối:** Sau mỗi lần deploy hoặc thay đổi cấu hình lớn.

---

*— END OF DOCUMENT —*
