# 📊 Plan: Grand Opening Loyalty, Cashback & Vouchers Calculator

**Mục tiêu**: Xây dựng cẩm nang chi tiết cho chủ quán và bộ công cụ dự toán tương tác động (loyalty-calculator.html) phục vụ ra quyết định cho chiến dịch khai trương 06/06/2026, tích hợp thêm hệ thống **Mã giảm giá/Voucher khai trương**.

---

## 🎯 Danh Sách Công Việc (TODOs)

### Phase 1: Biên Soạn Cẩm Nang Chủ Quán
- [ ] Tạo file [loyalty_grand_opening_handbook.md](file:///Users/mac/mekong-cli/FnB-Container-Caffe/docs/loyalty_grand_opening_handbook.md) bằng tiếng Việt.
- [ ] Giải thích nguyên lý ví cashback & cơ chế hạng thành viên.
- [ ] Tích hợp cơ chế **Mã giảm giá/Voucher khai trương** và quy tắc xếp chồng (stacking) an toàn.
- [ ] Trực quan hóa chu kỳ giới thiệu (A ➔ B) & cân đối dòng tiền.
- [ ] Phân tích chi tiết 5 kịch bản tài chính doanh thu 100M/tháng bao gồm ảnh hưởng của voucher.
- [ ] Nêu bật các chốt chặn chống thâm hụt và gian lận.

### Phase 2: Xây Dựng Công Cụ Tính Toán Tương Tác
- [ ] Tạo file [loyalty-calculator.html](file:///Users/mac/mekong-cli/FnB-Container-Caffe/loyalty-calculator.html) ở thư mục gốc.
- [ ] Nhúng CSS Premium Dark glassmorphism đồng bộ thương hiệu AURA CAFE Sa Đéc.
- [ ] Lập trình logic ESM Javascript cho các thanh trượt thời gian thực (bao gồm cả thanh trượt Voucher).
- [ ] Tích hợp bộ đo an toàn dòng tiền (Safety Gauge) & nút Preset nhanh cho 5 kịch bản.

### Phase 3: Xác Minh & Chạy Thử
- [ ] Chạy kiểm thử trên Vite dev server (`npm run dev`).
- [ ] Đối chiếu số liệu hiển thị trên web động với 5 kịch bản trong cẩm nang.
- [ ] Bàn giao kết quả.
