Fix double `/api/api/` path trong auth.js.

ĐỌC: `js/auth.js` toàn bộ.

## Vấn đề:
- Line 26: `API_BASE` được set dựa trên hostname
- Lines 47, 85, 129, 166: fetch URL dùng `${API_BASE}/api/auth/...`
- Nếu `API_BASE` đã chứa `/api` thì path sẽ thành `/api/api/auth/...` → 404

## Yêu cầu:
1. Kiểm tra giá trị `API_BASE` tại line 26
2. Nếu `API_BASE` kết thúc bằng `/api` → sửa tất cả fetch calls bỏ `/api` prefix (chỉ giữ `/auth/...`)
3. Hoặc nếu `API_BASE` KHÔNG chứa `/api` → giữ nguyên fetch paths
4. Đảm bảo consistency: production URL = `https://aura-space-worker.sadec-marketing-hub.workers.dev`

Hoàn tất → trả lời "Done bug-3".
