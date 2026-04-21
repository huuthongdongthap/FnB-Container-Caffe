# CTO Task: Go-Live Final — Verify + Deploy

> Priority: P0 | Scope: Full project go-live readiness

## Tasks (tuần tự)

### 1. Verify Order Flow Fix (C1→C5)
```bash
cd /Users/mac/mekong-cli/FnB-Container-Caffe
npx jest tests/order-flow.test.js tests/order-system.test.js tests/checkout.test.js --verbose 2>&1 | tail -30
```
- Nếu FAIL → fix trước khi tiếp

### 2. Verify Realtime Integration (RT-1→RT-6)
- Kiểm tra `js/kds-app.js` đã import `KdsPollClient` chưa
- Kiểm tra `js/track-order.js` không còn WebSocket code
- Kiểm tra `success.html` có poll status không
- Grep: `grep -r "WebSocket\|connectWS\|kdsWebSocket" js/ --include="*.js" -l` → phải trả rỗng (trừ `websocket-client.js`)

### 3. Seed DB Tables (nếu chưa có)
```bash
cd worker
# Check if promotions table exists
npx wrangler d1 execute AURA_DB --command "SELECT name FROM sqlite_master WHERE type='table' AND name='promotions'" --remote 2>&1 | tail -5
# If missing, run schema
# npx wrangler d1 execute AURA_DB --file=../db/schema.sql --remote
```

### 4. Deploy Worker
```bash
cd /Users/mac/mekong-cli/FnB-Container-Caffe/worker
npx wrangler deploy --minify 2>&1 | tail -10
```

### 5. Staging Build + Deploy Pages
```bash
cd /Users/mac/mekong-cli/FnB-Container-Caffe
rm -rf /tmp/fnb-deploy
rsync -av \
  --exclude='export.pdf' --exclude='*.pen' --exclude='node_modules' \
  --exclude='.git' --exclude='*.sqlite*' --exclude='.DS_Store' \
  --exclude='worker/.wrangler' --exclude='_archive' --exclude='plans' \
  --exclude='tasks-done' --exclude='tests' --exclude='docs' \
  --exclude='designs' --exclude='scripts' --exclude='*.txt' \
  --exclude='lighthouse-report.html' --exclude='package-lock.json' \
  . /tmp/fnb-deploy/
npx wrangler pages deploy /tmp/fnb-deploy/ --project-name=fnb-caffe-container --branch=main 2>&1 | tail -10
```

### 6. Health Check
```bash
curl -s https://aura-space-worker.sadec-marketing-hub.workers.dev/api/health | python3 -m json.tool
curl -s https://aura-space-worker.sadec-marketing-hub.workers.dev/api/menu | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'Menu items: {len(d.get(\"data\",[]))}')"
```

### 7. Git Tag + Commit
```bash
cd /Users/mac/mekong-cli/FnB-Container-Caffe
git add -A
git commit -m "deploy: go-live v1.0 — unified order flow + realtime KDS"
git tag -a v1.0.0 -m "Go-live: unified order pipeline, KDS realtime, PayOS integration"
git push origin main --tags
```

## Rules
- Pipe tất cả output qua `tail` để tránh token overflow
- DỪNG NGAY nếu deploy fail → báo lỗi
- KHÔNG sửa code — chỉ verify + deploy
