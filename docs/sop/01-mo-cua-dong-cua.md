# SOP 01 — Mo Cua & Dong Cua

> **Ap dung:** AURA CAFE — Container Space, Sa Dec
> **Phu trach:** Manager / Owner
> **Thoi gian:** ~30 phut mo cua, ~40 phut dong cua
> **Cap nhat:** 2026-08-15

---

## A. MO CUA (Truoc khi khach den)

### A1. Kiem tra he thong (5 phut)
- [ ] Bat may tinh quan ly / tablet KDS
- [ ] Dang nhap `auraspace.cafe/admin` (Owner/Manager)
- [ ] Kiem tra Dashboard: don hang hom nay, chi so doanh thu
- [ ] Kiem tra Internet, WiFi on dinh
- [ ] Kiem tra may in bill (neu co)

### A2. Chuan bi nguyen lieu dau ca (10 phut)
- [ ] Dun nuoc nong, pha tra, chuan bi da vien theo dinh bieu du bao doanh so
- [ ] Sap xep, lau sach cong cu phuc vu: khay bung nuoc, ly tra da, menu, may tinh bang/may POS order cam tay

### A3. Ve sinh khu vuc (10 phut)
- [ ] Ve sinh sach se ban ghe, lan can, sanh de xe duoc phan cong tu Truong ca
- [ ] Kiem tra khu vuc Restroom: dam bao nuoc rua tay, giay ve sinh, tinh dau luon day du, be mat kho ram, sach se
- [ ] Bat he thong am thanh, mo nhac, mo tivi theo khung gio chuan (Sang: 06:00 - 10:00; Chieu: 18:00 - 22:00)
- [ ] Thuc hien tuoi cay, set up hoa tai quay/banh dinh ky

### A4. Kiem tra ban & QR (5 phut)
- [ ] Duyet tat ca ban: Indoor, Outdoor, Rooftop
- [ ] Kiem tra QR code tren moi ban — sac net, khong bi che
- [ ] Neu QR bi mo — in lai tu Admin > QR Generator
- [ ] Dat lai ban "Occupied" thanh "Available" neu khach da di hom qua
- [ ] Kiem tra thiet bi: TV menu, loa, den, may lanh

### A5. Kiem tra KDS — Kitchen Display (3 phut)
- [ ] Mo KDS tai `/kds` hoac `/mobile/kds` tren tablet bep
- [ ] Xac nhan KDS ket noi may chu (thay "Connected" hoac mau xanh)
- [ ] Kiem tra am thanh bao moi (tieng "ding" khi co don moi)
- [ ] Xoa don cu neu co don "stuck" tu hom truoc

### A6. Kiem tra thuc don & khuyen mai (5 phut)
- [ ] Vao Admin > Menu Management (`/admin/manage-menu`)
- [ ] Tat ca mon dang "Available" (con hang)
- [ ] Mon het nguyen lieu → chuyen "Unavailable"
- [ ] Vao Admin > Promotions — kiem tra ma giam gia con hieu luc
- [ ] Vao Admin > Reservations — xem dat cho hom nay

---

## B. DONG CUA (Sau khi khach roi di)

### B1. Kiem tra don hang cuoi ngay (10 phut)
- [ ] Vao Admin > Orders (`/admin/orders`)
- [ ] Loc theo ngay — xem tat ca don da "Paid" / "Served"
- [ ] Don con "Pending" / "Preparing" → xu ly het
- [ ] Xac nhan tat ca don da thanh toan

### B2. Kiem tra doanh thu (10 phut)
- [ ] Vao Admin > Sales Reports (`/admin/sales-reports`)
- [ ] Xem tong doanh thu ngay
- [ ] Theo phuong thuc: PayOS vs COD
- [ ] Doi chieu tien mat COD thu duoc
- [ ] Xuat CSV neu can

### B3. Doi chieu tien mat COD (5 phut)
- [ ] Dem tien mat thu tu don COD
- [ ] Trung khop voi tong don COD tren he thong
- [ ] Ghi nhan so tien vao phieu quy
- [ ] Neu thieu/thua > 50k → bao cao Owner ngay

### B4. Kiem tra kho (5 phut)
- [ ] Kiem tra nguyen lieu con lai
- [ ] Mon het nguyen lieu → chuyen "Unavailable"
- [ ] Ghi nhan can mua them

### B5. Ban giao ca & Ve sinh (10 phut)
- [ ] Thuc hien ban giao chi tiet cac ban khach dang dung nuoc chua thanh toan cho ca sau
- [ ] Ve sinh tolet, cac khu vuc cua quan, phan loai rac va tap ket rac dung noi quy dinh
- [ ] Cuoi ngay (ca toi) thu gom toan bo gat tan thuoc la, thung chua rac — rua sach up hoac lau kho
- [ ] **Luu y:** Doi voi ca toi, chi tien hanh don de chuyen sau va lau san khu vuc Restroom sau 21:30 de tranh gay gian doan va bat tien cho trai nghiem khach hang cuoi ca

### B6. Kiem tra loyalty & he thong (5 phut)
- [ ] Tong diem/cashback phat sinh hom nay
- [ ] Khach tang hang (tier upgrade) → chuc mung
- [ ] KDS — xoa don cu, de trong cho ngay mai
- [ ] TV Menu — tat hoac de che do dem
- [ ] Kiem tra Service Worker — cap nhat neu can

### B7. Bao cao cuoi ngay (5 phut)
- [ ] Gui bao cao cho Owner qua Telegram/Zalo:
  - Tong doanh thu, so don hang
  - Phuong thuc thanh toan
  - Khach moi / Khach quen
  - Van de can luu y
- [ ] Luu nhat ky dong cua

---

## C. TRUONG HOP PHAT SINH

### Mat Internet
1. Kiem tra modem/router
2. Reset modem (cat dien 30s, gan lai)
3. Chuyen sang 4G hotspot (dien thoai Manager)
4. Mat > 30 phut → bao cao Owner

### Mat Dien
1. Kiem tra CB cong (circuit breaker)
2. Bat may gen (neu co)
3. KDS tu dong chuyen offline mode tren dien thoai staff
4. Khach van quet QR dat hang (PWA offline)

### He thong loi
1. Reload trang admin (F5 / Cmd+R)
2. Dang nhap lai neu can
3. Kiem tra: `auraspace.cafe/api/health`
4. Khong khuc phuc → goi Zalo ho tro
