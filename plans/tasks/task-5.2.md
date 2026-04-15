P0: Verify Order Flow End-to-End.
ĐỌC: js/checkout.js (xem gọi API nào khi submit order), worker/src/routes/orders.js (xem handler create order), success.html (xem có đọc order_id từ response không).

Kiểm tra flow: checkout submit → Worker tạo order (D1) → trả order_id → redirect success.html?id={orderId}

Nếu có gap → FIX, ghi comment "// FIX: P0 order flow". Nếu OK → báo cáo "Order flow E2E: OK".
