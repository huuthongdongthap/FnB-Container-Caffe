# PayOS/COD và Staff/KDS — sửa lỗi đã xác minh

## Mục tiêu

Đóng các lỗi local trong `reports/dev/review/audit.md`: giá/discount giả, tenant creation/write/refund, payment concurrency/recovery, COD fulfillment, KDS role/cache và nhãn trạng thái khách hàng. Chỉ hỗ trợ PayOS/COD.

## Ràng buộc

- Bảo toàn dirty tree trước khi bắt đầu; HEAD `2cf0025a954657ee102c4f655c021a97340cbca4`, local origin/main `d50543412e095310972705ceeb285293e24228dd`.
- Không fetch/reset/stash/stage/commit/đổi nhánh/deploy; không PayOS/D1 cloud, không thực thi migration trên database đang vận hành.
- Cập nhật 22/10: người dùng cho phép commit các sửa chữa đang xử lý; các giới hạn deploy/cloud còn hiệu lực. Kết quả kiểm thử 20/10 là lịch sử vì source hiện tại đã thay đổi.
- Không hạ gate hoặc chế tạo `.down.sql` để tuyên bố rollback an toàn. Staging credentials và runtime production vẫn là giới hạn riêng.
- Dùng code/runtime hiện tại làm bằng chứng. Test provider fixture chỉ chứng minh hợp đồng local.

## DAG và chủ sở hữu

| Nhóm song song | Chủ sở hữu | Phạm vi |
|---|---|---|
| Order boundaries | fix_order_boundaries | Giá catalog, ưu đãi, trusted tenant/table, public/mobile/POS/offline writers, idempotency, device JWT |
| Payment integrity | fix_payment_integrity | Reserve attempt D1 trước provider, cùng code khi retry, webhook settlement, tenant/payment/refund quyền |
| Kitchen lifecycle | fix_kds_lifecycle | Canonical CAS/status aliases, thu COD, KDS role/cache/stream, confirmation state |
| Integration | root | Bootstrap schema, local flow harness, kiểm tra tổng hợp, review, báo cáo |

## Phase 1 — Chuẩn bị

- [x] Đọc skill bootstrap-auto-parallel, development rules, Git dirty state và audit hiện tại.
- [x] Chia file ownership; worker được nhắc bảo toàn thay đổi của nhau.
- [x] Bootstrap preview: Python 3.9 thiếu StrEnum; .venv Python 3.11 chạy được nhưng engine chặn symlink `.agents/skills` trỏ ngoài target. Dry run không tạo file; triển khai DAG sửa trực tiếp, không sửa skill.

## Phase 2 — Sửa song song

- [x] Public giá/discount/tenant/table lấy từ nguồn tin cậy; unknown ID không fallback prefix/name; split dùng cùng chính sách.
- [x] Idempotency bền vững trong D1 theo scope; device login giữ signed tenant; guest CRM không đổi owner.
- [x] Reserve payment duy nhất trước fetch; retry giữ cùng code; chữ ký provider được kiểm tra.
- [x] Hai webhook cùng guarantee atomic settlement/replay; quyền/tenant trước refund; refund API chưa có hợp đồng được chặn 422.
- [x] Status/cancel aliases và generic PATCH dùng tenant + transition + CAS; reads mobile/canonical có tenant scope.
- [x] Thu COD nguyên tử, không đổi fulfillment; cashier/waiter KDS đúng role; cache authoritative theo identity.
- [x] Confirmation hiển thị payment/fulfillment thật, giữ retry khi detail thất bại; DO dùng internal fetch và durable storage thật.
- [x] Bootstrap schema đáp ứng local flow; regression D1 timestamp triggers (changes > 0) được thêm.
- [x] Checkout retry giữ cùng intent/order/key, kể cả mất phản hồi; paid retry không tạo đơn thứ hai.

## Phase 3 — Ghép, review, kiểm chứng

- [x] Regression từng nhóm và local Worker/D1/KV/Chrome: đợt 20/10 có 50/50 flow checks PASS; không đổi assertion an toàn để lấy PASS.
- [x] Review độc lập backend và sửa phát hiện; review bổ sung frontend bị giới hạn quota, đã rà thủ công và ghi giới hạn.
- [x] Đợt 20/10: typecheck/lint/migration lint/build PASS; Vitest 453 file / 4.225 tests PASS.
- [x] `npm run verify:gates` ngày 20/10: migration/build PASS, rollback FAIL, staging credentials PENDING; không hạ gate.
- [x] Báo cáo trong `plans/reports/fix-verification-261020-1436-payos-cod-kds-report.md`; kết quả lịch sử tách khỏi trạng thái HEAD mới.
- [ ] Chạy lại full suite và local flow trên release candidate mới trước staging/production.

## Nghiệm thu

- Món 20.000 không thể thanh toán 1.000 bằng client price/discount; tenant khác không đọc/sửa/hoàn tiền đơn.
- Một order không phát sinh hai attempt hoạt động; webhook replay sau lỗi không để paid/payment lệch nhau.
- COD đang chế biến còn trong KDS sau thu; role hợp lệ tải được, anonymous vẫn 401; completed ticket biến mất và đổi phiên không giữ dữ liệu cũ.
- Mọi lệnh có kết quả thật; failure/harness/schema/cloud gap được phân biệt, không coi local PASS là production readiness.

## Câu hỏi còn mở

- Schema D1 và webhook URL thật chưa kiểm từ cloud. Guest store dùng mapping server/default hiện có; không nhận tenant từ request chưa xác thực.
- Staging credentials và quyết định vận hành phục hồi D1 cần xử lý riêng trước deploy.
