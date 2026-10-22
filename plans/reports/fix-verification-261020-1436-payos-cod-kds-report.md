# PayOS/COD → Staff/KDS: bản sửa và kiểm chứng local

Ngày kiểm chứng: 2026-10-20, Asia/Ho_Chi_Minh. Cập nhật bàn giao: 2026-10-22. Trạng thái: **đợt kiểm chứng local đã hoàn tất; chưa đủ bằng chứng GO LIVE**.

## Phạm vi và bảo toàn trạng thái

- Tiếp nối audit `reports/dev/review/audit.md`; chỉ hỗ trợ PayOS/COD. Giữ các thay đổi chưa commit từ trước.
- Baseline ngày 20/10: HEAD `2cf0025a954657ee102c4f655c021a97340cbca4`; local origin/main `d50543412e095310972705ceeb285293e24228dd`. Đợt kiểm chứng không fetch/reset/stash/stage/commit/đổi nhánh/deploy. Ngày 22/10 người dùng yêu cầu commit; HEAD trước commit đã là `4c6c895` do các commit tiếp theo.
- Skill bootstrap-auto-parallel được đọc và chạy preview: Python mặc định 3.9 thiếu `StrEnum`; runtime .venv 3.11 chạy được nhưng engine chặn symlink `.agents/skills` ra ngoài target. Dry run không tạo file. Tiếp tục DAG sửa code trực tiếp; không sửa skill hoặc scaffold đè repo.
- Ba nhóm thực thi có file ownership; review độc lập sau khi ghép. Chỉ dùng database tạm và provider fixture; không gọi PayOS/Cloudflare production.

## Các sửa chữa

| Nhóm | Thay đổi | Bằng chứng kiểm tra |
|---|---|---|
| Giá và tenant khi tạo đơn | Public/mobile/POS/OpenAPI/split dùng giá catalog và chính sách checkout chung. Bỏ fallback prefix/name cho explicit product ID; không tin discount/service fee/client tenant. Bàn thuộc signed tenant; guest hiện gắn flagship default, chưa có public multistore mapping. | Regression giá 20.000 không thể thành 1.000, bàn/tenant khác bị từ chối, split PayOS tạo link được. |
| Order atomicity/idempotency | Order/items/COD ledger/table và durable request cùng D1 batch. Request fingerprint+actor+tenant ngăn trả cache nhầm; KV chỉ best effort; broadcast sau commit. | SQL fault injection, retry khi KV hỏng/không có, concurrent request và payload conflict. |
| Ownership/CRM | Guest phone/email chưa xác thực không tự nhận authorization owner; CRM side effects không sửa owner hoặc ghi đè profile từ public contact. | Guest dùng số đã có CRM vẫn tạo đơn/link/track được; signed customer giữ ownership. |
| Payment attempt | Reserve trước provider, conditional INSERT/CAS; unknown-result retry giữ nguyên mã. Kiểm chữ ký response, amount/orderCode/status và hosted URL. Historical duplicates cần reconciliation, không tự tạo attempt thứ ba. | Real SQLite concurrency, lost response, URL-write failure, invalid signature, mismatched total và trigger metadata. |
| Webhook | Hai URL dùng chung xác minh và settlement nguyên tử; replay repair; total phải khớp cả payment và order; không double metric/notification. | Lỗi giữa hai write rollback cả hai; replay thành paid; signed failure không được ghi thành success. |
| Quyền và tenant | List/detail/summary/payment/refund/mobile và status/cancel aliases giữ scope; coordinator dùng state machine+role+CAS. | Foreign tenant 403/404 và DB không đổi; HQ override theo policy hiện có. |
| COD/KDS | Thu COD update sổ và order nguyên tử, giữ fulfillment; repair trạng thái cũ dở dang. Cashier/waiter được vào queue; anonymous vẫn 401. Cache/list/snapshot authoritative, scope theo identity; fetch SSE dùng bearer header thay JWT trong URL. | COD pending/preparing/ready vẫn trong bếp, ticket completed biến mất, logout/login khác tenant không giữ ticket cũ. |
| Xác nhận/realtime | Hiển thị payment/fulfillment thật; không cố định preparing/10 phút. DO internal POST kiểm dữ liệu, lưu storage trước memory, rehydrate và gửi full DTO bằng fetch. | Chrome có item thực; unit status labels; DO runtime-storage contract. |
| Checkout retry | Giữ idempotency key và order qua mất phản hồi/reload; lỗi tạo link không tạo order mới; paid/refunded retry trở lại xác nhận. | Regression checkout intent/retry và luồng trình duyệt local. |
| Refund | Không gọi endpoint `/refund` chưa có hợp đồng API công khai. Sau kiểm quyền/tenant/validation trả 422 `REFUND_PROVIDER_UNAVAILABLE`, không ghi sổ hoặc gọi provider. | Financial role sai tenant bị chặn; cùng tenant unsupported 422, lịch sử nguyên vẹn. |

Giữ chính sách shipping hiện có của storefront: delivery một món 15.000, từ hai món miễn phí, không service fee. Payload discount không phải quyền áp dụng ưu đãi; tích hợp promotion được xác thực là công việc riêng.

## Runtime và bằng chứng

- Worker/Hono trên workerd/Miniflare stable; D1/KV/DO local thật, Vite/Chrome. Bootstrap DDL đã bổ sung các contract vận hành cần cho luồng; không phải snapshot D1 triển khai.
- PayOS API và hosted page được fixture có chữ ký thay thế; browser chỉ fulfill invoice local đã biết, chặn outbound khác. Link return đi qua trang fixture sau signed webhook; không mô tả là giao dịch ngân hàng thật.
- Probe thực ghi nhận một PK UPDATE có `meta.changes=2` vì timestamp trigger. Các CAS nhận số thay đổi dương, vẫn chặn zero; helper SQLite dùng `total_changes()` để không bỏ sót trường hợp này.
- Báo cáo/lần chạy cũ được giữ riêng; chỉ dùng kết quả cuối trong thư mục verification để kết luận.

## Kết quả lệnh

Các kết quả dưới đây thuộc đợt chạy ngày **20/10/2026**, không phải kết quả chạy lại ngày 22/10:

| Lệnh | Kết quả ghi nhận |
|---|---|
| `npm run typecheck:all` | PASS, root và Worker không lỗi. |
| `npm run lint` | PASS, phạm vi Worker TypeScript. |
| `npm run lint:migrations` | PASS, 64 forward / 7 down trên 4 thư mục; target chính 37 forward / 7 down. |
| `npx vitest run --maxWorkers=4 --reporter=default --reporter=json --outputFile=plans/261020-1225-payment-kds-remediation/verification/vitest-results.json` | Exit 0; 453/453 file, 4.225/4.225 tests PASS, 88,44 giây. |
| `npm run test:local-flow` | Exit 0; 50 PASS / 0 FAIL; không page error; mã nguồn không thay đổi trong lần chạy. |
| `npm run build` | Exit 0; 2.608 modules, Vite build 4,32 giây; cảnh báo thời gian plugin terser. |
| `npm run verify:gates` | Exit 1, `LOCAL_GATES_FAILED`: migration/build PASS; rollback FAIL; 6 staging credentials PENDING. |

Artifact chi tiết và ảnh nằm tại `plans/261020-1225-payment-kds-remediation/verification/`, giữ cục bộ, không đưa output chạy kiểm thử vào commit mã nguồn.

**Đối chiếu ngày 22/10:** source hash hiện tại đã khác baseline kiểm thử 20/10. Không dùng 4.225 tests/50 checks cũ làm bằng chứng cho HEAD mới. Lint được chạy lại trước commit: exit 0, 0 lỗi / 1 cảnh báo `WebPushError` chưa dùng trong `worker/src/types/module-ambient.d.ts`. Chưa chạy lại full suite hoặc luồng trình duyệt trong lượt bàn giao commit này.

## Giới hạn rollout

- Migration mới `worker/db/migrations/20261020_01_order_creation_requests.sql` là additive và **chưa chạy trên cloud**. Phải đối chiếu ledger/schema và áp dụng đúng quy trình trước khi rollout; không đưa fresh bootstrap SQL vào database có dữ liệu.
- Rollback runtime/D1 chưa diễn tập; không tạo down migration hủy dữ liệu để mở gate. Credentials staging và PayOS/D1 thật chưa kiểm chứng.
- Refund tự động chưa được hỗ trợ. Tích hợp Payout/hoàn tiền thật cần một phạm vi và hợp đồng được xác minh riêng.
- Lint theo script hiện tại chỉ kiểm Worker TypeScript. Local PASS không đồng nghĩa production ready hoặc audit toàn repo đã sạch mọi lỗi.

## Nguồn đối chiếu

- Định dạng create/get/cancel và dữ liệu PayOS: [API PayOS](https://payos.vn/docs/api/).
- Canonicalization/HMAC: [Kiểm tra dữ liệu với signature](https://payos.vn/docs/tich-hop-webhook/kiem-tra-du-lieu-voi-signature/).
- D1 batch rollback khi một statement thất bại: [D1 Database API](https://developers.cloudflare.com/d1/worker-api/d1-database/#batch).

## Câu hỏi còn mở

- Schema/ledger D1 và webhook URL PayOS triển khai hiện tại là gì? Chưa truy vấn cloud.
- Khi nào cấu hình staging và diễn tập phục hồi được phê duyệt? Chưa có hành động production trong lượt này.
