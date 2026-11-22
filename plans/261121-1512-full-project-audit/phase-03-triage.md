# Phase 03 — Confirm findings / Xác nhận lỗi

Depends on every phase 02 partition. Controller owns `findings.json` and reproduction artifacts; independent reviewer challenges evidence. Estimate 3h. No source edits yet.

Phụ thuộc tất cả nhóm kiểm định. Người điều phối giữ sổ lỗi; người đánh giá độc lập kiểm tra lại bằng chứng. Dự kiến 3 giờ, chưa sửa mã.

## Steps and exit / Các bước và điều kiện hoàn tất
1. Re-grep every reported file and symbol against frozen HEAD; verify current lines and reachable callers. Compare historical root causes and regression tests before opening a new finding.
2. Reproduce each candidate using the smallest offline test or disposable local Worker/D1 flow. Distinguish code defect, existing fixture limitation, missing dependency, environment restriction and speculative concern. A mocked test does not prove real database transactions or live provider behavior.
3. Record severity as likelihood × impact: Critical/High for demonstrated boundary bypass, money/data corruption or systemic outage; Medium for bounded correctness/verification failure; Low for measurable maintainability or documentation harm. Priority is not proof. Reject style-only cleanup with a short explanation.
4. Maintain fields: ID, baseline SHA, owner, file:line, trace, evidence, expected/actual, impact, severity/confidence, duplicate link, reproduction command/exit code, remediation files, tests, compatibility, rollback, disposition. Allowed dispositions: confirmed, duplicate, rejected-with-evidence, verification-blocked, fixed-verified.
5. Freeze finite confirmed inventory before fixes. Group by shared root cause and dependencies, not reviewer or arbitrary severity count. Evidence uncovered by regression testing may extend scope explicitly; no repeated generic audit loop.
6. Independent pre-implementation review checks adversarial assumptions, failure modes, scope and security. Resolve all factual blockers. Consult kongming only if a material architectural decision resists evidence; provide exact file:line, options and question. No user interview needed for reversible local decisions.

VI: Tìm lại mã hiện tại, tái hiện bằng kiểm thử cục bộ, phân biệt lỗi thật với giới hạn môi trường. Mỗi lỗi có người phụ trách, cách sửa, kiểm thử và quay lui. Chốt danh mục hữu hạn trước khi sửa, đánh giá độc lập trước thực hiện.

## Test matrix / Ma trận kiểm thử
| Area / Phạm vi | Unit / Đơn vị | Local integration / Tích hợp cục bộ | End to end / Toàn luồng |
|---|---|---|---|
| Identity/tenant | role/claim/expiry, missing identity | guest/staff and cross-tenant denial; request-context isolation | login/logout, protected UI, unauthorized access |
| Order/payment | prices, transition guards, signature validation | real isolated D1 constraints, repeated/out-of-order webhook, race/retry/refund and loyalty reversal | cart → checkout → tracking → KDS/COD settlement |
| Offline/customer | serialization, queue key, ownership | replay/partial failure and session change | mobile offline recovery, no duplicate order |
| Scheduled/integration | timezone boundaries, retry/dedup | local adapters/outbox and failure injection | local trigger → persisted outcome; never paid send |
| Migrations/setup | config validation, migration lint | fresh schema and representative existing local schema upgrade | setup command inspection; run only fully isolated non-deploy path |
| UI/contracts | bilingual strings, accessible names | route/response contract tests | existing desktop/mobile layout and keyboard paths, no restyling |

VI: Kiểm thử quyền, tiền, chống lặp, ngoại tuyến, thời gian, dữ liệu và trải nghiệm trên môi trường tạm; không gọi dịch vụ thật.

## Risk and rollback / Rủi ro và quay lui
Medium × High: false positive prompts damaging rewrite. Mitigate with failing reproduction plus independent trace. Medium × High: blocked checks mistaken for proof. Explicitly mark blocked; do not claim clean completion. Rollback discards only this phase's reproduction artifacts; preserve evidence ledger history.

VI: Không sửa lớn vì nghi vấn chưa chứng minh; kiểm tra bị chặn không được tính đạt. Quay lui chỉ xóa dữ liệu kiểm tra do giai đoạn này tạo.
