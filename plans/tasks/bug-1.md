Refactor `worker/src/index.js` — loại bỏ legacy dispatcher & fix runtime bugs.

ĐỌC: `worker/src/index.js` toàn bộ.

## Yêu cầu (thực hiện theo thứ tự):

### 1. Fix undefined function references (Hono routes)
- Line 49: `getLatestOrderTs(c)` → đổi thành `getLatestOrderTimestamp(c.req.raw, c.env)` (đã import sẵn)
- Line 54-55: `getKdsOrders(c)` và `updateOrderStatus(c)` — chưa định nghĩa. Import từ `./routes/orders-hono.js` nếu có, hoặc tạo inline handler query D1 trực tiếp.

### 2. Mount missing Hono sub-routers
Thêm 3 dòng sau khối `app.route(...)` hiện tại (sau line ~74):
```js
app.route('/api/reviews', reviewsRouter);
app.route('/api/contact', contactRouter);
app.route('/api/loyalty', loyaltyRouter);
```

### 3. Xóa legacy manual dispatcher
Xóa toàn bộ block `export default { async fetch(request, env, ctx) { ... } }` (khoảng line 88-229).
Thay bằng:
```js
export default app;
```

Hoàn tất → trả lời "Done bug-1".
