# JWT_SECRET cần rotate

## Vấn đề
`JWT_SECRET` trên production hiện tại < 16 ký tự → `POST /api/auth/register` trả 500:
```
JWT_SECRET must be at least 16 characters
```

## Fix
Chạy trên terminal:
```bash
cd worker
npx wrangler secret put JWT_SECRET
```
Nhập key ≥ 32 chars (vd: `fnb-caffe-2026-super-secure-jwt-key-min-32-chars-here`).

## Lưu ý
- Đổi secret → **tất cả users đang login sẽ bị logout** (token cũ invalid)
- Không cần sửa code, chỉ cần set secret mới
- Verify: `POST /api/auth/register` trả 201 thay vì 500
