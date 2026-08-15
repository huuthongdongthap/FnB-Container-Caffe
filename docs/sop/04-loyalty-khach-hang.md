# SOP 04 — Loyalty & Quan Ly Khach Hang

> **Ap dung:** AURA CAFE — Container Space, Sa Dec
> **Phu trach:** Tat ca staff, Manager, Owner
> **He thong:** Loyalty v2 — 4 hang, cashback, diem, referral, sinh nhat
> **Cap nhat:** 2026-08-15

---

## A. HE THONG HANG THANH VIEN

| Hang | Chi tieu | Cashback | He so diem | Sinh nhat | Han ví |
|------|----------|----------|-----------|-----------|--------|
| 🥉 **Bronze** | 0 — 500k | **3%** | x1.0 | Giam 10% | 90 ngay |
| 🥈 **Silver** | 500k — 5M | **5%** | x1.2 | Giam 20% | 120 ngay |
| 🥇 **Gold** | 5M — 15M | **7%** | x1.5 | Giam 35% | 180 ngay |
| 💎 **Platinum** | > 15M | **10%** | x2.0 | Giam 50% + Qua | Vinh vien |

### Quy tac tich luy
- **Diem =** (Tien sau giam) × he so hang / 1000
- **Cashback** = (Tien mat thuc te) × ty le hang
- **Khong tich luy** tren tien da dung tu ví cashback
- **Gioi han** cashback: 50k/don (100k ngay khai truong)

### Ví cashback
- Cong ngay sau thanh toan thanh cong
- Su dung toi **50% hoa don**
- Han su dung theo hang (Bronze 90 ngay → Platinum vinh vien)

---

## B. DANG KY THANH VIEN

### Online
1. Khach vao trang menu → nhap so dien thoai
2. He thong tao tai khoan → hang Bronze
3. Nhan thong bao chao mung (Zalo ZNS / SMS)

### Tai quay
1. Hoi khach: "Anh/ch co muon dang ky thanh vien AURA CAFE khong?"
2. Nhap so dien thoai, ten, email (neu co)
3. He thong tao tai khoan → hang Bronze

### Quy tac
- Moi so dien thoai chi dang ky 1 lan
- Dang nhap bang OTP/sdt (khong can mat khau)

---

## C. CASHBACK

### Tich luy
1. Khach thanh toan → he thong tu dong tinh cashback
2. Tien mat thuc te × ty le hang = cashback
3. Gioi han toi da 50k/don
4. Cong vao ví ngay lap tuc
5. Thong bao: "Ban da nhan X VND cashback!"

### Su dung
1. Khi thanh toan → he thong hien "Su dung ví: X VND"
2. Khach chon su dung → tru toi da 50% hoa don
3. Tien mat can tra = Hoa don - Cashback da su dung
4. Cashback cu duoc su dung truoc (FIFO)

### Tra loi khach
- "Cashback la gi?" → "Tien hoa hong quy khach duoc hoan lai sau moi don, dung cho don sau."
- "Tai sao chi dung 50%?" → "Quy dinh de dam bao dong tien on dinh."
- "Het han khi nao?" → "Bronze 90 ngay, Silver 120 ngay, Gold 180 ngay, Platinum vinh vien."

---

## D. DIEM

### Tich luy
- Diem = (Tien sau giam) × he so hang / 1000
- Vi du: Gold mua 100k → 100k × 1.5 / 1000 = 150 diem

### Doi diem
1. Vao Loyalty → "Thuong cua ban"
2. Chon mon doi
3. Kiem tra so du diem
4. Xac nhan → tru diem, tao voucher
5. Voucher hien tren KDS

### Gia tri doi
| Mon | Diem | Gia tri |
|-----|------|---------|
| Ca phe den | 100 | 20k |
| Ca phe sua | 125 | 25k |
| Tra | 150 | 30k |
| Sinh to | 175 | 35k |

**Chi doi mon tieu chuan** — khong doi mon dac biet.

---

## E. GIOI THIEU (REFERRAL)

### Co che
- Moi khach co **ma gioi thieu rieng**
- Nguoi gioi thieu nhan **10k cashback** khi ban be thanh toan don dau (>= 20k)
- Chan tu gioi thieu qua IP

### Quy trinh
1. Khach vao `/referral` → xem ma gioi thieu
2. Chia se voi ban be
3. Ban be nhap ma khi dang ky
4. Ban be thanh toan don dau → nguoi gioi thieu nhan 10k

### Tra loi khach
- "Ma gioi thieu cua toi?" → "Vao /referral, ma cua ban la: XXX"
- "Toi duoc bao nhieu?" → "10k cashback khi ban be thanh toan don dau >= 20k."

---

## F. SINH NHAT

### Co che
- He thong tu dong kiem tra ngay sinh nhat
- Gui uu dai **truoc 7 ngay** sinh nhat
- Giam 10-50% tuy hang
- Han: **7 ngay** ke tu ngay sinh nhat

### Quy trinh
1. Cron job phat hien sinh nhat
2. Tao voucher rieng
3. Gui thong bao: "Chuc mung sinh nhat! Ban duoc giam X%."
4. Khach su dung → voucher chi 1 lan

### Tra loi khach
- "Sinh nhat toi co gi?" → "AURA giam X% cho ban trong 7 ngay quanh sinh nhat. Vao /loyalty de nhan."

---

## G. CHECK-IN THUONG

### Co che
- 1 lan/thang moi khach
- Giai doan khai truong: +20k cashback
- Sau khai truong: giam 10% truc tiep

### Quy trinh
1. Khach vao `/checkin` → chup anh tai quan
2. Gui yeu cau check-in
3. Staff duyet tren `/admin/checkin-approve`
4. Duyet → khach nhan thuong

---

## H. PHAN QUYEN

| Hanh dong | Waiter | Staff | Manager | Owner |
|-----------|--------|-------|---------|-------|
| Xem thong tin khach | ❌ | ✅ | ✅ | ✅ |
| Dang ky khach moi | ✅ | ✅ | ✅ | ✅ |
| Xem lich su don | ❌ | ✅ | ✅ | ✅ |
| Cap nhat hang | ❌ | ❌ | ❌ | ✅ |
| Tao voucher ca nhan | ❌ | ❌ | ✅ | ✅ |
| Duyet check-in | ✅ | ✅ | ✅ | ✅ |
| Xuat danh sach | ❌ | ❌ | ✅ | ✅ |
| Gui broadcast | ❌ | ❌ | ✅ | ✅ |
