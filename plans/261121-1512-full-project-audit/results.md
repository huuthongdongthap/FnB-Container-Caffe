# Audit remediation / Sửa lỗi sau kiểm định

| Area / Hạng mục | Local change / Thay đổi cục bộ |
|---|---|
| NOWPayments | EN: Record invoice settlement and subscription activation together. VI: Ghi nhận thanh toán và kích hoạt gói cùng lúc. |
| ERPNext | EN: Compare retry times in a consistent format. VI: So sánh thời điểm thử lại theo cùng định dạng. |
| Cart / Giỏ hàng | EN: Keep the cart on session refresh; clear it on account-scope changes. VI: Giữ giỏ khi làm mới phiên; xóa khi đổi phạm vi tài khoản. |
| Split bills / Chia hóa đơn | EN: Keep product IDs, options, and notes in each split order. VI: Giữ mã món, tùy chọn và ghi chú trong từng đơn tách. |
| Table sessions / Phiên bàn | EN: Reject order attachment if the table session closes concurrently. VI: Từ chối gắn đơn nếu phiên bàn vừa đóng. |
| Mixpost | EN: Enforce Vietnam-time schedules and prevent repeat submissions. If delivery is uncertain, check the provider before retrying manually. VI: Đăng theo giờ Việt Nam và ngăn gửi trùng. Nếu chưa rõ bài đã được gửi hay chưa, kiểm tra bên cung cấp trước khi thử lại thủ công. |
| Deployment setup / Cài đặt triển khai | EN: Use the selected brand and generated Worker config; reject a missing or mismatched target. VI: Dùng thương hiệu đã chọn và cấu hình Worker vừa tạo; dừng nếu thiếu hoặc sai đích. |

## Final verification / Kiểm chứng cuối

- EN: `npm run --silent lint`, `npm run --silent typecheck:all`, `npm run --silent lint:migrations`, `npm run --silent build`, and `git diff --check` passed. Migration lint verified 89 forward and 20 down migrations across four directories.
- VI: `npm run --silent lint`, `npm run --silent typecheck:all`, `npm run --silent lint:migrations`, `npm run --silent build` và `git diff --check` đều đạt. Kiểm tra migration xác nhận 89 tệp tiến và 20 tệp hoàn tác ở bốn thư mục.
- EN: Full Vitest passed in both `TZ=Asia/Saigon` and `TZ=UTC`: 604 test files and 6,023 tests passed in each run (exit code 0).
- VI: Toàn bộ Vitest đạt ở cả `TZ=Asia/Saigon` và `TZ=UTC`: mỗi lần chạy có 604 tệp kiểm thử và 6.023 bài đạt (mã thoát 0).
- EN: Independent final review found no concrete blocking findings in the deployment-target and Mixpost claim-recovery scope; focused review passed 45/45 tests.
- VI: Đánh giá độc lập cuối không phát hiện lỗi chặn cụ thể trong phạm vi đích triển khai và khôi phục claim Mixpost; nhóm kiểm thử tập trung đạt 45/45 bài.
- EN: No deployment, production data changes, paid external calls, push, PR, or issue publication were performed. GitHub publication remains blocked by confirmed repository permission 403.
- VI: Không triển khai, sửa dữ liệu thật, gọi dịch vụ trả phí, push, tạo PR hay công bố issue. Việc công bố GitHub vẫn bị chặn bởi quyền kho mã trả về 403.
- EN: `verify:gates` remains a pre-existing release blocker: rollback readiness reports 42/62 active migrations without down files and 20 rollback hazards; staging credentials are absent. This audit did not alter migrations or claim staging readiness.
- VI: `verify:gates` vẫn là điểm chặn phát hành có sẵn: kiểm tra khôi phục báo 42/62 migration đang dùng thiếu tệp down và 20 rủi ro hoàn tác; chưa có khóa staging. Đợt kiểm định này không sửa migration và không tuyên bố staging đã sẵn sàng.
- EN: Browser/live Cloudflare behavior and real provider delivery remain unverified because no deployment or production access was authorized.
- VI: Hành vi trình duyệt/Cloudflare thực tế và việc gửi tới nhà cung cấp thật chưa được kiểm chứng vì không được cấp quyền triển khai hay truy cập production.

- EN: `npm run --silent verify:gates` exits 1. Migration lint and the frontend bundle pass. Of 62 active migrations, 42 lack a down migration and the other 20 are flagged for rollback hazards. This change set does not alter those migrations or prove a safe recovery. Staging was not verified.
- VI: `npm run --silent verify:gates` trả mã 1. Kiểm tra tệp cập nhật dữ liệu và gói giao diện đạt. Trong 62 bản cập nhật dữ liệu đang dùng, 42 bản thiếu tệp hoàn tác và 20 bản còn lại bị cảnh báo rủi ro. Đợt sửa này không thay đổi các tệp đó và chưa chứng minh cách khôi phục an toàn. Chưa kiểm chứng môi trường thử nghiệm.
- EN: No deployment, production data changes, or remote publication. VI: Không triển khai, sửa dữ liệu thật hay công bố từ xa.

## Verification in progress / Đang kiểm chứng

- EN: Lint, type checks, migration lint, contrast (11/11), build, and the CI test command passed on interim revisions. Vietnam-time suite: 5,993 passed. UTC suite saw a promotion regression while the test and fix were being integrated; the focused UTC rerun passed (14/14). Repeat the full suites after all review fixes land.
- VI: Kiểm tra mã, kiểu dữ liệu, tệp cập nhật dữ liệu, độ tương phản (11/11), build và lệnh kiểm thử CI đã đạt trên các bản trung gian. Bộ kiểm thử giờ Việt Nam đạt 5.993 bài. Bộ UTC gặp lỗi khi đang tích hợp bản sửa khuyến mãi; chạy lại nhóm liên quan đạt 14/14. Cần chạy lại toàn bộ sau khi xử lý nhận xét đánh giá.
- EN: Independent review flagged order/bill consistency, refund/access consistency, and deployment target validation; these remain open pending fixes and re-review. The promotion starvation regression has a focused passing test. No local commit yet.
- VI: Đánh giá độc lập phát hiện vấn đề đồng bộ đơn/hóa đơn, hoàn tiền/quyền truy cập và kiểm tra đích triển khai; vẫn đang sửa và cần đánh giá lại. Lỗi bỏ sót khuyến mãi đã có kiểm thử đạt. Chưa commit cục bộ.
