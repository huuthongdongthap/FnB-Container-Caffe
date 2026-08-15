# SOP 05 — Kho & Nguyen Vat Lieu

> **Ap dung:** AURA CAFE — Container Space, Sa Dec
> **Phu trach:** Manager, Owner
> **He thong:** Inventory Management (D1 database)
> **Cap nhat:** 2026-08-15

---

## A. TONG QUAN HE THONG KHO

### Phan loai kho
| Danh muc | Vi du | Don vi |
|----------|-------|--------|
| Ca phe | Hat, da xay | kg, g |
| Sua | Tuoi, dac, kem | lit, ml, hop |
| Tra | La tra, tra qua | kg, g, goi |
| Trai cay | Dau, xoai, chuoi, dua hau | kg, qua |
| Da | Vien, xay | kg, tui |
| Binh/Chai | Nuoc tinh khiet, Sting, Pepsi | chai, lon |
| Khac | Duong, siro, chanh, mat ong | kg, lit, chai |

### Cau truc du lieu
- **Inventory Items:** SKU, ten, danh muc, don vi, ton kho, min/max stock, nha cung cap
- **Inventory Transactions:** Phieu nhap/xuat/dieu chinh/pha che
- **Inventory Snapshots:** Bao cao tan kho ngay (opening/closing)
- **Recipes:** Cong thuc pha che moi mon
- **Recipe Ingredients:** Nguyen lieu can cho moi mon

---

## B. NHAP KHO

### B1. Kiem tra ton kho hang ngay
- [ ] Vao Inventory Management (Admin > Inventory)
- [ ] Xem ton kho tung nguyen lieu
- [ ] Danh dau can mua them (ton kho < min_stock)
- [ ] He thong tu dong canh bao khi duoi muc toi thieu

### B2. Tao phieu nhap
- [ ] Vao Inventory > Tao Phieu Nhap
- [ ] Chon nha cung cap
- [ ] Nhap: Nguyen lieu, so luong, don gia, tong tien
- [ ] Luu phieu nhap

### B3. Kiem tra hang nhap
- [ ] So luong dung voi phieu
- [ ] Chat luong (han su dung, tinh trang)
- [ ] Duyet nhap kho → he thong tu dong:
  - Tang `current_stock`
  - Ghi nhan transaction (type: "in")
  - Cap nhat gia tri kho

### B4. Luu y
- **Luon kiem tra** han su dung
- **Khong nhan** hang het han / sap het han (< 7 ngay)
- **Ghi nhan** ngay nhan, ngay het han
- **Luu hoaodon** (file/anh) de doi chieu

---

## C. XUAT KHO (PHA CHE)

### C1. Tu dong (theo don hang)
1. KDS nhan don → he thong tu dong tru ton kho theo cong thuc
2. Vi du: "Ca phe sua" → tru 20g ca phe + 100ml sua + da
3. Transaction type: "out" — lien ket order_id
4. Ton kho thieu → canh bao "Het nguyen lieu"

### C2. Thuong (bottled drinks)
1. KDS nhan don Sting/Pepsi/Nuoc tinh khiet
2. Tru 1 khoi tu inventory
3. Don vi: "chai" hoac "lon"

### C3. Thu cong (neu khong dung tu dong)
1. Chon mon can lam
2. Nhap so luong nguyen lieu da dung
3. He thong ghi nhan transaction

---

## D. KIEM KE

### D1. Hang ngay (Closing Stock)
1. Cuoi ngay, Manager chup anh/tinh ton kho
2. Vao Inventory > Snapshots → Nhap closing stock
3. He thong tinh tu dong:
   - Opening stock
   - + Nhap kho
   - - Xuat kho (theo don hang)
   - = Expected closing stock
4. **So sanh expected voi thuc te:**
   - Trung khop → OK
   - Thua → Kiem tra lai
   - Thieu → Kiem tra (pha che loi? An trom? Hao hut?)

### D2. Hang tuan
- [ ] Dem tat ca nguyen lieu
- [ ] Doi chieu voi he thong
- [ ] Ghi nhan chenh lech
- [ ] Chenh lech > 5% → bao cao Owner

### D3. Hang thang
- [ ] Tong hop ton kho, gia tri kho
- [ ] Xuat bao cao CSV
- [ ] Doi chieu voi doanh thu (COGS = 30%)

---

## E. CANH BAO & TU DONG

### Canh bao ton kho thap
- He thong tu dong canh bao khi `current_stock < min_stock`
- Hien tren Dashboard: "Can mua them: [ten nguyen lieu]"
- Uu tien mua: Duoi 20% max_stock

### Tu dong tru kho
- Don hang thanh cong → tru kho tu dong
- Khong du kho → "Het hang" tren KDS
- Staff co the **ghi de** neu can thiet

### Phan tich hao hut
- Binh thuong: COGS 30%
- Bat thuong (> 35%): Kiem tra nguyen nhan
- Thap (< 25%): Co the ghi thieu so lieu

---

## F. QUAN LY NHA CUNG CAP

### Danh sach
- Luu trong he thong: Ten, SDT, dia chi, mat hang
- Cap nhat khi co nha cung cap moi

### Dat hang
1. Xac dinh can mua (tu canh bao ton kho thap)
2. Lien he nha cung cap → dat hang
3. Nhan hang → kiem tra → nhap kho
4. Luu hoa don

---

## G. CONG THUC (RECIPES)

### Them cong thuc
1. Vao Inventory > Recipes
2. Chon mon → Nhap:
   - Ten cong thuc
   - Huong dan pha che
   - Thoi gian chuan bi (phut)
   - So luong thanh pham (yield)
3. Them nguyen lieu: Chon tu inventory, nhap so luong, don vi

### Vi du
```
MON: Ca Phe Sua (tc002) — 25,000 VND
Thoi gian: 5 phut | Yield: 1 ly 350ml

Nguyen lieu:
  - Ca phe hat: 20g (bat buoc)
  - Sua tuoi: 100ml (bat buoc)
  - Da vien: 150g (tuy chon — "it da")
  - Duong: 15g (tuy chon — "khong duong")

COGS: ~7,500 VND (30% gia ban)
```

---

## H. LUU Y QUAN TRONG

1. **Khong xoa** transaction da ghi — chi dieu chinh
2. **Luon ghi nhan** ly do dieu chinh
3. **Cap nhat ton kho** ngay khi nhan hang
4. **Kiem ke** truoc/sau ngay khai truong, su kien lon
5. **Luu hoa don** nha cung cap toi thieu **12 thang**
6. **Thong bao** Owner khi ton kho < 20% max_stock
