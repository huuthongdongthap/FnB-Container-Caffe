## Task: Backend Code Inventory — Scan & Map All Features

### Mục tiêu
Đọc toàn bộ backend codebase của FnB Container Caffe project, tạo một bản inventory chi tiết các features đang tồn tại.

### Cấu trúc thật của project
```
FnB-Container-Caffe/
├── worker/src/routes/          (17 files: auth, categories, contact, cron, customers, loyalty, menu, orders-hono, orders, payment, products, promotions, reservations, reviews, shifts, tables, webhooks)
├── worker/src/index.js         (main entry)
├── worker/src/middleware/      (admin-auth.js, cors.js)
├── worker/src/utils/           (logger.js)
├── worker/schema.sql           (schema)
├── db/schema.sql               (schema)
└── js/websocket-client.js      (websocket client-side)
```

### Hướng dẫn
1. Đọc TẤT CẢ 17 route files trong `worker/src/routes/`:
   - Với mỗi file: liệt kê METHOD + URL pattern + mô tả ngắn

2. Đọc `worker/src/index.js`: mapping tất cả app.use() + mount() + middleware chain

3. Đọc `worker/src/middleware/*.js`: mô tả từng middleware

4. Đọc `worker/schema.sql` + `db/schema.sql`: liệt kê tất cả tables, columns, constraints, relationships

5. Đọc `js/websocket-client.js`: mô tả events client subscribe

6. Output vào file `plans/results/task-5.1-inventory.md` với cấu trúc:

```markdown
# Backend Code Inventory

## Routes Inventory
| File | Method | URL | Description |
|------|--------|-----|------|
| ... | ... | ... | ... |

## Middleware Inventory
| File | Purpose |
|------|---------|
| ... | ... |

## Database Schemas
### Tables (từ db/schema.sql)
| Table | Columns | Constraints |
|-------|---------|-------------|
| ... | ... | ... |

### Tables (từ worker/schema.sql)
| Table | Columns | Constraints |
|-------|---------|-------------|
| ... | ... | ... |

## WebSocket Events
| Event | Direction | Description |
|-------|-----------|------|
| ... | ... | ... |

## Complete Feature List
- List tất cả features backend đang support (ví dụ: "Auth: JWT login/register", "Order: CRUD orders", etc.)
```

### Lưu ý
- Chỉ READ và DOCUMENT. Không viết code.
- Kết quả cần đủ chi tiết để task 2 có thể tạo proposal.
