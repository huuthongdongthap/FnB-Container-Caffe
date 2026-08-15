# SOP 07 — Dat Cho & Quan Ly Ban

> **Ap dung:** AURA CAFE Sa Dec
> **Nguoi thuc hien:** Waiter, Staff, Manager, Owner
> **He thong:** Table Management + Reservations

---

## A. HE THONG BAN

### A1. Khu vuc (Zones)
| Khu vuc | Mo ta | Dung cho |
|---------|-------|----------|
| **Indoor** | Trong nha, dieu hoa | Khach binh thuong, hop |
| **Outdoor** | San thuong, co mai che | Khach thich ngoai troi |
| **Rooftop** | Tran mai, view canh | Suc, su kien nho |

### A2. Trang thai ban
| Trang thai | Mau sac | Y nghia |
|-----------|---------|---------|
| **Available** | Xanh la | Ban trong, co the don khach |
| **Occupied** | Do | Co khach dang ngoi |
| **Reserved** | Vang | Da dat truoc |
| **Overdue** | Cam | Qua thoi gian cho phep |

### A3. Quan ly ban tren he thong
1. Vao `/mobile/tables` hoac `/admin` → Tables
2. Xem danh sach ban theo khu vuc
3. Thay doi trang thai: Chon ban → Chon trang thai moi
4. Loc theo: khu vuc, trang thai

---

## B. QUY TRINH DON KHACH TU BAN (QR ORDERING)

### B1. Quet QR de dat hang
1. Khach ngoi vao ban → quet QR tren ban
2. Trinh duyet mo: `auraspace.cafe/order?table=<so_ban>`
3. He thong tu dong:
   - Tao don hang placeholder
   - Danh dau ban "Occupied"
   - Gan `table_id` vao don hang

### B2. Khach dat hang
1. Khach nhap **Ten** va **So dien thoai** (bat buoc)
2. Chon mon tu menu
3. Dat hang → KDS bep nhan don
4. Don hang duoc gan voi ban tu dong

### B3. Khach roi di
1. Don hang da thanh toan → ban tu dong chuyen "Available"
2. Neu khach roi di khong thanh toan → Manager chuyen "Available" thu cong
3. Ghi nhan ly do (neu co)

---

## C. QUY TRINH DAT TRUOC (RESERVATION)

### C1. Khach dat truoc online
1. Khach vao `/reservation` tren website
2. Nhap thong tin:
   - Ngay dat (ngay hom nay hoac ngay mai)
   - Gio den (gio mo cua — gio dong cua)
   - So khach (party size)
   - Ten, So dien thoai
   - Yeu cau dac biet (neu co)
3. He thong kiem tra tinh trang ban trong
4. Xac nhan dat → nhan thong bao

### C2. He thong kiem tra tinh trang
1. Loc ban theo khu vuc, suc chua
2. Kiem tra khong bi trung lich voi dat cu
3. Chon ban phu hop (suc chua >= so khach)
4. Neu khong co ban trong → thong bao "Het cho, vui long chon ngay/khac"

### C3. Manager quan ly dat cho
1. Vao Admin > Reservations (`/admin/reservations`)
2. Xem danh sach dat theo ngay
3. **Xac nhan** dat — cam ket giu cho
4. **Huy dat** — thong bao cho khach
5. **Danh dau khach den** — cap nhat trang thai

### D4. Trang thai dat cho
```
Pending → Confirmed → Arrived → Completed
    ↓           ↓          ↓
Cancelled   No-Show    Left Early
```

---

## D. QUY TRINH CHECK-IN TAI QUAY

### D1. Khach den khong dat truoc
1. Hoi khach: "Anh/ch co dat truoc khong?"
2. Neu **khong** → Kiem tra ban trong:
   - Xem tren mobile: `/mobile/tables`
   - Chon ban phu hop voi so khach
   - Danh dau "Occupied"
3. Huong dan khach: "Anh/ch co the quet QR tren ban de dat hang"

### D2. Khach den co dat truoc
1. Xac nhan ten / so dien thoai voi danh sach dat
2. Danh dau "Arrived" tren he thong
3. Huong dan khach den ban da dat
4. Ban tu dong chuyen "Occupied"

---

## E. QUAN LY BAN KHI KHACH NGOI LAU

### E1. Quy tac thoi gian
- **Binh thuong:** Khach ngoi 30-60 phut
- **Lau (> 2h):** Manager kiem tra — hoi khach can gi them khong
- **Qua lau (> 3h) va khong don moi:** Nhẹ nhàng de nghi giai phong ban

### E2. Ban bi "stuck"
1. Neu ban "Occupied" qua 3h ma khong co don moi
2. Manager lien he khach: "Anh/ch con su dung dich vu khong?"
3. Neu khach da di → chuyen "Available" + ghi nhan ly do

---

## F. CHINH SUA / HUY DAT CHO

### F1. Khach chinh sua dat
1. Khach lien he (Zalo/phone) de yeu cau thay doi
2. Manager tim dat → cap nhat: ngay, gio, so khach
3. Xac nhan voi khach

### F2. Khach huy dat
1. Khach thong bao huy (Zalo/phone/web)
2. Manager xac nhan huy → cap nhat trang thai
3. Ban duoc giai phong

### F3. Khach khong den (No-Show)
1. Neu khach den muon > 30 phut ma khong lien he
2. Manager danh dau "No-Show"
3. Ban duoc giai phong cho khach khac
4. Ghi nhan de theo doi (neu khach khong den nhieu lan → chan dat truoc)

---

## G. QUY TRINH GIAI QUYET VAN DE

### H1. Khach den ma ban da bi dat
1. Kiem tra he thong — ban nao dang "Reserved"
2. Dua khach den ban khac trong khu vuc
3. Neu khong co ban → de nghi cho 5-10 phut hoac den khung gio khac

### H2. Ban bi loi (ghi chu, sat)
1. Khach phan nan → xin loi
2. Chuyen khach den ban khac
3. Ghi nhan tinh trang ban → bao maintenance

### H3. QR code bi loi
1. Khach khong quet duoc → giao dien loi
2. **Loi 1:** Huong dan quet lai (dam bao sang, khong mo)
3. **Loi 2:** In lai QR tu Admin > QR Generator
4. **Loi 3:** Tao link truc tiep cho khach: `auraspace.cafe/order?table=X`

---

## H. PHAN QUYEN QUAN LY BAN

| Hanh dong | Waiter | Staff | Manager | Owner |
|-----------|--------|-------|---------|-------|
| Xem tinh trang ban | ✅ | ✅ | ✅ | ✅ |
| Doi trang thai ban | ✅ | ✅ | ✅ | �️ |
| Tao dat cho | ❌ | ❌ | ✅ | ✅ |
| Xac nhan dat cho | ❌ | ❌ | ✅ | ✅ |
| Huy dat cho | ❌ | ❌ | ✅ | ✅ |
| Tao QR moi | ❌ | ❌ | ✅ | ✅ |
| Xem lich su ban | ❌ | ❌ | ✅ | ✅ |
| Xuat bao cao | ❌ | ❌ | ✅ | ✅ |
