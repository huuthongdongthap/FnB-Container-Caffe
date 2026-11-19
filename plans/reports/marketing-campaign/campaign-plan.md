# Kế Hoạch Chiến Dịch 30 Ngày (0 VNĐ Ads): Flagship Sa Đéc → AURA SPACE SaaS v3.0

## 1. Tóm Tắt Điều Hành (Executive Summary)

- **Tên chiến dịch**: `flagship_sadec_30d` — Biến quán cà phê mẫu **AURA CAFE Sa Đéc** (29 Nguyễn Tất Thành, Phường 1, TP. Sa Đéc, Đồng Tháp — vận hành từ 2018) thành "phòng trưng bày sống" để thu hút chủ quán F&B đăng ký dùng thử và trả phí cho **AURA SPACE SaaS v3.0**.
- **Ngân sách quảng cáo trả phí**: **0 VNĐ** (100% Organic). Chi phí vật tư duy nhất ở mức tối thiểu là in kệ mica / table-tent QR tại quán (tận dụng máy in bill nhiệt có sẵn cho chân hóa đơn).
- **Lợi thế cạnh tranh cốt lõi**:
  - **Chứng minh bằng vận hành thật**: Không bán slide hay lời hứa; mọi tính năng (QR Order, POS, KDS, BOM, P&L, VietQR/PayOS) đang chạy hàng ngày từ 07:00–23:00 trên 3 container / 5 khu vực tại AURA CAFE.
  - **Rào cản gia nhập bằng 0**: 0% hoa hồng đơn hàng, dùng thử 14 ngày full tính năng không cần thẻ tín dụng, khởi tạo storefront `/s/:slug` trong 60 giây.
  - **Định giá minh bạch cho quán vừa và nhỏ**: Starter **199.000đ/tháng** (1.910.400đ/năm), Pro **499.000đ/tháng** (4.790.400đ/năm), Chain **1.290.000đ/tháng** (12.384.000đ/năm) — giảm 20% khi đóng theo năm.

---

## 2. Phân Bổ Thời Gian & Nhân Lực Tinh Gọn (Lean Cafe Team — 0 VNĐ Paid Media)

Chiến dịch được thiết kế để **không làm gián đoạn việc bán hàng hàng ngày** của quán. Tổng quỹ thời gian khoảng **6–7 giờ/tuần**, chia cho 2 vai trò chính (có thể do Founder kiêm nhiệm cùng 1 quản lý ca):

| Hạng mục công việc | Người phụ trách | Thời lượng / tuần | Chi tiết thực hiện |
| :--- | :--- | :--- | :--- |
| **Quay & dựng nhanh 1–2 video ngắn (30–45s)** | Founder + 1 nhân viên cầm máy | 2,0 giờ/tuần | Quay trực tiếp bằng điện thoại vào khung giờ vắng khách (09:00–10:30) hoặc bắt 15 giây cảnh thật giờ cao điểm tối. Cắt ghép cơ bản trên CapCut, thêm phụ đề rõ chữ. |
| **Viết & đăng bài Facebook Page / Group F&B / Zalo OA** | Founder / Quản lý | 2,0 giờ/tuần | Sử dụng sẵn bộ nội dung trong `content-pack.md`, chỉnh nhẹ theo tình hình thực tế trong tuần, trả lời bình luận và tin nhắn thật tâm. |
| **Vận hành điểm chạm In-store (QR, Bill, Demo KDS)** | Quản lý ca & Thu ngân | 0,5 giờ/tuần | Tuần 1 đặt kệ QR & cài footer bill (1 lần duy nhất). Các tuần sau chỉ kiểm tra kệ sạch đẹp và hỗ trợ khách hỏi thăm về phần mềm. |
| **Chăm sóc 1-1 tài khoản dùng thử & Review UTM** | Founder | 2,0 giờ/tuần | Nhắn Zalo/gọi điện (0946 013 633) hỗ trợ quán mới đăng ký lên menu trong 15 phút đầu; tối Chủ nhật xem bảng UTM 30 phút để chọn góc nội dung tuần kế tiếp. |
| **Tổng cộng** | **1–2 người kiêm nhiệm** | **~6,5 giờ/tuần** | **0 VNĐ ngân sách quảng cáo trả phí** |

---

## 3. Phễu Chuyển Đổi & Chỉ Tiêu KPI 30 Ngày (Measurable Funnel & Targets)

Mục tiêu được đặt ở mức **thực tế, đo được bằng UTM và dữ liệu hệ thống** cho một chiến dịch organic 30 ngày khởi điểm từ một quán flagship địa phương:

| Tầng phễu | Chỉ số đo lường | Nguồn đo | Mục tiêu 30 ngày (Thực tế) | Mục tiêu bứt phá (Stretch) |
| :--- | :--- | :--- | :--- | :--- |
| **1. Tiếp cận & Điểm chạm quán** | Lượt quét QR tại bàn / thẻ promo `/checkin` / chân bill | UTM `instore` | 350 – 500 lượt quét | 800+ lượt quét |
| **2. Lưu lượng xem bảng giá** | Tổng lượt truy cập `auraspace.cafe/pricing` (tất cả UTM) | Analytics theo `utm_campaign=flagship_sadec_30d` | 600 – 900 lượt xem | 1.500+ lượt xem |
| **3. Đăng ký dùng thử 14 ngày** | Số tài khoản hoàn tất `/signup` (tạo `/s/:slug`) | Database đăng ký + UTM | 30 – 45 quán đăng ký (tỷ lệ chuyển đổi ~5%) | 75+ quán đăng ký |
| **4. Kích hoạt thực tế (Activation)** | Số quán dùng thử có ≥ 5 món trong menu & phát sinh ≥ 3 đơn test/thật qua QR hoặc POS trong 7 ngày đầu | Event hệ thống SaaS | 15 – 22 quán kích hoạt (≥ 50% số đăng ký) | 40+ quán kích hoạt |
| **5. Chuyển đổi trả phí (Paid)** | Số quán nâng cấp lên Starter (199k), Pro (499k) hoặc Chain (1.290k) sau 14 ngày (đo tới Ngày 45) | Billing / PayOS | 5 – 8 quán trả phí (tỷ lệ chốt ~30–35% trên nhóm kích hoạt) | 12–15 quán trả phí |

### Ước tính doanh thu định kỳ tạo ra (MRR / Cashflow)
- **Kịch bản mục tiêu thực tế** (ví dụ: 4 Starter + 3 Pro = 7 quán):
  - MRR: `(4 × 199.000) + (3 × 499.000)` = **2.293.000 VNĐ/tháng**.
  - Nếu 50% chọn đóng theo năm (giảm 20%: 1.910.400đ/năm Starter, 4.790.400đ/năm Pro) → dòng tiền thu ngay trong 45 ngày đầu đạt khoảng **13 – 18 triệu VNĐ** với **0 VNĐ chi phí ads** (CAC gần như bằng 0).

---

## 4. Nghi Thức Đánh Giá Hàng Tuần (Weekly Review Ritual — 30 Phút Tối Chủ Nhật)

Mỗi tối Chủ nhật (Ngày 7, 14, 21, 28), Founder dành đúng 30 phút kiểm tra 3 câu hỏi và ra quyết định ngay cho tuần sau:

1. **Kênh nào mang về nhiều lượt bấm `/pricing` và `/signup` nhất?**
   - Lọc báo cáo theo `utm_source` (`instore`, `tiktok`, `fb_reels`, `facebook`, `zalo_oa`, `organic_search`) và `utm_content`.
   - *Hành động*: Giữ nguyên kênh hiệu quả nhất; nếu 1 chủ đề video (ví dụ `vid02_0pct_commission`) có tỷ lệ click cao gấp đôi chủ đề khác, lập tức quay thêm 1 biến thể góc quay mới cho chủ đề đó ở tuần tiếp theo.
2. **Người dùng thử đang bị khựng ở bước nào?**
   - Kiểm tra danh sách quán đã đăng ký `/signup` nhưng chưa đạt ngưỡng kích hoạt (chưa sửa menu hoặc chưa bấm đơn test).
   - *Hành động*: Gọi/nhắn Zalo hỗ trợ trực tiếp trong vòng 24 giờ sau khi đăng ký. Hỏi đúng 1 câu: *"Anh/chị có cần em nhập phụ menu hoặc gửi mẫu in QR đặt bàn không?"*.
3. **Điểm chạm tại quán AURA CAFE có đang chạy đều không?**
   - Kiểm tra riêng `utm_source=instore` (`table_qr`, `checkin_promo`, `receipt_qr`, `kds_demo`).
   - *Hành động*: Nếu `receipt_qr` ít lượt quét do mực in mờ hoặc chữ nhỏ, chỉnh lại khổ chữ và mã QR trên mẫu bill nhiệt ngay sáng Thứ Hai.

---

## 5. Quản Trị Rủi Ro & Phương Án Xử Lý (Risk Register & Mitigations)

| Rủi ro tiềm ẩn | Mức độ | Dấu hiệu nhận biết | Phương án phòng ngừa & xử lý |
| :--- | :--- | :--- | :--- |
| **Bài đăng trong Group F&B bị xóa hoặc gắn mác quảng cáo** | Cao | Bài bị từ chối duyệt hoặc bị bình luận tiêu cực là "seeding bán phần mềm". | Viết theo góc chia sẻ kinh nghiệm chủ quán thật (số liệu BOM, cách xử lý đơn cuối tuần), tuyệt đối không chèn link bán hàng trong nội dung bài; chỉ để link ở bình luận đầu tiên hoặc gửi riêng khi có người hỏi. |
| **Khách B2C tại quán thấy phiền vì thông điệp B2B** | Trung bình | Khách phàn nàn hoặc tỷ lệ quét QR gọi món/check-in giảm. | Tách bạch rõ không gian hiển thị: mặt trước kệ bàn 100% phục vụ khách gọi món; thông điệp SaaS chỉ nằm gọn ở mặt sau kệ, 4 dòng cuối chân bill nhiệt và 1 thẻ nhỏ cuối trang `/checkin` sau khi khách đã tích điểm xong. |
| **Quán đông khách đột xuất làm đứt nhịp quay video** | Trung bình | Tới ngày đăng theo lịch nhưng chưa có video mới. | Quay dồn 2 video trong 1 buổi sáng vắng khách (Thứ Ba 09:00–10:30) để luôn có sẵn ít nhất 1 video dự phòng; ưu tiên sự chân thật, không cầu toàn hậu kỳ. |
| **Chủ quán đăng ký dùng thử `/signup` nhưng bỏ quên không dùng** | Cao | Tỷ lệ kích hoạt (Activation) dưới 30%. | Áp dụng quy tắc "15 phút đầu vàng": chuẩn bị sẵn tin nhắn Zalo chào mừng + video hướng dẫn 60 giây cách in QR bàn và bấm đơn KDS đầu tiên; chủ động gọi hỗ trợ từ hotline 0946 013 633. |
| **Link UTM gõ sai khiến mất dữ liệu đo lường** | Thấp | Traffic đổ về Direct thay vì `flagship_sadec_30d`. | Copy-paste trực tiếp từ bảng URL chuẩn trong `channels.md` và `content-pack.md`; quét thử lại toàn bộ mã QR in tại quán bằng 2 điện thoại (iOS & Android) ngay trong Ngày 1. |
