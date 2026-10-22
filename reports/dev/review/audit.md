# Audit luồng PayOS/COD → xác nhận → Staff/KDS

Ngày: 2026-10-20, Asia/Ho_Chi_Minh. Kết luận: **HOLD — chưa đủ điều kiện deploy**.

## Phạm vi và phương pháp

- Đọc working tree hiện tại và đối chiếu HEAD `2cf0025a954657ee102c4f655c021a97340cbca4`; local `origin/main` là `d50543412e095310972705ceeb285293e24228dd`. HEAD đi trước 1 commit; không fetch/đổi nhánh.
- Theo recipe `/Users/mac/mekong-cli/recipes/dev/review.json`: scan lint/types song song → phân tích payment/KDS → kiểm tra runtime local → tổng hợp. Alias dispatcher `agy check /dev/review` không tìm thấy; thực hiện recipe trực tiếp. Worker-scan dùng command definition vì không có recipe con.
- Chạy Worker/Hono thật trên workerd `1.20260515.1`, Miniflare `4.20260515.0`, compatibility date `2025-01-01`; D1/KV/DO local; giao diện Vite và Chrome thật. Không dùng Wrangler cloud.
- Khởi tạo D1 bằng **`worker/schema.sql`, chưa áp dụng migration**. Đây là kiểm tra bootstrap local, không phải bản sao schema triển khai. PayOS dùng khóa giả và phản hồi provider giả lập; webhook vẫn đi qua xác minh chữ ký của ứng dụng.
- Ghi DB trực tiếp chỉ để seed fixture, tạo tình huống lỗi ghi và mô phỏng terminal khác. Các kiểm tra thanh toán/order/KDS đi qua HTTP và code ứng dụng hiện tại.
- Proxy Vite được ghi đè về localhost, không dùng proxy production trong cấu hình mặc định; browser chặn tài nguyên ngoài localhost, Worker chặn outbound ngoài provider fixture. Không nạp `.env.local` vào Vite của harness.
- Không sửa source sản phẩm, dependency hoặc Git index. Chỉ thêm báo cáo, harness và ảnh trong thư mục này. Hash diff `src/`, `worker/`, `packages/` trước/sau giống nhau; xem `local-flow-results.json`.

## Phát hiện đã tái hiện tại local

Các ID dưới đây ánh xạ trực tiếp tới `checks[]` trong `local-flow-results.json`. Không kết luận đây là sự cố đã xảy ra trên production.

| Mức / phát hiện | Bằng chứng hiện tại | Kết quả thực tế / tác động | Hướng sửa và tiêu chí nghiệm thu |
|---|---|---|---|
| **P1 — Giá/giảm giá do khách quyết định** | `worker/src/routes/orders-hono-handlers/guest-handlers.ts:174-205`; `packages/domain/order/commands/create-order.ts:40-46`; `packages/domain/order/policies/order-snapshot.ts:162-166` | `guest-price-tamper`, `public-discount-tamper`: món catalog 20.000 được lưu tổng 1.000; create-link trả 200 và payment lưu 1.000. Đây là số tiền gửi provider fixture, không phải giao dịch thật. | Mọi public writer dùng giá catalog và ưu đãi được server xác thực. Giả giá hoặc discount phải bị từ chối/bỏ qua; tổng giữ 20.000 và mọi alias có regression test. |
| **P1 — Sửa trạng thái đơn khác tenant** | `worker/src/routes/features-router.ts:91-124`; `worker/src/routes/orders-hono-handlers/kds-handlers.ts:93-102`; `packages/domain/kitchen/commands/kds-status-transition.ts:52,96` | `tenant-canonical-status-write`, `tenant-admin-status-write`: token cafe-a sửa đơn cafe-b qua hai route; đều 200, D1 thực sự đổi preparing/ready. API list có lọc tenant nhưng các write này không có. | Ràng buộc tenant/quyền và transition tại một coordinator; UPDATE có tenant và trạng thái kỳ vọng. Mọi alias phải trả 403/404 với foreign order, không thay DB/event. |
| **P1 — Tenant lúc tạo đơn không đáng tin** | `worker/src/lib/validators/order.ts:38`; `packages/domain/order/commands/create-order.ts:76-89,116` | `tenant-signed-creation`: staff cafe-a tạo đơn thành tenant default. `tenant-client-injection`: khách chưa đăng nhập truyền cafe-b, đơn được gán cafe-b. | Staff tenant từ identity; guest store từ host/table/store mapping tin cậy. Kiểm tra tạo → trả tiền → đúng queue và loại trừ tenant khác. Không mở queue công khai để bù dữ liệu thiếu. |
| **P1 — Tạo đồng thời hai payment attempt** | `packages/domain/payment/commands/payos-create-link.ts:92-145`; `packages/domain/payment/commands/payos-helpers.ts:129-138` | `payos-concurrent-create`: hai request cùng đơn đều 200; D1 có hai payment pending với hai mã và URL fixture khác nhau. Cửa sổ cạnh tranh được tạo bằng delay provider 150 ms. | Reserve attempt nguyên tử trước khi gọi provider, duy nhất attempt hoạt động/order và phục hồi retry. Hai request đồng thời phải dùng cùng attempt hoặc một request bị từ chối; không tạo hai invoice. |
| **P1 — Webhook phụ không phục hồi settlement dở dang** | `worker/src/routes/openapi-payments-handlers/webhook-handlers.ts:76-79,99-110` | `openapi-webhook-recovery`: fault injection cho UPDATE orders gây 503 sau khi payment completed; bỏ lỗi rồi replay nhận 200 nhưng order vẫn unpaid. Primary webhook sửa được cùng trạng thái dở dang. | Dùng cùng settlement function cho hai URL; update nguyên tử hoặc replay luôn repair order. Test lỗi giữa hai write và replay ở từng alias. |
| **P1 — Thu COD đồng thời kết thúc chế biến** | `worker/src/routes/orders-hono-handlers/kds-handlers.ts:138-159,177-180` | `cod-preserves-kitchen-state`: đơn preparing sau thu tiền thành completed/paid, bị loại khỏi active queue dù bếp chưa hoàn tất. Quyền cashier và tenant của thao tác thu tiền được giữ đúng. | Tách payment state khỏi fulfillment state; thu tiền không tự hoàn tất đơn. Pending/preparing phải còn trong queue sau thu; chỉ transition bếp hợp lệ mới loại đơn. |
| **P1 — Cashier bị chặn queue mới** | `worker/src/index.ts:85-93`; `worker/src/routes/orders-unified.ts:56,62`; `src/hooks/use-kds.ts:125` | `cashier-queue`: cashier hợp lệ nhận 403 ở `/api/kds/orders` do outer allowlist thiếu cashier/waiter, dù inner router cho phép. Staff tải được REST/SSE và thao tác UI thành công. | Đồng bộ role matrix đã định nghĩa giữa outer middleware, router và UI. Test cả REST/SSE từng role; giữ anonymous 401 và kiểm tra tenant. |
| **P2 — Ticket đã hoàn tất vẫn nằm trong cache KDS** | `src/hooks/use-kds.ts:135-143,167-170` | `browser-removes-completed-ticket`: ticket ready chuyển completed tại D1; hai response queue 200 không còn ticket nhưng Chrome vẫn hiển thị. Ảnh `browser-kds.png`. | Snapshot/list đầy đủ là nguồn thay thế cache; không giữ record vắng mặt vô thời hạn. Test terminal khác completed/cancelled và identity switch. |

## Phát hiện từ source, giới hạn runtime

- **P1 / VERIFIED_SOURCE — Refund/payment thiếu tenant scope.** Route refund được mount tại `worker/src/routes/features-router.ts:144-145`. `worker/src/routes/refunds-handlers/mutation-handlers.ts:18,36-48,91-101` cho role staff/waiter/cashier, lấy payment bằng ID rồi gọi provider mà chưa kiểm linked-order tenant. List tại `worker/src/routes/openapi-payments-handlers/read-handlers.ts:114-125` cũng thiếu tenant scope. Cần kiểm quyền tài chính/tenant trước đọc/ghi/provider. **Runtime thử refund trả 500 vì bootstrap thiếu `refund_status`; chưa chứng minh request cross-tenant tới provider hoặc refund thành công.** Chi tiết trong `security-payment.md`.
- **P2 / VERIFIED_SOURCE — Transition thiếu compare-and-set.** `packages/domain/kitchen/commands/kds-status-transition.ts:51-54,96-98` đọc rồi UPDATE bằng ID; COD tương tự. Có nguy cơ ghi đè cancel khi hai terminal chạy đồng thời; chưa dựng interleaving runtime cho trường hợp này.
- **P2 / VERIFIED_SOURCE — Nhãn xác nhận không phản ánh trạng thái.** `src/pages/order-success.tsx:138-152` không truyền payment/fulfillment state; `src/components/stitch/StitchOrderSuccessNew-tracking.tsx:157-163` cố định “Đang pha chế”; thời gian 10 phút cố định. Item đã hiển thị đúng trong Chrome, nhưng status/progress cần test riêng cho unpaid/ready/completed/cancelled.
- **UNKNOWN — Cache sau đổi tenant.** Query key chỉ có station; logout không dọn query cache; SSE effect không phụ thuộc identity. Test logout/login đã gọi API thành công nhưng timeout khi chờ response đúng điều kiện tenant. Chưa đủ bằng chứng runtime để khẳng định dữ liệu tenant trước vẫn hiển thị cho tenant sau; không tính timeout này như một lỗ hổng đã tái hiện.
- **GAP — Bootstrap/schema và side effect.** Local ghi nhận thiếu `_metrics`, `customer_identities`, `stock_movements`, `inventory_items`, `client_errors`, cột refund và schema loyalty tương ứng. Có response loyalty 503/client-error 500; order chính vẫn tạo được. Cần kiểm tra bằng schema/migration topology chuẩn trong môi trường cô lập. Không suy diễn production thiếu cùng bảng/cột.
- **UNKNOWN — Luồng guest realtime.** Trang success gọi detail có auth nhận 401 và order events nhận 403; `/track` fallback 200 và item hiện đúng. Chưa xác minh hành trình live cập nhật trạng thái khách hàng từ đầu đến cuối.
- **UNKNOWN — Token SSE trong URL.** Source gửi JWT trong query. Chưa đọc log edge/proxy thực tế nên không kết luận lộ token. Cần scoped stream token hoặc fetch streaming và kiểm redaction log khi được phép kiểm staging.

## Những phần đạt tại local

- Checkout Chrome chỉ hiện PayOS/COD; MoMo/Apple Pay/Google Pay bị từ chối 400; endpoint đã gỡ trả 404 khi có phiên hợp lệ.
- COD và PayOS tạo order 201/unpaid; tạo PayOS link cho COD bị 409; amount sửa ở create-link bị 400.
- Webhook primary kiểm chữ ký, chặn amount 0, xử lý replay và repair partial settlement. Payment/order chuyển completed/paid đúng trên D1 local.
- Chrome COD submit → confirmation, PayOS submit → provider fixture → signed callback → confirmation đều hiển thị món thực từ API. Điều hướng về success sau callback được harness thực hiện; chưa xác minh auto-return của provider thật.
- Staff có phiên: queue REST/SSE 200, đơn PayOS đã paid và COD preparing có mặt; nút bắt đầu chế biến gọi route và trả 200. Không phiên nhận 401; kitchen không được thu COD (403); cashier khác tenant không thu được (404).
- Không có uncaught page error trong lượt Chrome cuối. Các tài nguyên font/CDN ngoài localhost bị chặn có chủ đích.

## Kết quả kiểm chứng hiện tại

| Lệnh | Exit | Kết quả và phạm vi |
|---|---:|---|
| `npm run lint` | 0 | PASS; chỉ `worker/src/**/*.ts`, theo cấu hình hiện tại; xem `lint.md`. |
| `npm run typecheck:all` | 0 | PASS root + Worker; xem `types.md`. |
| `node reports/dev/review/local-flow.mjs` | 1 | 46 check records: 33 PASS, 11 kiểm tra thất bại xác nhận lỗi ứng dụng, 1 schema gap, 1 timeout chưa kết luận. Không fatal; xem JSON/log. |
| `npm run verify:gates` | 1 | Migration lint và build freshness PASS; rollback FAIL, credentials staging PENDING; xem `gates-output.log`. |
| `git diff --check` | 0 | Không có lỗi whitespace trong tracked diff; không chứng minh tính đúng runtime. |

Gate rollback chỉ phát hiện command tĩnh (`runtimeVerified=false`); target chính có 7/36 down, thiếu 29, cả 7 bị gắn hazard. “0/36 safely reversible” là kết luận heuristic của gate, không phải chạy phục hồi dữ liệu. Thiếu 6/6 biến staging trong môi trường kiểm tra hiện tại.

Không chạy lại toàn bộ Vitest/build trong lượt review này; không dùng số liệu lịch sử làm bằng chứng hiện tại. Gate freshness không thay thế một build mới. Chưa quét advisory dependency trực tuyến hoặc kiểm schema/cloud/PayOS thật.

Lượt đầu hoàn chỉnh được giữ trong `local-flow-first-run-*`; lỗi chờ exact-text KDS lúc cold start không được kết luận là defect. Lượt cuối sửa predicate và xác nhận UI tải/nút hoạt động. Một retry gián đoạn localhost được giữ ở `local-flow-transport-error.json`. Chỉ số chốt lấy từ `local-flow-results.json`, kết thúc `2026-10-20T04:50:47.485Z`.

## Nguồn gốc và thứ tự xử lý

1. Chặn giá/discount giả và tenant writes/refund: ưu tiên bảo vệ tiền và dữ liệu; bổ sung request-level regression xuyên mọi alias.
2. Chuẩn hóa tenant creation + role matrix; thu COD độc lập fulfillment; sửa cache authoritative và bind identity cho query/stream.
3. Reserve payment attempt nguyên tử; thống nhất settlement/replay giữa hai webhook; kiểm fault injection và concurrency.
4. Xác định schema/migration local chuẩn và kiểm bootstrap; sau sửa chạy test mục tiêu, full Vitest, lint/typecheck/build mới; báo đúng phạm vi lint.
5. Gỡ blocker rollback bằng chiến lược phục hồi được kiểm chứng; staging credentials cần cấu hình riêng khi được ủy quyền. Deployment và production nằm ngoài lượt review.

Đối chiếu HEAD: role gate cashier/waiter là regression của dirty implementation; pricing, tenant writers, concurrent link, partial webhook recovery và COD completion đã tồn tại trong HEAD. Cache merge cũ được giữ trong khi queue mới đã lọc active; không quy mọi lỗi cho lượt sửa PayOS/COD.

## Câu hỏi còn mở

- Ma trận quyền cuối cho cashier/waiter/KDS và quyền tài chính/refund theo cửa hàng/HQ là gì?
- Guest order gắn cửa hàng qua hostname, table token hay store mapping nào được server xác thực?
- PayOS hiện cấu hình webhook URL primary hay alternate? Chưa kiểm dashboard thật.
- Chuỗi schema/migration nào là chuẩn để tái tạo DB hiện dùng, và cơ chế rollback dữ liệu nào được chấp thuận?
