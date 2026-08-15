# SOP 05 — Kho & Nguyen Vat Lieu

> **Ap dung:** AURA CAFE Sa Dec
> **Nguoi thuc hien:** Manager, Owner
> **He thong:** Inventory Management (D1 database)

---

## A. TONG QUAN HE THONG KHO

### A1. Cau truc kho
- **Inventory Items:** SKU, ten, danh muc, don vi, ton kho hien tai, ton kho toi thieu/toi da
- **Inventory Transactions:** Phieu nhap/xuat/dieu chinh/pha che — moi giao dich deu duoc ghi nhan
- **Inventory Snapshots:** Bao cao tan kho ngay (opening/closing stock)
- **Recipes:** Cong thuc pha che moi mon (liên ket voi products)
- **Recipe Ingredients:** Nguyen lieu can cho moi mon

### A2. Phan loai kho
| Danh muc | Vi du | Don vi |
|----------|-------|--------|
| **Ca phe** | Ca phe hat, ca phe da xay | kg, g |
| **Sua** | Sua tuoi, sua dac, kem | lit, ml, hop |
| **Tra** | La tra, tra qua | kg, g, goi |
| **Trai cay** | Dau, xoai, chuoi, dua hau | kg, qua |
| **Da** | Da vien, da xay | kg, tui |
| **Binh/Chai** | Nuoc tinh khiet, Sting, Pepsi | chai, lon |
| **Nguyen lieu khac** | Duong, siro, chanh, mat ong | kg, lit, chai |

---

## B. QUY TRINH NHAP KHO

### B1. Kiem tra ton kho hang ngay
1. Vao Inventory Management (Admin > Inventory)
2. Xem ton kho hien tai cua tung nguyen lieu
3. Danh dau nguyen lieu can mua them (ton kho < min_stock)
4. He thong tu dong canh bao khi duoi muc toi thieu

### B2. Tao phieu nhap kho
1. Vao Inventory > Tao Phieu Nhap
2. Chon nha cung cap (supplier)
3. Nhap cac mon:
   - Nguyen lieu
   - So luong
   - Don gia
   - Tong tien
4. Luu phieu nhap

### B3. Kiem tra hang nhap
1. Kiem tra so luong dung voi phieu
2. Kiem tra chat luong (han su dung, tinh trang)
3. Duyet nhap kho — he thong tu dong:
   - Tang `current_stock`
   - Ghi nhan transaction (type: "in")
   - Cap nhat gia tri kho

### B4. Luu y nhap kho
- **Luon kiem tra** han su dung truoc khi nhan
- **Khong nhan** hang het han / sap het han (< 7 ngay)
- **Ghi nhan** ngay nhan, ngay het han (neu co)
- **Luu hoa don** (file hoac anh) de doi chieu

---

## C. QUY TRINH XUAT KHO (PHA CHE)

### C1. Xuat khi pha che
1. KDS nhan don hang → hien thi mon can lam
2. He thong tu dong **tru ton kho** theo cong thuc (recipe):
   - Vi du: "Ca phe sua" → tru 20g ca phe + 100ml sua + da
3. Transaction type: "out" — lien ket voi order_id
4. Neu ton kho thieu → he thong canh bao "Het nguyen lieu"

### C2. Xuat khi ban hang
- Bottled drinks (Sting, Pepsi, Nuoc tinh khiet):
  - KDS nhan don → tru 1 khoi tu inventory
  - Don vi: "chai" hoac "lon"

### C3. Xuat khi pha che (thu cong)
- Neu khong dung he thong tu dong:
  1. Staff chon mon can lam
  2. Nhap so luong nguyen lieu da dung
  3. He thong ghi nhan transaction

---

## D. KIEM KE & DANH GIA TON KHO

### D1. Kiem ke hang ngay (Closing Stock)
1. Cuoi ngay, Manager chup anh/tinh ton kho
2. Vao Inventory > Snapshots → Nhap closing stock
3. He thong tinh tu dong:
   - Opening stock (dau ngay)
   - + Nhap kho trong ngay
   - - Xuat kho trong ngay (theo don hang)
   - = Expected closing stock
4. **So sanh** expected voi thuc te:
   - **Trung khop** → OK
   - **Thua** → Kiem tra lai (co don bi ghi nham?)
   - **Thieu** → Kiem tra (pha che bi loi? An trom? Hao hut?)

### D2. Kiem ke hang tuan
1. Dem tat ca nguyen lieu trong kho
2. Doi chieu voi so lieu tren he thong
3. Ghi nhan chenh lech
4. Neu chenh lech > 5% → bao cao Owner

### D3. Kiem ke hang thang
1. Tong hop ton kho thang
2. Tinh gia tri kho
3. Xuat bao cao (CSV)
4. Doi chieu voi doanh thu (COGS = 30% doanh thu)

---

## E. CANH BAO & TU DONG

### E1. Canh bao ton kho thap
- He thong tu dong gui canh bao khi `current_stock < min_stock`
- Hien thi tren Dashboard: "Can mua them: [ten nguyen lieu]"
- Uu tien mua: Nguyen lieu duoi 20% max_stock

### E2. Tu dong tru kho khi dat hang
- Don hang thanh cong → he thong tru kho tu dong
- Neu khong du kho → hien "Het hang" tren KDS
- Staff co the **ghi de** (override) neu can thiet

### E3. Phan tich hao hut
- **Hao hut binh thuong** (COGS 30%): Du kien
- **Hao hut bat thuong** (> 35%): Kiem tra nguyen nhan
- **Khong hao hut** (< 25%): Co the ghi thieu so lieu

---

## F. QUAN LY NHA CUNG CAP

### F1. Danh sach nha cung cap
- Luu trong he thong: Ten, SDT, dia chi, mat hang
- Cap nhat khi co nha cung cap moi

### F2. Dat hang nha cung cap
1. Xac dinh can mua gi (tu canh bao ton kho thap)
2. Lien he nha cung cap — dat hang
3. Nhan hang → kiem tra → nhap kho
4. Luu hoa don de doi chieu

---

## G. CONG THUC (RECIPES)

### G1. Them cong thuc mon moi
1. Vao Inventory > Recipes
2. Chon mon can them cong thuc
3. Nhap:
   - Ten cong thuc
   - Huong dan pha che
   - Thoi gian chuan bi (phut)
   - So luong thanh pham (yield)
4. Them nguyen lieu:
   - Chon nguyen lieu tu inventory
   - Nhap so luong can
   - Don vi
   - Bat buoc / tuy chon
   - Ghi chu (neu co)

### G2. Vi du cong thuc
```
MON: Ca Phe Sua (tc002) — 25,000 VND
Thoi gian: 5 phut
Thanh pham: 1 ly 350ml

Nguyen lieu:
  - Ca phe hat: 20g (bat buoc)
  - Sua tuoi: 100ml (bat buoc)
  - Da vien: 150g (tuy chon — "it da")
  - Duong: 15g (tuy chon — "khong duong")

COGS: ~7,500 VND (30% gia ban)
```

---

## H. LUU Y QUAN TRONG

1. **Khong duoc** xoa transaction da ghi — chi duoc dieu chinh (adjustment)
2. **Luon ghi nhan** ly do dieu chinh (pha che sai, hao hut, mat cap)
3. **Cap nhat ton kho** ngay khi nhan hang — khong de tre
4. **Kiem ke truoc/sau** ngay khai truong, su kien lon
5. **Luu hoa don** nha cung cap toi thieu **12 thang**
6. **Thong bao** Owner ngay khi ton kho thap (< 20% max)
