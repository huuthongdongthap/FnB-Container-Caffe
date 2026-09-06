# Hanging Tasks Inventory — Toàn dự án FnB-Container-Caffe

Date: 2026-08-25 | Method: sweep 97 plan dirs + 55 task files + code evidence verification

## Task còn treo thật sự (dev work chưa làm)

| # | Plan | Status | Bằng chứng treo |
|---|------|--------|-----------------|
| T1 | **260821-pos-kds-operations** | Proposed | 3 phases (POS offline queue, KDS SLA escalation, print/receipt queue) chưa start. Verified: cron.ts:137-145 chỉ log overdue orders, KHÔNG có escalation action; không có print_queue/receipt files; không có offline wiring trong StitchPOSNew* |
| T2 | **260820-0012-fnb-architecture-10x Phase 4** | In progress (P1-P3 done) | Phase 4 (i18n 100% extraction, production hardening) chưa được vận hành hóa — 0 checkbox, không tồn tại `src/i18n/`; chỉ 1 commit sau 2026-08-20 |
| T3 | **260814-production-readiness-launch-control** | Proposed — awaiting review | Approval gate chờ USER review SLO thresholds + backup drill policy trước khi implement. 6 phase files chưa execute |
| T4 | **Sprint 15-18 mega-modularization** | Abandoned | Sprint 16/17/18 = thư mục RỖNG (0 files). Sprint 13 status PLANNING. Thực tế: 83 files >200 LOC trong worker/src — mục tiêu modularization chưa đạt |
| T5 | **users table rỗng trên prod** | Mới phát hiện (audit 24-08) | staff-tips report trả "Unassigned" cho mọi tip cho đến khi seed staff rows |

## Task treo dạng "chờ thao tác vận hành" (không phải dev work)

| # | Item | Nguồn |
|---|------|-------|
| O1 | PayOS secrets (CLIENT_ID/API_KEY/CHECKSUM_KEY) + webhook URL setup + Test Webhook | go-live-checklist.md |
| O2 | Seed owner account đầu tiên (`worker/scripts/seed-admin.js`) | go-live-checklist.md |
| O3 | Smoke curls go-live (health/menu/promotions/validate/payment-link/auth/shifts) | go-live-checklist.md |
| O4 | SOP vận hành ~190 checkbox (docs/sop/ 97 + plans/ 92) — BY DESIGN mở, staff tick hằng ngày khi thực hiện quy trình | 260815-1249-sop-operations |

## Task đã xong nhưng chưa tick (có thể đóng ngay)

| # | Item | Verify |
|---|------|--------|
| C1 | promotion-card test "Verify passing locally" (260812-1133) | ✅ chạy实测: 10/10 passed |
| C2 | cto-realtime-integration "frontend không nhận order status" | ✅ EventSource đã wire ở use-order-store.ts:60 |
| C3 | cto-order-flow-fix `_request()` throw on !ok | ✅ api-client.ts:83-96 có error handling |
| C4 | saas-launch-ready (8/8 phases), fnb-gap-closure (7/7 phases ✅) | plan headers đã đánh completed |

## Debt cũ nên dọn

- go-live-checklist: 5 item đánh dấu "scope lớn" (JWT HttpOnly, CSRF, email/SMS confirm, dashboard hardcoded hours, xóa deprecated html) — cần quyết định làm/bỏ
- Plans UI tháng 05 (ui-architecture-fnb: 9 open, fnb-ui-x100: 8 open) — đã bị superseded bởi các plan Stitch conversion sau này
- 12+ table chỉ tồn tại trên remote D1 không có DDL trong repo (odoo_*, campaign_*, bonus_campaigns…) — xem audit-260824 report

## Khuyến nghị thứ tự xử lý

1. Đóng C1-C4 (tick/xóa) — 5 phút
2. Quyết định T4: xóa sprint-16/17/18 rỗng hoặc revival modularization
3. T3 launch-control: user review approval gate → mới implement được
4. T2 arch-10x Phase 4 + T1 pos-kds: 2 plan lớn còn dang, chọn 1 prioritize
5. O1-O2 PayOS + seed admin: bắt buộc trước go-live thật

</content>