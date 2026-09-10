# Phase 5: Official Launch Day Operations & Monitoring

## Objective
Thực thi quy trình mở bán chính thức trong Ngày Khai Trương (Go-Live Day), theo dõi số liệu trực tiếp qua Launch Monitor và tổng kết báo cáo kinh doanh ngày đầu tiên.

## Mekong CLI Commands
- `mekong deploy` — Triển khai bản build sản xuất cuối cùng.
- `mekong daily` — Lập báo cáo điều hành cuối ngày.
- `mekong ops-status` — Kiểm tra trạng thái hệ thống và nhật ký lỗi.
- `mekong business-report` — Xuất báo cáo tổng kết doanh thu và hiệu quả chiến dịch.

## Tasks
- [ ] **07:30 Sáng Khai Trương (Pre-open):**
  - Mở trang `/admin/launch-monitor`.
  - Kiểm tra trạng thái Worker `GET /api/health` trả về 200 OK.
  - Bật đồng hồ đếm ngược và kiểm tra banner mã giảm giá `AURA20` hiển thị trên trang chủ.
- [ ] **Trong giờ phục vụ (Live Service Monitoring):**
  - Giám sát độ dài hàng chờ trên KDS `/kds.html`.
  - Theo dõi số lượng khách đăng ký thành viên mới nhận voucher 50.000đ.
- [ ] **22:00 Đóng cửa & Chốt ngày:**
  - Chốt ca POS, đối chiếu tiền mặt thực thu với số liệu phần mềm.
  - Chạy script xuất danh sách thành viên mới (`reports/members-d1.csv`).
  - Sinh thẻ thành viên điện tử (PDF/SVG) cho khách hàng.
- [ ] **Ngày D+1 (Post-Launch Debrief):**
  - Họp rút kinh nghiệm cùng đội ngũ nhân sự (Cường, Khánh, Thư).
  - Tự động chuyển chiến dịch sang mã `AURA10` cho 6 ngày tiếp theo.
