# SOP 03 — Thanh Toan & Quy

> **Ap dung:** AURA CAFE Sa Dec
> **Nguoi thuc hien:** Waiter, Staff, Manager, Owner
> **Muc do bao mat:** CAO — lien quan den tien te

---

## A. PHUONG THUC THANH TOAN

| Phuong thuc | Mo ta | Phi | Thoi gian xac nhan |
|-------------|-------|-----|-------------------|
| **PayOS QR** | Khach quet QR thanh toan truc tuyen | 2.5% | Tu dong (1-5s) |
| **COD** | Tien mat tai quay/ban | 0% | Ngay lap tuc |
| **MoMo** | Vi dien tu (ke hoach) | 1.5% | Tu dong (1-5s) |

---

## B. THANH TOAN PAYOS (Chinh)

### B1. Khach quet QR thanh toan
1. He thong tao link PayOS voi so tien chinh xac
2. Hien QR code tren dien thoai khach hoac KDS
3. Khach mo app ngan hang / vi dien tu → Quet QR
4. Xac nhan thanh toan trong app ngan hang
5. PayOS gui webhook xac nhan → He thong tu dong cap nhat

### B2. Quy trinh xac nhan (tu dong)
1. Webhook PayOS gui toi `auraspace.cafe/api/webhook/payos`
2. He thong kiem tra **chu ky HMAC-SHA256** (xac thuc signature)
3. Xac nhan so tien khop (amount mismatch → bao loi)
4. Cap nhat: `payment_status = paid`, `order_status = paid`
5. Cong diem/tien hoa hong loyalty (tu dong)
6. Gui thong bao Telegram cho admin
7. Gui email receipt cho khach (neu co email)

### B3. Xu ly loi PayOS
| Van de | Xu ly |
|--------|-------|
| QR het han (15 phut) | Tao link moi, khach quet lai |
| Khach quet nhung khong xac nhan | Kiem tra `payment_status` — neu "pending" → cho them 5 phut |
| Webhook bi loi | He thong tu dong retry (3 lan) |
| So tien khop (amount mismatch) | Huy link cu, tao link moi |
| Thanh toan thanh cong nhung he thong khong nhan | Kiem tra `/api/admin/payments/stuck` — xu ly thu cong |

### B4. Kiem tra thanh toan bi kẹt (Stuck Payments)
1. Vao `/admin` → Payments → Stuck Payments
2. Xem danh sach don thanh toan bi kẹt
3. Kiem tra trang thai tren PayOS dashboard
4. Xu ly:
   - Neu PayOS da confirm → cap nhat thu cong
   - Neu PayOS khong co giao dich → huy link, yeu cau khach thanh toan lai
   - Neu khong xac dinh → bao Owner

---

## C. THANH TOAN COD (Tien Mat)

### C1. Quy trinh thu tien
1. Don hang dat thanh cong → hien "COD" trong KDS
2. Waiter mang mon → thu tien mat tu khach
3. Waiter xac nhan "Da thu tien" tren mobile/KDS
4. He thong cap nhat `payment_status = paid`

### C2. Quy tac tien mat
- **Nhan tien truoc** — khach tra tien truoc khi nhan mon (neu don COD)
- **Dem ky** — tra truoc mat khach
- **Khong thoi tien** — neu khong co tien le, khach tra thua thi ghi nhan
- **Ghi nhan** — moi giao dich COD deu duoc ghi trong he thong

### C3. Doi chieu tien mat cuoi ngay
1. Dem tat ca tien mat thu duoc trong ngay
2. Doi chieu voi tong don COD tren he thong
3. **Phai trung khop 100%**
4. Neu thieu/thua:
   - Thieu < 50k: Ghi nhan, kiem tra lai ngay mai
   - Thieu > 50k: Bao cao ngay cho Owner
   - Thua: Kiem tra co don nao ghi nham khong

---

## D. HOAN TIEN (REFUND)

### D1. Khi nao hoan tien
- Khach thanh toan truc tuyen (PayOS) nhung khong nhan duoc mon
- Don hang bi huy sau khi da thanh toan
- Loi he thong lam tru tien sai

### D2. Quy trinh hoan tien PayOS
1. **Chi Owner/Manager** co quyen hoan tien
2. Vao Admin > Orders → Tim don → Chon "Refund"
3. Chon loai hoan:
   - **Hoan toan** — hoan 100% gia tri don
   - **Hoan mot phan** — nhap so tien can hoan
4. Xac nhan → He thong gui yeu cau hoan tien toi PayOS
5. **Thoi gian xu ly:** 1-3 ngay lam viec (PayOS xu ly)
6. Khach nhan tien ve tai khoan ngan hang goc

### D3. Hoan tien COD
- Khach da tra tien mat nhung can hoan
- **Tra tien mat truc tiep** tu quy
- Ghi nhan trong he thong: "Hoan tien COD — so tien — ly do"
- Khach ky nhan (neu co phieu)

### D4. Gioi han hoan tien
- Don da qua **7 ngay** → khong hoan tien (lien he Owner de xet)
- Hoan tien **> 500k VND** → can **Owner** phe duyet
- Moi don chi duoc hoan **toi da 1 lan** (khong hoan nhieu lan)

---

## E. QUAN LY QUY (CASH MANAGEMENT)

### E1. Quy tien mat
- **Nguoi quan ly:** Owner hoac Manager duoc uyen quyen
- **Tien quy dau ngay:** Dua vao so tien du de tra tien le (de xuat: 2M VND)
- **Luu y:** Khong dua tien quy vao he thong — chi ghi nhan so luong

### E2. Phieu quy
Moi giao dich tien mat deu phai co phieu quy:
```
PHIEU QUY — AURA CAFE
Ngay: ___/___/______
Loai: [ ] Thu  [ ] Chi
So tien: _____________ VND
Ly do: ________________
Nguoi thuc hien: ________
Nguoi kiem soat: ________
```

### E3. Kiem ke cuoi ngay
- [ ] Dem tat ca tien mat trong quy
- [ ] Doi chieu voi tong COD tren he thong
- [ ] Doi chieu voi tong doanh thu ngay
- [ ] Ghi nhan ket qua vao phieu kiem ke
- [ ] Gui bao cao cho Owner

---

## F. THANH TOAN VOI VÍ CASHBACK / DIEM

### F1. Su dung ví cashback
- Khach thanh vien co the dung toi **50% hoa don** bang ví cashback
- Ví duoc ap dung **sau** khi giam gia voucher
- Cashback moi chi duoc tinh tren **tien mat thuc te** sau giam

### F2. Doi diem lay thuong
1. Khach chon mon doi qua (trong muc Loyalty)
2. Kiem tra so du diem du (thieu diem → thong bao)
3. Xac nhan doi — tru diem, cap nhat voucher
4. Mon doi qua hien tren KDS nhu don binh thuong

### F3. Luu y
- **Khong duoc** cho khach dung cashback de tao cashback moi (no loop)
- **Khong duoc** cho khach dung diem da het han
- **Gioi han** toi da 50.000 VND cashback/don (100k ngay khai truong)

---

## G. CAP DO QUYEN THANH TOAN

| Hanh dong | Waiter | Staff | Manager | Owner |
|-----------|--------|-------|---------|-------|
| Thu tien COD | ✅ | ✅ | ✅ | ✅ |
| Tao link PayOS | ✅ | ✅ | ✅ | ✅ |
| Xac nhan thanh toan | ✅ | ✅ | ✅ | ✅ |
| Hoan tien < 500k | ❌ | ❌ | ✅ | ✅ |
| Hoan tien > 500k | ❌ | ❌ | ❌ | ✅ |
| Xem bao cao thanh toan | ❌ | ❌ | ✅ | ✅ |
| Doi chieu tien mat | ❌ | ❌ | ✅ | ✅ |

---

## H. TRUONG HOP PHAT SINH

### Mat ket noi khi khach thanh toan
1. Khach quet QR → mat internet → giao dich bi huy tren PayOS
2. **Khong sao** — khong tru tien khach
3. Yeu cau khach quet lai khi co internet
4. Neu da tru tien nhung khong xac nhan → kiem tra `/admin/payments/stuck`

### PayOS bao loi
1. Chuyen sang **COD** — khach tra tien mat
2. Bao cao cho Owner
3. Kiem tra lai PayOS dashboard

### Khach tra tien khong dung
- Tien gia / tien mat khong hop le → tu choi, giai thich
- Can ho tro → goi Manager
