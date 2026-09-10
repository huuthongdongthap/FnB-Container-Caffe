# Phase 4: Pre-Flight Drills, Backup & Smoke Test

## Objective
Thực hiện tổng kiểm tra tiền khai trương (Pre-flight Smoke Test), sao lưu dự phòng toàn bộ cơ sở dữ liệu D1 và diễn tập kịch bản ứng phó sự cố (rớt mạng internet).

## Mekong CLI Commands
- `mekong worker-backup` — Sao lưu trạng thái mã nguồn và cơ sở dữ liệu.
- `mekong sre-morning-check` — Kiểm tra sức khỏe toàn diện trước giờ mở quán.
- `mekong ops-health` — Quét tình trạng vận hành các dịch vụ phụ thuộc.
- `mekong qa-perf` — Đánh giá hiệu năng và tốc độ tải trang.

## Tasks
- [ ] **Sao lưu Database D1:**
  - Xuất snapshot toàn bộ bảng D1 `fnb-caffe-db` lưu về thư mục backup bảo mật.
- [ ] **Diễn tập mất mạng Internet (Offline Scenario Drill):**
  - Giả lập ngắt wifi tại quán: Thu ngân ghi đơn vào sổ giấy dự phòng đặt sẵn tại quầy.
  - Khi có mạng trở lại: Nhập lại các đơn vào POS để hệ thống tự bù trừ doanh thu và cộng điểm cho khách.
- [ ] **Kiểm tra độ trễ & khả năng chịu tải:**
  - Đo đạc thời gian tải menu qua mạng 4G Viettel/Vinaphone (< 1.5s).
  - Xác nhận tính năng ghi nhớ giỏ hàng trong `localStorage` khi khách tắt app/reload.
- [ ] **Kiểm tra tương thích hiển thị:**
  - Test trên iOS Safari, Android Chrome và Zalo In-App Browser (khi quét QR từ camera Zalo).
