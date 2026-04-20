# CTO Refactor Dispatch — Copy & Paste vào Claude Code CLI

> Mở Claude Code CLI tại `~/mekong-cli/FnB-Container-Caffe` rồi paste từng prompt bên dưới.
> Đợi Worker hoàn thành xong prompt trước rồi mới paste prompt tiếp theo.

---

## Prompt 1: Xóa Bloat Files

```
Đọc file plans/tasks/cto-refactor.md phần Phase 1. Xóa các file rác: export.pdf, lighthouse-report.html, websocket-server.js, task2.txt, task4.txt, test-reviews.html. Kiểm tra .cfignore và .gitignore đã có các entry loại trừ (node_modules, .git, .wrangler, _archive, .claude, dist, plans, designs, docs, tests, tools, scripts, *.pen, *.md). Thêm entry thiếu. Commit: "chore: remove dead files and update ignore rules"
```

---

## Prompt 2: Dọn CSS Rác

```
Chạy grep kiểm tra xem các file CSS sau có còn được HTML nào import không: css/loyalty-full.css, css/loyalty-m3.css, css/loyalty-styles.css, css/kds-m3.css, css/kds-styles.css. Nếu file nào KHÔNG có HTML nào tham chiếu → xóa file đó. Commit: "refactor: cleanup unused legacy css"
```

---

## Prompt 3: Dọn JS Cũ

```
Kiểm tra js/websocket-client.js có HTML nào import không. Nếu không → xóa. Trong js/config.js xóa block WS_CONFIG (WebSocket config). Trong js/kds-app.js tìm và xóa/comment out mọi tham chiếu supabase cũ. Commit: "refactor: remove legacy websocket and supabase code"
```

---

## Prompt 4: Gom Admin Dashboard

```
Tìm tất cả file .html và .js đang có link trỏ về "dashboard/admin" hoặc "dashboard/login". Đổi sang trỏ về "admin/dashboard" và "admin/login" tương ứng. Sửa back-link trong admin/orders.html từ "../dashboard/admin.html" thành "dashboard.html". Sau khi đổi hết references, xóa thư mục dashboard/ cũ. Commit: "refactor: consolidate admin panel references"
```

---

## Prompt 5: Build & Verify

```
Chạy npm ci && npx vite build --mode production. Kiểm tra thư mục dist/ có đầy đủ các file HTML chính (index, menu, checkout, loyalty, admin/dashboard). Nếu build thành công, deploy: npx wrangler pages deploy dist --project-name=fnb-caffe-container --branch=main --commit-dirty=true. Sau đó curl kiểm tra HTTP 200 cho các trang: /, /menu, /checkout, /admin/dashboard.html.
```
