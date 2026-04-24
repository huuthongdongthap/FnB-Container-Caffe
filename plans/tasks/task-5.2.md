## Task: Tạo `docs/backend-proposals.md` — Feature Gap Analysis & Roadmap

### Input
Dựa trên inventory file: `plans/results/task-5.1-inventory.md` (đã có sẵn)

### Hướng dẫn
1. Đọc file `plans/results/task-5.1-inventory.md` để lấy danh sách features backend đang có.

2. Đọc TẤT CẢ 14 frontend JS files trong `js/` để mapping features frontend:
   - `js/api-client.js` — API calls
   - `js/auth.js` — auth UI
   - `js/cart.js` — cart management
   - `js/checkout.js` — checkout flow
   - `js/loyalty.js` — loyalty frontend
   - `js/track-order.js` — order tracking
   - `js/kds-app.js` + `js/kds-poll.js` + `js/kds/kds-api.js` + `js/kds/kds-render.js`
   - `js/checkout/cart-summary.js` + `js/checkout/payment.js` + `js/checkout/qr-code.js`
   - `js/landing/form-validation.js` + `js/landing/gallery.js`

3. So sánh FE vs BE từ inventory → tạo 3 categories:
   - **Đã có ✅**: FE đã có UI + BE đã có API (full-stack)
   - **Đang thiếu 🔴**: FE đã có UI nhưng BE chưa có API (gap analysis)
   - **Đề xuất mới 🆕**: Chưa có cả FE lẫn BE

4. Output vào file `docs/backend-proposals.md` với cấu trúc:

```markdown
# Backend Proposal — FnB Container Caffe

## Tổng quan
Tóm tắt 1 đoạn về kiến trúc hiện tại: 17 routes, D1 database, Cloudflare KV, PayOS integration, JWT auth.

## Đã có ✅ (Full-Stack Features)
Liệt kê tất cả features đang hoạt động đầy đủ FE + BE. Với mỗi feature:
- **Feature Name**: mô tả ngắn
  - FE: [file.js]
  - BE: [route.js] + [endpoints]

## Đang thiếu & Cần thiết 🔴 (FE có UI, BE thiếu API)
Liệt kê tất cả gaps — những gì FE cần nhưng BE chưa support:
- **Feature Name**: FE đang làm gì, BE cần API gì
  - FE: [file.js] đang gọi/khả năng
  - BE: cần thêm route/middleware nào

## Đề xuất mới 🆕 (chưa có cả FE lẫn BE)
Chỉ đề xuất, KHÔNG implement. P2 chỉ đề xuất, không implement:
- Analytics Aggregation, Inventory Tracking, QR Code Ordering, Export/Report

## Roadmap ưu tiên (P0/P1/P2)
### P0 — Critical (làm ngay)
- List các gap quan trọng nhất

### P1 — Important (next sprint)  
- List các đề xuất mới

### P2 — Nice to have
- List các tính năng dài hạn
```

### Output file
`docs/backend-proposals.md`
