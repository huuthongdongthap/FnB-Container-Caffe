# F&B CAFFE CONTAINER — Sa Đéc

Chào mừng đến với **F&B CAFFE CONTAINER** — Quán cà phê container phong cách F&B hiện đại tại Sa Đéc, Đồng Tháp.

> Forked từ VIBE CODING Café — thuộc hệ sinh thái **Mekong CLI / Sadec Marketing Hub**.

## 🎯 Thông Tin Dự Án
- **Mục tiêu:** Doanh thu F&B tối ưu từ mô hình container café.
- **Concept:** F&B Container — Where Flavor Meets Design.
- **Vị trí:** Sa Đéc, Đồng Tháp (Container Architecture).
- **Trạng thái:** Production-ready v2.1.0.

## 💻 Open Source Arsenal (Tech Stack)
F&B CAFFE CONTAINER sử dụng 100% phần mềm mã nguồn mở để tối ưu hóa 90% chi phí SaaS.
Toàn bộ chi tiết hệ thống nằm ở file: [**TECH_STACK.md**](TECH_STACK.md)

12 Trụ cột cốt lõi:
1. **Odoo (POS/ERP/CRM)** - Quản trị toàn diện.
2. **Cal.com** - Đặt lịch phòng họp & sự kiện.
3. **OpenWISP** - Quản lý WiFi Marketing.
4. **pretix** - Bán vé Workshop/Sự kiện.
5. **TastyIgniter** - Hệ thống Online Ordering.
6. **Frigate & Home Assistant** - Camera AI và IoT.
*(Xem thêm 6 pillars khác trong TECH_STACK.md)*

## 🚀 Quick Start

### Yêu cầu
- Node.js 18+
- npm 9+

### Cài đặt

```bash
# 1. Clone repository
git clone https://github.com/your-org/fnb-container-caffe.git
cd FnB-Container-Caffe

# 2. Install dependencies
npm install

# 3. Chạy dev server (http://localhost:8081)
npm run dev

# 4. Chạy tests
npm test

# 5. Build production (lint + minify)
npm run build
```

### Scripts

| Command | Mô tả |
|---------|-------|
| `npm run dev` | Chạy dev server tại port 8081 |
| `npm test` | Chạy Jest test suite |
| `npm run lint` | ESLint check |
| `npm run lint:fix` | ESLint auto-fix |
| `npm run minify` | Minify CSS/JS assets |
| `npm run build` | Lint + Minify production build |
| `npm run deploy` | Deploy lên Cloudflare Pages |

## 📡 API Endpoints (Cloudflare Worker)

Worker cung cấp 11 REST API endpoints:

### Menu APIs

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| GET | `/api/menu` | Lấy danh sách menu (filter: category, available, search) |
| GET | `/api/menu/:id` | Lấy chi tiết món theo ID |

### Order APIs

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| POST | `/api/orders` | Tạo đơn hàng mới |
| GET | `/api/orders/:id` | Lấy thông tin đơn hàng |
| PATCH | `/api/orders/:id` | Cập nhật trạng thái đơn hàng |
| GET | `/api/admin/orders` | Lấy danh sách đơn (admin) |
| GET | `/api/stats` | Thống kê dashboard (orders, revenue, top products) |

### Auth APIs

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| POST | `/api/auth/register` | Đăng ký tài khoản mới |
| POST | `/api/auth/login` | Đăng nhập (trả về JWT token) |
| POST | `/api/auth/logout` | Đăng xuất (invalidate token) |
| GET | `/api/auth/me` | Lấy thông tin user hiện tại |

## 🚀 Infrastructure
Thư mục `infrastructure/` chứa các cấu hình (Docker Compose) cơ bản để triển khai:
- [Docker Compose Bootstrap](infrastructure/docker-compose-bootstrap.yml): Cấu hình Odoo + PostgreSQL local.

## 📄 Project Brief
Hồ sơ thiết kế dự án (Concept, 2D/3D Layout, Ngân sách):
- Mở file: [project-brief.html](project-brief.html)

## 🔗 Mekong CLI Integration
Dự án này thuộc hệ sinh thái **Mekong CLI Framework** và được quản lý qua `mekong.config.yaml`.

```
mekong-cli/
└── FnB-Container-Caffe/     ← Đường dẫn dự án
    ├── mekong.config.yaml   ← Config trỏ về Mekong CLI
    ├── index.html
    ├── styles.css
    ├── script.js
    ├── worker/
    │   └── src/
    │       ├── index.js     ← Worker entry point
    │       ├── middleware/
    │       └── routes/
    ├── js/
    ├── css/
    ├── infrastructure/
    └── ...
```

---
*Tài liệu nội bộ — Mekong CLI Framework / Sadec Marketing Hub.*