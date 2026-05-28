# 🌙 SOP 02 — ĐÓNG QUÁN (Closing Checklist)

> **Áp dụng:** Tất cả staff ca tối (Cường / Khánh / Thư)
> **Thời gian:** 21:30 - 22:30 (1 tiếng đóng, 22:30 ra về)
> **In + ép plastic dán ở quầy**

---

## ⏰ 21:30 — Last call (30 phút trước đóng)

### 📢 Thông báo cho khách

- [ ] Đi từng bàn lịch sự: **"Dạ, quán sẽ đóng cửa lúc 22h, mời anh chị cứ tự nhiên. Em phục vụ thêm gì không ạ?"**
- [ ] **Last call** cho menu nóng: từ 21:30 không pha thêm coffee đặc biệt
- [ ] Sau 21:45: KHÔNG nhận order mới (chỉ takeaway nếu khách đến)

### 🧹 Vệ sinh sớm (khách còn ngồi)

- [ ] Dọn bàn trống ngay khi khách đứng dậy
- [ ] Bắt đầu rửa ly/cốc đã dùng
- [ ] Đổ rác ngăn pha chế (nếu đầy)
- [ ] Lau bếp pha chế (khu khô)

---

## ⏰ 22:00 — Đóng cửa chính thức

### 🔒 An ninh ngoài quán

- [ ] Tiễn khách cuối cùng lịch sự + tặng voucher 30k nếu họ đã ăn (theo chiến dịch)
- [ ] Đóng + khoá cổng ngoài (nếu có)
- [ ] Tắt biển hiệu LED ngoài
- [ ] Tắt nhạc nền
- [ ] Tắt máy lạnh khu phục vụ (giữ máy tủ lạnh + đèn an ninh)

---

## ⏰ 22:05 — Chốt ca POS ⭐ QUAN TRỌNG NHẤT

### 💻 Chốt ca trên app

- [ ] Mở `/admin/pos.html` → menu **"Chốt ca"**
- [ ] App tự tổng hợp:
  - Số đơn ca này
  - Số ly bán
  - Tiền mặt
  - Chuyển khoản (Vietinbank/Momo)
  - Tiền mặt đầu ca (đã nhập sáng)

### 💰 Đếm tiền mặt vật lý

- [ ] Dọn két ra bàn → đếm CHẬM 2 lần:
  ```
  Tiền 500k:  ___ tờ × 500.000 = _________
  Tiền 200k:  ___ tờ × 200.000 = _________
  Tiền 100k:  ___ tờ × 100.000 = _________
  Tiền 50k:   ___ tờ × 50.000  = _________
  Tiền 20k:   ___ tờ × 20.000  = _________
  Tiền 10k:   ___ tờ × 10.000  = _________
  Tiền 5k:    ___ tờ × 5.000   = _________
  Tiền 2k:    ___ tờ × 2.000   = _________
  Tiền 1k:    ___ tờ × 1.000   = _________
  Xu/lẻ:                       = _________
  
  TỔNG ĐẾM THỰC:               = _________
  ```
- [ ] Nhập "Tiền đếm thực" vào app
- [ ] App tính chênh lệch:
  - **Tiền đếm + tiền chuyển khoản = Tổng app báo?**
  - Nếu lệch < 10.000đ: bình thường, ghi note
  - Nếu lệch > 10.000đ: **dừng lại tìm hiểu lý do trước khi chốt**

### 🟢 Confirm chốt

- [ ] Báo cáo ca xuất ra PDF/in (lưu tài liệu)
- [ ] Tiền mặt: để lại **200k tiền thối cho ca sáng** + còn lại chuyển vào két chính
- [ ] **Anh Còn check trên app dashboard từ xa** — không cần ai gọi báo (đã tự update real-time)

---

## ⏰ 22:15 — Kiểm kê cuối ca (5 phút) ⭐ QUAN TRỌNG

### 📦 Kiểm kê 10 nguyên liệu chiến lược

Mở app: `/admin/inventory/kiem-ke.html`

**Đếm thực tế + so app:**

| Nguyên liệu | Hệ thống | Đếm thực | Lệch |
|---|---|---|---|
| Café D2 | __ kg | __ kg | __ |
| Café D4 | __ kg | __ kg | __ |
| Sữa đặc | __ hộp | __ hộp | __ |
| Sữa tươi VNM | __ bịch | __ bịch | __ |
| Sữa CAPU | __ hộp | __ hộp | __ |
| Đá viên | __ bao | __ bao | __ |
| Ly nhựa | __ cái | __ cái | __ |
| Ly giấy | __ cái | __ cái | __ |
| Đường | __ kg | __ kg | __ |
| Trái cây (cam/chanh/...) | check | check | __ |

- [ ] **Nếu lệch > 5%** → ghi lý do (pha hỏng / đổ vỡ / chưa log waste)
- [ ] **Áp dụng count_diff** vào app → kho sync với thực tế

---

## ⏰ 22:20 — Vệ sinh cuối ca (10 phút)

### 🍵 Máy pha cà phê

- [ ] **Xả nhóm pha 3 lần** với nước nóng
- [ ] Tháo basket + portafilter → rửa kỹ
- [ ] Lau máy bằng khăn ẩm + khô
- [ ] Backflush với chất tẩy chuyên dụng (mỗi 2-3 ngày, không phải mỗi ngày)
- [ ] Đậy nắp hopper xay (chống ẩm)

### 🥛 Bảo quản nguyên liệu

- [ ] **Sữa tươi VNM** mở hộp → đậy nắp, ghi ngày mở, để chiller (max 2 ngày)
- [ ] **Mứt/Syrup** mở chai → đậy kín, đặt nơi khô mát
- [ ] **Trái cây tươi** → bọc nilon hoặc hộp kín, để chiller
- [ ] **Đá viên** chưa dùng → đậy nắp container freezer

### 🧹 Vệ sinh tổng

- [ ] Quét + lau sàn toàn bộ khu phục vụ + pha chế
- [ ] Lau bàn ghế bằng khăn ẩm + khử khuẩn
- [ ] Rửa toàn bộ ly/cốc/đĩa trong shift → up lên giá ráo
- [ ] Đổ rác **TẤT CẢ** thùng rác (bếp + khách + WC) ra điểm tập kết
- [ ] WC sạch + đủ giấy + xà phòng cho ca sáng
- [ ] Lau bồn rửa tay + gương WC

---

## ⏰ 22:25 — Kiểm tra cuối + Tắt máy

### 🔌 Điện + nước

- [ ] Tắt máy pha cà phê (chuyển standby hoặc rút điện tuỳ máy)
- [ ] Tắt máy xay đậu
- [ ] Tắt blender / máy ép
- [ ] Tắt đèn khu phục vụ (giữ 1-2 đèn an ninh)
- [ ] Khoá vòi nước chính (nếu áp dụng)
- [ ] **KHÔNG TẮT** tủ lạnh + tủ đông (đang giữ nguyên liệu!)

### 🔒 An ninh đóng

- [ ] Tiền mặt két chính → khoá két
- [ ] Tablet POS → tắt + cất tủ khoá
- [ ] Kiểm tra cửa sổ, lỗ thông gió đóng
- [ ] Khoá tất cả tủ kính + cửa pha chế
- [ ] Khoá cửa chính (2 ổ khoá)
- [ ] Bật chuông báo trộm (nếu có)

---

## ⏰ 22:30 — Sign-off + Về nhà

### ✍️ Báo cáo cuối ca

Vào app `/admin/pos.html` → "Báo cáo ca":

```
✅ Đóng quán T2 27/05/2026
   Ca: Tối (16:00 - 22:30)
   Staff: Cường + Thư
   Doanh thu ca: 1.450.000đ
   Số đơn: 32 | Số ly: 51
   Chênh lệch tiền: 0đ
   Note: Sữa VNM hôm nay waste 1 bịch (hết hạn)
   Kiểm kê: ok
   Vệ sinh: hoàn thành
```

### 📱 Gửi Zalo cho anh Còn (qua Zalo OA sau task 13)

App tự gửi tin nhắn báo cáo cho anh Còn — staff không cần gọi.

### 👋 Tạm biệt

- [ ] Cảm ơn đồng nghiệp đã làm cùng ca
- [ ] Khoá cửa cuối cùng → rời quán cùng nhau (an toàn)

---

## ⚠️ NẾU PHÁT HIỆN VẤN ĐỀ TRONG CLOSING

### 🔴 Mức 1 (Gọi anh Còn ngay):
- Tiền lệch > 100.000đ
- Két không khoá được
- Phát hiện đồ thất thoát (ly, đường, sữa)
- Có khách lạ lảng vảng ngoài quán

### 🟡 Mức 2 (Tự xử, báo sáng mai):
- Tiền lệch 10-100k → ghi note + chia đều bù
- Máy pha cf vị lạ → ghi để vệ sinh sâu mai

### 🟢 Mức 3 (Log app, anh Còn xem dashboard):
- Waste cao bất thường → đã log
- Kiểm kê lệch 1-2% → bình thường

---

## 🧠 Mẹo nhỏ

1. **Đếm tiền 2 lần — đếm 2 người khác nhau** để tránh sai
2. **Đừng vội** — closing kỹ sẽ đỡ tốn 1h sáng hôm sau
3. **Sữa tươi mở quá 2 ngày → waste ngay**, đừng tiếc tiền → mất uy tín với khách lớn hơn nhiều
4. **Đá viên là chi phí ẩn** — tan trong tủ là tiền bay → đậy kín
5. **Vệ sinh máy pha cf hằng ngày** — không vệ sinh = vị đắng + giảm tuổi máy

---

## 📋 In version A4 (laminate)

File này được rút gọn thành 1 trang A4 dán ở quầy. Em sẽ tạo file `CLOSING_CHECKLIST_PRINT.md` riêng cho in.
