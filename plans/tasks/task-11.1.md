# Phase 11.1 — Admin Dashboard: Build & Deploy

## Context
Phase 11 code changes đã hoàn tất. Các file đã sửa:
- `dashboard/dashboard.js` — API_BASE dynamic, SPA tab router, endpoint mapping → `/admin/orders` + `/stats`
- `dashboard/admin.html` — Tab sections: `#view-dashboard`, `#view-orders`, `#view-customers`, `#view-menu`, `#view-coming-soon`

## Task: Build + Deploy + Verify

### Step 1: Build Frontend
```bash
cd ~/mekong-cli/FnB-Container-Caffe && npm run build
```
Verify `dist/dashboard/admin.html` tồn tại và reference đúng `dashboard.js` (không phải `dashboard.min.js`).

### Step 2: Deploy Worker
```bash
cd worker && npx wrangler deploy
```

### Step 3: Deploy Pages
```bash
cd ~/mekong-cli/FnB-Container-Caffe && npx wrangler pages deploy dist --project-name=fnb-caffe-container
```

### Step 4: Verify Production
1. Mở `https://fnb-caffe-container.pages.dev/dashboard/admin`
2. Login với `admin@auraspace.vn` / `AuraAdmin2026!`
3. Check Network tab: API gọi đến `aura-space-worker.sadec-marketing-hub.workers.dev/api/stats` (KHÔNG phải `localhost:8000`)
4. Click Sidebar "Đơn hàng" → Tab chuyển sang `#view-orders`, hiện bảng Orders
5. Click "Kho", "Cài đặt" → Hiện "Coming Soon" placeholder
6. Data rỗng phải hiện "Không có đơn hàng nào" — KHÔNG được hiện Mock "Nguyễn Thành"

### Done Criteria
- [ ] Build thành công, no errors
- [ ] Worker deployed
- [ ] Pages deployed
- [ ] Login flow OK
- [ ] SPA tabs navigate đúng
- [ ] Production KHÔNG hiện Mock Data
