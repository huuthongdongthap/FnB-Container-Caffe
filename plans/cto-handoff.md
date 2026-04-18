# CTO Handoff Plan — FnB-Container-Caffe

## Tình trạng hiện tại

| Item | Status | Deploy |
|------|--------|--------|
| Checkout unicode encoding | ✅ Fixed (225 sequences) | `eca9677e` |
| Admin login CSP blocking | ✅ Fixed | `b328e9ef` |
| Dashboard data mapping | ✅ Fixed (field mapping worker→renderer) | `eca9677e` |
| Live URL | [fnb-caffe-container.pages.dev](https://fnb-caffe-container.pages.dev) | |
| Worker | `aura-space-worker.sadec-marketing-hub.workers.dev` | |

---

## Bug Tasks cho CTO

### Task 1: Verify Dashboard Live Data (HIGH)
- **Mô tả**: Dashboard đã sửa mapping (`customer_name` → `customer.full_name`, `status` → `order_status`) nhưng chưa verify trên production
- **File**: `dashboard/dashboard.js`, `dashboard/admin.html`
- **Action**: Đăng nhập admin → kiểm tra tab Dashboard + Orders có hiển thị order `ORD_mo3pe54i17vr6`
- **Nếu lỗi**: Check console errors, CSP blocking, hoặc field mapping sai

### Task 2: Scan Unicode Encoding Toàn Bộ (MEDIUM)
- **Mô tả**: `checkout.html` đã fix 225 sequences. Cần scan các file .html khác có bị tương tự
- **Command**: `grep -r '\\\\u[0-9a-fA-F]\{4\}' --include='*.html' .`
- **Action**: Nếu tìm thấy, chạy cùng script fix unicode đã dùng

### Task 3: Test E2E Order Flow (HIGH)
- **Mô tả**: Flow Menu → Cart → Checkout → COD → Success → Admin Dashboard
- **Action**: Đặt 1 đơn test, verify hiện trên admin dashboard real-time
- **File liên quan**: `menu.html`, `checkout.html`, `success.html`, `dashboard/admin.html`

### Task 4: Audit `_headers` CSP cho tất cả pages (LOW)
- **Mô tả**: CSP đã fix cho admin login + checkout, nhưng cần audit toàn bộ
- **File**: `_headers`
- **Check**: Tất cả external resources (fonts, images, API) phải có trong CSP directives

### Task 5: Static Data Cleanup (MEDIUM)
- **Mô tả**: Dashboard tab vẫn còn hardcoded stats (doanh thu ₫24.5M, 156 đơn, giờ cao điểm)
- **File**: `dashboard/admin.html` lines 204-570
- **Action**: Stats cards, revenue chart, order status bars, peak hours — tất cả nên render từ `/api/stats`

### Task 6: Wrangler Config Warning (LOW)
- **Mô tả**: Deploy warning về missing `pages_build_output_dir` trong `wrangler.toml`
- **Fix**: Thêm `pages_build_output_dir = "."` vào `wrangler.toml`

---

## CTO Execution

### Command
```bash
cd ~/mekong-cli/FnB-Container-Caffe
bash ../scripts/cto-worker.sh "Execute tasks 1-6 from plans/cto-handoff.md. Follow RULES strictly."
```

### Hoặc Manual
```bash
cd ~/mekong-cli/FnB-Container-Caffe
claude --dangerously-skip-permissions
```

---

## RULES — Không được vi phạm

1. **Atomic commits** — 1 task = 1 commit, message rõ ràng
2. **Không refactor** — chỉ fix bug, không đổi architecture
3. **Không thêm dependencies** — không `npm install` gì mới
4. **Không sửa Worker bindings** — D1 schema, KV namespace giữ nguyên
5. **Deploy staging trước** — `npx wrangler pages deploy /tmp/fnb-deploy/ --project-name=fnb-caffe-container --branch=staging`
6. **Verify bằng browser** — phải check visual output, không chỉ console
7. **Exclude large files** — `export.pdf`, `*.pen` không được deploy
8. **Backup trước khi sửa** — `git stash` hoặc `git branch backup-<date>`

---

## Deploy SOP

```bash
# 1. Build staging
rm -rf /tmp/fnb-deploy
rsync -av --exclude='export.pdf' --exclude='*.pen' --exclude='node_modules' \
  --exclude='.git' --exclude='*.sqlite*' --exclude='.DS_Store' \
  --exclude='worker/.wrangler' --exclude='_archive' --exclude='plans' \
  --exclude='tasks-done' --exclude='tests' --exclude='docs' \
  --exclude='designs' --exclude='scripts' --exclude='*.txt' \
  --exclude='lighthouse-report.html' --exclude='package-lock.json' \
  . /tmp/fnb-deploy/

# 2. Deploy
npx wrangler pages deploy /tmp/fnb-deploy/ --project-name=fnb-caffe-container --branch=main

# 3. Git
git add -A && git commit -m "🐛 fix: [description]" && git push origin main
```

## Verification Checklist

- [ ] Admin login works at `/dashboard/login`
- [ ] Dashboard shows real orders from D1
- [ ] Checkout page Vietnamese text correct
- [ ] COD order flow completes successfully
- [ ] No console errors on any page
- [ ] CSP headers not blocking any resources
