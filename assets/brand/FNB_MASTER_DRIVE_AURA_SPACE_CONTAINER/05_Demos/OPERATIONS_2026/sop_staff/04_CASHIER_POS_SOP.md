# 💳 SOP 04 — CASHIER + POS (Quy trình thu ngân + POS)

> **Áp dụng:** Khánh (chính), Cường (backup), Thư (đang train)
> **Mục đích:** Mỗi đơn vào POS chính xác, mỗi đồng tiền tracked, mỗi member nhận đủ cashback
> **In + ép plastic dán cạnh tablet POS**

---

## 🎯 NGUYÊN TẮC VÀNG

1. **MỖI MÓN KHÁCH GỌI → BẤM POS NGAY**, không "nhớ rồi bấm sau"
2. **HỎI SĐT THÀNH VIÊN** trước khi tính tiền — để cộng cashback x2 đúng campaign 6-8/6
3. **HOÁ ĐƠN ĐƯA TỪ TAY ĐẾN TAY**, có lời cảm ơn
4. **TIỀN MẶT ĐẾM 2 LẦN** trước khi trả lại + cho vào két
5. **NẾU SAI → ADMIN VOID** ngay, không tự xoá lén lút

---

## 📱 LUỒNG XỬ LÝ 1 ĐƠN HÀNG ĐIỂN HÌNH

### Bước 1: Đón khách + Order (60-90 giây)

**Câu chào chuẩn:**
> "Chào anh/chị! Em phục vụ gì hôm nay ạ?"

**Khi khách order:**
- [ ] Nhìn mặt khách → ghi nhớ giọng nói, đặc điểm để gọi cảm ơn cuối
- [ ] **Bấm món vào POS ngay khi khách nói** — KHÔNG nhớ rồi nhập sau
- [ ] Confirm: "Dạ, 1 cf sữa đá ít đá, 1 trà đào, đúng không ạ?"
- [ ] Hỏi: **"Anh/chị có thẻ thành viên AURA chưa ạ? Cho em SĐT để cộng điểm ạ!"**

### Bước 2: Loyalty lookup ⭐ QUAN TRỌNG

**Nếu khách đã có SĐT:**
1. Bấm icon "👤 Tìm thành viên" trong POS
2. Nhập SĐT khách → tìm
3. App hiển thị:
   ```
   ✅ NGUYỄN VĂN A
   Tier: Silver (5% cashback)
   Ví: 45.000đ
   ⚠ Hết hạn 12.000đ trong 7 ngày
   ```
4. Báo khách: **"Anh/chị đang có 45.000đ trong ví, 12k sẽ hết hạn ngày XX, dùng giờ luôn không ạ?"**
5. Nếu khách OK → bấm "Áp dụng tới mức tối đa" → app tự deduct

**Nếu khách chưa có thành viên:**
1. Hỏi: **"Anh/chị có muốn đăng ký thành viên không ạ? Đăng ký hôm nay tặng 50k vào ví, có thể dùng ngay đơn này!"**
2. Nếu YES → hướng dẫn quét QR ở quầy → khách điền form 30 giây
3. Sau đăng ký xong → quay lại bước 2 above
4. Nếu NO → tiếp tục bước 3

### Bước 3: Confirm đơn

POS hiển thị:
```
1× Cà phê sữa đá          25.000đ
1× Trà đào Cozy           30.000đ
─────────────────────────────────
Tạm tính:                 55.000đ
Cashback áp dụng:        -10.000đ (Silver 5% x2 = 10% campaign)
Voucher campaign 6/6:     -5.000đ (Random pick voucher 30k giảm phụ)
─────────────────────────────────
TỔNG:                     40.000đ
```

- [ ] Đọc to cho khách: **"Tổng cộng của anh/chị 40.000đ ạ"**
- [ ] Hỏi: **"Anh/chị thanh toán tiền mặt hay chuyển khoản ạ?"**

### Bước 4: Thanh toán

#### 4a. Tiền mặt

- [ ] Nhận tiền từ tay khách
- [ ] **Đếm to thành tiếng:** "Em nhận của anh/chị 50.000đ ạ"
- [ ] Đưa hoá đơn cùng tiền thối: **"Trả lại anh/chị 10.000đ"**
- [ ] Đếm tiền thối 1 lần nữa trước khi đưa
- [ ] Bấm POS: **"Đã nhận tiền mặt 50.000đ"** → confirm

#### 4b. Chuyển khoản

- [ ] Hiển thị QR Vietinbank trên màn hình tablet
- [ ] Khách quét → chuyển
- [ ] **Đợi tin nhắn xác nhận chuyển vào điện thoại quán** (KHÔNG tin lời "đã chuyển rồi")
- [ ] Khi có thông báo SMS / app banking → bấm POS "Đã nhận chuyển khoản"

#### 4c. Thanh toán hỗn hợp

- [ ] Khách dùng ví loyalty + tiền mặt → POS tự split
- [ ] Confirm với khách: "20k ví + 20k tiền mặt = 40k"

### Bước 5: In + giao hoá đơn

- [ ] Bấm **"In hoá đơn"** → máy in nhiệt ra
- [ ] **Đặt hoá đơn vào khay nhỏ + đưa tay** (KHÔNG vứt trên quầy)
- [ ] Nói: **"Hoá đơn của anh/chị, em cảm ơn ạ!"**

### Bước 6: Báo barista pha

- [ ] Đẩy đơn sang màn hình bếp (auto khi confirm)
- [ ] Hoặc nói trực tiếp với Cường (nếu busy): "Cường, 1 cf sữa đá ít đá + 1 trà đào số bàn 5"

### Bước 7: Mời khách ngồi + theo dõi

- [ ] **"Anh/chị ngồi bàn nào em mang ra ạ?"**
- [ ] Nếu khách lạ vị trí: chỉ tận tay tới bàn
- [ ] Mở app order tracking để barista biết khách ngồi đâu

### Bước 8: Đưa đồ uống

- [ ] Khi Cường gọi "Xong rồi" → kiểm tra:
  - Đúng số đơn?
  - Trông món có đẹp không?
  - Có ống hút + nắp đủ?
- [ ] Mang ra bàn + đặt nhẹ nhàng
- [ ] **"Cf sữa đá của anh, trà đào của chị. Anh chị uống ngon miệng ạ!"**

### Bước 9: Sau khi khách về

- [ ] Dọn ly + lau bàn ngay (đừng để khách sau đến thấy bẩn)
- [ ] **Nếu khách quên đồ → giữ ở quầy, ghi note + SĐT** (nếu là member)

---

## 🔄 XỬ LÝ CASE ĐẶC BIỆT

### Case 1: Khách báo SĐT sai / không tìm thấy member

**Phản ứng:**
1. Hỏi lại SĐT → confirm lại 2 lần
2. Nếu vẫn không tìm thấy: **"Có thể anh chị chưa đăng ký, đăng ký giúp em ạ — sẽ được tặng 50k campaign khai trương!"**
3. KHÔNG tự tạo member với SĐT mơ hồ

### Case 2: Khách muốn refund / huỷ đơn

**Quy trình:**
1. Hỏi lý do (vị không hợp / nhầm món)
2. Nếu lỗi quán → pha lại + KHÔNG tính tiền + tặng kèm 1 voucher 30k
3. Nếu khách đổi ý → cần admin (anh Còn) approve refund qua app
4. Nếu refund chuyển khoản → hoàn về stk khách
5. Nếu refund tiền mặt → trả từ két + ghi rõ lý do trong app

**Lưu ý:** Nếu cashback đã trừ → app tự revert + thông báo khách.

### Case 3: Khách phàn nàn pha không ngon

**Phản ứng:**
1. **Lắng nghe + xin lỗi**: "Em xin lỗi anh/chị, em pha lại ngay ạ!"
2. KHÔNG cãi / KHÔNG đổ tại đậu
3. Gọi Cường pha lại (đổi loại đậu / điều chỉnh đường)
4. Tặng kèm 1 voucher 30k cho lần sau
5. Ghi note vào app: "Khách bàn X phàn nàn cf vị Y → Cường pha lại"

### Case 4: Đông khách — queue dài (>3 người)

**Phản ứng:**
1. Smile + nói lớn: **"Em cảm ơn các anh chị, em sẽ phục vụ theo thứ tự ạ!"**
2. Phát menu cho khách đợi để họ chọn trước
3. **Tối ưu bằng pre-order:** Nhận order khách thứ 3 trong khi xử lý thứ 1

### Case 5: Khách dùng voucher chưa hết hạn nhưng app báo invalid

**Phản ứng:**
1. KHÔNG cãi với khách
2. Check voucher code trong app → screenshot
3. Tạm thời apply discount manual với note "voucher dispute - check anh Còn"
4. Sau ca → báo anh Còn investigate

### Case 6: Hết tiền thối — không trả lẻ được

**Phản ứng:**
1. **Đừng nói "không trả lẻ"** — đó là lỗi của quán
2. Đề nghị khách: "Em xin lỗi, em chuyển khoản phần lẻ qua tk anh/chị được không?"
3. Hoặc tặng 1 voucher 20k bù
4. Sau đó NGAY LẬP TỨC đi đổi tiền lẻ

### Case 7: Mất internet / POS không hoạt động

**Phản ứng:**
1. KHÔNG hoảng — vẫn phục vụ khách
2. Ghi đơn vào sổ giấy (sổ dự phòng đặt sẵn ở quầy): tên món + giá + thanh toán + thời gian
3. Khi POS hoạt động lại → nhập từng đơn vào hệ thống
4. Đối chiếu tiền mặt cuối ca chuẩn xác

---

## 💰 KIỂM SOÁT TIỀN ⭐

### Đầu ca:
- [ ] Đếm tiền thối từ ca trước (200k)
- [ ] Nhập "Tiền đầu ca" vào app

### Giữa ca (chuyển ca sáng → tối — 14h):
- [ ] Đếm tiền mặt hiện có trong két
- [ ] Confirm với app: "Tổng đến giờ" = "tiền đầu + tiền mặt thu" - "tiền thanh toán tiền mặt từ KH ra"
- [ ] Anh Còn có thể lấy tiền giữa ca (anh tự nhập vào app)

### Cuối ca:
- [ ] Theo SOP 02 Closing — đếm 2 lần, đối chiếu với app

---

## 🚨 CỜ ĐỎ — DỪNG VÀ GỌI ANH CÒN

- 🔴 Khách thanh toán quá lớn (>500k) bằng tiền mặt + không có hoá đơn — possible rửa tiền
- 🔴 Cùng SĐT đăng ký member 3+ lần trong ngày — possible bot
- 🔴 Khách đòi cấp quyền admin / login vào account quán
- 🔴 Cảnh sát / kiểm tra liên ngành đến — gọi anh Còn NGAY, không tự trả lời chi tiết kinh doanh

---

## 🎯 KPI cho Cashier

| Chỉ tiêu | Mục tiêu | Cách đo |
|---|---|---|
| Tỉ lệ thu loyalty SĐT | > 70% | App tự track |
| Thời gian từ order → tính tiền | < 90 giây | App tự track |
| Chênh lệch tiền cuối ca | < 10.000đ | Đối chiếu |
| Phàn nàn về dịch vụ | 0/tuần | Khách feedback |
| Member mới ký/ca | 3-5 (campaign) / 1-2 (sau campaign) | App |

---

## 📊 Báo cáo theo ca (auto từ app)

Cuối mỗi ca, app tự gửi anh Còn:

```
☕ AURA — Báo cáo ca sáng 27/05/2026
Cashier: Khánh
Đơn: 39 | Ly: 73
Doanh thu: 1.412.000đ
  - Tiền mặt: 1.250.000đ
  - Chuyển khoản: 162.000đ
Cashback issued: 71.000đ (5 members)
Member mới: 4 (campaign khai trương)
Tiền đầu ca: 200.000đ
Tiền đếm cuối ca: 1.450.000đ ✅ (chênh 0đ)
```

---

## 🎓 ONBOARDING (cho Ngọc đang train)

**Tuần 1:** Quan sát Khánh thao tác, học UI app POS
**Tuần 2:** Cùng làm — nhập order dưới sự giám sát
**Tuần 3:** Làm solo ca sáng (ít khách), Khánh check cuối ca
**Tuần 4:** Pass test — xử lý 1 ngày solo, 0 sai sót lớn

---

## 📋 Thẻ tham chiếu nhanh (1 trang A5 dán cạnh tablet)

Em sẽ tạo file `CASHIER_QUICK_REF.md` rút gọn các shortcut + câu chào chuẩn để in.
