# SOP 06 — Quan Ly Nhan Vien

> **Ap dung:** AURA CAFE — Container Space, Sa Dec
> **Phu trach:** Owner, Manager
> **He thong:** Staff Management + Shift Tracking
> **Cap nhat:** 2026-08-15

---

## A. HE THONG PHAN QUYEN (RBAC)

### Vai tro

| Vai tro | So nguoi | Quyen chinh |
|---------|----------|-------------|
| **Owner** | 1-2 | Toan quyen he thong |
| **Manager** | 1-2 | Quan ly don, kho, nhan vien |
| **Staff** | 2-4 | Xem don, cap nhat trang thai, KDS |
| **Waiter** | 2-4 | Tao don, thu tien, quan ly ban |

### Chi tiet quyen

| Hanh dong | Owner | Manager | Staff | Waiter |
|-----------|-------|---------|-------|--------|
| Xem Dashboard | ✅ | ✅ | ❌ | ❌ |
| Quan ly Don hang | ✅ | ✅ | ✅ (xem) | ✅ (tao) |
| KDS (Bep) | ✅ | ✅ | ✅ | ❌ |
| Quan ly Menu | ✅ | ✅ | ❌ | ❌ |
| Quan ly Kho | ✅ | ✅ | ❌ | ❌ |
| Quan ly Nhan vien | ✅ | ❌ | ❌ | ❌ |
| Quan ly Ca lam | ✅ | ✅ | ✅ (xem) | ✅ (clock) |
| Quan ly Khach hang | ✅ | ✅ | ✅ (xem) | ❌ |
| Xem Bao cao | ✅ | ✅ | ❌ | ❌ |
| Quan ly Khuyen mai | ✅ | ✅ | ❌ | ❌ |
| Quan ly Dat cho | ✅ | ✅ | ❌ | ❌ |
| Hoan tien < 500k | ✅ | ✅ | ❌ | ❌ |
| Hoan tien > 500k | ✅ | ❌ | ❌ | ❌ |
| Duyet check-in | ✅ | ✅ | ✅ | ✅ |
| Xem Audit Log | ✅ | ✅ | ❌ | ❌ |
| Dang ky Staff moi | ✅ | ❌ | ❌ | ❌ |

---

## B. DANG KY NHAN VIEN

### B1. Owner tao tai khoan
1. Vao Admin > Staff Management (`/admin/staff`)
2. Bam "Them Nhan Vien"
3. Nhap: Ho ten, Email, Vai tro, So dien thoai
4. He thong tao tai khoan → gui thong bao
5. Nhan vien nhan email/SMS huong dan dang nhap

### B2. Nhan vien dang nhap lan dau
1. Vao `auraspace.cafe/admin` (web) hoac `/mobile` (dien thoai)
2. Dang nhap bang email + mat khau
3. Doi mat khau lan dau (bat buoc)
4. Hoan thanh thong tin ca nhan

### B3. Dang nhap Mobile
1. Vao `/mobile/login` tren dien thoai
2. Nhap so dien thoai + PIN
3. He thong xac thuc → vao KDS/Orders/Tables

---

## C. CA LAM (SHIFTS)

### C1. Cau hinh
- Ca Sang (Ca A): 06:00 — 14:00
- Ca Chieu (Ca B): 14:00 — 22:00
- Ca Part-time (Ca C): Linh hoat tuy tinh hinh van hanh

### C2. Clock In/Out
1. Den quan → vao `/mobile` → bam "Clock In"
2. He thong ghi nhan gio bat dau
3. Het ca → bam "Clock Out"
4. He thong tinh gio lam viec

### C3. Xem lich su
1. Vao Admin > Shifts (`/admin/shifts`)
2. Loc theo nhan vien, ngay
3. Xem: gio in, gio out, tong gio
4. Xuat CSV neu can

### C4. Luu y
- **Bat buoc** clock in/out
- **Khong** clock in cho nguoi khac
- **Quen clock out** → lien he Manager
- **Tang ca** → ghi nhan vao "notes"

---

## D. DAO TAO

### D1. Onboarding (Ngay dau tien)
- [ ] Gioi thieu tong quan quan
- [ ] Huong dan dang nhap (web + mobile)
- [ ] Huong dan KDS (nhan don, cap nhat trang thai)
- [ ] Huong dan quan ly ban
- [ ] Huong dan thu tien (COD, PayOS)
- [ ] Gioi thieu quy tac phuc vu khach
- [ ] Huong dan xu ly truong hop phat sinh
- [ ] Cap tai khoan + quyen

### D2. Quy tac phuc vu khach
1. **Chao don:** "Chao anh/ch, xin chao mung den AURA CAFE!"
2. **Gioi thieu:** "Day la menu, quet QR de xem day du"
3. **Goi mon:** Huong dan quet QR hoac giup dat hang
4. **Xac nhan:** "Anh/ch co mon gi them khong?"
5. **Tra mon:** "Xin moi, mon cua anh/ch day!"
6. **Tam biet:** "Cam on anh/ch, hen gap lai!"

### D3. Tieng Anh
1. "Welcome to AURA CAFE!"
2. "Scan the QR code to order"
3. "Anything else?"
4. "Here's your order, enjoy!"
5. "Thank you, see you again!"

---

## E. CHAM CONG & LUONG

### E1. Du lieu cham cong
- He thong ghi nhan: gio in, gio out, tong gio
- Manager xac nhan cuoi thang
- Doi chieu voi bang luong

### E2. Luong
| Vi tri | Luong co ban | Tang ca | Phu cap |
|--------|-------------|---------|---------|
| Manager | 8-12M/thang | 1.5x | Quan ly |
| Staff | 5-8M/thang | 1.5x | Ca toi |
| Waiter | 4-6M/thang | 1.5x | Tien tip |

### E3. Tien tip
- Tien tip khach → thuoc ve nhan vien phuc vu
- Khong chia neu khong dong y cua ca nhom

---

## F. CHI TIET CLOCK IN/OUT

### Den lam
1. Mo app mobile → `/mobile`
2. Bam "Clock In"
3. He thong: `clock_in = 07:55`
4. Bat dau lam viec

### Ket thuc ca
1. Xac nhan don hang da xu ly xong
2. Tra ban, don dep khu vuc
3. Bam "Clock Out"
4. He thong: `clock_out = 12:05`
5. Tong gio: 4h 10 phut

### Quen clock out
1. Lien he Manager
2. Manager sua clock_out thu cong
3. Ghi nhan ly do

---

## G. HIEU SUAT

### Chi so danh gia
| Chi so | Muc tieu |
|--------|----------|
| Don hang phuc vu | > 20 don/ngay |
| Thoi gian phuc vu | < 5 phut |
| Ty loi khach phan nan | < 5% |
| Gio lam viec | > 160 gio/thang |
| Ty le co mat | > 95% |

### Ky luat
| Vi pham | Hinh thuc |
|---------|-----------|
| Quen clock in/out | Nhac nho, phat lan 2 |
| Di muon > 15 phut | Phat 50k |
| Nghi khong phep | Phat 200k + canh bao |
| An cap / gian lanh | Sa thai ngay |

---

## H. LUU Y CHO MANAGER/OWNER

1. **Tao tai khoan** — chi Owner
2. **Cap nhat quyen** — kiem tra truoc khi thay doi
3. **Xoa tai khoan** — khong xoa, chi "Deactivate"
4. **Doi mat khau** — moi 3 thang
5. **Xem Audit Log** — kiem tra hanh dong bat thuong
6. **Gui thong bao** — dung he thong, khong chi Zalo
