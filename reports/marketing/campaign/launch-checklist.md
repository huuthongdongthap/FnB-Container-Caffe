# AURA CAFE SA ĐÉC — GRAND OPENING LAUNCH CHECKLIST
**Campaign:** GRAND_OPENING_6_6_2026  
**Ngày khai trương:** Thứ 7, 06/06/2026  
**Loyalty system:** https://aura-space-worker.sadec-marketing-hub.workers.dev  
**Pages:** https://fnb-caffe-container.pages.dev  
**Launch monitor:** /admin/launch-monitor  

---

## T-7 — 30/05/2026 (Thứ 6) — Chuẩn bị

### Print Materials
- [ ] In standee QR signup (`qr-signup-standee.png`) — khổ A1, 2 bản — **Chủ quán**
- [ ] In leaflet QR signup (`qr-signup-leaflet.png`) — 500 tờ A5 — **Chủ quán**
- [ ] In receipt QR (`qr-signup-receipt.png`) — gắn vào máy in hóa đơn — **Chủ quán**
- [ ] Kiểm tra chất lượng in, scan thử từng QR để xác nhận link hoạt động — **Nhân viên**
- [ ] Chuẩn bị banner "KHAI TRƯƠNG 06/06 — TẶNG CASHBACK 20%" — **Chủ quán**

### Social Accounts Setup
- [ ] Tạo / cập nhật Facebook Page AURA CAFE Sa Đéc — avatar, cover, info đầy đủ — **Chủ quán**
- [ ] Tạo / cập nhật Zalo OA AURA CAFE Sa Đéc — **Chủ quán**
- [ ] Tạo tài khoản TikTok @auracafe.sadec — xác minh số điện thoại — **Chủ quán**
- [ ] Đăng ký Zalo OA đủ follower để broadcast (tối thiểu 10 follower test) — **Chủ quán**
- [ ] Pin link Pages lên bio Facebook + Zalo OA — **Chủ quán**

### Staff Training
- [ ] Hướng dẫn nhân viên quy trình QR signup tại bàn — **Chủ quán**
- [ ] Demo loyalty system: đăng ký → nhận điểm → dùng cashback — **CTO**
- [ ] Phân vai: 1 người cầm standee mời khách, 1 người tại quầy hỗ trợ đăng ký — **Chủ quán**
- [ ] Nhân viên tự test đăng ký loyalty bằng số điện thoại cá nhân — **Nhân viên**
- [ ] Phổ biến kịch bản xử lý lỗi: khách không có điện thoại, QR không scan được — **Chủ quán**

---

## T-3 — 03/06/2026 (Thứ 4) — Pre-launch

### Social Media
- [ ] Đăng teaser Facebook: ảnh không gian AURA CAFE + đếm ngược "3 ngày nữa" — **Chủ quán**
- [ ] Đăng teaser Zalo OA: thông điệp khai trương + CTA đăng ký loyalty — **Chủ quán**
- [ ] Story Instagram/Facebook: behind-the-scenes chuẩn bị khai trương — **Nhân viên**
- [ ] Post TikTok preview: video 15s không gian quán — **Nhân viên**
- [ ] Ghim bài post khai trương trên Facebook Page — **Chủ quán**

### Phân phát Leaflet Sa Đéc
- [ ] Phân phát leaflet khu vực chợ Sa Đéc (sáng 7h–9h) — **Nhân viên**
- [ ] Phân phát leaflet trường học, khu dân cư gần quán — **Nhân viên**
- [ ] Đặt leaflet tại các điểm hợp tác (tiệm tóc, siêu thị mini) — **Chủ quán**
- [ ] Ghi nhận số lượng leaflet phân phát từng khu vực — **Nhân viên**

### System Check
- [ ] Test URL Pages: https://fnb-caffe-container.pages.dev — load bình thường — **CTO**
- [ ] Test loyalty endpoint: `curl https://aura-space-worker.sadec-marketing-hub.workers.dev/health` — **CTO**
- [ ] Xác nhận campaign GRAND_OPENING_6_6_2026 đã được tạo trong hệ thống — **CTO**
- [ ] Test toàn bộ flow QR → signup → nhận điểm — **CTO**

---

## T-1 — 05/06/2026 (Thứ 6) — Eve

### Zalo Broadcast
- [ ] Soạn và gửi Zalo OA broadcast: "Ngày mai AURA CAFE khai trương!" + link đăng ký loyalty — **Chủ quán**
- [ ] Gửi tin nhắn Zalo cá nhân đến khách quen, người thân — **Chủ quán**
- [ ] Đăng Facebook reminder: "Ngày mai 06/06 — Tặng cashback 20% giao dịch đầu" — **Chủ quán**
- [ ] Story TikTok/FB: đếm ngược 12 tiếng — **Nhân viên**

### Final System Check
- [ ] Kiểm tra campaign GRAND_OPENING_6_6_2026 status = READY — **CTO**
- [ ] Verify campaign schedule: active từ 00:00 ngày 06/06 — **CTO**
- [ ] Test `/admin/launch-monitor` — dashboard load, metrics hiển thị — **CTO**
- [ ] Xác nhận cashback rule: 20% giao dịch đầu, cap đúng cấu hình — **CTO**
- [ ] Backup snapshot database loyalty trước khai trương — **CTO**
- [ ] Test QR signing in 3 loại: leaflet, standee, receipt — scan & register thành công — **Nhân viên**

### Staff Briefing
- [ ] Họp nhân viên 20:00 ngày 05/06: phân công vị trí ngày mai — **Chủ quán**
- [ ] Phổ biến target D0: số đăng ký loyalty, doanh thu — **Chủ quán**
- [ ] Xác nhận nhân viên có mặt lúc 7:00 sáng 06/06 — **Chủ quán**
- [ ] Chuẩn bị phần thưởng nhân viên bán hàng tốt nhất ngày khai trương — **Chủ quán**

---

## D0 — 06/06/2026 (Thứ 7) — LAUNCH DAY

### 07:00 — Mở cửa chuẩn bị
- [ ] Nhân viên có mặt đầy đủ, đồng phục chỉnh tề — **Nhân viên**
- [ ] Bày standee QR tại cửa vào và trong quán — **Nhân viên**
- [ ] Bật nhạc, décor khai trương — **Nhân viên**

### 08:00 — Verify Campaign Active
- [ ] Chạy lệnh verify campaign:
  ```bash
  curl -s https://aura-space-worker.sadec-marketing-hub.workers.dev/api/campaigns/GRAND_OPENING_6_6_2026/status
  ```
  → Expected: `{"status":"active","campaign_id":"GRAND_OPENING_6_6_2026"}` — **CTO**
- [ ] Mở `/admin/launch-monitor` — xác nhận real-time metrics hiển thị — **CTO**
- [ ] Check Pages: https://fnb-caffe-container.pages.dev — load OK — **CTO**
- [ ] Test 1 giao dịch thực tế: order → QR scan → cashback credited — **CTO**

### 08:30 — Go Live
- [ ] Đăng Facebook: "AURA CAFE chính thức mở cửa! 🎉" + ảnh khai trương — **Chủ quán**
- [ ] Đăng Zalo OA broadcast lần 2: "Chúng tôi đang mở cửa! Đến ngay nhận cashback" — **Chủ quán**
- [ ] Nhân viên cầm standee đứng trước cửa mời khách + hướng dẫn QR signup — **Nhân viên**

### 09:00 — First TikTok Live
- [ ] Bắt đầu TikTok LIVE: giới thiệu quán, không gian, menu — **Nhân viên**
- [ ] Trong LIVE: demo đăng ký loyalty bằng QR — **Nhân viên**
- [ ] Pin comment link đăng ký loyalty trong LIVE — **Nhân viên**
- [ ] Duy trì LIVE tối thiểu 60 phút — **Nhân viên**

### Suốt ngày — Staff Operations
- [ ] Nhân viên tại mỗi bàn chủ động hướng dẫn khách quét QR signup — **Nhân viên**
- [ ] Chủ quán monitor `/admin/launch-monitor` mỗi 2 tiếng: signups, transactions — **Chủ quán**
- [ ] CTO on-call: nhắn ngay nếu có lỗi hệ thống — **CTO**
- [ ] Chụp ảnh/video khách đến quán → đăng Stories liên tục — **Nhân viên**
- [ ] Ghi nhận feedback khách về sản phẩm, không gian — **Nhân viên**

### 18:00 — Cuối ngày
- [ ] Đăng post tổng kết D0: "Cảm ơn X khách đã ghé AURA CAFE hôm nay" — **Chủ quán**
- [ ] Story TikTok: recap highlight ngày khai trương — **Nhân viên**

---

## D+1 — 07/06/2026 (Chủ Nhật) — Review

### Pull D1 Signup Stats (09:00)
- [ ] Lấy báo cáo số đăng ký loyalty ngày 06/06:
  ```bash
  curl -s "https://aura-space-worker.sadec-marketing-hub.workers.dev/api/reports/signups?date=2026-06-06"
  ```
  — **CTO**
- [ ] Export danh sách member đăng ký D0 — **CTO**
- [ ] So sánh target vs thực tế: signups, transactions, revenue — **Chủ quán + CTO**
- [ ] Xác nhận kênh signup nào hiệu quả nhất: leaflet QR / standee QR / receipt QR — **CTO**

### Cashback Issued Report
- [ ] Lấy báo cáo cashback đã phát:
  ```bash
  curl -s "https://aura-space-worker.sadec-marketing-hub.workers.dev/api/reports/cashback?date=2026-06-06"
  ```
  — **CTO**
- [ ] Tổng cashback đã issued vs budget campaign — **Chủ quán + CTO**
- [ ] Kiểm tra có anomaly: cashback bất thường, fraud signup — **CTO**
- [ ] Xác nhận cashback credited đúng cho từng member — **CTO**

### Adjust Campaign (nếu cần)
- [ ] Nếu cap cashback gần đạt (>80%): đánh giá có nên tăng cap hoặc kết thúc sớm — **Chủ quán + CTO**
- [ ] Nếu signup thấp hơn target: tăng cường quảng bá — post thêm, boost Facebook — **Chủ quán**
- [ ] Nếu có lỗi hệ thống D0: hotfix và deploy — **CTO**
- [ ] Gửi email/Zalo cảm ơn đến member đã đăng ký D0 — **Chủ quán**

### Social Recap
- [ ] Đăng post Facebook D+1: tổng kết khai trương, số khách, ảnh highlight — **Chủ quán**
- [ ] Reply toàn bộ comment trên các bài post khai trương — **Nhân viên**
- [ ] Post TikTok video recap D0 — **Nhân viên**

---

## CONTACTS & ESCALATION

| Role | Trách nhiệm | Liên hệ khẩn |
|------|-------------|---------------|
| Chủ quán | Vận hành, marketing, quyết định | Trực tiếp |
| Nhân viên | Tại quán, social media, khách hàng | Zalo nhóm |
| CTO | Hệ thống, loyalty, technical on-call | Zalo trực tiếp |

**System emergency:** `curl -X POST https://aura-space-worker.sadec-marketing-hub.workers.dev/api/campaigns/GRAND_OPENING_6_6_2026/pause`

---

*Generated: 2026-05-20 | Campaign: GRAND_OPENING_6_6_2026 | AURA CAFE Sa Đéc*
