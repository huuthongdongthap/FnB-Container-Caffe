Implement Auto-Cashback Trigger.
ĐỌC: `worker/src/routes/orders.js`, và logic cập nhật đơn hàng. Đọc `worker/src/routes/loyalty.js` để xem schema.
Yêu cầu:
1. Khi đơn hàng được thanh toán (hoặc khi KDS update status thành "Hoàn thành" qua PATCH `/api/orders/:id/status`), cần tự động kích hoạt logic cộng điểm CashBack cho khách hàng (dựa trên `customer_phone` và `total_amount`).
2. Vì các router chạy chung trong Worker, bạn có thể implement bằng cách gọi thẳng thư viện hoặc fetch local `POST /api/loyalty/cashback`.
3. Audit và chọn vị trí gọi Code tốt nhất (ví dụ: trong handler PATCH `/api/orders/:id/status` khi status='Hoan thanh').
4. Viết code chèn logic update D1 table `loyalty_members` cho cashback.
Hoàn tất thì trả lời "Done 5.5".
