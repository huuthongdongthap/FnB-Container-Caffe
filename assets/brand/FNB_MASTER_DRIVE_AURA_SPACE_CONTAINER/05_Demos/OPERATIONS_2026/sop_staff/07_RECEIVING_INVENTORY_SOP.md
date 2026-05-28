# 📦 SOP 07 — NHẬN HÀNG + QUẢN LÝ KHO

> **Áp dụng:** Cường (chính), Khánh (backup)
> **Mục đích:** Mỗi món nhập đúng giá, đúng số lượng, đúng chất lượng → kho luôn chính xác
> **Liên kết với:** Task 15 (Receiving UI) — Task 17 (Waste tracking)

---

## 🎯 NGUYÊN TẮC VÀNG

1. **KHÔNG NHẬN HÀNG KHI MỘT MÌNH** — Nếu chỉ có 1 staff trong quán, đề nghị NCC chờ hoặc bỏ đó để Cường về.
2. **CÂN / ĐẾM TRƯỚC KHI KÝ** — Số lượng thực tế ≠ số NCC báo? **Sửa ngay trên hoá đơn**.
3. **KIỂM TRA CHẤT LƯỢNG** — Đường mốc, sữa phồng hộp, trái cây dập? **TỪ CHỐI ngay**.
4. **GIÁ TRÊN HOÁ ĐƠN = GIÁ APP** — Khác giá → confirm với anh Còn TRƯỚC khi ký.
5. **FIFO TUYỆT ĐỐI** — Hàng mới vào TRONG, hàng cũ vẫn để ngoài.

---

## 📅 LUỒNG NHẬN HÀNG ĐIỂN HÌNH

### Bước 1: NCC đến quán (5 phút trước)

**Khi nghe NCC gọi báo sắp đến:**
- [ ] Mở app `/admin/inventory/po-suggestions.html` → check đơn dự kiến
- [ ] Hoặc xem PO đã đặt trước qua `/admin/inventory/po/sent`
- [ ] Chuẩn bị khu vực nhận hàng (lau bàn, tâm thế sạch sẽ)
- [ ] Báo Khánh / Thư biết để cover thu ngân trong 10-15 phút

### Bước 2: NCC giao hàng (15-30 phút)

#### 2a. Kiểm số lượng

**Đối với hàng rời (cf, đường, mứt):**
- [ ] **CÂN ĐIỆN TỬ** từng món
- [ ] So với hoá đơn NCC
- [ ] Nếu lệch > 2% → ghi rõ trên hoá đơn + bút mực

**Đối với hàng đóng gói (sữa, lon nước, lipton):**
- [ ] Đếm từng cái
- [ ] Lệch dù 1 cái → ghi rõ

**Ví dụ:**
```
NCC báo: 10 bịch sữa VNM × 36.000đ = 360.000đ
Cường đếm: 9 bịch (NCC quên 1 bịch)
→ Sửa hoá đơn: 9 bịch × 36.000đ = 324.000đ
→ NCC ký xác nhận
```

#### 2b. Kiểm chất lượng

**Sữa tươi:**
- [ ] Date còn > 5 ngày (nếu < 5 ngày → từ chối)
- [ ] Hộp không phồng, không thủng
- [ ] Lắc nhẹ: không có vón cục

**Trái cây tươi (chanh, cam, dâu, sapo, mãng cầu, dừa):**
- [ ] Không úng, không thâm, không mềm
- [ ] Cuống tươi (không khô)
- [ ] **TỪ CHỐI** nếu thấy mốc dù 1 quả
- [ ] Em recommend lấy ra 5-10 quả random kiểm
- [ ] Cân nặng đúng (1kg cam = 4-6 quả tuỳ loại)

**Đường + bột:**
- [ ] Không vón cục (ẩm)
- [ ] Không có dấu hiệu côn trùng
- [ ] Bao bì còn nguyên (không rách)

**Café (D2, D4, Phin):**
- [ ] Ngày rang còn < 14 ngày (lý tưởng)
- [ ] Không lẫn tạp chất
- [ ] Có mùi thơm đặc trưng (không khét)

**Đồ uống đóng chai/lon:**
- [ ] Date > 90 ngày
- [ ] Vỏ không bị bóp móp
- [ ] Số lon trong lốc đủ (lốc 24/12/6)

**Ly nhựa / Vật tư:**
- [ ] Số lượng đúng
- [ ] Không vỡ / hỏng
- [ ] Kích thước đúng (ly 500ml ≠ ly 350ml)

#### 2c. Kiểm giá

- [ ] So với giá trên app (preferred supplier price)
- [ ] Lệch < 5%: OK, ký hoá đơn
- [ ] Lệch 5-15%: gọi anh Còn confirm
- [ ] Lệch > 15%: **TỪ CHỐI** hoặc hoãn để anh Còn quyết định

### Bước 3: Nhập app (10 phút) ⭐ QUAN TRỌNG

Mở `/admin/inventory/receiving.html`:

```
1. Chọn NCC: [NCC Sa Đéc Trung Tâm ▼]
2. Ngày nhận: hôm nay
3. Thêm từng dòng nhập:
   - Chọn nguyên liệu
   - Nhập SỐ LƯỢNG THỰC TẾ (sau khi cân/đếm)
   - Nhập GIÁ TRÊN HOÁ ĐƠN (nếu lệch app cảnh báo)
   - Ghi chú: "Date 2026-06-04" / "Có 1 thùng móp nhẹ"
4. Submit
```

App tự:
- Update kho (`stock_movements` type='receive')
- Update giá NCC nếu khác > 2%
- Ghi `supplier_price_history`

### Bước 4: Thanh toán NCC

**COD (Cash on Delivery):**
- [ ] Đếm tiền từ két két phụ "Tiền NCC"
- [ ] Đếm to: "Em trả 850.000đ"
- [ ] Đếm trước mặt NCC
- [ ] NCC ký xác nhận trên hoá đơn

**Net 7 / Net 15 / Net 30 (đối với NCC trả sau):**
- [ ] Lấy hoá đơn từ NCC
- [ ] Cất vào file "Nợ NCC" theo tháng
- [ ] App tự nhắc anh Còn khi gần đến hạn

**Chuyển khoản:**
- [ ] Đợi anh Còn chuyển (qua app banking)
- [ ] NCC confirm nhận → OK

### Bước 5: Cất hàng (15 phút) ⭐ FIFO

**FIFO = First In, First Out** — Hàng cũ ra trước!

**Quy trình:**
1. **KHÔNG đẩy hàng cũ ra sau**, để nó ở chỗ dễ lấy
2. Hàng mới: đặt **PHÍA TRONG** kệ
3. Hàng cũ: kéo lên **PHÍA NGOÀI**
4. Mỗi hộp/bịch ghi **NGÀY NHẬP** bằng bút lông (tránh nhầm)

**Theo nhóm:**

**Kho chiller (0-5°C):**
- Sữa tươi (tối đa 7 ngày từ ngày nhập)
- Sữa CAPU
- Trái cây tươi (chanh, cam, dâu, sapo)
- Sữa chua

**Kho freezer (-15 đến -18°C):**
- Đá viên
- Topping đông lạnh (nếu có)

**Kho khô (room temp, kín):**
- Cà phê hột (kín nắp tránh ẩm)
- Đường, muối, bột
- Trà gói, Lipton
- Mứt/syrup (chưa mở)
- Đồ uống lon/chai
- Vật tư (ly, ống hút, bao bì)

**Tủ riêng (an ninh):**
- Tiền mặt + chìa khoá két
- Thuốc lá (giữ tránh khách lén lấy)

---

## 📦 KIỂM KÊ ĐỊNH KỲ

### Daily (cuối ca, đã ở SOP 02)
- 10 nguyên liệu chiến lược
- Lệch > 5% → tìm lý do

### Weekly (mỗi chủ nhật, sau closing)
- **Full check 41 nguyên liệu**
- Mở `/admin/inventory/kiem-ke.html`
- Đếm từng món vs app
- Áp dụng `count_diff` cho mọi lệch

### Monthly (cuối tháng — chủ nhật cuối)
- **Full inventory deep**
- Mở từng hộp/bịch
- Check date, chất lượng
- Waste log những món hết hạn
- In báo cáo gửi anh Còn

---

## 🛒 ĐẶT HÀNG MỚI (PO — Purchase Order)

### Mở app: `/admin/inventory/po-suggestions.html`

App tự suggest dựa trên:
- Current stock < min_stock_level
- Avg consumption 7 ngày qua
- Lead time của NCC

**Quy trình:**
1. Review suggestions
2. Adjust số lượng nếu cần (vd: cuối tuần lễ → đặt thêm)
3. Click "Tạo PO này"
4. App sinh PO ID + gửi anh Còn approve (qua Zalo OA)
5. Anh Còn approve → app gửi tin nhắn / call NCC
6. NCC giao trong lead_time_days

**Tránh:**
- KHÔNG đặt trước ngày cuối tuần lễ (NCC nghỉ)
- KHÔNG đặt quá nhiều 1 lần (trừ nguyên liệu lâu hỏng)
- KHÔNG đặt nguyên liệu mau hỏng (sữa tươi, trái cây) > 1 tuần dùng

---

## 🗑 LIÊN KẾT VỚI WASTE LOG

Khi cất hàng phát hiện:
- Hộp đường rách → waste 1 hộp
- Sữa hết hạn → waste
- Trái cây dập → waste

→ Mở `/admin/inventory/waste.html` log ngay

→ Sau Task 17 deploy, daily waste auto-aggregate gửi anh Còn nếu > 5% revenue.

---

## 📊 KIỂM SOÁT NCC

### Bảng đánh giá NCC (hàng quý)

Anh Còn mở `/admin/inventory/suppliers.html` → mỗi NCC có rating 1-5:

**Tiêu chí:**
- Đúng giờ: 1-5 sao
- Đúng giá: 1-5 sao
- Chất lượng hàng: 1-5 sao
- Thái độ phục vụ: 1-5 sao

→ NCC < 3 sao → cân nhắc đổi.

### Đa dạng hoá NCC

**KHÔNG để 1 nguyên liệu chỉ có 1 NCC:**
- Nếu NCC nghỉ / hết hàng → bí
- Lý tưởng: 2-3 NCC cho mỗi nhóm hàng quan trọng
- Quan trọng: cf, sữa, ly nhựa, đá viên

---

## 🚫 TUYỆT ĐỐI KHÔNG

1. **KÝ HOÁ ĐƠN MÀ CHƯA CÂN/ĐẾM** — bị NCC ăn gian, quán mất tiền
2. **NHẬN HÀNG KHI KHÔNG CÓ EM/ANH CÒN APPROVE** giá khác > 5%
3. **TỰ ĐẶT HÀNG NCC TRÁI APP** — không track được, không có audit
4. **LẤY ĐỒ KHO RA DÙNG CÁ NHÂN** — đó là ăn cắp
5. **CHO NCC NỢ "VÌ QUEN"** — sẽ thành nợ xấu
6. **THAY ĐỔI SẮP XẾP KHO** mà không báo team — sai FIFO

---

## 📋 CHECKLIST 1 LẦN NHẬN HÀNG (in laminate đặt ở quầy nhận)

```
☐ NCC đã đến (đúng giờ?)
☐ Khu nhận hàng sạch
☐ Có ít nhất 2 staff trong quán
☐ Cân điện tử + thước đo sẵn sàng
☐ App receiving mở sẵn

KIỂM HÀNG:
☐ Cân/đếm từng món
☐ Date / hạn sử dụng (>5 ngày sữa, >90 ngày đồ khô)
☐ Bao bì nguyên vẹn
☐ Không mốc / dập / hỏng

GIÁ + APP:
☐ So giá hoá đơn vs giá app
☐ Lệch < 5% → ký
☐ Lệch 5-15% → call anh Còn confirm
☐ Lệch > 15% → từ chối / hoãn
☐ Nhập đúng app

THANH TOÁN:
☐ COD đếm trước mặt NCC
☐ Net X → cất hoá đơn vào file

CẤT HÀNG:
☐ Đúng kho (chiller/freezer/dry)
☐ Hàng mới phía TRONG
☐ Ghi ngày nhập bằng bút lông
☐ Đậy nắp kín

CUỐI:
☐ NCC ký xác nhận hoá đơn (bản copy quán giữ)
☐ Cảm ơn NCC
```

---

## 🎓 ONBOARDING (cho Khánh + Ngọc)

**Tuần 1-2:** Quan sát Cường nhận hàng 4-5 lần
**Tuần 3:** Cùng làm với Cường — Cường giám sát
**Tuần 4:** Làm solo với 1 NCC quen — Cường review hoá đơn sau

→ Sau 1 tháng, Khánh độc lập nhận hàng được. Ngọc sau 2 tháng.
