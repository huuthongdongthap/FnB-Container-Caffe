# Risk rank — Luồng đăng nhập

**Goal:** deep check luồng đăng nhập Admin, KDS, Staff/mobile và customer.
**Baseline:** HEAD `85d7deddd5a3cc9d8e4e8a108f5cb519b50ff897` + working tree ngày 28/10/2026. [Manifest trước run](./evidence/source-baseline.json).
**Cách tính:** impact × likelihood, thang thứ bậc 1–5 do người audit đánh giá; không phải xác suất thống kê. Score không thay thế proof kind hoặc verdict control.

| ID | Hạng mục | I × L | Score | Bằng chứng hiện tại |
|---|---|---|---|---|
| AUTH-01 | Phone-only cấp customer session | 5 × 5 | 25 | **Local FAIL:** app + bootstrap SQLite trả 200/token cho existing customer, chỉ gửi phone |
| AUTH-02 | Anonymous lookup profile/ví | 4 × 5 | 20 | **Local FAIL:** app + SQLite trả 200/member fields khi không có Authorization |
| AUTH-03 | Admin báo login thành công dựa user cũ | 4 × 4 | 16 | **Client local FAIL:** API boundary reject credentials, real page/store vẫn success + navigate `/admin` |
| AUTH-09 | Customer ID/token/user/cache không đồng nhất | 4 × 4 | 16 | Source gap: phone flow ghi token riêng; email/phone mapping và loyalty/referral persistence khác contract |
| AUTH-05 | Provisioning, D1/KV directory và schema release | 5 × 3 | 15 | Source yêu cầu schema mới; deployed schema/config chưa được kiểm tra trong run này |
| AUTH-08 | Route aliases và transport ngoài SSE | 5 × 3 | 15 | SSE được phủ regression; realtime forwarding/DO/WebSocket cần dispatch và auth audit riêng |
| AUTH-06 | Cookie/Bearer, hydrate và browser cross-origin | 4 × 3 | 12 | Unit/session regression PASS; chưa có browser/Safari/triển khai thật |
| AUTH-07 | Rate limit, recovery, reset và logout khi KV lỗi | 4 × 3 | 12 | Source có KV counter và degraded fail-open; forgot-password alias sang reset có RESET_KEY; cần rule/runtime riêng |
| AUTH-04 | Staff lifecycle và durable revocation | 5 × 2 | 10 | Nhóm regression mới PASS; vẫn cần kiểm browser/release path, không tự hạ gate |
| AUTH-10 | Đào sâu toàn bộ demo/build-mode matrix | 3 × 2 | 6 | Guest Admin được guard DEV/test; chưa có bằng chứng backend production bypass |
| AUTH-11 | Long-duration login/stream load soak | 3 × 2 | 6 | Chưa có load evidence hoặc capacity budget; tách khỏi đợt audit login đầu tiên |

## Tác động và giới hạn ba lỗi đã tái hiện

1. **LOGIN-01 / AUTH-01:** identity boundary thất bại. [phone-auth-handler.ts](/Users/mac/mekong-cli/FnB-Container-Caffe/worker/src/tree/loyalty/phone-auth-handler.ts:154) phát token sau lookup phone; [quan sát](./evidence/backend-observations.json) chỉ lưu status/booleans, không raw token. Chưa kiểm production.
2. **LOGIN-02 / AUTH-02:** anonymous data boundary thất bại. [pubPaths](/Users/mac/mekong-cli/FnB-Container-Caffe/worker/src/tree/loyalty/auth-middleware.ts:9) cho lookup đi qua; [response](/Users/mac/mekong-cli/FnB-Container-Caffe/worker/src/tree/loyalty/lookup-handler.ts:103) có profile, points, balance. Dữ liệu probe hoàn toàn tổng hợp.
3. **LOGIN-03 / AUTH-03:** false acknowledgement phía client, **không kết luận bypass backend**. [Store login](/Users/mac/mekong-cli/FnB-Container-Caffe/src/hooks/stores/use-auth-store.ts:84) ghi error nhưng không clear user cũ; [page](/Users/mac/mekong-cli/FnB-Container-Caffe/src/pages/admin/Login.tsx:30) dùng `currentUser` có sẵn làm dấu hiệu thành công. [Quan sát](./evidence/admin-observations.json): uiStatus=success, errorRecorded=true, previousUserRetained=true, navigate `/admin`.

## Không được suy luận

- Không gọi Staff web login “thiếu claims”: source hiện đã issueStaffSession từ D1, có auth_version/8h/device/revocation và regression mới.
- Không gọi demo Admin là production backdoor khi `import.meta.env.DEV/MODE=test` được guard; vẫn kiểm production build không expose action.
- Không gọi raw realtime route là exploit đã chứng minh: owner path/forwarding và actual upgrade còn cần kiểm, nhất là khác biệt isolated router với app mount.
- Không gọi 92 regression PASS là cả đăng nhập đã an toàn khi ba acceptance probes đang FAIL.

Đầu ra máy đọc từ DAGScheduler: [risk-rank.json](./risk-rank.json). Recipe flag `--annual` được giữ làm metadata; phạm vi vẫn là login audit được yêu cầu, không mở rộng thành audit năm của tổ chức.
