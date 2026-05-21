# Cấu Hình Hạng Thành Viên AURA LOYALTY (Dựa trên Điểm Tích Lũy Trọn Đời)

Tài liệu này xác định chính thức các khái niệm, quy tắc phân hạng và đặc quyền của chương trình khách hàng thân thiết AURA LOYALTY tại **AURA SPACE**, áp dụng từ phiên bản v2.0 (tháng 5/2026).

---

## 1. Khái Niệm Cốt Lõi

Để đảm bảo quyền lợi tối đa cho khách hàng và tính bền vững cho doanh nghiệp, hệ thống phân tách điểm thành hai khái niệm độc lập:

*   **Điểm Tích Lũy Trọn Đời (`lifetime_points`)**: 
    *   **Định nghĩa**: Là tổng số điểm khách hàng tích lũy được từ mọi nguồn kể từ lúc đăng ký tài khoản.
    *   **Tính chất**: Chỉ tăng, không bao giờ giảm (không bị trừ đi khi khách hàng đổi quà/voucher).
    *   **Mục đích**: **Dùng làm thước đo duy nhất để xác định hạng thành viên và ngăn ngừa việc tụt hạng.**
*   **Điểm Khả Dụng (`loyalty_points`)**:
    *   **Định nghĩa**: Là điểm số hiện có trong ví điểm của khách hàng.
    *   **Tính chất**: Tăng khi tích điểm mới và **giảm đi tương ứng khi khách hàng đổi voucher/quà tặng**.
    *   **Mục đích**: Dùng để quy đổi sang quà tặng, đồ uống miễn phí hoặc voucher giảm giá.

---

## 2. Bảng Phân Hạng Thành Viên & Đặc Quyền

Hệ thống tự động nâng hạng ngay lập tức khi **Điểm Tích Lũy Trọn Đời (`lifetime_points`)** của khách hàng đạt tới các ngưỡng quy định dưới đây:

| Hạng Thành Viên | Ngưỡng Điểm Trọn Đời (`min_points`) | Tỷ Lệ Hoàn Tiền (`cashback_rate`) | Hệ Số Nhân Điểm (`point_multiplier`) | Ưu Đãi Sinh Nhật (`birthday_discount`) | Thời Hạn Điểm Khả Dụng (`expiry_days`) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Bronze (Đồng)** | **0 điểm** | 3% | x1.0 | Giảm 10% | 90 ngày |
| **Silver (Bạc)** | **50 điểm** | 5% | x1.2 | Giảm 20% | 120 ngày |
| **Gold (Vàng)** | **200 điểm** | 7% | x1.5 | Giảm 35% | 180 ngày |
| **Platinum (Bạch Kim)** | **500 điểm** | 10% | x2.0 | Giảm 50% + Quà đặc biệt | Không bao giờ hết hạn |

---

## 3. Các Cách Tích Lũy Điểm Trọn Đời

Khách hàng có thể gia tăng điểm trọn đời (`lifetime_points`) thông qua 3 luồng hoạt động chính:

1.  **Chi tiêu mua sắm tại quán (Spend-based)**:
    *   Tích lũy điểm dựa trên hóa đơn với tỷ lệ: **1 điểm cho mỗi 10,000₫ thanh toán**.
    *   Công thức: `Điểm tích lũy = floor(Giá trị hóa đơn / 10,000) * Hệ số nhân điểm (Point Multiplier)`.
    *   *Ví dụ: Khách hàng hạng Gold chi tiêu 100,000₫ sẽ được tích lũy: `floor(100,000 / 10,000) * 1.5 = 15 điểm`.*
2.  **Giới thiệu bạn bè (Referral integration)**:
    *   Người giới thiệu (Referrer) nhận ngay **+100 điểm** trọn đời (và 100 điểm khả dụng) khi người được giới thiệu hoàn thành đơn hàng đầu tiên hợp lệ từ 30,000₫ trở lên.
3.  **Chiến dịch Marketing (Bonus Campaigns)**:
    *   Thưởng điểm khi tham gia các sự kiện khai trương, ngày vàng nhân đôi điểm tích lũy, hoặc hoàn thiện thông tin tài khoản.

---

## 4. Lợi Ích Của Mô Hình "Điểm Trọn Đời"

*   **Không lo tụt hạng**: Khách hàng có thể đổi quà liên tục (khấu trừ điểm khả dụng) mà vẫn giữ nguyên đẳng cấp của mình (giữ nguyên hạng Bạc/Vàng/Bạch Kim dựa theo điểm trọn đời).
*   **Decouple giá trị**: Cho phép bộ phận Marketing linh hoạt tạo các chương trình tặng điểm miễn phí (như tặng 100đ khi giới thiệu bạn) để thúc đẩy nâng hạng cho các khách hàng tích cực chia sẻ, thay vì bó buộc cứng nhắc vào số tiền chi tiêu.
*   **Tối ưu hiệu năng**: Điểm số được lưu dưới dạng cột số trực tiếp, giúp hệ thống truy vấn và nâng hạng cực kỳ nhanh mà không cần tính tổng lịch sử hóa đơn mỗi khi đặt hàng.
