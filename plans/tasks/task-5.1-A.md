PHẦN A: AUDIT BACKEND CODEBASE

Nhiệm vụ: Đọc, phân tích toàn bộ backend codebase của dự án FnB-Container-Caffe.

## Bước 1: Đọc tất cả files

Đọc các nhóm files sau (ghi lại nội dung quan trọng):

### Routes (10 files)
Đọc toàn bộ files trong: worker/src/routes/
- Liệt kê tất cả API endpoints (method + path + mô tả)
- Ghi chú các endpoints có logic đặc biệt

### JS Files (23 files)
Đọc toàn bộ files trong: worker/src/js/
- Liệt kê các modules/functions được export
- Ghi chú các service layer quan trọng

### Schemas
Đọc toàn bộ:
- worker/supabase/schema.sql (hoặc supabase/schema.sql)
- worker/db/schema.sql (nếu tồn tại)
- Liệt kê tất cả tables, relationships, indexes

### WebSocket
Đọc: worker/websocket-server.js (hoặc các file websocket tương đương)
- Ghi chú các event channels, real-time features

## Bước 2: Tổng hợp kết quả

Trả kết quả chi tiết theo format:

### A. Existing APIs (đã có)
| Method | Path | Description | Status |
|--------|------|-------------|--------|
| GET | /api/menu | ... | working |

### B. Database Schema
Liệt kê tất cả tables với columns chính + relationships

### C. JS Modules
Liệt kê các service/module chính + chức năng

### D. WebSocket Features
Các real-time channels và events

### E. Gap Analysis
- Frontend có UI nhưng backend chưa support (đánh dấu 🔴)
- Frontend gọi API nhưng trả về lỗi/404
- Missing features: frontend đã làm UI nhưng không có backend tương ứng

**OUTPUT:** Trả về kết quả phân tích chi tiết, không implement code. Chỉ đọc và báo cáo.
