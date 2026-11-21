# Phase 05 — Verification and local handoff / Kiểm chứng và bàn giao cục bộ

Depends on phase 04. Controller runs gates; independent reviewer checks final diff. Estimate 6h. No deployment or publishing.

Phụ thuộc giai đoạn 04. Người điều phối chạy kiểm tra; người độc lập xem thay đổi. Dự kiến 6 giờ, không triển khai hoặc công bố.

## Commands and safety / Lệnh và an toàn
Run from the repository root only after phase 01 safety inspection. Use installed dependencies; do not let npx fetch tools. Redirect each command's full output to a separate file under this plan's `verification/`, record its actual exit code, and display only error/failure excerpts. Do not mask errors with a succeeding grep pipeline.

Chạy từ gốc dự án sau kiểm tra an toàn. Chỉ dùng công cụ đã cài, lưu nhật ký riêng và mã thoát thật; không để grep che lỗi.

| Order | Command | Purpose / Mục đích |
|---|---|---|
| 1 | `npm run --silent lint` | Existing zero-warning scope / Phạm vi lint hiện tại |
| 2 | `npm run --silent lint:migrations` | Migration ordering/targets / Trình tự dữ liệu |
| 3 | `npm run --silent check:contrast` | Existing contrast gate; never restyle without authority / Kiểm tra tương phản, không tự đổi thiết kế |
| 4 | `npm run --silent typecheck:all` | Frontend, Worker, deployment setup / Kiểu dữ liệu cả ba vùng |
| 5 | `TZ=Asia/Saigon npm test -- --silent` | Full installed Vitest suite / Toàn bộ kiểm thử |
| 6 | `TZ=UTC npm test -- --silent` | CI timezone parity / Tương thích giờ CI |
| 7 | `npm run --silent test:ci -- --silent` | Existing coverage gate, inspect omissions / Độ phủ và phần thiếu |
| 8 | `LOCAL_FLOW_VERIFICATION_DIR=plans/261121-1512-full-project-audit/verification npm run --silent test:local-flow -- --api-only` | Real loopback Worker + disposable D1/KV/DO, provider responses simulated / Máy chủ thật cục bộ, nhà cung cấp giả lập |
| 9 | `npm run --silent build` | Existing production bundle command, no deployment / Tạo gói, không triển khai |
| 10 | `npm run --silent verify:gates` | Local migration/deployment-contract checks; do not supply staging credentials / Kiểm tra hợp đồng cục bộ, không cấp khóa thật |

Commands are sourced from `package.json:16–39`, test scope from `vitest.config.ts:62–71`, and CI parity from `.github/workflows/ci.yml:31–50`. Inspect shell execution in each script and all test setup before running; these are proposed gates, not proof of zero side effects. Frontend build alone does not typecheck the Worker; hence typecheck-all is mandatory. Gate failures present at baseline remain explicit findings, never accepted silently.

Các lệnh là kế hoạch kiểm chứng, không phải kết quả đã chạy. Phải kiểm tra tác động của script trước; build giao diện không thay thế kiểm tra Worker. Lỗi tồn tại từ trước vẫn phải ghi nhận.

## Browser integration / Kiểm thử trình duyệt
- Prefer the existing loopback harness full mode by removing `--api-only`, with the same evidence-directory override. Inspect its browser launcher and outbound rules first; Worker network blocking alone does not block browser traffic.
- Review every selected Playwright test for hardcoded remote URLs, real credentials and mutations. Production config is prohibited. The root Playwright config starts port 5173 (`playwright.config.ts:22–25`), but Vite proxy defaults may be remote (`vite.config.js:25–26`). Do not run generic Playwright until a locally owned Worker is running and effective proxy/API targets are verified as loopback, with browser external requests denied.
- Then run the installed Playwright binary against `tests/playwright/store-operations-go-live.spec.ts` with project `Desktop Chrome`; broaden to all safe local tests and mobile project where dependencies exist. Record skipped tests by explicit reason. Use existing local harness rather than inventing replacement smoke scripts.
- Verify guest menu/cart/order/payment/tracking, authorized staff/KDS/COD, tenant denial, subscription/webhook route preservation and any existing onboarding/notification integrations discovered in inventory. Do not assume Sophia-specific flows exist merely from global instructions; if present, include setup keys, Telegram command/webhook and NOWPayments activation as protected paths with offline adapters.
- Compare affected pages at existing desktop/mobile viewports for layout, keyboard operation and bilingual text; no .pen/CSS redesign. Preserve baseline screenshots where safe.

VI: Ưu tiên bộ kiểm thử cục bộ sẵn có. Không chạy cấu hình production, không để proxy trỏ ra máy chủ thật. Kiểm tra luồng khách, nhân viên, thanh toán và tích hợp đang có; không tự thêm tính năng. Kiểm tra bố cục máy tính/điện thoại mà không đổi thiết kế.

## Process and artifact ownership / Tiến trình và dữ liệu kiểm tra
Check ports before starting: local harness Worker 8797, browser frontend binding 5197 (`scripts/local-payment-flow/local-runtime.mjs:110–124`), root Playwright server 5173. Reuse only a verified same-task process; do not kill another session or increment ports silently. Track command/PID/port/worktree and stop owned children on exit. Never execute install/deploy scripts merely to satisfy a missing test prerequisite. Known local fixture limitations must remain limitations, not fabricated passing results.

Kiểm tra cổng trước khi chạy, ghi PID và dừng đúng tiến trình của nhiệm vụ. Không tắt tiến trình người khác, không tự đổi cổng hoặc dùng dữ liệu giả để ghi nhận đạt.

## Exit, review and rollback / Hoàn tất, đánh giá và quay lui
- Compare baseline/final results, inventory dispositions and finding ledger. Every confirmed finding is fixed-verified; rejected/duplicate entries retain evidence. Verification-blocked means completion is blocked.
- Independent reviewer checks final source diff, regression quality, no secrets, no unrelated changes, backward compatibility and failure/rollback paths. Resolve new evidence, not hypothetical stylistic objections.
- Check `git status --short` against expected artifacts. Confirm no unintended source edits in the planning stage and no background processes remain. Later implementation may make focused local commits only after checks, never push/PR/issues.
- Final bilingual handoff lists evidence paths, commands/exit codes, exact fixed findings and remaining blockers. No production success claim or live-provider certification.
- Medium × High risk: false clean report. Mitigation: exact exit codes, separate not-run status, review of gaps outside default test/lint globs. Medium × High risk: browser hits production. Mitigation: explicit loopback target plus outbound deny policy; otherwise block browser gate.
- Rollback deletes only owned verification/build artifacts and stops only owned processes; source rollback follows phase 04. There is no deployment to roll back.

VI: Đối chiếu trước/sau, sửa và kiểm chứng mọi lỗi. Kiểm tra chưa chạy phải ghi riêng. Bàn giao song ngữ, không tuyên bố đã xác nhận hệ thống thật. Chỉ xóa dữ liệu kiểm tra và tiến trình do nhiệm vụ tạo.
