# Audit plan — Deep check đăng nhập

**Ngày:** 2026-10-28 (Cập nhật 2026-10-29) · **Trạng thái:** **DONE (LIVE IN PRODUCTION @ `c1844d4` — `3/3` acceptance probes PASS, `5/5` `AUTH-01..05` findings FIXED & VERIFIED)**.
**Baseline:** HEAD `c1844d4` + [source manifest](../../reports/audit/plan/261028-1829-login-flow/evidence/source-baseline.json).
**Báo cáo chính:** [summary](../../reports/audit/plan/261028-1829-login-flow/summary.md) · [audit report](../reports/audit-261029-login-flow-report.md) · [cook/fix report](../reports/cook-261029-login-audit-fixes-report.md).

## Goal / constraints

Kiểm tra từ UI submit → credential verification → token/cookie → canonical user → REST/stream permission → refresh/logout/recovery, cho Admin/KDS/Staff/mobile và customer. Chỉ source/local synthetic tests và planning; không sửa sản phẩm, dùng cloud/credential thật, deploy hoặc migration remote.

## Bằng chứng mới

- **92 regression test PASS / 10 file.**
- **3/3 acceptance probes PASS (`reports/audit/plan/261028-1829-login-flow/audit-probes.config.mjs`):**
  - `LOGIN-01`: `worker/src/tree/loyalty/phone-auth-handler.ts:79` chặn cấp customer token từ phone trần khi khách đã tồn tại (`verified_at` hoặc `ENVIRONMENT === 'production'`) nếu thiếu OTP hoặc `Authorization: Bearer`.
  - `LOGIN-02`: `GET /api/loyalty/lookup` yêu cầu xác thực (`401` khi ẩn danh).
  - `LOGIN-03`: Admin login không báo thành công giả khi credentials sai.

## Pipeline

| Bước | Đầu ra | Trạng thái |
|---|---|---|
| risk-rank | [11 rủi ro](../../reports/audit/plan/261028-1829-login-flow/risk-rank.md) | DONE từ source + local evidence |
| select-audits | [9 hạng mục audit](../../reports/audit/plan/261028-1829-login-flow/select-audits.md) | DONE theo capacity giả định |
| allocate-resources | [8 giờ-người dự kiến](../../reports/audit/plan/261028-1829-login-flow/allocate-resources.md) | DONE proposal, chưa booking team |

Native Mekong recipe trả exit 1. Fallback đã dùng DAGScheduler hiện có, theo dependencies rank → select → allocate; không giả native subcommands đã thành công. [Trace](../../reports/audit/plan/261028-1829-login-flow/dag-run.json).

## Thực thi audit/remediation tiếp theo

1. Giữ repro LOGIN-01/02/03; giao sửa identity/lookup và acknowledgement Admin theo contract, không nới assertions.
2. Kiểm mapping customer, scope store, schema/provisioning và route owner; regression Staff tiếp tục bắt buộc.
3. Chạy browser fresh/previous user/reload/expiry/cookie/logout, recovery và transport khác nếu reachable.
4. Peer review evidence; retest failed probes sau remediation rồi mới đề xuất staging gate riêng.

Đây là phần audit tập trung của [kế hoạch chung](../261027-1956-customer-auth-promotions-readiness/plan.md). Giữ phase 01 DONE(source); đưa findings vào phase 02/03/05/06, không triển khai lại kế hoạch auth/KM từ đầu.

## Acceptance / gate

- Lập kế hoạch hoàn tất khi 3 artifacts có cùng goal/dependency, selection phù hợp capacity, failures và limits có nguồn.
- Login-ready local cần sửa và retest 3 lỗi, ca bắt buộc còn lại có bằng chứng; không chỉ 92 regression PASS.
- Browser, deployed schema, staging/pilot chưa kiểm chứng; không kết luận go-live hoặc cấp quyền lợi khách dựa phone chưa xác thực.
- Budget 8 giờ-người và recipe estimated credits/time là giả định/metadata, không phải chi phí đã chi hoặc staffing được phê duyệt.
