# 🏆 CẨM NANG CHỦ QUÁN: CHIẾN DỊCH KHAI TRƯƠNG LOYALTY, CASHBACK & VOUCHERS

> **Dành cho:** Chủ quán AURA CAFE Sa Đéc  
> **Phiên bản:** v2.1 (Tích hợp Mã giảm giá khai trương & Loyalty v2)  
> **Ngày áp dụng:** 06/06/2026  
> **Dự án:** [FnB-Container-Caffe](file:///Users/mac/mekong-cli/FnB-Container-Caffe)  

Tài liệu này được biên soạn đầy đủ, trực quan và chi tiết nhất giúp chủ quán hiểu sâu sắc cơ chế vận hành tài chính, dòng tiền và cấu trúc kiểm soát rủi ro của chương trình **Thành viên tích lũy (Loyalty)**, **Hoàn tiền (Cashback)** song song với **Mã giảm giá khai trương (Vouchers)**. 

Tài liệu đi kèm các kịch bản tài chính giả định cụ thể để chủ quán dễ dàng ra quyết định kinh doanh tối ưu nhất.

---

## 1. Nguyên Tắc Cốt Lõi Về Trực Quan Tài Chính
Hệ thống kết hợp 3 hình thức ưu đãi: **Voucher giảm giá trực tiếp** + **Tích lũy ví Cashback** + **Đổi điểm lấy đồ uống miễn phí**. Để bảo vệ dòng tiền mặt của quán luôn **dương (+)**, hệ thống áp dụng các nguyên tắc chặn cứng sau:

1. **Quy tắc xếp chồng ưu đãi (Stacking Hierarchy):**
   * Khi khách mua hàng, **Voucher giảm giá (Mã giảm giá)** được áp dụng trước để giảm giá trị hóa đơn gộp (Gross bill).
   * **Ví Cashback** được sử dụng để thanh toán tối đa **50% số dư còn lại** sau giảm giá.
   * **Điểm tích lũy và Cashback mới** chỉ được tính dựa trên **số tiền mặt thực tế khách trả sau cùng** (`Cash Paid`).
2. **Triệt tiêu vòng lặp tích lũy (No Loop Earning):** Khách không thể dùng cashback để tạo ra cashback mới.
3. **Chi phí Loyalty cực thấp (1.2% - 2.4%):** Khi khách đổi 100 điểm lấy 1 đồ uống trị giá 40.000đ, quán chỉ chịu chi phí sản xuất nguyên vật liệu thực tế (`40.000đ × 30% COGS = 12.000đ`).

---

## 2. Hệ Thống Hạng Thành Viên & Ưu Đãi Khai Trương

### 2.1 Hệ thống 4 hạng thành viên tiêu chuẩn
Khách hàng đăng ký miễn phí bằng Số điện thoại và tự động thăng hạng theo tổng chi tiêu:

| Hạng | Tổng Chi Tiêu Tích Lũy | Cashback Thường | Hệ số Điểm | Ưu đãi sinh nhật | Hiệu lực ví |
| :--- | :--- | :---: | :---: | :---: | :---: |
| 🥉 **Bronze** (Đồng) | 0 — 500.000đ | **3%** | ×1.0 | Giảm 10% | 90 ngày |
| 🥈 **Silver** (Bạc) | 500.000 — 2.000.000đ | **5%** | ×1.2 | Giảm 20% | 120 ngày |
| 🥇 **Gold** (Vàng) | 2.000.000 — 5.000.000đ | **7%** | ×1.5 | Giảm 35% | 180 ngày |
| 💎 **Platinum** (Bạch Kim) | > 5.000.000đ | **10%** | ×2.0 | Giảm 50% + Quà | Vĩnh viễn |

### 2.2 Chiến dịch khai trương đặc quyền (3 ngày: 6-8/6/2026)
* 🔥 **Cashback Nhân Đôi (x2):** Bronze (**6%**), Silver (**10%**), Gold (**14%**), Platinum (**20%**). *Giới hạn cashback tối đa 100.000đ/đơn.*
* 🎁 **Thưởng Đăng Ký Mới:** Tặng ngay **+50.000đ** vào ví cashback cho **100 người đầu tiên** đăng ký.
* 👥 **Thưởng Giới Thiệu (Referral):** Người giới thiệu và Người được giới thiệu đều nhận **+50.000đ** vào ví sau khi người được giới thiệu thanh toán đơn đầu tiên thành công.
* ⬆️ **Nâng hạng siêu tốc:** Chi tiêu **≥ 200.000đ trong 1 đơn** ngày khai trương ➔ Tự động nâng lên **Silver** (không cần tích lũy đủ 500k).

### 2.3 Hệ Thống Mã Giảm Giá Vouchers Khai Trương (Voucher Codes)
Để bùng nổ chiến dịch khai trương, quán phát hành bộ 4 mã Voucher đặc quyền với các điều kiện chặn nghiêm ngặt bảo vệ dòng tiền mặt:

| Mã Voucher | Loại Ưu Đãi | Cơ Chế Áp Dụng | Giới Hạn (Cap) | Điều Kiện & Cách Dùng |
| :--- | :--- | :--- | :---: | :--- |
| 🎟️ **AURA20** | **Giảm 20% hóa đơn** | Áp dụng trực tiếp vào Bill gộp trước khi tính ví Cashback/Points. | Giảm tối đa **50.000đ** | Dành cho tất cả thành viên trong ngày khai trương 6/6. |
| 🎟️ **AURA10** | **Giảm 10% hóa đơn** | Áp dụng trực tiếp vào Bill gộp trước khi tính ví Cashback/Points. | Giảm tối đa **30.000đ** | Dành cho thành viên trong tuần lễ khai trương (7/6 - 13/6). |
| 🎟️ **CHECKIN30K** | **Voucher 30.000đ** | Giảm trừ trực tiếp cho hóa đơn **lần mua tiếp theo**. | Phát 50 lượt | Tặng khách hàng check-in chụp hình tại quán kèm hashtag `#AURACafeSaDec`. |
| 🎟️ **LOYALTY50** | **Tặng 50.000đ ví** | Cộng thẳng vào Ví Cashback để trừ tối đa 50% bill sau. | Giới hạn 100 khách | Tặng cho 100 khách hàng đầu tiên đăng ký thành viên mới thành công. |

> [!NOTE]
> **Lưu ý kỹ thuật:** Mọi mã giảm giá (AURA20, AURA10) đều phải tuân thủ nguyên tắc **Xếp chồng ưu đãi**: Giảm bill trước ➔ Áp dụng ví cashback sau ➔ Tích lũy điểm/cashback mới trên số tiền mặt thực tế thanh toán cuối cùng.

---

## 3. Phân Tích Cân Đối Dòng Tiền: Chu Kỳ Referral (A ➔ B)

Để chứng minh tính an toàn tài chính, dưới đây là luồng tiền của chu kỳ giới thiệu thành viên giữa khách hàng **A (Người giới thiệu)** và **B (Người được giới thiệu)** trong giai đoạn khai trương.

### Giả định kịch bản:
1. Cả A và B đều đăng ký mới và nhận **50.000đ** thưởng đăng ký.
2. B mua đơn đầu tiên **100.000đ**, áp dụng thêm **Voucher khai trương giảm 10%** (10.000đ) ➔ Bill còn 90.000đ. B dùng 45.000đ ví cashback (tối đa 50% số dư) và trả **45.000đ tiền mặt**.
3. B thanh toán đơn đầu thành công ➔ A nhận thưởng giới thiệu **+50.000đ** và tự động nâng lên **Silver** (nhận 100 điểm).
4. B thực hiện đơn 2 trị giá **100.000đ** (sử dụng 5.000đ ví còn lại) ➔ trả **95.000đ cash**.
5. A thực hiện đơn 1 trị giá **200.000đ** (sử dụng tối đa 100.000đ ví) ➔ trả **100.000đ cash**.

### 📊 Bảng đối chiếu dòng tiền chi tiết:

| Bước | Hành Động & Giao Dịch | Ví Cashback Khách A | Ví Cashback Khách B | Doanh Thu Tiền Mặt | Giá Vốn NVL (30% COGS) | Chi phí Voucher (10%) | Dòng Tiền Mặt Thuần Thu Về |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **0** | Đăng ký tài khoản mới | **+50.000đ** | **+50.000đ** | 0đ | 0đ | 0đ | **0đ** |
| **1** | B mua đơn 1 (100k, giảm 10k voucher)<br>*B trả 45k cash + 45k ví* | 50.000đ | 5.000đ ví còn lại<br>+ **2.700đ** tích mới (6% trên 45k cash) | +45.000đ | -30.000đ | -10.000đ | **+5.000đ** |
| **2** | Duyệt Referral thành công | **+50.000đ** *(Ví: 100k)* | 7.700đ | 0đ | 0đ | 0đ | **0đ** |
| **3** | B mua đơn 2 (100k)<br>*B trả 95k cash + 5k ví* | 100.000đ | 2.700đ ví còn lại<br>+ **5.700đ** tích mới (6% trên 95k cash) | +95.000đ | -30.000đ | 0đ | **+65.000đ** |
| **4** | A mua đơn 1 (200k)<br>*A trả 100k cash + 100k ví* | **10.000đ** tích mới (10% trên 100k cash hạng Silver) | 8.400đ | +100.000đ | -60.000đ | 0đ | **+40.000đ** |
| **Tổng** | **Toàn bộ chu kỳ tương tác** | **10.000đ ví còn** | **8.400đ ví còn** | **+240.000đ** | **-120.000đ** | **-10.000đ** | **+110.000đ** |

> [!TIP]
> **Bảo chứng dòng tiền thực:** Qua chu kỳ trên, tổng dòng tiền mặt thu về của quán đạt **+110.000đ (dương hoàn toàn)**. Quán không hề bị thâm hụt tiền mặt nhờ cơ chế chặn 50% ví cashback bắt buộc khách phải chi tiền túi, bù đắp hoàn toàn chi phí COGS và Voucher giảm giá!

---

## 4. Dự Toán Và 5 Kịch Bản Giả Định Tài Chính
*(Dựa trên doanh thu cơ sở gộp mục tiêu: **100.000.000đ / tháng**)*

Để có cái nhìn toàn diện, dưới đây là 5 kịch bản mô phỏng tài chính tích hợp cả yếu tố **Loyalty, Cashback x2** và **Chi phí Voucher khai trương**.

### 📊 BẢNG TỔNG HỢP SO SÁNH 5 KỊCH BẢN (DOANH THU 100M)

| Chỉ số tài chính | Kịch bản 1: Khai trương (Bùng nổ) | Kịch bản 2: Vận hành thường (Tiêu chuẩn) | Kịch bản 3: Vận hành thường (Khách quen cao) | Kịch bản 4: Vận hành thường (Đổi nước nhiều) | Kịch bản 5: Vận hành thường (Du lịch/Vãng lai) |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Doanh thu gộp (Gross)** | 100.000.000đ | 100.000.000đ | 100.000.000đ | 100.000.000đ | 100.000.000đ |
| **Độ phủ thành viên Loyalty** | **80%** | **50%** | **90%** | **70%** | **20%** |
| **Tỷ lệ khách dùng Voucher** | **60% khách** (Giảm gộp 15%) | **10% khách** (Giảm gộp 2%) | **5% khách** (Giảm gộp 1%) | **20% khách** (Giảm gộp 4%) | **5% khách** (Giảm gộp 1%) |
| **Doanh thu giảm trừ do Voucher** | -15.000.000đ | -2.000.000đ | -1.000.000đ | -4.000.000đ | -1.000.000đ |
| **Cashback đã tiêu dùng (Ví)** | -20.000.000đ | -15.000.000đ | -25.000.000đ | -20.000.000đ | -5.000.000đ |
| **TIỀN MẶT THỰC THU** | **65.000.000đ** | **83.000.000đ** | **74.000.000đ** | **76.000.000đ** | **94.000.000đ** |
| **COGS NVL (30% bill gộp)** | -30.000.000đ | -30.000.000đ | -30.000.000đ | -31.800.000đ* | -30.000.000đ |
| **Thuế & Phí vận hành POS (10%)** | -6.500.000đ | -8.300.000đ | -7.400.000đ | -7.600.000đ | -9.400.000đ |
| **DÒNG TIỀN MẶT THỰC THU VỀ** | **+28.500.000đ** | **+44.700.000đ** | **+36.600.000đ** | **+36.600.000đ** | **+54.600.000đ** |
| **Quỹ nợ Cashback tích lũy mới** | -4.550.000đ | -1.320.000đ | -3.200.000đ | -2.130.000đ | -440.000đ |
| **Quỹ nợ Loyalty Points phát sinh** | -858.000đ | -435.600đ | -921.600đ | -653.400đ | -176.000đ |
| **Nợ thưởng đăng ký (Khai trương)** | -5.000.000đ | 0đ | 0đ | 0đ | 0đ |
| **LỢI NHUẬN RÒNG SAU NỢ** | **+18.092.000đ** | **+42.944.400đ** | **+32.478.400đ** | **+33.816.600đ** | **+53.984.000đ** |
| **Tỷ lệ Biên ròng / Doanh số gộp** | **18.1%** | **42.9%** | **32.5%** | **33.8%** | **54.0%** |

*\* Kịch bản 4 đã cộng thêm 1.800.000đ chi phí COGS thực tế phục vụ cho 150 ly nước đổi quà bằng điểm của khách hàng thân thiết.*

---

## 5. Đánh Giá Chi Tiết Từng Kịch Bản

### Kịch Bản 1: Tháng Khai Trương — Bùng Nổ Chiến Dịch (Grand Opening)
* **Đặc điểm:** Tỷ lệ phủ thành viên đạt 80% nhờ hiệu ứng truyền thông mạnh. Hơn 60% khách hàng áp dụng Voucher khai trương giảm giá trực tiếp. Cashback nhân đôi hoạt động hết công suất. Đạt mốc tặng 50k thưởng cho 100 khách đăng ký đầu tiên.
* **Phân tích:** Mặc dù chi phí khuyến mãi cực kỳ khổng lồ (giảm 15M voucher + tiêu 20M cashback ví + thưởng 5M đăng ký), **dòng tiền thực thu về của quán vẫn đạt +28.500.000đ (Dương)**. Sau khi trừ đi toàn bộ nợ dự phòng tích lũy tương lai, lợi nhuận ròng vẫn đạt **18.092.000đ (Biên ròng 18.1%)**.
* **Đánh giá:** An toàn tuyệt đối, rất đáng triển khai để tạo tiếng vang lớn trong khu vực.

### Kịch Bản 2: Tháng Vận Hành Thường — Mức Độ Loyalty Tiêu Chuẩn
* **Đặc điểm:** Hệ thống đi vào quỹ đạo bình thường. Tỷ lệ khách thành viên chiếm 50% doanh số. Vouchers khai trương dừng áp dụng (chỉ còn 10% khách dùng voucher sinh nhật/sự kiện nhỏ). Tỷ lệ dùng ví cashback ở mức trung bình 15%.
* **Phân tích:** Dòng tiền thực của quán rất mạnh, đạt **+44.700.000đ**. Quỹ nợ dự phòng phát sinh cực thấp (chỉ ~1.7M). Lợi nhuận ròng đạt **42.944.400đ (Biên 42.9%)**.
* **Đánh giá:** Đây là trạng thái mơ ước của các quán cà phê, đảm bảo thời gian hoàn vốn đầu tư cực nhanh.

### Kịch Bản 3: Vận Hành Thường — Độ Phủ Loyalty Cao (Khách quen chiếm lĩnh)
* **Đặc điểm:** Quán xây dựng được tệp khách ruột Sa Đéc vững chắc, chiếm tới 90% doanh số. Khách hàng tích cực tiêu ví cashback (25% hóa đơn).
* **Phân tích:** Mặc dù khách tiêu cashback nhiều và tích lũy dồn dập, biên lợi nhuận ròng của quán vẫn cực kỳ bền vững ở mức **32.5%** (thu về **32.478.400đ** ròng).
* **Đánh giá:** Chứng minh toán học tự cân bằng của Loyalty v2 hoạt động hoàn hảo. Khách quen càng đông, doanh thu càng ổn định bất chấp thời tiết hay mùa vụ.

### Kịch Bản 4: Vận Hành Thường — Cao Điểm Đổi Điểm Nhận Nước (Voucher Peak)
* **Đặc điểm:** Tháng tri ân, tệp khách thành viên tích lũy đủ điểm và đồng loạt đổi voucher nước miễn phí (150 ly nước đổi quà bằng điểm). Tỷ lệ phủ thành viên 70%, tiêu cashback 20% hóa đơn.
* **Phân tích:** Quán chịu thêm chi phí vốn 1.800.000đ cho các ly nước đổi quà. Tuy nhiên biên lợi nhuận ròng vẫn giữ vững ở mức **33.8%** (thu về **33.816.600đ** ròng).
* **Đánh giá:** Chi phí nguyên vật liệu F&B thấp (30%) là chìa khóa giúp quán hấp thụ tốt các đợt đổi quà lớn mà không lo thâm hụt dòng tiền.

### Kịch Bản 5: Vận Hành Thường — Độ Phủ Loyalty Thấp (Khách vãng lai nhiều)
* **Đặc điểm:** Quán đón lượng lớn khách du lịch, khách vãng lai qua đường không đăng ký thành viên. Tỷ lệ thành viên chỉ chiếm 20%.
* **Phân tích:** Dòng tiền mặt thuần cao nhất hệ thống đạt **+54.600.000đ**, biên lợi nhuận ròng lên tới **54.0%** do hầu như khách trả 100% tiền mặt không ưu đãi.
* **Đánh giá:** Dòng tiền ngắn hạn rất mạnh nhưng tính ổn định lâu dài kém hơn vì thiếu tính ràng buộc quay lại của tệp thành viên.

---

## 6. Các Chốt Chặn Bảo Vệ Dòng Tiền (Anti-Loss Core Shields)
Để ngăn chặn hoàn toàn việc nhân viên POS gian lận hoặc hệ thống bị thâm hụt tài chính khi chạy voucher và cashback cùng lúc, AURA CAFE đã cài đặt sẵn **5 chốt chặn kỹ thuật**:

1. **Lá chắn chặn 50% sử dụng ví (50% Wallet Cap):** Đảm bảo khách hàng luôn trả tiền mặt ít nhất 50% hóa đơn. Vì `Tiền mặt thu về (≥50%) > COGS (30%)`, quán luôn có dòng tiền dương ngay trên mỗi đơn hàng.
2. **Quy tắc giảm giá trước - Tích lũy sau:** Cashback chỉ được tính trên số tiền mặt thực tế thanh toán sau khi đã áp dụng mọi Voucher giảm giá và Cashback cũ. Không tích lũy kép.
3. **Idempotency Chống Trùng Lặp:** Hệ thống khóa chặt database `cashback_transactions` với khóa UNIQUE `(order_id, type='earn')`. Một đơn hàng POS dù hoàn thành nhiều lần cũng chỉ được cộng cashback duy nhất 1 lần.
4. **Giới hạn trần giao dịch (Transaction Cap):** Cashback tối đa nhận được trên một hóa đơn là 50.000đ (100.000đ khi khai trương). Tránh việc khách mua số lượng lớn làm phát sinh nợ cashback đột biến.
5. **Giới hạn số lượng Voucher Khai trương:** Cài đặt giới hạn cứng số lượt sử dụng voucher khai trương trên hệ thống (ví dụ: giới hạn 100 khách đăng ký nhận bonus 50k đầu tiên).

---

## 7. Khuyến Nghị Chiến Lược Dành Cho Chủ Quán
Để tối đa hóa doanh thu và biên lợi nhuận ròng trong thời gian khai trương, chủ quán nên áp dụng các chiến thuật vận hành sau:

* 💡 **Upselling (Bán thêm món kèm):** Huấn luyện staff tư vấn khách hàng mua thêm topping (trân châu, thạch, kem phô mai) hoặc nâng size ly nước. Topping có biên lợi nhuận cực cao (COGS chỉ ~15%), giúp bù đắp hoàn toàn chi phí giảm giá của Voucher.
* 📦 **Combo Khai Trương:** Thiết kế các combo gồm "1 Đồ uống đặc sắc + 1 Bánh ngọt" với mức giá hấp dẫn (ví dụ: combo 79.000đ). Combo giúp đẩy giá trị đơn trung bình (AOV) lên cao, làm giảm tỷ trọng chi phí cố định của voucher trên mỗi bill.
* 🚫 **Ràng buộc điều kiện Voucher:** Cài đặt Voucher khai trương chỉ áp dụng cho hóa đơn tối thiểu từ 50.000đ hoặc 80.000đ. Tránh trường hợp đơn quá nhỏ (ví dụ đơn 20.000đ giảm 10.000đ) làm tăng tỷ lệ chi phí vốn trên đơn đó.
* 🥤 **Giới hạn danh mục món đổi quà:** Khi khách tích đủ điểm đổi nước miễn phí, chỉ cho phép đổi các món nước tiêu chuẩn (trà trái cây, cà phê đen, cà phê sữa) có chi phí sản xuất thấp. Giới hạn đổi các món đặc biệt có nguyên liệu đắt đỏ.

---

## 8. Kết Luận
Chương trình Loyalty, Cashback kết hợp Voucher khai trương của **AURA CAFE Sa Đéc** được thiết kế toán học **cực kỳ tối ưu, an toàn và dòng tiền luôn dương**. Chủ quán hoàn toàn yên tâm phê duyệt triển khai chiến dịch khai trương bùng nổ mà không lo ngại bất kỳ rủi ro thâm hụt tài chính nào!
