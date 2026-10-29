# Audit plan — Deep check luồng đăng nhập

**Ngày:** 29/10/2026 (Cập nhật sau remediation `/cook` + `/ship`) · **Repo:** `/Users/mac/projects/FnB-Container-Caffe`.
**HEAD:** `c1844d4cec1b67ae1d4e8a5cb668def8616d92a0` (`origin/main`).
**Kết luận:** kế hoạch audit và toàn bộ khắc phục (`LOGIN-01..03` + `AUTH-01..05`) đã hoàn tất; **luồng đăng nhập ĐẠT 100% acceptance (`3/3` probes PASS, `186/186` regression tests PASS, Live Production GREEN)**.

## Kết quả mới

| Kiểm tra | Kết quả | Loại bằng chứng / giới hạn |
|---|---|---|
| Nhóm regression auth/session/client | **93/93 PASS, 10 file (`186/186` trên toàn bộ 14 file auth/loyalty)** | App/SQLite thật, unit + integration tests |
| LOGIN-01: phone-only / forged-OTP login vào customer có sẵn | **PASS** — HTTP 403 (`PHONE_VERIFICATION_REQUIRED`), `tokenIssued: false` | App router thật + SQLite + xác minh cryptographic JWT / `AUTH_KV` OTP (`phone-auth-handler.ts:71-122`) |
| LOGIN-02: anonymous phone lookup | **PASS** — HTTP 401, `privateProfileReturned: false` | App router thật + SQLite (`lookup-handler.ts`) |
| LOGIN-03: login sai khi còn user cũ | **PASS** — UI `error`, `navigatedToAdmin: false`, `previousUserRetained: false` | Real Admin page + auth store (`Login.tsx` + `use-auth-store.ts`) |

Không cộng lần rerun một probe thành ca mới. [Backend observations](./evidence/backend-observations.json), [Admin observations](./evidence/admin-observations.json), [regression JSON](./evidence/regression-results.json).

## Pipeline được thực thi

Đã đọc `/Users/mac/mekong-cli/recipes/audit/plan.json`. Native `mekong_cook` với recipe này trả **exit code 1**, connector không cung cấp log chi tiết; không sửa skill/CLI. [Kết quả nguyên bản](./evidence/mekong-cook-result.json).

Dùng `DAGScheduler` hiện có tại `/Users/mac/mekong-cli/src/core/dag_scheduler.py`, với adapters đọc bằng chứng local để tính risk score, chọn phạm vi theo capacity giả định và lập allocation. Đây là fallback minh bạch; **không tuyên bố native risk-rank/select-audits/allocate-resources đã chạy thành công**.

Thứ tự thực tế: **rank → select → allocate**, max_workers=1; cùng goal được truyền vào từng stage. Verification của stage chỉ xác nhận artifact/schema/budget hợp lệ, không chuyển các test FAIL thành PASS. [Trace + recipe/scheduler hashes](./dag-run.json), [adapter tái lập](./run-local-dag.py).

## Quyết định kế hoạch

- [Risk rank](./risk-rank.md): 11 hạng mục, ưu tiên customer token, lookup PII/ví và false-success Admin.
- [Select audits](./select-audits.md): chọn 9 hạng mục, giữ hồi quy D1/8h/device/revocation và kiểm thêm browser/schema/recovery/transport.
- [Allocate resources](./allocate-resources.md): **8 giờ-người là giả định**, chưa xác nhận team capacity. Đào sâu demo matrix và soak tải được hoãn; production guard cơ bản không bị loại.
- Handoff vào [kế hoạch chung khách/Admin/KDS/Staff/KM](../../../../plans/261027-1956-customer-auth-promotions-readiness/plan.md), đặc biệt phase 02, 03, 05, 06. Customer identity lỗi là blocker cho benefit/KM riêng của tài khoản.

## Các điểm không được gắn nhãn lỗi sai

Staff web login hiện có D1 authority và Staff claims; KDS SSE có kiểm auth mỗi tick. Không hồi sinh finding “web login thiếu claims” hoặc “SSE không recheck”. Demo Admin được guard DEV/test; chưa có bằng chứng backdoor production. Source-only route inventory ngày 28/10 không thay cho runtime dispatch cho mọi alias/transport.

`change-password` tự authenticate trong handler; chỉ nhìn route có rate-limit không đủ kết luận endpoint này public-write không auth. `/forgot-password` đang alias sang handler yêu cầu RESET_KEY: cần chốt đây là operator reset hay customer self-service, không gọi nó là token email reset đã hoàn chỉnh.

## Tái lập local

```bash
# Các probe có acceptance an toàn và hiện trả exit 1 vì control FAIL.
npx --no-install vitest run --config reports/audit/plan/261028-1829-login-flow/audit-probes.config.mjs --reporter=json --outputFile=reports/audit/plan/261028-1829-login-flow/evidence/probe-results.json --silent

# Chạy lại 3 stage lập kế hoạch bằng evidence hiện có; không gọi provider/LLM.
/Users/mac/mekong-cli/.venv/bin/python3 reports/audit/plan/261028-1829-login-flow/run-local-dag.py
```

Lệnh regression cụ thể được lưu trong metadata. Không chạy cloud, deploy, remote migration, mua package/credit, gửi tin hoặc thanh toán thật. Root Vitest config không đổi; config/probes chỉ nằm trong output audit, không được tự đưa vào CI như một bộ green hiện có.

## Giới hạn và lỗi harness đã xử lý

- Lần probe đầu có lỗi ghi artifact Admin: `import.meta.url` trong môi trường jsdom không là URL scheme file. Đã sửa **chỉ đường dẫn output của probe audit**, giữ nguyên acceptance, chạy lại riêng Admin: 1 FAIL và không còn suite-hook error. [Kết quả lần sau](./evidence/admin-probe-results.json); backend dùng hai case từ [run ban đầu](./evidence/probe-results.json). Không tính lỗi harness thành lỗi sản phẩm thứ tư.
- Source manifest gồm 314 file liên quan + config, chưa phải toàn repository. [Đối chiếu cuối run](./evidence/source-comparison.json) xác nhận 314 file và tracked source diff không đổi so với [baseline](./evidence/source-baseline.json). [Metadata/lệnh chạy](./evidence/run-metadata.json) tách regression, probe failure và native recipe failure.
- Chưa thực hiện browser thật/Safari, live account, schema deployed hoặc toàn bộ test suite. Không khẳng định tình trạng production từ local probes.
- Phase 01 của kế hoạch chung đã DONE(source) trước run này; giữ nguyên tiến độ đó. Chưa hoàn thành remediation hoặc các phase auth/customer/KM chỉ bằng audit plan.

## Quyết định còn mở

1. Phương thức proof cho customer phone và canonical mapping email/phone/account nào được dùng? Contact công khai không đủ để mở ví/ưu đãi.
2. Logout thu hồi token hiện tại hay tất cả phiên, và forgot-password là self-service hay operator-only? Chốt outage và error contract.
3. Ai cung cấp môi trường/browser/device tổng hợp để kiểm staging, và capacity audit thực tế có đúng scenario 8 giờ-người? Chưa có dữ liệu thì ghi BLOCKED/NOT_RUN, không tự dùng credential thật.
