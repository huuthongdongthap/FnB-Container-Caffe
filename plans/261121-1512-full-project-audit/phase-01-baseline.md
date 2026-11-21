# Phase 01 — Baseline / Mốc kiểm định

## Context and ownership / Bối cảnh và trách nhiệm
Depends on nothing. Controller owns inventory and baseline artifacts inside this plan directory only. Estimate: 3h. No source changes.

Không có phụ thuộc. Người điều phối lập danh mục, chỉ ghi trong thư mục kế hoạch. Dự kiến 3 giờ, không sửa mã.

## Steps / Các bước
1. Record HEAD, branch, `git status --short`, Node/npm versions and installed executables. Use tracked-file listing, not recursive scans of dependencies. Count production, tests, configs, generated and binary/archive artifacts separately. Never print credentials or private configuration contents.
2. Read instructions, README navigation, architecture/security records, CI and every workspace manifest. Confirm package scripts before execution. Missing inherited instructions are noted in the plan index.
3. Create `inventory.tsv`: tracked path, classification, partition, disposition. Apply phase 02 assignment precedence. Assert one owner per tracked path, zero unassigned and zero duplicate assignments. Include dot directories as metadata/runtime-tooling surfaces; do not package or execute their contents.
4. Create `historical-findings.tsv`: historical ID, root cause, original commit/date, current evidence, linked regression, present disposition. Read `docs/BACKEND_REVIEW.md:14–17` (old P0/P1/P2 claims), `docs/10_RISK_REGISTER.md:165–215` (guest isolation/replay/settlement risks), `plans/reports/audit-261118-aura-coffee-latest-full-report.md:10–16` (prior baseline/testing claims), and `SECURITY.md:3–33` (claimed protections/recommendations). Also inspect `docs/api-audit.md`, `docs/CART-CHECKOUT-AUDIT.md`, recent `plans/reports/` and root deploy audit as historical candidates, not established current defects.
5. Inspect test setup files and commands for network, cloud credentials, destructive SQL and process creation. Record a safe allowlist. Do not run installs, production Playwright config, remote Wrangler, deployment/setup executable, or shell smoke scripts merely because their names contain test.
6. Establish baseline validation only after safety review and installed dependencies are confirmed. Store logs under this plan's `verification/`; emit only concise error extracts and exit codes. Run narrow tests first, then phase 05 commands. Snapshot status before/after and account for every artifact.

VI: Ghi mốc mã và công cụ; chia mọi tệp vào đúng một nhóm; đối chiếu lỗi cũ với mã hiện tại; kiểm tra an toàn của lệnh trước khi chạy; lưu nhật ký gọn, không lộ thông tin riêng.

## Validation / Kiểm chứng
- Inventory tracked count equals assignment count. Every excluded runtime surface has a reason and an owner, not a missing entry.
- Historical findings are marked confirmed-current, fixed-with-proof, duplicate, obsolete or unverified. An old report is never enough to reopen an issue.
- Actual baseline outcomes replace README test-count assumptions. Unsafe/unavailable checks are blocked with cause, not passed.

VI: Số tệp phải khớp; lỗi cũ có kết luận; kiểm tra chưa chạy không được ghi là đạt.

## Risk and rollback / Rủi ro và quay lui
- Medium × High: tests unexpectedly reach production. Mitigate with source inspection, no production credentials and deny-by-default outbound boundaries before execution.
- Medium × Medium: reports become stale across concurrent work. Freeze HEAD and file hashes; re-read changed evidence before phase 03.
- Low × Low: inventory artifacts are wrong. Regenerate only this phase's artifacts; source remains untouched.

VI: Chặn kết nối ngoài; khóa mốc kiểm tra; có thể tạo lại danh mục mà không ảnh hưởng mã.
