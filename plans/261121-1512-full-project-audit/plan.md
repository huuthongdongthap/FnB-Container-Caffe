---
title: "Full repository audit / Kiểm định toàn bộ kho mã"
description: "Evidence-led local audit and bounded remediation while preserving existing behavior / Kiểm định cục bộ có bằng chứng, giữ nguyên chức năng."
status: completed
priority: P1
effort: 24h audit + finding-sized remediation
branch: minhlongs/porpoise
tags: [audit, security, correctness, testing]
created: 2026-11-21
---

# Outcome / Kết quả
- EN: Audit every tracked file for security, correctness, maintainability and verification coverage. Fix every confirmed finding later, without changing design, features or API contracts. This document authorizes no implementation during scouting.
- VI: Kiểm định mọi tệp được Git quản lý về an toàn, tính đúng đắn, chất lượng và kiểm thử. Sau đó sửa mọi lỗi được chứng minh, không đổi giao diện, tính năng hoặc hợp đồng API. Giai đoạn khảo sát không sửa mã.
- EN: Baseline `b41aa5e975e351333a2f052bf0e50706c87fa8ae`; timezone `Asia/Saigon`; locale `en_US.UTF-8`. Inventory is rebuilt at execution start, not inferred from README test counts.
- VI: Mốc mã như trên; dùng giờ Việt Nam. Đếm lại tệp và kiểm thử khi thực hiện, không dùng số lượng cũ trong README.

## Boundaries / Giới hạn
- EN: HOLD SCOPE; no YAGNI reduction. No redesign, speculative cleanup, new libraries, deployment, production data, paid calls, push, PR or issue operations. Local commits only after verified remediation and the required local validation workflow. GitHub 403 remains a publishing blocker, not an audit blocker.
- VI: Giữ đủ phạm vi; không dọn mã theo suy đoán, đổi thiết kế, thêm thư viện, triển khai, dùng dữ liệu thật hoặc dịch vụ trả phí. Chưa đẩy mã hay tạo PR/issue vì lỗi 403. Chỉ commit cục bộ sau kiểm chứng.
- EN: Current permission allows writes only beneath this plan directory. Source fixes are future controller-owned work, never an implicit extension of this scouting task.
- VI: Hiện chỉ được ghi trong thư mục kế hoạch này. Việc sửa mã thuộc bước thực hiện sau.

## Sequence / Trình tự
| Phase / Giai đoạn | Dependencies / Phụ thuộc | Owner / Phụ trách | Estimate / Dự kiến | Observable exit / Điều kiện hoàn tất |
|---|---|---|---|---|
| [01 Baseline](phase-01-baseline.md) | None / Không | Controller | 3h | Complete inventory; safe commands; historical finding ledger / Đủ danh mục, lệnh an toàn, sổ lỗi cũ |
| [02 Parallel read-only audit](phase-02-partitions.md) | 01 | Partition reviewers A–H | 12h total / tổng | Every tracked file assigned once; evidenced findings / Mỗi tệp một nhóm; lỗi có bằng chứng |
| [03 Reproduce and prioritize](phase-03-triage.md) | All 02 partitions / Tất cả nhóm 02 | Controller + independent reviewer | 3h | Each candidate confirmed, rejected, duplicate or blocked / Mỗi nghi vấn có kết luận |
| [04 Remediate](phase-04-remediation.md) | 03; future source-edit authority / quyền sửa mã sau | One integration owner | Finding-dependent / Theo lỗi | Every confirmed finding fixed and regression-tested / Sửa và kiểm thử mọi lỗi xác nhận |
| [05 Validate and hand off](phase-05-validation.md) | 04 | Controller + reviewer | 6h | Gates pass, no unexplained failures, local-only handoff / Kiểm tra đạt; bàn giao cục bộ |

EN: Audit estimate is 24 person-hours, not a deadline. Do not estimate the unknown fix inventory as a fixed promise. Parallelism applies only to read-only partitions. Phase 04 is serialized to avoid migration/config/test conflicts.

VI: Dự kiến kiểm định 24 giờ công, không phải cam kết thời hạn. Chỉ khảo sát được song song; sửa lỗi theo thứ tự để tránh xung đột.

## Verified architecture and safety anchors / Căn cứ đã đọc
- `README.md:9` describes the deployed layers; `docs/README.md:18` points to architecture and `docs/README.md:33` to security/risk records. Documentation is context, not proof of current behavior.
- `worker/src/index.ts:87–105`: request enters primary-session environment cloning, then correlation, security headers, metrics, host tenant and write guard. `worker/src/index.ts:108–130`: body limits and KDS/COD authentication/tenant hooks precede order routing. `worker/src/index.ts:181–199`: root OpenAPI routes and v1 delegation require overlap/precedence audit. `worker/src/index.ts:201–206`: HTTP and scheduled entry points.
- `vitest.config.ts:62–71`: jsdom, two setup files, and tests under frontend, root tests, Worker and domain packages. This is not proof all tests are offline.
- `package.json:16–39`: lint, migration lint, typecheck-all, Vitest/coverage, loopback harness and build commands; `worker/package.json:7–13` separates local dev from deploy.
- `vite.config.js:25–26`: development proxy falls back to configured default Worker origin; plain browser testing is NOT presumed local. `playwright.config.ts:7,22–25`: browser origin 5173 and automatic Vite startup/reuse.
- `scripts/local-payment-flow/local-runtime.mjs:110–150`: loopback 8797, isolated D1/KV/DO bindings, local provider responses, all other Worker outbound requests blocked. `scripts/local-payment-flow/run.mjs:44–48` runs API/security before optional browser flow. These provider responses validate local contracts, not live provider delivery.
- `scripts/local-payment-flow/local-runtime.mjs:14–16`: default evidence path belongs to an older plan; always override it for this audit.
- `.github/workflows/ci.yml:31–50`: existing CI gates; `.github/workflows/ci.yml:73–74`: store-operations browser smoke. Remote workflows are read-only evidence and must not be triggered here.

## Data-flow checks / Kiểm tra luồng dữ liệu
| Flow / Luồng | Inputs → transformation → output / Đầu vào → xử lý → đầu ra | Required proof / Bằng chứng |
|---|---|---|
| Customer/staff browser / Trình duyệt khách, nhân viên | Browser storage/forms → client request → Worker middleware → router/domain → D1/KV/DO → response/event → UI | Trace one success, one denied request and one retry per critical journey / Lần theo thành công, từ chối, thử lại |
| Order/payment / Đơn hàng, thanh toán | Cart/table/guest identity → authoritative price and order state → provider adapter → signed webhook → payment/order/loyalty updates → KDS/customer projection | Amount, tenant, ownership, signature, duplicate/out-of-order delivery, refund reversal / Số tiền, quyền, chữ ký, lặp, đảo thứ tự, hoàn tiền |
| Scheduled/integration / Tác vụ nền, kết nối | Scheduler or signed event → tenant context → domain commands → database/outbox/provider → operational result | Timezone, repeat delivery, partial failure, secret redaction / Múi giờ, lặp, lỗi giữa chừng, che khóa |
| Deployment/setup / Cài đặt | Operator configuration → setup/build/migration tools → local artifacts/schema contracts | Read-only inspection now; local disposable migration proof later / Hiện chỉ đọc; kiểm tra trên dữ liệu tạm sau |

EN: These are audit trace requirements, not an assertion that every intermediary is implemented. Record actual symbols and all callers with file:line before proposing a fix. Before state changes, enumerate creation sites and prove request/session/process lifetime; preserve the request environment isolation visible at `worker/src/index.ts:87–99`.

VI: Đây là yêu cầu kiểm tra, không khẳng định hệ thống đã có đủ từng bước. Trước khi sửa phải chỉ rõ dòng mã, mọi nơi gọi và vòng đời trạng thái.

## Success / Hoàn tất
- 100% tracked files mapped to one audit owner; generated/binary/archive files explicitly classified, not silently omitted.
- Every confirmed finding has current file:line, reachable trace, impact, local reproduction, regression test and owner; duplicates link to one root cause.
- All confirmed findings remediated in the later execution stage. A blocked finding prevents a clean-completion claim; no silent deferral.
- Existing visual design, mobile behavior, features, routes, response shapes and stored data preserved. Required gates in phase 05 recorded with exit code and artifact paths.
- No production/network/paid side effects; no source writes in this planning stage; no remote publishing.

VI: Mọi tệp có người kiểm tra; mọi lỗi có chứng cứ và bài kiểm thử; không bỏ qua lỗi bị chặn; giữ nguyên sản phẩm; lưu kết quả kiểm tra; không tác động hệ thống thật.

## Risks and rollback / Rủi ro và quay lui
EN: Each phase names likelihood × impact and mitigation. Phases 01–03 only create local audit evidence, so rollback removes only their own artifacts. Phase 04 uses focused additive changes and local commits, reverted in reverse dependency order. Phase 05 does not deploy; delete only owned build/test artifacts and terminate only owned processes. No destructive reset or shared stash.

VI: Khảo sát chỉ tạo bằng chứng cục bộ. Sửa lỗi theo thay đổi nhỏ, hoàn tác ngược thứ tự phụ thuộc. Không triển khai, không xóa dữ liệu hoặc tiến trình của người khác.

## Execution notes / Ghi chú
- No live task-management tool is exposed here; this dependency table is the handoff graph. Do not fabricate task IDs.
- The referenced `/Users/macbook/.agents/AGENTS.md` does not exist in this environment. Remaining available instructions were read; controller should record this inherited-reference gap without creating a replacement.
- `ak plan --help` was inspected; pending is initial state, not a status transition. No working local activation script was found in the repository; pass this absolute plan path directly to future agents.
- Independent adversarial review remains a gate before implementation. This scout does not claim a completed security audit or passed tests.

VI: Không có công cụ quản lý tác vụ trực tiếp; dùng bảng phụ thuộc. Thiếu tệp hướng dẫn được tham chiếu ở cấp người dùng; không tự tạo thay thế. Cần đánh giá độc lập trước khi sửa mã.

## Execution results / Kết quả thực hiện
- [Local fixes and release blockers / Bản sửa cục bộ và điểm chặn phát hành](results.md)

## Unresolved questions / Câu hỏi còn lại
None requiring user input. Missing tooling, offline prerequisites or verification access become explicit execution blockers rather than requests for production access.

Không cần hỏi người dùng. Thiếu công cụ hoặc điều kiện kiểm chứng phải ghi rõ là điểm chặn, không xin quyền vào hệ thống thật.
