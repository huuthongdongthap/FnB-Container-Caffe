# SOP 01 — Mo Cua & Dong Cua

> **Ap dung:** AURA CAFE Sa Dec
> **Thoi gian thuc hien:** ~30 phut/moi buoc
> **Nguoi thuc hien:** Manager hoac Owner

---

## A. QUY TRINH MO CUA (Truoc khi khach den)

### A1. Kiem tra he thong (5 phut)
- [ ] Bat may tinh quan ly / tablet KDS
- [ ] Truy cap `auraspace.cafe/admin` — dang nhap tai khoan Owner/Manager
- [ ] Kiem tra Dashboard: don hang hom nay, chi so doanh thu
- [ ] Kiem tra Ket Noi: Internet, WiFi hoat dong on dinh
- [ ] Kiem tra May in bill (neu co)

### A2. Kiem tra KDS (Kitchen Display) (3 phut)
- [ ] Mo KDS tai `/kds` hoac `/mobile/kds` tren tablet bep
- [ ] Xac nhan KDS ket noi voi may chu (thay "Connected" hoac mau xanh)
- [ ] Kiem tra am thanh bao moi hoat dong (se co tieng "ding" khi co don moi)
- [ ] Xoa don cu (neu co don "stuck" tu hom truoc)

### A3. Kiem tra ban & khu vuc (10 phut)
- [ ] Duyet qua tat ca ban trong 3 khu: Indoor, Outdoor, Rooftop
- [ ] Dọn sach ban, tra lai ghe, lau ban
- [ ] Kiem tra QR code tren moi ban — dam bao sac net, khong bi che
- [ ] Neu QR bi mo — in lai tu Admin > QR Generator
- [ ] Kiem tra tinh trang ban tren he thong:
  - Vao `/mobile/tables` hoac `/admin` xem tinh trang
  - Dat lai ban "Occupied" thanh "Available" neu khach da di hom qua
- [ ] Kiem tra thiet bi: TV menu, loa, den, may lanh

### A4. Kiem tra thuc don (5 phut)
- [ ] Vao Admin > Menu Management (`/admin/manage-menu`)
- [ ] Kiem tra tat ca mon dang "Available" (con hang)
- [ ] Neu co mon het nguyen lieu — chuyen sang "Unavailable"
- [ ] Kiem tra gia chua thay doi (neu co dieu chinh gia)
- [ ] Kiem tra hinh anh mon an hien thi dung

### A5. Kiem tra khuyen mai (2 phut)
- [ ] Vao Admin > Promotions (`/admin/promotions`)
- [ ] Kiem tra ma giam gia con hieu luc: AURA10, WELCOME
- [ ] Kiem tra chien dich dang chay (neu co)
- [ ] Tat ma giam gia het han (neu co)

### A6. Kiem tra dat cho (5 phut)
- [ ] Vao Admin > Reservations (`/admin/reservations`)
- [ ] Xem danh sach dat cho hom nay
- [ ] Chuẩn bị bàn cho khách đặt trước
- [ ] Neu khach dat online qua Cal.com — xac nhan tren he thong

---

## B. QUY TRINH DONG CUA (Sau khi khach roi di)

### B1. Kiem tra don hang cuoi ngay (10 phut)
- [ ] Vao Admin > Orders (`/admin/orders`)
- [ ] Loc theo ngay hom nay — xem tat ca don da "Paid" / "Served"
- [ ] Kiem tra don nao con "Pending" hoac "Preparing" — xu ly het
- [ ] Xac nhan tat ca don da duoc thanh toan (payment_status = paid)

### B2. Kiem tra doanh thu (10 phut)
- [ ] Vao Admin > Sales Reports (`/admin/sales-reports`)
- [ ] Xem tong doanh thu ngay (daily revenue)
- [ ] Xem theo phuong thuc thanh toan: PayOS vs COD
- [ ] Doi chieu tien mat COD thu duoc voi tong don COD
- [ ] Xuat CSV neu can (Export button)

### B3. Kiem tra thanh toan COD (5 phut)
- [ ] Dem tien mat thu duoc tu don COD
- [ ] Kiem tra trung khop voi tong don COD tren he thong
- [ ] Ghi nhan so tien vao phieu quy (neu co)
- [ ] Neu thieu/thua — bao cao ngay cho Owner

### B4. Kiem tra kho (5 phut)
- [ ] Kiem tra nguyen lieu con lai (Inventory > `/admin` hoac KDS)
- [ ] Danh dau cac mon het nguyen lieu — chuyen "Unavailable"
- [ ] Ghi nhan can mua them (de danh sach mua hang)

### B5. Kiem tra loyaly (3 phut)
- [ ] Xem tong diem/cashback phat sinh hom nay (Admin > Loyalty)
- [ ] Kiem tra khach nao tang hang (tier upgrade) — chuc mung ho
- [ ] Kiem tra khach nao den han mat han cashback (cashback expiry)

### B6. Dong he thong (5 phut)
- [ ] KDS — xoa tat ca don cu, de trong cho ngay mai
- [ ] TV Menu — tat hoac de che do dem (neu co)
- [ ] Kiem tra Service Worker tren dien thoai staff — cap nhat neu can
- [ ] Xac nhan he thong da on dinh — khong con loi hien thi

### B7. Bao cao cuoi ngay (5 phut)
- [ ] Gui bao cao tong ket cho Owner qua Telegram/Zalo:
  - Tong doanh thu
  - So don hang
  - Phuong thuc thanh toan
  - Khach moi / Khach quen
  - Van de can luu y
- [ ] Luu nhat ky dong cua

---

## C. TRUONG HOP PHAT SINH

### Mat Internet
- [ ] Kiem tra modem/router
- [ ] Reset modem (cat dien 30s, gan lai)
- [ ] Chuyen sang 4G hotspot (dien thoai Manager)
- [ ] Neu mat > 30 phut — bao cao cho Owner

### Mat Dien
- [ ] Kiem tra CB cong (circuit breaker)
- [ ] Bat may gen (neu co)
- [ ] KDS se tu dong chuyen sang offline mode tren dien thoai staff
- [ ] Khach van co the quet QR de dat hang (PWA offline)

### He thong loi
- [ ] Reload trang admin (F5 / Cmd+R)
- [ ] Dang nhap lai neu can
- [ ] Kiem tra health check: `auraspace.cafe/api/health`
- [ ] Neu khong khac phuc — goi Zalo ho tro: [so dien thoai ho tro]

---

## THOI GIAN TONG CONG
| Buoc | Thoi gian |
|------|-----------|
| Mo cua | ~30 phut |
| Dong cua | ~40 phut |
| **Tong** | **~70 phut/ngay** |
