# SOP 03 — Thanh Toan & Quy

> **Ap dung:** AURA CAFE — Container Space, Sa Dec
> **Phu trach:** Waiter, Staff, Manager, Owner
> **Muc do bao mat:** CAO — lien quan den tien te
> **Cap nhat:** 2026-08-15

---

## A. PHUONG THUC THANH TOAN

| Phuong thuc | Phi | Thoi gian |
|-------------|-----|-----------|
| **PayOS QR** | 2.5% | Tu dong (1-5s) |
| **COD** (tien mat) | 0% | Ngay lap tuc |
| **MoMo** (ke hoach) | 1.5% | Tu dong (1-5s) |

---

## B. THANH TOAN PAYOS

### B1. Quy trinh
1. He thong tao link PayOS voi so tien chinh xac
2. Hien QR tren dien thoai khach / KDS
3. Khach mo app ngan hang → Quet QR → Xac nhan
4. PayOS webhook → He thong xac thuc HMAC-SHA256
5. Cap nhat: `payment_status = paid`
6. Cong diem/cashback loyalty (tu dong)
7. Gui thong bao Telegram + email receipt

### B2. Xu ly loi
| Van de | Xu ly |
|--------|-------|
| QR het han (15 phut) | Tao link moi |
| Khach quet nhung khong xac nhan | Cho 5 phut, kiem tra `payment_status` |
| Webhook loi | Tu dong retry 3 lan |
| So tien khop | Huy link cu, tao moi |
| Thanh toan thanh cong nhung he thong khong nhan | Kiem tra `/admin/payments/stuck` |

### B3. Stuck Payments
1. Vao `/admin` → Payments → Stuck Payments
2. Kiem tra trang thai tren PayOS dashboard
3. Xu ly:
   - PayOS confirm → cap nhat thu cong
   - PayOS khong co → huy, yeu cau khach thanh toan lai
   - Khong xac dinh → bao Owner

---

## C. THANH TOAN COD

### C1. Quy trinh
1. Don dat thanh cong → hien "COD" tren KDS
2. Waiter mang mon → thu tien mat
3. Xac nhan "Da thu tien" tren mobile/KDS
4. He thong cap nhat `payment_status = paid`

### C2. Quy tac tien mat
- **Nhan tien truoc** khi giao mon
- **Dem ky** truoc mat khach
- **Khong thoi tien** — ghi nhan thua thieu

### C3. Doi chieu cuoi ngay
1. Dem tat ca tien mat
2. Doi chieu voi tong don COD tren he thong
3. **Phai trung khop 100%**
4. Thieu/thua:
   - < 50k: Ghi nhan, kiem tra ngay mai
   - > 50k: Bao cao Owner ngay

---

## D. HOAN TIEN (REFUND)

### D1. Khi nao
- PayOS thanh toan nhung khong nhan mon
- Don huy sau khi da thanh toan
- Loi he thong tru tien sai

### D2. Quy trinh PayOS
1. Chi **Owner/Manager** co quyen
2. Admin > Orders → tim don → "Refund"
3. Chon: Hoan toan / Hoan mot phan
4. Xac nhan → Gui yeu cau toi PayOS
5. Thoi gian: 1-3 ngay lam viec
6. Khach nhan tien ve tai khoan goc

### D3. Hoan tien COD
- Tra tien mat truc tiep tu quy
- Ghi nhan trong he thong
- Khach ky nhan (neu co phieu)

### D4. Gioi han
- Qua 7 ngay → khong hoan (lien he Owner)
- > 500k → can Owner phe duyet
- Moi don chi hoan **toi da 1 lan**

---

## E. QUAN LY QUY

### E1. Quy tien mat
- Nguoi quan ly: Owner / Manager
- Tien quy dau ngay: 2M VND (de xuat)
- Khong dua tien quy vao he thong — chi ghi nhan so luong

### E2. Phieu quy
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
- [ ] Dem tat ca tien mat
- [ ] Doi chieu tong COD
- [ ] Doi chieu tong doanh thu
- [ ] Ghi nhan ket qua
- [ ] Gui bao cao Owner

---

## F. THANH TOAN VOI CASHBACK / DIEM

### Cashback
- Khach su dung toi **50% hoa don** bang ví cashback
- Ap dung **sau** giam gia voucher
- Cashback moi tinh tren **tien mat thuc te**

### Doi diem
1. Khach chon mon doi qua (Loyalty)
2. Kiem tra so du diem
3. Xac nhan → tru diem, cap nhat voucher
4. Mon doi qua hien tren KDS

### Quy tac
- **Khong** cho cashback tao cashback moi (no loop)
- **Khong** cho su dung diem het han
- **Gioi han** 50k cashback/don (100k ngay khai truong)

---

## G. PHAN QUYEN

| Hanh dong | Waiter | Staff | Manager | Owner |
|-----------|--------|-------|---------|-------|
| Thu tien COD | ✅ | ✅ | ✅ | ✅ |
| Tao link PayOS | ✅ | ✅ | ✅ | ✅ |
| Xac nhan thanh toan | ✅ | ✅ | ✅ | ✅ |
| Hoan tien < 500k | ❌ | ❌ | ✅ | ✅ |
| Hoan tien > 500k | ❌ | ❌ | ❌ | ✅ |
| Xem bao cao | ❌ | ❌ | ✅ | ✅ |
| Doi chieu tien mat | ❌ | ❌ | ✅ | ✅ |

---

## H. TRUONG HOP PHAT SINH

### Mat ket noi khi khach thanh toan
1. Khach quet QR → mat internet → giao dich bi huy tren PayOS
2. **Khong tru tien khach** — quet lai khi co internet

### PayOS bao loi
1. Chuyen sang COD
2. Bao cao Owner
3. Kiem tra PayOS dashboard

### Khach tra tien khong hop le
- Tien gia → tu choi, giai thich
- Can ho tro → goi Manager
