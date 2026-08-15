# SOP 06 — Quan Ly Nhan Vien

> **Ap dung:** AURA CAFE Sa Dec
> **Nguoi thuc hien:** Owner, Manager
> **He thong:** Staff Management + Shift Tracking

---

## A. HE THONG PHAN QUYEN (RBAC)

### A1. Cac vai tro

| Vai tro | So nguoi | Quyen chinh | Gioi han |
|---------|----------|-------------|----------|
| **Owner** | 1-2 | Toan quyen he thong | Khong |
| **Manager** | 1-2 | Quan ly don, kho, nhan vien | Khong xoa, khong quan ly staff |
| **Staff** | 2-4 | Xem don, cap nhat trang thai, KDS | Khong vao settings |
| **Waiter** | 2-4 | Tao don, thu tien, quan ly ban | Chi xem don cua minh |

### A2. Chi tiet quyen theo hanh dong

| Hanh dong | Owner | Manager | Staff | Waiter |
|-----------|-------|---------|-------|--------|
| **Xem Dashboard** | ✅ | ✅ | ❌ | ❌ |
| **Quan ly Don hang** | ✅ | ✅ | ✅ (xem) | ✅ (tao) |
| **KDS (Bep)** | ✅ | ✅ | ✅ | ❌ |
| **Quan ly Menu** | ✅ | ✅ | ❌ | ❌ |
| **Quan ly Kho** | ✅ | ✅ | ❌ | ❌ |
| **Quan ly Nhan vien** | ✅ | ❌ | ❌ | ❌ |
| **Quan ly Ca lam** | ✅ | ✅ | ✅ (xem) | ✅ (clock in/out) |
| **Quan ly Khach hang** | ✅ | ✅ | ✅ (xem) | ❌ |
| **Xem Bao cao** | ✅ | ✅ | ❌ | ❌ |
| **Quan ly Khuyen mai** | ✅ | ✅ | ❌ | ❌ |
| **Quan ly Dat cho** | ✅ | ✅ | ❌ | ❌ |
| **Thanh toan / Hoan tien** | ✅ | ✅ (<500k) | ❌ | ✅ (thu tien) |
| **Nhan vien Duyet check-in** | ✅ | ✅ | ✅ | ✅ |
| **Quan ly Thong bao** | ✅ | ✅ | ❌ | ❌ |
| **Xem Audit Log** | ✅ | ✅ | ❌ | ❌ |
| **Dang ky Staff moi** | ✅ | ❌ | ❌ | ❌ |

---

## B. QUY TRINH DANG KY NHAN VIEN

### B1. Owner tao tai khoan nhan vien
1. Vao Admin > Staff Management (`/admin/staff`)
2. Bam "Them Nhan Vien"
3. Nhap thong tin:
   - Ho ten
   - Email
   - Vai tro (Manager/Staff/Waiter)
   - So dien thoai (de dang nhap mobile)
4. He thong tao tai khoan → gui thong bao cho nhan vien
5. Nhan vien nhan email/SMS huong dan dang nhap

### B2. Nhan vien dang nhap lan dau
1. Vao `auraspace.cafe/admin` (web) hoac `/mobile` (dien thoai)
2. Dang nhap bang email + mat khau
3. Doi mat khau lan dau (bat buoc)
4. Hoan thanh thong tin ca nhan

### B3. Dang nhap Mobile (Staff)
1. Vao `/mobile/login` tren dien thoai
2. Nhap so dien thoai + PIN
3. He thong xac thuc → vao KDS/Orders/Tables

---

## C. QUAN LY CA LAM (SHIFTS)

### C1. Cau hinh ca lam
- **Ca sang:** 06:00 — 12:00
- **Ca chieu:** 12:00 — 18:00
- **Ca toi:** 18:00 — 22:00
- (Tu cau hinh theo thuc te)

### C2. Quy trinh Clock In/Out
1. Nhan vien den quan → vao `/mobile` → bam "Clock In"
2. He thong ghi nhan thoi gian bat dau lam
3. Khi het ca → bam "Clock Out"
4. He thong tinh so gio lam viec

### C3. Xem lich su ca lam
1. Vao Admin > Shifts (`/admin/shifts`)
2. Loc theo nhan vien, ngay
3. Xem: gio bat dau, gio ket thuc, tong gio
4. Xuat CSV neu can

### C4. Luu y ca lam
- **Nhan vien bat buoc** phai clock in/out
- **Khong duoc** clock in cho nguoi khac
- **Quen clock out** → lien he Manager de sua
- **Tang ca** → ghi nhan vao "notes" de tinh luong

---

## D. DAO TAO NHAN VIEN

### D1. Onboarding (Ngay dau tien)
- [ ] Gioi thieu tong quan quan (vi tri, khu vuc, gio lam viec)
- [ ] Huong dan dang nhap he thong (web + mobile)
- [ ] Huong dan su dung KDS (nhan don, cap nhat trang thai)
- [ ] Huong dan quan ly ban (xem tinh trang, doi trang thai)
- [ ] Huong dan thu tien (COD, PayOS QR)
- [ ] Gioi thieu quy tac phuc vu khach
- [ ] Huong dan xu ly truong hop phat sinh
- [ ] Cap tai khoan + quyen phu hop

### D2. Quy tac phuc vu khach
1. **Chao don** — "Chao anh/ch, xin chao mung den AURA CAFE!"
2. **Gioi thieu** — "Day la menu cua chung toi, anh/ch co the quet QR de xem day du"
3. **Goi mon** — Huong dan quet QR hoac giup dat hang
4. **Xac nhan** — "Anh/ch co mon gi them khong?"
5. **Tra mon** — "Xin moi, mon cua anh/ch day!"
6. **Tam biet** — "Cam on anh/ch, hen gap lai!"

### D3. Quy tac phuc vu khach (tieng Anh)
1. "Welcome to AURA CAFE!"
2. "Here's our menu — you can scan the QR code to order"
3. "Would you like anything else?"
4. "Here's your order, enjoy!"
5. "Thank you, see you again!"

---

## E. CHAM CONG & LUONG

### E1. Du lieu cham cong
- He thong ghi nhan: gio in, gio out, tong gio
- Manager xac nhan cuoi thang
- Doi chieu voi bang luong

### E2. Tinh luong
| Vi tri | Luong co ban | Tang ca | Phu cap |
|--------|-------------|---------|---------|
| Manager | 8-12M/thang | 1.5x gio | Phu cap quan ly |
| Staff | 5-8M/thang | 1.5x gio | Phu cap ca toi |
| Waiter | 4-6M/thang | 1.5x gio | Tien tip khach |

### E3. Quy tac tienong
- **Tien tip** khach — luon thuoc ve nhan vien phuc vu
- **Khong duoc** chia tip (neu khong dong y cua ca nhom)
- **Tien phat** — chi ap dung khi vi pham nghiem trong (mat doanh thu, mat khach)

---

## F. QUY TRINH CHAM CONG (CHI TIET)

### F1. Nhan vien den lam
1. Mo app mobile → `/mobile`
2. Bam "Clock In"
3. He thong ghi nhan: `clock_in = 07:55`
4. Bat dau lam viec

### F2. Nhan vien ket thuc ca
1. Xac nhan tat ca don hang da xu ly xong
2. Tra ban, don dep khu vuc
3. Mo app → bam "Clock Out"
4. He thong ghi nhan: `clock_out = 12:05`
5. Tong gio: 4h 10 phut

### F3. Nhan vien quen clock out
1. Lien he Manager
2. Manager vao Admin > Shifts → sua clock_out thu cong
3. Ghi nhan ly do trong notes

---

## G. QUAN LY HIEU SUAT

### G1. Chi so danh gia
| Chi so | Don vi | Muc tieu |
|--------|--------|----------|
| So don hang phuc vu | don/ngay | > 20 don/ngay |
| Thoi gian phuc vu | phut | < 5 phut |
| Ty le loi khach phan nan | % | < 5% |
| So gio lam viec | gio/thang | > 160 gio |
| Ty le co mat | % | > 95% |

### G2. Ky luat
| Vi pham | Muc do | Hinh thuc |
|---------|--------|-----------|
| Quen clock in/out | Nhe | Nhac nho lan 1, phat lan 2 |
| Di muon > 15 phut | Trung binh | Phat 50k |
| Nghi khong phep | Nang | Phat 200k + canh bao |
| An cap / gian lanh | Rat nang | Sa thai ngay |

---

## H. LUU Y CHO MANAGER/OWNER

1. **Tao tai khoan** chi Owner duoc phep
2. **Cap nhat quyen** — kiem tra truoc khi thay doi
3. **Xoa tai khoan** — khong xoa, chi "Deactivate"
4. **Doi mat khau** — yeu cau nhan vien doi moi 3 thang
5. **Xem Audit Log** — kiem tra hanh dong bat thuong
6. **Gui thong bao** — dung he thong thong bao, khong chi Zalo
