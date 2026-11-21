# Phase 04 — Evidence-linked repair / Sửa theo bằng chứng

Depends on phase 03 and future controller-granted source-edit scope. This planning assignment never modifies application files. One integration owner serializes repairs; effort is estimated from the confirmed inventory.

Phụ thuộc giai đoạn 03 và quyền sửa mã ở bước sau. Nhiệm vụ lập kế hoạch không sửa ứng dụng. Một người tích hợp thực hiện lần lượt, ước lượng theo lỗi xác nhận.

## Execution / Thực hiện
1. For each confirmed root cause, append a bounded repair packet to this plan: exact files and callers with current file:line, failing regression, minimal change, compatibility, success and rollback. Until this exists, no file is assigned to an implementer. Source file ownership is exclusive; shared migrations/configs/tests remain controller-owned.
2. Prove the regression fails for the expected reason before the fix, then implement smallest cause-aligned repair using local conventions. Preserve UI design, responsive behavior, API paths/shapes and features. No `:any`, production `console.log`, hardcoded credentials, new libraries or unsupported placeholder behavior.
3. Before changing existing structures enumerate instantiations and verify lifetime. Before signature changes enumerate callers. Security changes must preserve legitimate guest/staff/integration flows, not only reject malicious inputs.
4. Prefer no schema change. If required by demonstrated defect, use additive/version-compatible migration, document old/new read behavior, and validate fresh plus existing disposable database upgrades. Preserve existing data. Do not modify historical applied migrations. Do not execute remote migrations.
5. Run focused unit and local integration tests, then related end-to-end checks. Repair every confirmed finding, including code-quality/build/test defects with evidence; no silent scope cut. Record blocked repairs as incomplete.
6. After two failed local fix attempts for the same issue, stop that repair and escalate with file:line, observed failure and attempted approaches. Do not spin a third attempt or weaken assertions.
7. Use `mekong-cli /validate-before-commit` if available and inspect its local-only behavior first. It was not found in PATH during this scout; if unavailable, document the gap and run the explicit equivalent phase 05 gates. Never claim an unavailable wrapper ran. Local commits are future authorized work; never push or publish.

VI: Mỗi lỗi cần danh sách tệp và kiểm thử thất bại trước khi sửa. Giữ hợp đồng và dữ liệu; không thêm thư viện hoặc lối tắt. Hai lần sửa không thành thì dừng và báo nguyên nhân. Chỉ commit cục bộ sau kiểm chứng, không đẩy mã.

## Acceptance / Hoàn tất
All confirmed findings have an isolated fix, passing regression and no unexplained affected-flow failure. An independent reviewer validates security/public-contract changes against evidence before local commit. No source comment, migration, test or commit name contains audit labels or phase IDs.

Mọi lỗi xác nhận đều có bản sửa riêng và kiểm thử đạt; thay đổi bảo mật/hợp đồng được xem lại độc lập, không cài nhãn kiểm định vào mã.

## Risk and rollback / Rủi ro và quay lui
- Medium × High: auth/payment fixes break legitimate traffic. Preserve success-path tests and local end-to-end journeys alongside deny tests.
- Medium × High: schema/data incompatibility. Use additive migration and copy of representative local synthetic schema, never production data. If reversibility cannot be proven, stop before applying it.
- Medium × Medium: ownership conflict. Serialize all edits and group shared-root-cause fixes; no parallel modification of the same file.
- Rollback each fix using its focused reverse patch/local revert after checking dependencies. Reverse dependent code before underlying helpers. Additive migrations remain inert when code is reverted; do not drop user data to achieve rollback. Build/test artifacts can be deleted only when owned.

VI: Kiểm thử cả luồng hợp lệ và từ chối; nâng cấp dữ liệu có đường lui; sửa tuần tự. Hoàn tác ngược phụ thuộc, không xóa dữ liệu khách hàng.
