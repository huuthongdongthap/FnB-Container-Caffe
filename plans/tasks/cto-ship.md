# CTO Task: SHIP — Push code + Deploy Worker + Deploy Pages

> Priority: P0 | Ship tất cả code mới nhất lên production

## Steps (tuần tự)

### 1. Git push
```bash
cd /Users/mac/mekong-cli/FnB-Container-Caffe
git add -A
git status | head -20
git commit -m "ship: all fixes — order flow, KDS, checkout, cache busting" 2>&1 | tail -5
git push 2>&1 | tail -5
```

### 2. Deploy Worker
```bash
cd /Users/mac/mekong-cli/FnB-Container-Caffe/worker
npx wrangler deploy --minify 2>&1 | tail -5
```

### 3. Deploy Pages
```bash
cd /Users/mac/mekong-cli/FnB-Container-Caffe
rm -rf /tmp/fnb-deploy
rsync -av \
  --exclude='*.pen' --exclude='node_modules' --exclude='.git' \
  --exclude='*.sqlite*' --exclude='.DS_Store' --exclude='worker/.wrangler' \
  --exclude='_archive' --exclude='plans' --exclude='tasks-done' \
  --exclude='tests' --exclude='docs' --exclude='designs' \
  --exclude='scripts' --exclude='*.txt' --exclude='package-lock.json' \
  --exclude='export.pdf' \
  . /tmp/fnb-deploy/ 2>&1 | tail -3
npx wrangler pages deploy /tmp/fnb-deploy/ --project-name=fnb-caffe-container --branch=main 2>&1 | tail -5
```

### 4. Health Check
```bash
curl -s https://aura-space-worker.sadec-marketing-hub.workers.dev/api/health
curl -s -o /dev/null -w "Domain: %{http_code}\n" https://auraspace.cafe/checkout
```

## Rules
- Pipe output qua `tail`
- DỪNG nếu deploy fail
