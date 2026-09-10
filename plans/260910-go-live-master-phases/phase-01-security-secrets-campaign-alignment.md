# Phase 1: Security, Secrets & Date Window Alignment

## Objective
Khóa an toàn bảo mật hạ tầng Cloudflare, kiểm tra cấu hình bí mật và cập nhật cửa sổ ngày bắt đầu của chiến dịch khai trương `AURA20`, `AURA10` trong D1.

## Mekong CLI Commands
- `mekong sec-scan` — Quét bảo mật tự động toàn bộ codebase.
- `mekong sec-secrets` — Kiểm tra và quản lý Cloudflare Worker Secrets.
- `mekong code:check` — Kiểm tra tính toàn vẹn cú pháp và tiêu chuẩn code.
- `mekong backend-db-task` — Thực thi tác vụ cập nhật bảng D1 remote.

## Tasks
- [ ] Chạy audit bảo mật toàn bộ mã nguồn (`mekong sec-scan`).
- [ ] Xác minh các secret bắt buộc trên Cloudflare Worker: `JWT_SECRET`, `PAYOS_CLIENT_ID`, `PAYOS_API_KEY`, `PAYOS_CHECKSUM_KEY`.
- [ ] Khóa chặt CORS Origin trong `wrangler.toml` cho domain `https://auraspace.cafe` và `https://fnb-caffe-container.pages.dev`.
- [ ] Cập nhật bảng `promotions` và `bonus_campaigns` trên Cloudflare D1 với ngày khai trương chính thức:
  - `AURA20`: 20% off trong ngày khai trương (00:00 - 23:59).
  - `AURA10`: 10% off trong 6 ngày tiếp theo.
- [ ] Xác minh phản hồi từ `GET /api/promotions` đúng ngày giờ mới.
