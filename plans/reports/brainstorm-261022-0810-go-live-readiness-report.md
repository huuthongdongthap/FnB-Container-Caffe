# GO LIVE AURA CAFE — đề xuất sau đối chiếu repo local

Ngày 22/10/2026, Asia/Ho_Chi_Minh. Baseline mã nguồn: `5efb3d893ae4def210bf4bc39d5e34acd225fb9a`, nhánh `main`.

**Kết luận: chưa đủ điều kiện GO LIVE. Đề xuất pilot một cửa hàng, PayOS/COD, sau khi đóng các điểm chặn bên dưới.**

## 1. Hợp đồng brainstorm

- **Outcome:** chốt commit các sửa chữa đang xử lý; xác định đường ngắn nhất để khách đặt đúng món/giá, thanh toán đúng, Staff/KDS nhận đơn và đối soát được tiền.
- **Constraints:** giữ mọi thay đổi ngoài phạm vi; chỉ PayOS/COD; giữ xác thực và tenant; không push, deploy, chạy migration, gọi PayOS hoặc D1 cloud.
- **Non-goals:** lượt này không triển khai các đề xuất mới, hợp nhất vật lý các thư mục migration, viết lại kiến trúc hoặc mở thêm ví thanh toán.
- **Acceptance:** có SHA commit; bằng chứng từ code/config hiện tại; kết quả kiểm tra ghi đúng ngày và phạm vi; lựa chọn triển khai, thứ tự công việc và điều kiện GO/NO-GO rõ ràng.

## 2. Git và kết quả thực tế

Commit `5efb3d8` — `🐛 fix: harden PayOS COD and staff operations`: 169 file, gồm bỏ MoMo/wallet, giá server, idempotency, PayOS/webhook/COD, tenant, Staff/KDS, retry checkout, gia cố kiểu Worker và bộ kiểm tra local.

Không đưa database runtime, ảnh/JSON/log kiểm thử hoặc các bản nháp khác vào commit. `docs/deployment-guide.md` đã dirty từ trước, được giữ riêng; các đề xuất trong file đó không tự trở thành chính sách phục hồi đã nghiệm thu.

| Kiểm tra ngày 22/10 | Exit | Kết quả |
|---|---|---|
| `npm run lint` | 0 | 0 lỗi, 1 warning `WebPushError` chưa dùng; chỉ lint Worker TypeScript. |
| `npm run typecheck:all` | 0 | Root và Worker PASS. |
| `npm run verify:gates` | 1 | `LOCAL_GATES_FAILED`; chi tiết dưới đây. |
| Vite `resolveConfig({}, 'serve', 'development')` | 0 | `server.proxy = null`, port 5173; API base local rỗng. |
| So source hash với lần local flow ngày 20/10 | 0 | **Không khớp**; mã nguồn đã thay đổi. |
| `git diff --cached --check` trước commit | 0 | PASS sau chuẩn hóa dòng cuối một file. |

Gate hiện tại:

- **GATE_1 PASS:** 64 forward / 7 down, 4 thư mục; target chính 37 forward / 7 down.
- **GATE_2 FAIL:** `dist/` cũ hơn source; chưa build lại trong lượt brainstorm.
- **GATE_3 FAIL:** có câu lệnh rollback trong script nhưng `runtimeVerified=false`; bộ phân tích tĩnh báo 30/37 migration chính thiếu down, 7 down còn lại có hazard. Đây không phải kết luận đã mất dữ liệu hay mọi migration không thể phục hồi bằng cách khác.
- **GATE_4 PENDING:** 6 tên biến staging không hiện diện trong process chạy kiểm tra. Chưa kiểm tra secret trên Cloudflare/GitHub; không kết luận cloud không có secret.

**Kết quả 20/10 chỉ là lịch sử:** 453 file / 4.225 tests PASS; 50/50 local flow checks PASS; build PASS. Chưa chạy lại full suite hoặc browser flow cho SHA mới trong lượt này. Không dùng chúng để tuyên bố bản phát hành hiện tại đã được nghiệm thu.

## 3. Phạm vi đã đọc lại

| Nhóm | Nguồn đối chiếu | Kết luận có giới hạn |
|---|---|---|
| Khách hàng | Checkout/intent, order store, confirmation, API client | Có giữ key/order khi retry và tải món từ API; cần kiểm chứng lại trên candidate mới. |
| Thanh toán | Domain payment, hai webhook, COD settlement, refund | Server total, signature và batch settlement đã có trong source; chưa chứng minh giao dịch thật. Refund tự động trả 422. |
| Staff/KDS | App guards, auth/tenant, KDS routes/hooks/stream, staff/shift stores | Queue lấy đủ trạng thái hoạt động; polling 5 giây; quyền API còn được giữ. Phần quản trị staff vẫn có lỗi phản hồi và gap vòng đời tài khoản. |
| Database | Hai bootstrap schema, migration mới, apply/deploy scripts, inventory 4 target | Fresh schema không chứng minh schema live; chưa biết migration/column/index nào đã có trên D1 thật. |
| Vận hành | Scheduled handler, overdue alerts, stuck/DLQ endpoint | Có lịch cron và dispatch alerts; chưa chứng minh thông báo tới người trực hoặc tự đối soát PayOS khi callback mất. |
| Phát hành | Vite, redirects/CSP, Wrangler, CI/deploy workflows, rollback/gate scripts | Có CI test/build, nhưng đường deploy chưa ràng buộc cùng kết quả CI và còn vấn đề staging/migration/rollback. |

Đây là đối chiếu các luồng phục vụ GO LIVE, không phải chứng nhận đã audit từng module trong toàn monorepo. Không rà vendor, output build, binary assets, checkout Mekong khác hoặc trạng thái cloud.

## 4. Phát hiện ưu tiên

### G01 — P1 / FACT: proxy local không được Vite áp dụng

[vite.config.js:92](/Users/mac/mekong-cli/FnB-Container-Caffe/vite.config.js:92) đặt callback tại thuộc tính `server` trong `defineConfig({...})`. Kiểu Vite đã cài yêu cầu `server` là `ServerOptions`. Đọc cấu hình bằng `resolveConfig` trả `server.proxy = null`.

Khi DEV dùng API base rỗng, các request `/api/*` không được proxy sang Worker bởi cấu hình này; đây là nguyên nhân có bằng chứng cho lỗi local, chưa phải chẩn đoán sự cố production. Bộ browser flow ghi đè cả API base/proxy tại [local-flow-browser.mjs:15](/Users/mac/mekong-cli/FnB-Container-Caffe/scripts/local-payment-flow/local-flow-browser.mjs:15), nên PASS của harness không bao phủ đường `npm run dev` mặc định.

**Đề xuất:** đưa callback `{ mode }` lên cấp `defineConfig`, trả về object có `server` đúng kiểu; kiểm tra resolve config và đường dev mặc định, giữ backend local và chặn outbound production khi nghiệm thu local.

### G02 — P1 / FACT + UNKNOWN runtime: deploy đi trước schema cần thiết

[create-order.ts:37](/Users/mac/mekong-cli/FnB-Container-Caffe/packages/domain/order/commands/create-order.ts:37) đọc `order_creation_requests` khi có idempotency key. Migration additive tương ứng đã có nhưng chưa được truy vấn trên D1 live. [deploy-cloudflare.sh:175](/Users/mac/mekong-cli/FnB-Container-Caffe/deploy-cloudflare.sh:175) deploy Pages, `:187` deploy Worker, sau đó `:191` mới áp dụng migration được chọn; mặc định bỏ migration.

**Đề xuất:** preflight schema/ledger, chỉ áp dụng migration additive đã được duyệt trước code phụ thuộc, xác nhận schema rồi mới Worker → Pages. Nếu bảng đã tồn tại đúng contract thì không chạy lại chỉ vì thấy file mới. Không replay toàn bộ 37 migration hoặc dùng fresh bootstrap SQL trên database có dữ liệu.

### G03 — P1 / GAP: staging chưa được định nghĩa thành môi trường cách ly trong repo

[wrangler.toml:19](/Users/mac/mekong-cli/FnB-Container-Caffe/worker/wrangler.toml:19) khai báo production; file không có `env.staging`. Các deploy jobs đều dùng `environment: production`. Kiểm tra có 6 biến `_STAGING` chỉ chứng minh sự hiện diện của biến, không chứng minh deploy script dùng chúng. [payos-create-link.ts:50](/Users/mac/mekong-cli/FnB-Container-Caffe/packages/domain/payment/commands/payos-create-link.ts:50) còn mặc định return URL về `https://auraspace.cafe` nếu thiếu `FE_BASE_URL`.

**Đề xuất:** staging có Worker, D1, KV, DO và frontend origin riêng; cấu hình rõ `FE_BASE_URL`, API base/CSP/CORS và credentials theo target. Thiếu thông tin staging phải dừng, không kế thừa binding hoặc URL production. Khả năng provider cung cấp kênh thử riêng còn UNKNOWN; fixture local không thay thế xác minh kênh merchant thực tế.

### G04 — P1 / FACT + GAP: script rollback chưa chứng minh dùng được

[deploy-rollback.sh:42](/Users/mac/mekong-cli/FnB-Container-Caffe/scripts/deploy-rollback.sh:42) gọi Worker rollback thiếu đường config khi chạy từ repo root; `:46` luôn dùng `--timestamp` dù usage nhận cả bookmark; `:49` dùng `wrangler pages rollback`, không có trong danh mục Pages CLI hiện hành. Bước xác minh `:55` chỉ đọc HTML trang chủ và bỏ qua lỗi, không xác nhận Worker/D1 hoặc SHA.

**Đề xuất:** Pages dùng [Rollback API chính thức](https://developers.cloudflare.com/api/resources/pages/subresources/projects/subresources/deployments/methods/rollback/); Worker chỉ rõ config/target/version; D1 phân biệt timestamp và bookmark, yêu cầu phê duyệt restore. Diễn tập trên staging, xác nhận version/readiness và dữ liệu. [D1 Time Travel](https://developers.cloudflare.com/d1/reference/time-travel/) ghi đè database tại chỗ: phải dừng ghi và đối soát mọi khoản đã thu sau điểm khôi phục trước khi mở lại.

Chọn chính sách expand-contract/forward-fix cùng phục hồi theo target. Gate chỉ được đổi theo chính sách đã duyệt và bằng chứng diễn tập; không tạo 30 file down hủy dữ liệu hoặc miễn gate bằng lời xác nhận.

### G05 — P1 / FACT: deploy workflow chưa ràng buộc CI cùng SHA

[ci.yml:1](/Users/mac/mekong-cli/FnB-Container-Caffe/.github/workflows/ci.yml:1) có lint, migration lint, root/Worker typecheck, tests và build. Nhưng [deploy.yml:32](/Users/mac/mekong-cli/FnB-Container-Caffe/.github/workflows/deploy.yml:32) là workflow dispatch độc lập; jobs không kiểm tra kết quả CI cùng SHA. Pages build chỉ chạy Vite; Worker upload/deploy không chạy chuỗi kiểm tra đó. Việc in SHA ra log không phải một release gate. Quy tắc bảo vệ environment trên GitHub chưa được kiểm tra.

**Đề xuất:** một release manifest gắn commit, artifact, migration allowlist và version baseline; deploy phải kiểm tra CI thành công cho đúng commit và dùng artifact đã kiểm chứng. Chỉ một đường phát hành được nghiệm thu. Bổ sung version metadata cho Pages trong cùng pipeline.

### G06 — P1 / FACT source, runtime chưa chạy: tắt staff chưa có contract thu hồi truy cập đầy đủ

[use-admin-staff-store.ts:96](/Users/mac/mekong-cli/FnB-Container-Caffe/src/hooks/stores/admin/use-admin-staff-store.ts:96) đổi trạng thái optimistic nhưng `:108` nuốt lỗi, giữ giao diện như đã lưu. Mobile login kiểm thiết bị/PIN rồi chỉ đọc `tenant_id` từ users ([staff-auth.ts:217](/Users/mac/mekong-cli/FnB-Container-Caffe/packages/domain/staff/commands/staff-auth.ts:217)), chưa kiểm `is_active` trước cấp JWT. `requireAuth` kiểm chữ ký/role/KV revoked, không kiểm trạng thái tài khoản ở D1; cập nhật staff chưa nối thành một cơ chế thu hồi phiên được nghiệm thu.

**Đề xuất:** UI revert/refetch và báo lỗi khi lưu thất bại; account inactive/missing không được cấp token; đổi quyền, vô hiệu hóa hoặc thu hồi thiết bị phải có cơ chế session revocation/version dùng chung cho web/mobile/SSE. Xác minh tình huống nhân viên đang đăng nhập bị khóa. Nếu quản lý vòng đời thiết bị chưa đạt, không mở tính năng đó cho pilot.

### G07 — P1 / GAP: thiếu đường khép kín khi tiền đã thu nhưng webhook không cập nhật được

[payos-attempt.ts:68](/Users/mac/mekong-cli/FnB-Container-Caffe/packages/domain/payment/commands/payos-attempt.ts:68) có GET recovery nhưng chỉ chấp nhận provider status `PENDING`; `:77` trả conflict cho trạng thái khác, không reconcile settlement. `scheduled.ts` chưa nối tác vụ đối soát PayOS. Có màn hình stuck/DLQ ([admin-handlers.ts:200](/Users/mac/mekong-cli/FnB-Container-Caffe/worker/src/routes/admin-handlers.ts:200)), nhưng marker catch của webhook ([payos.ts:87](/Users/mac/mekong-cli/FnB-Container-Caffe/worker/src/routes/webhooks-handlers/payos.ts:87)) chỉ có lỗi/timestamp, thiếu định danh cho khôi phục tự động.

**Đề xuất:** reconcile giới hạn các pending bất thường theo orderCode; gọi GET provider, kiểm signature/order/amount rồi dùng cùng settlement nguyên tử, có audit và khóa chống chạy lặp. Không cho client return URL tự đánh dấu paid. Ghi lỗi có correlation/order/payment ID đã biết, không ghi secret hoặc payload PII thô. Endpoint và response đối chiếu theo [API PayOS](https://payos.vn/docs/api/); chưa gọi provider thật trong lượt này.

### G08 — P1 / FACT + rủi ro có điều kiện: refresh mobile chỉ dựa vào device token tĩnh

[staff-mobile.ts:24](/Users/mac/mekong-cli/FnB-Container-Caffe/worker/src/routes/staff-mobile.ts:24) mount `/mobile/refresh` trên public router. [staff-auth.ts:239](/Users/mac/mekong-cli/FnB-Container-Caffe/packages/domain/staff/commands/staff-auth.ts:239) chỉ cần `device_token` đã đăng ký để cấp JWT mới; không yêu cầu PIN/JWT hiện tại, không xoay hoặc kiểm TTL của credential refresh trong đường này. Người giữ được device token có thể xin lại quyền theo device; chưa thử khai thác hoặc xác minh tình trạng token ngoài production.

**Đề xuất tối thiểu cho pilot:** khi hết phiên yêu cầu PIN đăng nhập lại; không cho chỉ một device identifier đổi thành JWT mới. Nếu giữ tự động refresh, phải dùng credential riêng có TTL, rotation và revocation gắn account/device/tenant; không coi identifier là bằng chứng đã vượt PIN. Kiểm tra account inactive và role hiện tại đồng thời với G06.

## 5. So sánh và lựa chọn

| Phương án | Giá trị / chi phí / rủi ro | Quyết định |
|---|---|---|
| Mở toàn bộ monorepo sau khi sửa hết 30 mục của plan cũ | Phạm vi lớn, nhiều thay đổi ngoài bán hàng; khó xác định ngày xong. | Đưa cải tiến không chặn vận hành vào backlog. |
| Pilot một cửa hàng với PayOS/COD, menu → order → Staff/KDS → thu tiền → đối soát | Phục vụ trực tiếp khách và ca làm việc; tái dùng phần hiện có; cần đóng G01–G08 và xác minh môi trường. | **Khuyến nghị.** |
| COD-only tạm thời | Ít phụ thuộc gateway hơn; tăng thu tiền/đối soát thủ công và chưa đáp ứng đầy đủ mục tiêu PayOS. | Chỉ là phương án dự phòng để chủ quán chọn nếu PayOS thật chưa đạt. Không tự chuyển. |

Giá trị cần kiểm chứng là khách nhận đúng món, thu đúng tiền và nhân viên xử lý đơn được. Chưa có bằng chứng về nhu cầu/quy mô mới hoặc lợi thế thị trường để biện minh cho mở thêm ERP, marketing automation, SaaS/franchise hay ví khác trong đợt này.

## 6. Handoff thực hiện theo thứ tự

1. **Đóng lỗi local/release:** ưu tiên G06/G08 (staff auth), G01 (dev), G07 (đối soát), rồi G02/G04/G05 (release); giữ tenant và các contract được hỗ trợ. Tạo candidate mới, chưa hợp nhất/xóa migration lịch sử.
2. **Kiểm chứng đúng candidate:** typecheck, lint, migration lint, test mục tiêu và full Vitest, local Worker/D1/browser flow, build rồi gate. Thêm kiểm tra đường dev mặc định vì harness hiện ghi đè cấu hình. Số tests là kết quả, không là mục tiêu cần giữ bằng mọi giá.
3. **Cách ly staging:** hoàn thành G03; đối chiếu D1 schema/ledger/index/trigger và cấu hình PayOS/webhook/return URL; chỉ ghi cloud sau phê duyệt tương ứng. Dùng dữ liệu staging không chứa PII production.
4. **Diễn tập khôi phục:** Pages + Worker + D1 staging, đo thời gian thực; kiểm tra order/items/payment totals và đối soát sau restore. Ngưỡng đề xuất RTO ≤15 phút, chưa phải khả năng đã đạt.
5. **Phát hành có phê duyệt:** chốt target và baseline còn hợp lệ; schema additive được kiểm tra trước, Worker tương thích trước, Pages sau; version frontend/backend phải thuộc release manifest. Không tự chạy các bước này trong lượt brainstorm.
6. **Pilot có người trực một ca:** tối thiểu 2 PayOS và 2 COD thật được duyệt; mọi khoản thu khớp sổ, món và trạng thái đúng, Staff/KDS thấy đơn ≤15 giây khi online. Một ca không đủ số mẫu thì tiếp tục quan sát, không coi thiếu mẫu là PASS.

Không mặc định bấm canary 10% có sẵn. [Cloudflare xác nhận](https://developers.cloudflare.com/workers/versions-and-deployments/gradual-deployments/) mỗi request có thể vào phiên bản khác nếu chưa có version affinity. Với order/payment dùng chung D1 và DO, cần chứng minh tương thích hai phiên bản trước; kiểm tra riêng [giới hạn lifecycle DO](https://developers.cloudflare.com/workers/versions-and-deployments/gradual-deployments/with-durable-objects/). Mặc định đề xuất một cửa sổ đổi phiên bản sau staging, rồi giới hạn pilot ở nhóm vận hành; chưa thực hiện hoặc phê duyệt thay đổi traffic.

### Điều kiện GO/NO-GO

- GO khi candidate/CI/build đúng SHA, staging cách ly, schema đã đối chiếu, phục hồi đã diễn tập, Staff/KDS/auth và PayOS/COD thật đạt ca pilot.
- Không còn lỗi làm sai giá, thu trùng tiền, mất đơn đã thu tiền hoặc vượt quyền; webhook replay và retry chỉ có một kết quả hợp lệ.
- Anonymous vẫn 401; chỉ device identifier không đổi được JWT; staff đúng role/tenant dùng được; phiên bị khóa không tiếp tục thao tác; mất mạng hiện trạng thái thử lại, không giả thành công.
- Safari và Chrome đều hoàn tất checkout → món trên xác nhận → Staff/KDS → hoàn tất/thu COD → đối soát. Polling 5 giây là source fact; ≤15 giây là ngưỡng nghiệm thu đề xuất.
- NO-GO/đóng nhận đơn mới khi có tiền không khớp sổ, đơn mất khỏi KDS, lỗi auth diện rộng hoặc chưa xác định được bản đang chạy. Không tự restore D1; giữ bằng chứng và chủ quán duyệt phương án xử lý.
- Refund tự động còn 422: phải có người phụ trách hoàn tiền/đối soát thủ công rõ ràng; không hứa chức năng này đã hoàn chỉnh.

## 7. Câu hỏi còn mở

1. Schema/ledger/index/trigger, SHA Worker/Pages và webhook URL thực tế đang chạy là gì? Chưa truy vấn cloud.
2. Có tài nguyên staging cách ly và kênh merchant để xác minh PayOS chưa? Ai được quyền phê duyệt giao dịch thử và migration?
3. Ai trực pilot, ai quyết định dừng nhận đơn, và ai xử lý tiền đã thu sau một lần phục hồi?
4. Baseline Worker/Pages còn rollback được và có tương thích schema/DO mới không? CI protection trên GitHub được cấu hình thế nào?

Các câu hỏi này chặn bước cloud/GO LIVE tương ứng; không chặn việc chuẩn bị sửa chữa local và kế hoạch kiểm chứng.
