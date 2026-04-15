File: `js/api-client.js`. Đọc code hiện có. THÊM (không xóa code cũ) các methods nếu chưa có:
- getMenu(category?) → GET /api/menu?category=X
- getMenuItem(id) → GET /api/menu/:id
- createOrder(data) → POST /api/orders
- getOrder(id) → GET /api/orders/:id
- updateOrderStatus(id, status) → PUT /api/orders/:id/status
- getOrdersByStatus(status) → GET /api/orders?status=X
- getTables(zone?) → GET /api/tables?zone=X
- updateTableStatus(id, status) → PUT /api/tables/:id/status

Follow existing code pattern. Giữ nguyên base URL config từ config.js.
