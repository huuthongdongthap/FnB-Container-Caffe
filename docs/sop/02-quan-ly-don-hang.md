# SOP 02 — Quan Ly Don Hang

> **Ap dung:** AURA CAFE — Container Space, Sa Dec
> **Phu trach:** Tat ca staff (Waiter, Staff, Manager, Owner)
> **Cap nhat:** 2026-08-15

---

## A. DON HANG KHACH HANG (Customer Journey)

### A1. Khach den — Quet QR (2 phut)
1. Khach ngoi vao ban → quet QR tren ban
2. Trinh duyet mo: `auraspace.cafe/order?table=<so_ban>`
3. Khach nhap **Ten** + **So dien thoai** (bat buoc)
4. He thong tao don placeholder + danh dau ban "Occupied"

### A2. Khach dat hang (5-10 phut)
1. Duyet menu theo danh muc (Coffee, Tea, Soda...)
2. Chon mon, chon size/ty le da
3. Them ghi chu ("it da", "nhieu sua", "khong duong")
4. Xem lai gio hang → bam "Dat Hang"
5. Don gui toi KDS bep

### A3. KDS nhan don (1 phut)
1. Don moi hien o cot "Pending" + am thanh bao
2. Bep bam "Accept" → chuyen "Preparing"
3. Thoi gian chuan bi tu dong tinh

### A4. Bep hoan thanh (2-15 phut)
1. Bam "Ready" → chuyen cot "Ready"
2. Am thanh bao "Ready" → thong bao waiter
3. Waiter mang mon ra

### A5. Thanh toan
1. Xem tong tien tren dien thoai
2. Chon: PayOS QR hoac COD
3. PayOS — quet QR, he thong tu dong xac nhan
4. COD — tra tien mat cho waiter
5. Don chuyen "Paid"

### A6. Sau thanh toan
1. Khach nhan diem/tien hoa hong (neu thanh vien)
2. Khach co the danh gia don
3. Ban giai phong → "Available"

---

## B. DON HANG TAI BAN (POS / Waiter)

### B1. Waiter tao don
1. Mo dien thoai: `/mobile/orders`
2. Bam "Tao Don Moi" → chon ban
3. Chon mon, nhap so luong
4. Them ghi chu → Xac nhan
5. Don gui toi KDS

### B2. Khach thanh toan tai quay
1. Waiter xem don tren mobile
2. Bam "Thanh Toan" → chon COD hoac tao link PayOS
3. PayOS — hien QR cho khach quet
4. Xac nhan thanh toan

---

## C. TRANG THAI DON HANG

```
New → Pending → Confirmed → Preparing → Ready → Served → Paid
                                                   ↓
                                              Cancelled
```

| Tu | Den | Ai duoc phep | Dieu kien |
|----|-----|-------------|-----------|
| New | Pending | He thong | Tu dong |
| Pending | Confirmed | Staff/Manager | Xac nhan |
| Confirmed | Preparing | Bep/KDS | Bat dau lam |
| Preparing | Ready | Bep/KDS | Hoan thanh |
| Ready | Served | Waiter | Da mang ra |
| Served | Paid | Waiter/Manager | Da thanh toan |
| Any | Cancelled | Manager/Owner | Huy (bat buoc co ly do) |

### Quy tac:
- **Khong duoc xoa don** — chi duoc huy
- Don "Paid" **khong duoc huy**
- Moi thay doi deu duoc ghi nhan (audit log)

---

## D. THEO DOI REAL-TIME

### Customer Tracking
- Khach vao `/track-order` xem tinh trang
- Cap nhat real-time qua WebSocket

### Admin Monitoring
- Dashboard hien thi don theo thoi gian thuc
- Don "stuck" (> 15 phut) → canh bao do

### Am thanh KDS
- Don moi: 1 tieng "ding"
- Don "Ready": 2 tieng "ding ding"
- Don "Overdue": Canh bao lien tuc

---

## E. DON HANG BI LOI

### Khach khong nhan mon
1. Kiem tra trang thai don tren KDS
2. Da "Ready" → kiem tra waiter da mang chua
3. Mat → de xuat hoan tien / lam lai mien phi

### Don sai mon
1. Kiem tra ghi chu khach
2. Staff nhap sai → huy mon sai, lam lai
3. Khach doi mon → nhan yeu cau, cap nhat KDS

### Don bi kẹt (Stuck > 15 phut)
1. KDS hien canh bao do
2. Manager kiem tra: bep qua tai? Het nguyen lieu?
3. Uu tien don cu, huy neu khong the lam
4. Thong bao khach: "Mon cua ban bi tre. Ban co muon huy khong?"

---

## F. HUY DON HANG

### Quy tac
- Chi **Manager/Owner** co quyen huy
- **Bat buoc** nhap ly do
- Don "Paid" → chi hoan tien (refund), khong phai huy
- Don chua thanh toan → huy va giai phong ban

### Quy trinh
1. Admin > Orders → tim don → "Cancel" → nhap ly do
2. He thong tu dong:
   - Trang thai → "Cancelled"
   - Ban → "Available"
   - Audit log ghi nhan
   - Thong bao bep (neu dang lam)

---

## G. CHIA DON (Split Bill)

1. Vao don can chia → "Split Bill"
2. Chon mon can tach
3. He thong tao don moi
4. Moi don co thanh toan rieng

---

## H. LUU Y CHO STAFF

1. **Khong tang gia mon thu cong** — gia da cau hinh san
2. **Luon kiem tra ghi chu** truoc khi gui KDS
3. **Cap nhat trang thai ngay** — khach theo doi real-time
4. **Mat ket noi** — don gui khi co lai (offline queue)
5. **Moi don co ID** — dung ID de tra cuu
