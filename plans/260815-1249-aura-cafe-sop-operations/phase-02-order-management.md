# SOP 02 — Quan Ly Don Hang

> **Ap dung:** AURA CAFE Sa Dec
> **Nguoi thuc hien:** Tat ca staff (Waiter, Staff, Manager, Owner)

---

## A. QUY TRINH DON HANG KHACH HANG (Customer Journey)

### A1. Khach den quan — Quet QR (2 phut)
1. Khach ngoi vao ban, quet QR code tren ban bang dien thoai
2. Trinh duyet mo trang menu: `auraspace.cafe/order?table=<so_ban>`
3. Khach nhap **Ten** va **So dien thoai** (bat buoc)
4. He thong tao don hang placeholder + danh dau ban "Occupied"

### A2. Khach chon mon va dat hang (5-10 phut)
1. Khach duyet menu theo danh muc (Coffee, Tea, Soda, Smoothies...)
2. Chon mon, chon size/ty le da (neu co)
3. Them ghi chu (neu can: "it da", "nhieu sua", "khong duong")
4. Xem lai gio hang — chinh sua so luong
5. Bam "Dat Hang" — don hang gui toi KDS bep

### A3. KDS bep nhan don (1 phut)
1. KDS hien don moi o cot "Pending" + am thanh bao
2. Bep nhan don — bam "Accept" → chuyen sang "Preparing"
3. Thoi gian chuan bi tu dong tinh tu luc accept

### A4. Bep hoan thanh (2-15 phut)
1. Khi hoan thanh — bam "Ready" → chuyen sang cot "Ready"
2. Am thanh bao "Ready" — thong bao cho waiter
3. Waiter mang mon ra cho khach

### A5. Khach thanh toan
1. Xem tong tien tren dien thoai (hoac nhan tu staff)
2. Chon phuong thuc thanh toan: PayOS QR hoac COD
3. Neu PayOS — quet QR thanh toan, he thong tu dong xac nhan
4. Neu COD — tra tien mat cho waiter
5. Don hang chuyen sang "Paid"

### A6. Sau thanh toan
1. Khach nhan diem/tien hoa hong (neu la thanh vien loyalty)
2. Khach co the danh gia (review) don hang
3. Ban duoc giai phong — chuyen thanh "Available"

---

## B. QUY TRINH DON HANG TAI BAN (POS / Waiter)

### B1. Waiter tao don cho khach
1. Dung dien thoai mobile: `/mobile/orders`
2. Bam "Tao Don Moi" — chon ban
3. Chon mon tu menu, nhap so luong
4. Them ghi chu (neu khach yeu cau)
5. Xac nhan — don gui toi KDS

### B2. Khach thanh toan tai quay
1. Waiter xem don tren mobile
2. Bam "Thanh Toan" — chon COD hoac tao link PayOS
3. Neu PayOS — hien QR cho khach quet
4. Xac nhan thanh toan thanh cong

---

## C. QUAN LY TRANG THAI DON HANG

### Trang thai don hang (State Machine):
```
New → Pending → Confirmed → Preparing → Ready → Served → Paid
                                                   ↓
                                              Cancelled
```

### Quy tac chuyen trang thai:
| Tu | Den | Ai duoc phep | Dieu kien |
|----|-----|-------------|-----------|
| New | Pending | He thong | Tu dong khi tao |
| Pending | Confirmed | Staff/Manager | Xac nhan don |
| Confirmed | Preparing | Bep/KDS | Bat dau lam |
| Preparing | Ready | Bep/KDS | Hoan thanh |
| Ready | Served | Waiter | Da mang ra |
| Served | Paid | Waiter/Manager | Da thanh toan |
| Any | Cancelled | Manager/Owner | Huy don (ly do) |

### Luu y quan trong:
- **Khong duoc xoa don** — chi duoc huy voi ly do
- Don da "Paid" **khong duoc huy**
- Don "Cancelled" van hien thi trong lich su de kiem toan
- Moi thay doi trang thai deu duoc ghi nhan (audit log)

---

## D. THEO DOI DON HANG REAL-TIME

### D1. Customer Tracking
1. Khach vao `/track-order` de xem tinh trang don
2. He thong cap nhat real-time qua WebSocket
3. Khach thay: "Dang xu ly" → "Dang lam" → "San sang" → "Da giao"

### D2. Admin Monitoring
1. Dashboard hien thi don hang theo thoi gian thuc
2. Don "stuck" (qua 15 phut chua ready) → bao canh do
3. Co the filter theo: trang thai, ban, phuong thuc thanh toan

### D3. Am thanh bao (KDS)
- Don moi: Tieng "ding" 1 lan
- Don "Ready": Tieng "ding ding" 2 lan
- Don "Overdue" (qua 15 phut): Canh bao am thanh lien tuc

---

## E. DON HANG BI loi

### E1. Khach khong nhan duoc mon
1. Kiem tra trang thai don tren KDS — da "Ready" chua?
2. Neu da "Ready" — kiem tra waiter da mang ra chua
3. Neu chua — bao bep lam lai
4. Neu da mat — de xuat hoan tien hoac lam lai mien phi

### E2. Don hang sai mon
1. Kiem tra ghi chu cua khach — co de trong khong?
2. Neu staff nhap sai — huy mon sai, lam lai mon dung
3. Neu khach doi mon — nhan yeu cau, cap nhat tren KDS

### E3. Don bi kẹt (Stuck)
1. Neu don > 15 phut chua "Ready" — KDS hien thi canh bao do
2. Manager kiem tra: bep bi qua tai? Nguyen lieu het?
3. Xu ly: uu tien don cu, huy don neu khong the lam
4. Thong bao khach: "Xin loi, mon cua ban bi tre. Ban co muon huy khong?"

---

## F. HUY DON HANG

### F1. Quy tac huy
- Chi **Manager/Owner** co quyen huy don
- **Bat buoc** phai nhap ly do huy
- Don da thanh toan — chi co the **hoan tien** (refund), khong phai huy
- Don chua thanh toan — co the huy va giai phong ban

### F2. Quy trinh huy
1. Vao Admin > Orders — tim don can huy
2. Chon "Cancel" → Nhap ly do
3. Xac nhan huy
4. He thong tu dong:
   - Chuyen trang thai → "Cancelled"
   - Giai phong ban → "Available"
   - Ghi nhan audit log
   - Thong bao bep (neu don dang lam)

### F3. Hoan tien (Refund)
1. Vao Admin > Orders — tim don can hoan
2. Chon "Refund" → Chon phuong thuc (PayOS hoac tien mat)
3. Xac nhan hoan tien
4. He thong tao yeu cau hoan tien tren PayOS
5. Theo doi trang thai hoan tien (1-3 ngay lam viec)

---

## G. CHIA DON (Split Bill)

### G1. Khi nao can chia don
- Nhom khach muon tra tach rieng
- Mot nguoi tra mon cua minh

### G2. Quy trinh
1. Vao don hang can chia
2. Chon "Split Bill" — chon mon can tach
3. He thong tao don moi voi cac mon da chon
4. Moi don co thanh toan rieng

---

## H. LUU Y CHO STAFF

1. **Khong bao gio** tang gia mon thu cong — gia da duoc cau hinh san
2. **Luon kiem tra** ghi chu cua khach truoc khi gui len KDS
3. **Cap nhat trang thai** ngay lap tuc — khach theo doi real-time
4. **Khi mat ket noi** — don van duoc gui khi co internet lai (offline queue)
5. **Moi don deu co ID** — dung ID de tra cuu, khong dung ten khach
