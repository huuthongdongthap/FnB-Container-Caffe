# Review local trước deploy — PayOS/COD

**Khuyến nghị: HOLD — chưa deploy.** Ngày 2026-10-20, Asia/Ho_Chi_Minh.

## Kết quả

| Kiểm tra mới | Kết quả |
|---|---|
| Lint | PASS, exit 0; phạm vi Worker TypeScript. |
| Typecheck root + Worker | PASS, exit 0. |
| Worker/D1/KV + Chrome local | Exit 1; 33 PASS, 11 kiểm tra xác nhận lỗi ứng dụng, 1 schema gap, 1 timeout chưa kết luận. |
| Operational gates | Exit 1; migration lint/build freshness PASS; rollback FAIL; 6 biến staging còn thiếu. |
| Bảo toàn source | Hash tracked diff `src/worker/packages` trước/sau giống nhau; không sửa source sản phẩm trong review. |

**Quality score: chưa gán.** 33/46 check records đạt (71,7%) là tỷ lệ kịch bản của harness, không phải coverage hay điểm readiness. Nhiều check có cùng nguyên nhân; không coi 13 kết quả FAIL là 13 lỗi độc lập.

## Lỗi cần xử lý trước

1. **P1 — Giá thanh toán bị giảm trái phép:** món 20.000 được gửi giá 1.000 hoặc discount 19.000; API lưu 1.000 và tạo payment 1.000. Sửa tại public order writers và chính sách discount.
2. **P1 — Tenant isolation chưa kín:** staff cafe-a sửa trạng thái đơn cafe-b thành công qua cả canonical/admin alias; order creation còn nhận tenant từ khách hoặc ghi nhầm default. Refund/payment list cũng thiếu scope theo source, nhưng runtime refund bị chặn bởi schema local.
3. **P1 — Payment retry/concurrency:** hai request đồng thời tạo hai payment pending/URL provider fixture. Webhook phụ nhận replay 200 nhưng để order unpaid sau lỗi ghi dở dang.
4. **P1 — COD/KDS:** thu tiền làm đơn preparing chuyển completed; cashier có phiên nhận 403 ở queue mới dù router bên trong cho phép.
5. **P2 — Cache KDS:** ticket completed vẫn hiện sau hai response queue đã loại ticket. Kiểm tra đổi tenant còn timeout nên chưa kết luận rò dữ liệu runtime.

Chi tiết file/dòng, cách tái hiện và tiêu chí sửa: [audit.md](audit.md). Phân tích source: [payment](security-payment.md), [KDS/UI](security-kds.md).

## Luồng đã chạy được

- Chrome chỉ hiện PayOS/COD; phương thức khác bị API từ chối; endpoint đã bỏ trả 404 với phiên hợp lệ.
- COD tạo đơn → trang xác nhận có món. PayOS tạo đơn → provider fixture → webhook có chữ ký → paid → trang xác nhận có món.
- Staff tải queue/SSE và bắt đầu chế biến thành công. Anonymous vẫn 401; kitchen/khác tenant không thu được COD.

## Giới hạn và an toàn

- Dùng runtime Worker và D1 local thật; **PayOS là provider fixture**, chưa chứng minh giao dịch/return URL trên PayOS thật. Frontend được chuyển về success bằng harness sau callback.
- Chỉ bootstrap `worker/schema.sql`, chưa áp dụng migrations. Refund 500 và lỗi side effect do thiếu schema được phân loại GAP; không suy diễn schema production.
- Chưa chạy lại full Vitest/build trong lượt review. Lint không bao phủ frontend/domain. Chưa quét dependency advisory trực tuyến.
- Rollback gate chỉ kiểm source tĩnh, chưa diễn tập khôi phục; credentials staging thiếu trong môi trường hiện tại. Không thể tuyên bố production ready.
- Không fetch/reset/stash/stage/commit/đổi nhánh/deploy; không gọi PayOS/D1 cloud. Local servers đã được dọn sau kiểm tra.

## Bàn giao và bước tiếp theo

- Dữ liệu máy đọc: [local-flow-results.json](local-flow-results.json); [log runtime](local-flow-output.log); [gate log](gates-output.log).
- Ảnh local: [COD confirmation](browser-confirmation-cod.png), [PayOS confirmation](browser-confirmation-payos.png), [KDS và ghost ticket](browser-kds.png).
- Harness: `node reports/dev/review/local-flow.mjs`; cần dependencies local hiện có, Miniflare stable trong parent monorepo và Chrome. Script chặn outbound, ghi fixture vào DB tạm và trả exit 1 khi có check thất bại.
- Ưu tiên sửa tiền/tenant trước, sau đó tenant creation + COD/KDS, rồi concurrency/recovery. Mỗi sửa phải có regression test và rerun local scenario tương ứng; chạy mới full test/typecheck/lint/build trước đánh giá deploy.
- Readiness chỉ đạt khi P1 đóng bằng bằng chứng mới, schema local chuẩn được kiểm tra, rollback/staging gate đạt và các giới hạn runtime được xử lý riêng.

## Câu hỏi còn mở

- Role matrix KDS/refund, trusted guest-store mapping và webhook URL PayOS đang dùng cần chốt từ cấu hình có thẩm quyền.
- Schema/migration chuẩn và chiến lược khôi phục D1 cần xác minh riêng; không tự chạy migration/cloud trong review này.
