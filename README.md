# F&B CAFFE CONTAINER — Sa Đéc

Chào mừng đến với **F&B CAFFE CONTAINER** — Quán cà phê container phong cách F&B hiện đại tại Sa Đéc, Đồng Tháp.

> Forked từ VIBE CODING Café — thuộc hệ sinh thái **Mekong CLI / Sadec Marketing Hub**.

## 🎯 Thông Tin Dự Án
- **Mục tiêu:** Doanh thu F&B tối ưu từ mô hình container café.
- **Concept:** F&B Container — Where Flavor Meets Design.
- **Vị trí:** Sa Đéc, Đồng Tháp (Container Architecture).
- **Trạng thái:** Khởi tạo & phát triển.

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
└── apps/
    └── fnb-caffe-container/   ← Đường dẫn dự án
        ├── mekong.config.yaml  ← Config trỏ về Mekong CLI
        ├── index.html
        ├── styles.css
        ├── script.js
        ├── infrastructure/
        └── ...
```

---
*Tài liệu nội bộ — Mekong CLI Framework / Sadec Marketing Hub.*