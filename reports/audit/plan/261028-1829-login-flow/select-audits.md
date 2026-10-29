# Select audits — Phạm vi được đề xuất

**Goal:** deep check luồng đăng nhập Admin, KDS, Staff/mobile và customer.
**Phụ thuộc:** [risk rank](./risk-rank.md). **Capacity giả định:** 420 phút kiểm tra + 30 phút peer review + 30 phút báo cáo = 480 phút-người. Chưa phải budget/nhân sự đã duyệt.

## Chọn 9 hạng mục

| Hạng mục | Phút ước lượng | Cách kiểm / deliverable | Gate |
|---|---|---|---|
| AUTH-01 | 60 | Phone capture vs credential proof; existing/new customer, aliases, self session; giữ repro LOGIN-01 | Không cấp customer authority chỉ vì biết phone |
| AUTH-02 | 30 | Anonymous/self/POS lookup theo role và store; trả projection tối thiểu | Không lộ profile/ví không được phép |
| AUTH-03 | 45 | Fresh/previous-user/failed/new login, page + store + real browser | Kết quả login gắn với attempt vừa submit; không success do user cũ |
| AUTH-09 | 45 | Email/phone ID mapping, `/me`/session, account A→B, late response và cache | Token/user/customer/tenant đồng nhất, dữ liệu riêng không theo sang user mới |
| AUTH-05 | 45 | D1 authority/identity directory/provisioning/legacy import; rehearsal schema local | Schema thiếu → lỗi rõ; không fallback quyền sang KV |
| AUTH-08 | 45 | App route/method/alias ownership; KDS REST/SSE và realtime transport nếu reachable | Mỗi path có đúng role/store/expiry/revocation gate |
| AUTH-06 | 60 | Browser fresh login/reload/logout/expiry, cookie/Bearer/CORS/proxy/production demo guard | UI/API nhất quán; cookie lỗi không giả login, CSRF không được bỏ qua |
| AUTH-07 | 45 | Credential abuse/concurrent throttle, PIN lock, reset/forgot/change-password, KV outage logout | Recovery có proof hoặc operator contract rõ; không ghi success giả |
| AUTH-04 | 45 | Regression 8h, device binding, account mutations/version, HTTP/SSE revoke và role boundary | Giữ toàn bộ gate đã có; dữ liệu sau revoke không tiếp tục phát |

**Tổng kiểm tra:** 420 phút. Đếm phút là giả định phục vụ lựa chọn, không phải thời gian đã tiêu hoặc ước lượng sửa code.

## Thứ tự kiểm chứng và remediation handoff

1. Giữ baseline + route owner; tái hiện AUTH-01/02/03 trước. Ba probe này đã FAIL local trong run 28/10; không chờ hết full audit để ghi blocker.
2. Customer identity/mapping và Staff authority/schema; kiểm API roles/store + aliases để không sửa nhầm handler shadowed.
3. Browser/auth-state/cookie, recovery và transport; giữ regression ở mỗi thay đổi khi có lượt remediation được giao.
4. Peer review verdict/evidence, lập backlog sửa nhỏ theo [kế hoạch chung](../../../../plans/261027-1956-customer-auth-promotions-readiness/plan.md), rồi retest probes bằng acceptance không bị nới.

## Hoãn phần đào sâu

- AUTH-10: exhaustive demo/build-mode combinations. Guard production cơ bản vẫn nằm trong AUTH-06; không bỏ kiểm điều kiện production.
- AUTH-11: long-duration load/soak. Chưa có capacity hoặc performance objective để đặt expected numbers.

Hoãn không đồng nghĩa chấp nhận residual risk. Nếu phát hiện bypass production hoặc sự cố tải liên quan login, nâng phạm vi thay vì giữ selection cũ.

## Acceptance audit

- Audit plan hoàn thành khi risk/selection/allocation có dependency, goal và bằng chứng; **không đồng nghĩa login-ready**.
- Chỉ đề xuất login-ready local sau khi 3 lỗi được sửa và retest PASS, ca bắt buộc có kết quả, không thiếu ownership/schema/browser evidence.
- Sửa code, deploy và migration remote không được thực hiện bởi `audit:plan`; staging/pilot cần gate riêng. Không mở KM/wallet dựa trên customer identity chưa xác thực.

Đầu ra máy đọc: [selected-audits.json](./selected-audits.json). Những ca chưa chạy ngoài ba probes và regression được ghi `NOT_RUN`/`BLOCKED`, không mặc định PASS.
