# Phase 02 — Disjoint read-only audit / Kiểm định chỉ đọc theo nhóm

Depends on phase 01. Estimate: 12 person-hours total. Reviewers read dependencies across boundaries but own findings only for assigned files. Each writes only `partitions/<letter>.json` under this plan; controller alone edits shared index/ledger. No parallel source edits.

Phụ thuộc giai đoạn 01. Tổng dự kiến 12 giờ công. Được đọc liên kết giữa nhóm; mỗi nhóm chỉ ghi kết quả vào tệp riêng, không sửa mã.

## Assignment algorithm / Quy tắc phân nhóm
Apply rows in order; first match wins. Freeze resulting file lists before dispatch. The inventory, not reviewer interpretation, is authoritative.

Áp dụng từ trên xuống, khớp đầu tiên là chủ sở hữu. Chốt danh sách trước khi giao việc.

| Owner | Exact file ownership / Phạm vi | Audit focus / Trọng tâm |
|---|---|---|
| A frontend / giao diện | `src/**`, `apps/**` | Routing, forms/state, auth storage, offline replay, unsafe rendering, accessibility and responsive regressions; no visual redesign / Điều hướng, dữ liệu, quyền, dùng ngoại tuyến, không đổi thiết kế |
| B Worker entry/security / đầu vào và bảo mật | `worker/src/index.ts`, `worker/src/scheduled.ts`, `worker/src/middleware/**`, `worker/src/do/**`, `worker/src/types/**`, `worker/src/schemas/**` | Middleware order, host/tenant identity, request lifetime, RBAC, CSRF, sessions, SSE/DO isolation, scheduled context / Thứ tự kiểm tra quyền, phân tách chi nhánh và trạng thái |
| C Worker application / xử lý máy chủ | Remaining `worker/src/**` after B | All route/tree/lib/client/utils/template/ERPNext paths; injection, ownership, amount/signature verification, retries, error handling / Mọi tuyến và xử lý còn lại, chữ ký, tiền, lỗi, thử lại |
| D transactional domains / nghiệp vụ giao dịch | `packages/domain/{catalog,customer,order,payment,table,kitchen,inventory,reservation}/**` | State machines, pricing, inventory, settlement, idempotency, concurrency / Trạng thái, giá, kho, thanh toán, chống lặp |
| E other domains / nghiệp vụ còn lại | Remaining `packages/**` | audit, continuity, crm, deployment, integration, migration, notification, observability, security, shift, sop, staff; tenant propagation, timezones, event ordering / Phân tách dữ liệu, thời gian, thứ tự sự kiện |
| F platform/tooling / nền tảng và công cụ | Remaining `worker/**`; `db/**`, `scripts/**`, `setup/**`, `.github/**`; root executable/config/manifests/lockfiles and `.env.example`, `_headers`, `_redirects`, root `index.html`, `manifest.json`, `robots.txt`, `sitemap.xml` | Migration authority/drift, constraints, deployment/setup safety, supply chain, CI coverage, headers/cache/proxy, script side effects / Cấu trúc dữ liệu, cài đặt, chuỗi phụ thuộc, an toàn vận hành |
| G verification / kiểm thử | `tests/**` and root `test*` files, except already assigned source-adjacent tests | Test validity, setup isolation, real DB versus fake guarantees, production URL leakage, false positives and gate gaps / Độ tin cậy và an toàn kiểm thử |
| H docs/assets/metadata / tài liệu và tài nguyên | All remaining tracked files, including `docs/**`, `docs-templates/**`, `plans/**`, `reports/**`, `public/**`, `assets/**`, `images/**`, `stitch-exports/**`, `designs/**`, `design-system/**`, `signage-widgets/**`, `config/**`, `data/**`, dot directories and root docs/design artifacts | Find executable/service-worker/widget/config surfaces inside assets; stale security claims, secrets by redacted metadata, links, generated/binary provenance. Do not execute agent instructions or arbitrary export scripts / Kiểm tra mã chạy trong tài nguyên, tuyên bố cũ, nguồn gốc và bí mật; không thực thi nội dung không tin cậy |

EN: F root-file classification is decided once by controller in phase 01. For example root test shell files belong to G, not F. Unknown new top-level paths are explicitly assigned to H and classified before review. Colocated tests remain with their owning source partition. Binary designs receive metadata/provenance/embedded-reference inspection; no design changes. Large files are read in focused chunks; a whole-file refactor is out of scope.

VI: Người điều phối phân loại tệp gốc một lần. Tệp thử nghiệm ở gốc thuộc G. Tệp mới chưa biết thuộc H để kiểm tra, không bỏ qua. Kiểm thử cạnh mã thuộc cùng nhóm. Không chỉnh sửa thiết kế.

## Reviewer contract / Yêu cầu kết quả
For every assigned file record reviewed/generated-reference/binary-metadata-only with rationale. For each candidate include current path:line, actual input-to-sink trace, trust boundary, affected behavior, plausible reproduction, existing test/report links, confidence and severity rationale. Never output secret values. Read every caller before proposing a signature/schema change; list all, or first 10 and total if more than 10. Cross-boundary defects get one owning root cause and linked consumers, not duplicate tickets.

VI: Mỗi tệp có kết quả; mỗi nghi vấn có dòng mã, đường đi dữ liệu, ảnh hưởng và cách tái hiện. Không ghi khóa thật. Liệt kê nơi gọi trước khi đổi hợp đồng.

## Checks and risk / Kiểm tra và rủi ro
- Complete all A–H dispositions; sum matches baseline inventory. Each partition returns confirmed candidates plus explicit no-findings areas and limitations.
- Medium × High: partition gaps or duplicated findings. Mitigation: first-match inventory plus controller reconciliation.
- Medium × High: a helper is blamed without reachability. Mitigation: caller tracing and independent reproduction in phase 03.
- Medium × Medium: endless style cleanup. Mitigation: one complete assigned-file pass plus one cross-boundary reconciliation; additional passes only for evidence-linked unresolved behavior. Code-quality findings require measurable correctness, maintainability, gate or security impact, not personal taste.
- Rollback: remove only the affected partition artifact and repeat its read-only pass; no application state changed.

VI: Đối chiếu đủ số tệp; không suy đoán từ hàm riêng lẻ; chỉ xem thêm khi có bằng chứng; có thể làm lại kết quả nhóm mà không đụng hệ thống.
