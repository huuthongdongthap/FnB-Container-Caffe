# SOP 07 — Dat Cho & Quan Ly Ban

> **Ap dung:** AURA CAFE — Container Space, Sa Dec
> **Phu trach:** Waiter, Staff, Manager, Owner
> **He thong:** Table Management + Reservations
> **Cap nhat:** 2026-08-15

---

## A. HE THONG BAN

### Khu vuc (Zones)
| Khu vuc | Mo ta | Dung cho |
|---------|-------|----------|
| **Indoor** | Trong nha, dieu hoa | Khach binh thuong, hop |
| **Outdoor** | San thuong, co mai che | Thich ngoai troi |
| **Rooftop** | Tran mai, view canh | Suc, su kien nho |

### Trang thai ban
| Trang thai | Mau | Y nghia |
|-----------|-----|---------|
| **Available** | Xanh la | Ban trong |
| **Occupied** | Do | Co khach |
| **Reserved** | Vang | Da dat truoc |
| **Overdue** | Cam | Qua thoi gian |

### Quan ly tren he thong
1. Vao `/mobile/tables` hoac `/admin` → Tables
2. Xem danh sach theo khu vuc
3. Doi trang thai: Chon ban → Chon trang thai moi
4. Loc theo: khu vuc, trang thai

---

## B. QR ORDERING (Khach tu dat)

### B1. Quet QR
1. Khach ngoi vao ban → quet QR
2. Trinh duyet mo: `auraspace.cafe/order?table=<so_ban>`
3. He thong tu dong:
   - Tao don placeholder
   - Danh dau ban "Occupied"
   - Gan `table_id` vao don

### B2. Khach dat hang
1. Nhap **Ten** + **So dien thoai** (bat buoc)
2. Chon mon tu menu
3. Dat hang → KDS bep nhan

### B3. Khach roi di
1. Don "Paid" → ban tu dong "Available"
2. Khach roi khong thanh toan → Manager chuyen "Available" thu cong

---

## C. DAT TRUOC (RESERVATION)

### C1. Khach dat online
1. Vao `/reservation` tren website
2. Nhap: Ngay, Gio den, So khach, Ten, SDT, Yeu cau
3. He thong kiem tra ban trong
4. Xac nhan → nhan thong bao

### C2. He thong kiem tra
1. Loc ban theo khu vuc, suc chua
2. Kiem tra khong trung lich
3. Chon ban phu hop (suc chua >= so khach)
4. Het cho → thong bao "Vui long chon ngay/khac"

### C3. Manager quan ly
1. Vao Admin > Reservations (`/admin/reservations`)
2. Xem theo ngay
3. **Xac nhan** dat → cam ket giu cho
4. **Huy dat** → thong bao khach
5. **Danh dau khach den** → cap nhat trang thai

### Trang thai
```
Pending → Confirmed → Arrived → Completed
    ↓           ↓          ↓
Cancelled   No-Show    Left Early
```

---

## D. CHECK-IN TAI QUAY

### Khach khong dat truoc
1. Hoi: "Anh/ch co dat truoc khong?"
2. **Khong** → Kiem tra ban trong:
   - Xem tren `/mobile/tables`
   - Chon ban phu hop
   - Danh dau "Occupied"
3. Huong dan: "Quet QR tren ban de dat hang"

### Khach co dat truoc
1. Xac nhan ten/SDT voi danh sach dat
2. Danh dau "Arrived"
3. Huong dan den ban
4. Ban tu dong "Occupied"

---

## E. BAN NGOI LAU

### Quy tac thoi gian
- **Binh thuong:** 30-60 phut
- **Lau (> 2h):** Manager hoi khach can gi them
- **Qua lau (> 3h, khong don moi):** Nhe nhang de nghi giai phong ban

### Ban bi "stuck"
1. "Occupied" > 3h, khong don moi
2. Manager lien he khach: "Anh/ch con su dung dich vu khong?"
3. Khach da di → "Available" + ghi nhan ly do

---

## F. CHINH SUA / HUY DAT

### Khach chinh sua
1. Lien he (Zalo/phone) yeu cau thay doi
2. Manager tim dat → cap nhat: ngay, gio, so khach
3. Xac nhan voi khach

### Khach huy dat
1. Thong bao huy
2. Manager xac nhan → cap nhat trang thai
3. Ban duoc giai phong

### No-Show
1. Den muon > 30 phut, khong lien he
2. Manager danh dau "No-Show"
3. Ban giai phong cho khach khac
4. Ghi nhan (neu khach khong den nhieu lan → chan dat truoc)

---

## G. GIAI QUYET VAN DE

### Ban da bi dat
1. Kiem tra he thong — ban "Reserved"
2. Dua khach den ban khac
3. Khong co ban → cho 5-10 phut hoac ngay/khac

### Ban bi loi
1. Xin loi khach
2. Chuyen ban khac
3. Ghi nhan → bao maintenance

### QR bi loi
1. Huong dan quet lai (dam bao sang)
2. In lai QR tu Admin > QR Generator
3. Tao link truc tiep: `auraspace.cafe/order?table=X`

---

## H. PHAN QUYEN

| Hanh dong | Waiter | Staff | Manager | Owner |
|-----------|--------|-------|---------|-------|
| Xem tinh trang ban | ✅ | ✅ | ✅ | ✅ |
| Doi trang thai ban | ✅ | ✅ | ✅ | ✅ |
| Tao dat cho | ❌ | ❌ | ✅ | ✅ |
| Xac nhan dat cho | ❌ | ❌ | ✅ | ✅ |
| Huy dat cho | ❌ | ❌ | ✅ | ✅ |
| Tao QR moi | ❌ | ❌ | ✅ | ✅ |
| Xem lich su ban | ❌ | ❌ | ✅ | ✅ |
