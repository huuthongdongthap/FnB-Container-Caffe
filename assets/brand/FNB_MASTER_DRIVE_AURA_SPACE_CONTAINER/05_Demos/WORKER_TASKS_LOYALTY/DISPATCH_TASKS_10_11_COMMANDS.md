# 🚀 DISPATCH TASKS 10 + 11 — Mekong CLI Commands

> **Mục đích:** Soạn commands cho anh chạy 2 P0 tasks còn lại trong Claude Code CLI worker
> **Còn lại:** Task 10 (signup page + QR), Task 11 (thẻ giấy + POS wallet)
> **Tasks đã xong:** Task 08 (migration applied ✅) + Task 09 (PR #26 open ✅)

---

## 🔧 Pre-flight setup (chỉ chạy 1 lần)

### Verify tmux session
```bash
# Check tmux session đã có chưa
tmux has-session -t mekong-cto 2>/dev/null && echo "✅ Session exists" || echo "❌ Need to create"

# Nếu chưa có session:
tmux new-session -d -s mekong-cto -x 220 -y 50
tmux new-window -t mekong-cto -n cto-worker

# Verify pane number (default = 2 per mekong.config.yaml)
tmux list-panes -t mekong-cto:cto-worker -F '#{pane_index} #{pane_current_command}'
```

### Source tasks path setup
```bash
# Verify Cowork workspace path
SOURCE="$HOME/Documents/AURA_SPACE/05_Demos/WORKER_TASKS_LOYALTY"
ls "$SOURCE" 2>/dev/null || {
  echo "⚠️ Adjust SOURCE path nếu folder khác"
  ls $HOME/Documents/*AURA* 2>/dev/null
  ls $HOME/Documents/*FNB* 2>/dev/null
}

# Set destination
REPO="/Users/mac/mekong-cli/FnB-Container-Caffe"
DEST="$REPO/.claude-tasks/loyalty"
mkdir -p "$DEST"
```

---

## 📋 Workflow chuẩn cho mỗi task

```
1. Verify trạng thái git (clean main, no pending PR conflict)
2. Copy task file vào local repo
3. Dispatch qua send_task.sh
4. Wait worker xong (~2h mỗi task)
5. Review PR trên GitHub
6. Test local nếu cần
7. Merge PR
8. Deploy worker production nếu cần
9. Verify production endpoint
10. Move sang task tiếp theo
```

---

## 🚀 TASK 10 — Public Signup Page + QR Generator (~2h)

### Pre-check
```bash
cd /Users/mac/mekong-cli/FnB-Container-Caffe

# Verify PR #26 đã merged (Task 09 — code logic backend)
gh pr view 26 --json state | grep state
# Expected: "state":"MERGED"

# Nếu chưa merged, đợi merge trước khi dispatch Task 10
# Task 10 (frontend) cần Task 09 (active-campaign endpoint) đã live

# Sync main
git checkout main && git pull origin main
git status --short  # Expected: empty
```

### Copy task file
```bash
SOURCE="$HOME/Documents/AURA_SPACE/05_Demos/WORKER_TASKS_LOYALTY"
DEST="/Users/mac/mekong-cli/FnB-Container-Caffe/.claude-tasks/loyalty"

cp "$SOURCE/10-signup-page-qr.md" "$DEST/"
wc -l "$DEST/10-signup-page-qr.md"
# Expected: ~580+ lines
```

### Dispatch
```bash
cd /Users/mac/mekong-cli/FnB-Container-Caffe
./send_task.sh 2 .claude-tasks/loyalty/10-signup-page-qr.md
```

**Worker sẽ:**
- Tạo branch `feat/loyalty-signup-page-qr`
- Tạo `dang-ky-thanh-vien.html` (mobile-first form)
- Tạo `js/signup-loyalty.js`
- Update `_redirects`
- Tạo `scripts/generate-qr-signup.js`
- Generate 3 QR PNG files (standee/leaflet/receipt)
- Test trên local
- Push branch + open PR

### Verify sau khi worker xong
```bash
cd /Users/mac/mekong-cli/FnB-Container-Caffe
git fetch origin
git checkout feat/loyalty-signup-page-qr
git pull origin feat/loyalty-signup-page-qr

# 1. Verify files mới
ls -la dang-ky-thanh-vien.html
ls -la js/signup-loyalty.js
ls -la scripts/generate-qr-signup.js
ls -la public/qr/ 2>/dev/null

# 2. Test local
python3 -m http.server 8000 &
SERVER_PID=$!
sleep 2

# 3. Verify page accessible
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8000/dang-ky-thanh-vien
# Expected: 200

# 4. Quick visual check
open "http://localhost:8000/dang-ky-thanh-vien"
# Browser sẽ mở page mobile-first

kill $SERVER_PID

# 5. Review PR
gh pr view --web
```

### Merge sau khi review OK
```bash
gh pr merge --squash --delete-branch
git checkout main && git pull origin main
```

### Deploy production
```bash
# Cloudflare Pages auto-deploy từ main branch
# Verify production live:
curl -s -o /dev/null -w "%{http_code}\n" https://fnb-caffe-container.pages.dev/dang-ky-thanh-vien
# Expected: 200

# Test active-campaign endpoint (from Task 09)
curl https://fnb-caffe-container.pages.dev/api/loyalty/active-campaign | jq
# Expected: campaign.code = GRAND_OPENING_6_6_2026
```

### In QR code prep
```bash
# Verify QR files generated
ls -la public/qr/
# Expected:
#   qr-signup-standee.png (1200x1200)
#   qr-signup-leaflet.png (600x600)
#   qr-signup-receipt.png (300x300)

# Send file PNG cho shop in Sa Đéc để in:
# - 2 standee X (90x180cm) với QR signup-standee
# - 500 leaflet A5 với QR signup-leaflet
```

---

## 🪪 TASK 11 — Membership Card + POS Wallet (~2h)

### Pre-check
```bash
cd /Users/mac/mekong-cli/FnB-Container-Caffe

# Verify Task 10 merged
gh pr list --state merged --head feat/loyalty-signup-page-qr | head -1

# Verify puppeteer dependency (cho script generate cards)
ls node_modules/puppeteer 2>/dev/null || npm install puppeteer --save-dev

# Sync main
git checkout main && git pull origin main
```

### Copy task file
```bash
SOURCE="$HOME/Documents/AURA_SPACE/05_Demos/WORKER_TASKS_LOYALTY"
DEST="/Users/mac/mekong-cli/FnB-Container-Caffe/.claude-tasks/loyalty"

cp "$SOURCE/11-membership-card-pos.md" "$DEST/"
```

### Dispatch
```bash
cd /Users/mac/mekong-cli/FnB-Container-Caffe
./send_task.sh 2 .claude-tasks/loyalty/11-membership-card-pos.md
```

**Worker sẽ:**
- Tạo branch `feat/loyalty-card-pos-display`
- Tạo `designs/membership-card-template.html` (90×54mm card)
- Tạo `scripts/generate-member-cards.js` (puppeteer PDF batch)
- Update `js/pos.js` + `css/pos.css` (wallet panel)
- Update `receipt-template.html` (loyalty section + QR)
- Tạo `designs/standee-cach-dung-vi.svg` (A1 standee)
- Update `worker/src/routes/loyalty.js` `/lookup` endpoint enhanced
- Push branch + open PR

### Verify sau khi worker xong
```bash
cd /Users/mac/mekong-cli/FnB-Container-Caffe
git fetch origin
git checkout feat/loyalty-card-pos-display
git pull

# 1. Verify files mới
ls -la designs/membership-card-template.html
ls -la designs/standee-cach-dung-vi.svg
ls -la scripts/generate-member-cards.js

# 2. Test thẻ giấy template render (mở browser)
python3 -m http.server 8000 &
SERVER_PID=$!
sleep 2
open "http://localhost:8000/designs/membership-card-template.html"
# Verify: 10 thẻ render đẹp trên A4

# 3. Test POS hiển thị ví đẹp
open "http://localhost:8000/pos.html"
# Login admin + lookup SĐT → wallet panel hiển thị

kill $SERVER_PID

# 4. Test script generate cards (cần có member trong D1 production)
node scripts/generate-member-cards.js 10 designs/cards-test-batch.pdf
# Output: designs/cards-test-batch.pdf (10 thẻ in)
open designs/cards-test-batch.pdf

# 5. Review PR
gh pr view --web
```

### Merge + deploy
```bash
gh pr merge --squash --delete-branch
git checkout main && git pull
cd worker && npx wrangler deploy
```

---

## 📊 Sau Task 11 → Ready cho 6/6

Sau khi merge Task 10 + 11:
- ✅ Backend logic (Task 09): cashback + idempotency + campaigns
- ✅ Database (Task 08): 4 tier + bonus campaigns + audit log
- ✅ Public signup (Task 10): /dang-ky-thanh-vien + QR codes
- ✅ POS wallet (Task 11): thẻ giấy + receipt + standee

→ Ready cho khai trương 06/06. Tasks 12 (admin dashboard) + 13 (Zalo OA) chạy POST-LAUNCH.

---

## 🆘 Troubleshooting nếu worker fail

### Lỗi: worker timeout (>30 phút không output)
```bash
# Check pane content
tmux capture-pane -t mekong-cto:cto-worker -p | tail -50

# Restart worker session nếu cần
tmux kill-session -t mekong-cto
tmux new-session -d -s mekong-cto -x 220 -y 50
tmux new-window -t mekong-cto -n cto-worker
# Dispatch lại
```

### Lỗi: rate limit Claude API
```bash
# Đợi ~10 phút rồi dispatch lại
# Hoặc switch sang em làm trực tiếp qua GitHub MCP (như Task 08 + 09)
```

### Lỗi: PR conflict với main
```bash
cd /Users/mac/mekong-cli/FnB-Container-Caffe
git checkout feat/loyalty-signup-page-qr  # hoặc branch tương ứng
git fetch origin
git rebase origin/main
# Resolve conflicts manually
git rebase --continue
git push --force-with-lease origin feat/loyalty-signup-page-qr
```

### Lỗi: tests fail
```bash
# Worker thường run tests trước khi commit
# Nếu fail, check log:
tmux capture-pane -t mekong-cto:cto-worker -p | grep -A 5 "FAIL\|Error"

# Fix locally rồi push update
```

---

## 📅 Estimated timeline

| Step | Time |
|---|---|
| Pre-flight setup | 5 phút |
| Task 10 dispatch + worker run | 2h (worker autonomous) |
| Anh review + merge PR Task 10 | 15 phút |
| Cloudflare auto-deploy + verify | 5 phút |
| **Task 10 total** | **~2.5h** |
| Task 11 dispatch + worker run | 2h |
| Anh review + merge PR Task 11 | 15 phút |
| Worker deploy production | 5 phút |
| **Task 11 total** | **~2.5h** |
| **GRAND TOTAL** | **~5h** |

→ Có thể chạy SONG SONG (Task 10 worker đang chạy → anh trở lại sau ~2h, rồi review + merge → dispatch Task 11) hoặc TUẦN TỰ (chờ Task 10 xong hẳn rồi mới Task 11).

---

## ⚡ Quick start — copy paste 1 lần cho Task 10

```bash
# COMBINED BLOCK — Pre-check + Copy + Dispatch Task 10
cd /Users/mac/mekong-cli/FnB-Container-Caffe && \
git checkout main && git pull origin main && \
git status --short && \
chmod +x send_task.sh && \
mkdir -p .claude-tasks/loyalty && \
SOURCE="$HOME/Documents/AURA_SPACE/05_Demos/WORKER_TASKS_LOYALTY" && \
cp "$SOURCE/10-signup-page-qr.md" .claude-tasks/loyalty/ && \
echo "✅ Setup done — dispatching Task 10..." && \
./send_task.sh 2 .claude-tasks/loyalty/10-signup-page-qr.md
```

## ⚡ Quick start — copy paste 1 lần cho Task 11 (sau khi Task 10 merged)

```bash
# COMBINED BLOCK — Pre-check + Copy + Dispatch Task 11
cd /Users/mac/mekong-cli/FnB-Container-Caffe && \
git checkout main && git pull origin main && \
ls node_modules/puppeteer 2>/dev/null || npm install puppeteer --save-dev && \
SOURCE="$HOME/Documents/AURA_SPACE/05_Demos/WORKER_TASKS_LOYALTY" && \
cp "$SOURCE/11-membership-card-pos.md" .claude-tasks/loyalty/ && \
echo "✅ Setup done — dispatching Task 11..." && \
./send_task.sh 2 .claude-tasks/loyalty/11-membership-card-pos.md
```

---

## 📡 Em standby

Sau khi anh dispatch:
- Em theo dõi qua PR notification trên GitHub
- Anh báo em khi PR open → em review + suggest improvements
- Anh báo nếu worker fail → em fallback dùng GitHub MCP làm trực tiếp (như Task 08 + 09)

🎯 **Mục tiêu:** Hoàn tất P0 (Task 10 + 11) trong 18-21/5 → còn 16-13 ngày để test + marketing trước launch 06/06.
