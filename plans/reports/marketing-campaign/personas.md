# Chân Dung Khách Hàng Mục Tiêu — Chiến Dịch Flagship Sa Đéc → AURA SPACE SaaS v3.0

Tài liệu định nghĩa 2 nhóm chân dung cốt lõi cho chiến dịch 30 ngày 0 đồng quảng cáo: nhóm khách hàng B2B trả tiền (Chủ quán F&B) và nhóm khách hàng B2C tạo bằng chứng sống tại quán mẫu AURA CAFE Sa Đéc.

---

## 1. Primary Persona (B2B): Chủ Quán Cà Phê / F&B Độc Lập & Chuỗi Nhỏ (1–5 Điểm Bán)

### Hồ sơ nhân khẩu & bối cảnh kinh doanh
- **Đại diện điển hình**: Anh Minh (34 tuổi, mở 2 quán cà phê sân vườn/máy lạnh ở Sa Đéc & Cao Lãnh) hoặc Chị Thảo (29 tuổi, chủ quán trà trái cây & cà phê muối 18 bàn tại Cần Thơ / Mỹ Tho / khu vực ĐBSCL & các tỉnh thành).
- **Quy mô vận hành**: 10–50 bàn, 3–15 nhân viên (pha chế, phục vụ, thu ngân bán thời gian — đa phần là sinh viên hoặc lao động trẻ hay xoay ca).
- **Doanh thu ước tính**: 80–350 triệu VNĐ/tháng/điểm bán, biên lợi nhuận ròng thực tế chỉ còn 12–18% sau mặt bằng, nhân sự, điện nước và nguyên liệu.
- **Tình trạng công nghệ hiện tại**:
  - Hoặc đang dùng phần mềm POS truyền thống (tốn phí duy trì cao, mua thêm máy POS cồng kềnh, muốn có QR Order/KDS/tích điểm phải mua thêm gói mở rộng).
  - Hoặc vẫn ghi giấy + bấm máy tính tiền cơ bản, cuối tháng cộng sổ tay nên không biết chính xác lời lỗ từng món.
  - Bán qua app giao đồ ăn bị chiết khấu 20–25% mỗi đơn, tiền về chậm.

### Nỗi đau cốt lõi (Pain Points)
1. **Bị bào mòn biên lợi nhuận**: Hoa hồng app 20–25% ăn sạch phần lời; phần mềm POS cũ thu thêm phí tính năng lẻ (QR đặt món, màn hình bếp, báo cáo kho, tích điểm) khiến chi phí cố định đội lên mỗi tháng.
2. **Rối đơn & lộn món giờ cao điểm**: Cuối tuần hoặc tối đông khách, nhân viên ghi giấy chữ xấu, chạy tới chạy lui báo quầy bar, quên ghi chú "ít đường / không đá / tách riêng", khách chờ lâu rồi đánh giá xấu.
3. **Thất thoát nguyên liệu & mù P&L**: Không có định lượng công thức (BOM), cuối tháng kiểm kho thấy hụt sữa đặc, siro, cà phê hạt nhưng không biết hụt do pha lố tay hay do thất thoát; doanh thu trên sổ đẹp nhưng tiền mặt trong túi không thấy dư.
4. **Ngại triển khai phức tạp**: Không rành IT, sợ đổi phần mềm phải mất 1–2 tuần nhập lại menu, mua thêm thiết bị chục triệu, nhân viên mới không biết bấm.

### Rào cản & Lời từ chối thường gặp (Objections)
- *"Quán anh nhỏ 15 bàn, dùng phần mềm chi cho tốn tiền?"*
  → **Góc tháo gỡ**: Gói Starter chỉ 199.000đ/tháng (bằng tiền bán chưa tới 5–6 ly nước, hoặc 1.910.400đ/năm khi giảm 20%), dùng luôn điện thoại/máy tính bảng có sẵn, không ép mua phần cứng.
- *"Lại mấy ông bán phần mềm nói cho hay, tới lúc chạy thực tế giờ đông khách thì đứng máy."*
  → **Góc tháo gỡ**: AURA SPACE SaaS v3.0 được viết từ chính nhu cầu vận hành thật của **AURA CAFE Sa Đéc** (29 Nguyễn Tất Thành, Phường 1, TP. Sa Đéc — mở từ 2018, 3 container, 5 khu vực, mở cửa 07:00–23:00 mỗi ngày). Mời ghé uống ly cà phê, ngồi quét QR đặt món xem đơn nhảy thẳng lên màn hình KDS trong quầy bar.
- *"Khách miền Tây lớn tuổi không quen quét QR, chỉ thích gọi nhân viên."*
  → **Góc tháo gỡ**: Hệ thống chạy song song cả 2: khách trẻ tự quét QR đặt tại bàn (đỡ tốn công chạy bàn), khách lớn tuổi vẫn có nhân viên bấm POS tại quầy hoặc bằng điện thoại, cả 2 đều đổ chung về 1 màn hình KDS và in bill nhiệt đồng nhất.
- *"Tiền khách chuyển khoản có bị giữ lại không?"*
  → **Góc tháo gỡ**: 0% hoa hồng đơn hàng. Gói Starter dùng VietQR trực tiếp vào tài khoản chủ quán; gói Pro (499.000đ/tháng) tích hợp PayOS đứng tên chính chủ quán (mã hóa AES-256-GCM), tiền về thẳng tài khoản, không qua trung gian giữ tiền.

### Điểm kích hoạt mua hàng (Triggers)
- Vừa trải qua một tối cuối tuần / dịp lễ bị vỡ trận đơn, khách bỏ về vì chờ quá lâu.
- Tới kỳ gia hạn hợp đồng phần mềm POS cũ thấy báo giá tăng hoặc bị thu thêm phí tính năng QR/KDS.
- Ngồi uống cà phê tại AURA CAFE Sa Đéc (hoặc xem clip quay thật tại quán), thấy tốc độ QR Order → KDS → VietQR mượt mà và thấy dòng giá 199.000đ/tháng + dùng thử 14 ngày không cần thẻ tín dụng.

### Hành trình chuyển đổi (Buying Journey)
1. **Nhận diện (Aware)**: Thấy video thực chiến tại quán container Sa Đéc trên TikTok/Reels, đọc bài bóc tách chi phí trong Group chủ quán F&B, hoặc trực tiếp quét QR tại bàn ở AURA CAFE.
2. **Cân nhắc (Consider)**: Bấm vào trang `/pricing` (qua link UTM), so sánh gói Starter (199k/tháng) và Pro (499k/tháng — có BOM, P&L, CRM, PayOS chính chủ, Custom Domain), kiểm tra điều kiện 0% hoa hồng & 14 ngày dùng thử.
3. **Dùng thử (Trial)**: Vào `/signup`, tạo storefront `/s/:slug` trong 60 giây bằng menu mẫu sẵn, không cần nhập thẻ tín dụng.
4. **Kích hoạt (Activate)**: Tự in thử 1–2 mã QR đặt lên bàn quán mình, bấm thử 3–5 đơn chạy qua KDS và quét thử VietQR.
5. **Chuyển đổi trả phí (Convert)**: Trước ngày 14, chọn gói Starter hoặc Pro (ưu tiên gói năm giảm 20%: 1.910.400đ/năm hoặc 4.790.400đ/năm) hoặc gói Chain (1.290.000đ/tháng) nếu có từ 2–3 chi nhánh trở lên muốn gộp báo cáo HQ.

### Góc thông điệp chủ đạo (Messaging Angles)
- **Thật từ quán thật**: "Chủ quán cà phê Sa Đéc tự làm phần mềm cho quán mình chạy từ 2018, giờ mở cho anh em F&B dùng chung."
- **Giữ trọn tiền lời**: "0% hoa hồng đơn hàng. Tiền khách quét VietQR/PayOS về thẳng tài khoản chủ quán."
- **Nhanh & Không rào cản**: "60 giây lên menu và mã QR tại bàn. Dùng thử 14 ngày full tính năng, không cần thẻ tín dụng."
- **Kiểm soát chặt con số**: "Từ định lượng BOM từng ly cà phê muối tới báo cáo P&L cuối ngày — hết cảnh bán đông mà cuối tháng không thấy tiền."

---

## 2. Secondary Persona (B2C — Social Proof Engine): Khách Ghé AURA CAFE Sa Đéc

### Hồ sơ nhân khẩu & hành vi
- **Đại diện điển hình**:
  - **Nhóm A (Khách trẻ & dân văn phòng địa phương, 20–35 tuổi)**: Sinh viên, freelancer, nhân viên văn phòng tại TP. Sa Đéc & các huyện lân cận tìm chỗ ngồi làm việc máy lạnh yên tĩnh (40ft Quiet AC Cabin) hoặc tụ tập buổi tối (Rooftop, Garden Sofa, Lounge Thủy Mộc).
  - **Nhóm B (Khách du lịch / công tác ghé Sa Đéc, 24–45 tuổi)**: Ghé Làng Hoa Sa Đéc, khu trung tâm Phường 1 (ngay đối diện Khách sạn Thảo Trâm 2 — 29 Nguyễn Tất Thành), thích không gian 3 container tái chế Industrial-Luxury độc đáo để chụp ảnh check-in, uống cà phê muối / specialty coffee / trà trái cây.
- **Tần suất & thói quen**: Hay chụp hình không gian, ly nước, bàn làm việc đăng story Facebook/Instagram/TikTok; cực kỳ nhạy cảm với trải nghiệm phục vụ chậm hoặc gọi nhân viên mãi không thấy.

### Vai trò chiến lược trong chiến dịch B2B (Social Proof Engine)
Nhóm khách B2C không phải là người trả tiền cho gói SaaS, nhưng lại là **động cơ tạo bằng chứng sống 0 đồng** cho sản phẩm SaaS:
1. **Minh chứng trải nghiệm thực tế**: Khi khách ngồi ở Rooftop hay Cabin 40ft chỉ cần quét QR trên bàn, chọn món (như cà phê muối, trà trái cây), ghi chú ít đá, thanh toán VietQR rồi 3 phút sau nước bưng ra đúng y chang — họ tự nhiên cảm thấy tiện và nhắc đến trải nghiệm "đặt món bằng QR siêu nhanh" trong review/story.
2. **Tạo dòng traffic tự nhiên qua `/checkin`**: Khách check-in tích điểm AURA Points tại trang `/checkin`, cuối trang hiển thị thẻ giới thiệu nhẹ nhàng: *"Quán bạn cũng muốn có QR đặt món mượt như AURA CAFE? Dùng thử 14 ngày miễn phí"*. Trong số khách ghé quán mỗi ngày luôn có tỷ lệ nhất định là chủ quán khác, người sắp mở quán, hoặc bạn bè/người thân của chủ quán F&B.
3. **Chất liệu quay video không cần diễn viên**: Cảnh khách thật đang quét QR tại 5 khu vực của quán (Container Bar, Lounge Thủy Mộc, Rooftop, 40ft Quiet AC Cabin, Garden Sofa) và cảnh màn hình KDS trong quầy bar nhảy đơn liên tục giờ cao điểm là bằng chứng thuyết phục nhất cho chủ quán B2B.

### Nỗi đau & Điểm chạm cảm xúc (B2C)
- **Khó chịu khi đi quán đông**: Giơ tay gọi phục vụ không ai thấy (đặc biệt khi ngồi lầu Rooftop hoặc trong Cabin máy lạnh kín), chờ tính tiền lâu lúc đang vội.
- **Thích sự chủ động & minh bạch**: Thích tự xem menu có hình, tự chỉnh đường/đá, biết rõ tổng tiền trước khi bấm đặt, tích điểm AURA Points rõ ràng.

### Góc thông điệp chạm tới nhóm B2C (để lan tỏa tự nhiên)
- **Tiện lợi tại chỗ**: "Ngồi trên Rooftop hay trong Cabin 40ft không cần chờ gọi nhân viên — quét QR tại bàn, chọn món trong 15 giây, nước lên tận nơi."
- **Check-in có quà**: "Check-in tại AURA CAFE (29 Nguyễn Tất Thành, P.1, Sa Đéc) tích AURA Points nhận ưu đãi thành viên."
- **Cầu nối giới thiệu tự nhiên**: "Thích kiểu đặt món nhanh gọn này? Chụp lại gửi cho bạn bè đang mở quán cà phê / quán ăn — AURA SPACE cho dùng thử 14 ngày miễn phí."
