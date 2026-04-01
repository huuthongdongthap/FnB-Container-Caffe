# Refactoring Plan: FnB Container Caffe 12 Pillars Infrastructure

**Date:** 2026-04-01
**Target:** Frontend Monolith & Backend Integration Foundation
**Mode:** Standard

## Tiêu Điểm Dự Án
Chuyển đổi dự án tĩnh (Static HTML/JS) hiện tại thành một nền tảng Modular Architecture. Đây là bước đệm bắt buộc để tích hợp 12 Trụ Cột Công Nghệ (Odoo POS, KDS WebSocket, Thanh toán VNPay/PayOS, IoT Home Assistant) mà không làm sập toàn bộ frontend.

## Các Vấn Đề (Technical Debt) Đang Gặp Phải
- Pipeline Build Thủ Công: `minify:js` trong `package.json` nối cứng hơn 15 file `*.js`. Dễ sinh lỗi dependency/loading order như trường hợp `ui-animations` vừa gặp.
- Không có Module System: Các file JS (`cart.js`, `checkout.js`, `kds-app.js`) dùng Global Scope. 
- Không State Management: Giao dịch PayOS và UI trạng thái dễ bị desync.
- Backend: Cần thiết lập API Gateway trên Cloudflare Workers kết nối PayOS, Odoo.

## Phân Rã Các Phase (Phases)

| Phase | Mục tiêu | Độ rủi ro | Trạng thái |
|-------|----------|-----------|------------|
| Phase 1 | Frontend Modularization (Vite ESModules) | Cao | TODO |
| Phase 2 | API Gateway Foundation (Cloudflare -> Odoo/PayOS) | Vừa | TODO |
| Phase 3 | KDS (Kitchen Display System) & WebSockets | Vừa | TODO |
