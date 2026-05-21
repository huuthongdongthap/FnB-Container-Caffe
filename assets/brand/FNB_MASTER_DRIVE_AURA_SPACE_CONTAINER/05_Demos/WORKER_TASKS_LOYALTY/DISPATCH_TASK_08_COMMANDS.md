# 🚀 DISPATCH TASK 08 — Commands cho Mekong CLI

> **Mục đích:** Chạy `08-loyalty-schema-v2.md` qua Claude Code CLI worker (pane 2 = cto-worker)
> **Estimated:** 2h worker autonomous → 1 PR
> **Date:** 18/05/2026 (T2, chiều)

---

## 📋 Pre-check (1 phút)

```bash
# 1. Verify Mekong CLI environment
tmux list-panes -t mekong-cto:cto-worker 2>&1 | head -5

# 2. Verify repo tồn tại + clean working tree
cd /Users/mac/mekong-cli/FnB-Container-Caffe
git status --short
git log --oneline -3

# 3. Verify send_task.sh executable
ls -la send_task.sh && [ -x send_task.sh ] && echo "✅ send_task.sh OK" || chmod +x send_task.sh
```

**Nếu git status có changes:** stash trước
```bash
git stash push -m "before-task-08-dispatch"
```

---

## 🗄 Step 1 — Backup D1 production (BẮT BUỘC trước migration)

```bash
cd /Users/mac/mekong-cli/FnB-Container-Caffe/worker

# Backup full D1 production → file SQL
npx wrangler d1 export fnb_caffe_db \
  --remote \
  --output=../backups/d1-backup-$(date +%Y%m%d-%H%M%S)-pre-task08.sql

# Verify backup file exists + size > 0
ls -la ../backups/ | tail -5

cd ..
```

**Nếu folder `backups/` chưa có:**
```bash
mkdir -p /Users/mac/mekong-cli/FnB-Container-Caffe/backups
```

---

## 📥 Step 2 — Copy task file từ Cowork workspace → local repo

```bash
# Adjust path nếu workspace Cowork ở chỗ khác
SOURCE="$HOME/Documents/AURA_SPACE/05_Demos/WORKER_TASKS_LOYALTY"
# Hoặc nếu folder Cowork tên khác — adjust theo thực tế anh thấy
# SOURCE="$HOME/Documents/FNB_MASTER_DRIVE_AURA_SPACE_CONTAINER/05_Demos/WORKER_TASKS_LOYALTY"

# Verify source folder exists
ls -la "$SOURCE" || echo "❌ Source folder không tồn tại — adjust SOURCE path"

# Create destination + copy
DEST="/Users/mac/mekong-cli/FnB-Container-Caffe/.claude-tasks/loyalty"
mkdir -p "$DEST"
cp "$SOURCE/08-loyalty-schema-v2.md" "$DEST/"

# Verify file copied
ls -la "$DEST/08-loyalty-schema-v2.md"
wc -l "$DEST/08-loyalty-schema-v2.md"  # Expected ~280 lines
```

---

## 🚀 Step 3 — Dispatch Task 08 qua send_task.sh

```bash
cd /Users/mac/mekong-cli/FnB-Container-Caffe

# Dispatch — blocking command, sẽ đợi worker xong (~2h)
./send_task.sh 2 .claude-tasks/loyalty/08-loyalty-schema-v2.md
```

**Lưu ý:**
- `2` = pane number cto-worker (theo mekong.config.yaml)
- Terminal sẽ block đến khi worker complete
- Worker output stream sẽ hiển thị real-time
- Nếu muốn detach + xem progress sau: `Ctrl+B d` rồi `tmux attach -t mekong-cto`

---

## 📊 Step 4 — Monitor progress (terminal 2, optional)

Mở terminal khác (hoặc tmux split) để monitor:

```bash
# Watch git activity trên branch mới
watch -n 5 'cd /Users/mac/mekong-cli/FnB-Container-Caffe && git log --all --oneline -10 2>/dev/null'

# Hoặc check pane output trực tiếp
tmux capture-pane -t mekong-cto:cto-worker -p | tail -30
```

---

## ✅ Step 5 — Verify sau khi worker xong

```bash
cd /Users/mac/mekong-cli/FnB-Container-Caffe

# 1. Verify branch tạo
git branch -a | grep feat/loyalty-schema-v2-launch

# 2. Verify migration file tạo
ls -la db/migrations/20260518_03_loyalty_v2_launch.sql

# 3. Verify migration applied trên local D1
cd worker
npx wrangler d1 execute fnb_caffe_db --local \
  --command="SELECT name, cashback_rate, expiry_days FROM loyalty_tiers ORDER BY sort_order;"

# Expected output: 4 rows
# bronze   | 0.03 | 90
# silver   | 0.05 | 120
# gold     | 0.07 | 180
# platinum | 0.10 | (null)

# 4. Verify campaign seeded
npx wrangler d1 execute fnb_caffe_db --local \
  --command="SELECT code, name, cashback_multiplier, signup_bonus_vnd, start_date, end_date FROM bonus_campaigns WHERE active=1;"

# Expected: GRAND_OPENING_6_6_2026, x2.0, +50000, 2026-06-06, 2026-06-08

# 5. Verify UNIQUE constraint (idempotency)
npx wrangler d1 execute fnb_caffe_db --local \
  --command="SELECT name FROM sqlite_master WHERE type='index' AND name LIKE '%order_earn%';"

cd ..

# 6. Verify PR opened
gh pr list --state open --head feat/loyalty-schema-v2-launch
```

---

## 🔍 Step 6 — Review PR trên GitHub

```bash
# Open PR trong browser
gh pr view --web

# Hoặc xem trực tiếp:
# https://github.com/huuthongdongthap/FnB-Container-Caffe/pulls
```

**Review checklist:**
- [ ] File `db/migrations/20260518_03_loyalty_v2_launch.sql` có đầy đủ 10 sections (4 tier, expires_at, UNIQUE constraint, bonus_campaigns, signup_bonus_log, audit_log)
- [ ] Campaign code = `GRAND_OPENING_6_6_2026` (KHÔNG phải 28_5)
- [ ] start_date = `2026-06-06`, end_date = `2026-06-08 23:59:59`
- [ ] Migration KHÔNG xóa data cũ — chỉ ALTER + INSERT
- [ ] PR title: "feat(loyalty): schema v2 — 4 tier + campaigns + idempotency"

---

## 🟢 Step 7 — Merge PR

```bash
# Approve + merge từ terminal
gh pr merge --squash --delete-branch

# Hoặc merge từ GitHub UI nếu muốn review kỹ hơn
```

---

## 📡 Step 8 — Apply migration trên D1 REMOTE (production)

⚠️ **QUAN TRỌNG**: Worker chỉ apply migration trên `--local`. Anh phải apply remote thủ công.

```bash
cd /Users/mac/mekong-cli/FnB-Container-Caffe/worker

# Apply migration production
npx wrangler d1 execute fnb_caffe_db --remote \
  --file=../db/migrations/20260518_03_loyalty_v2_launch.sql

# Verify production
npx wrangler d1 execute fnb_caffe_db --remote \
  --command="SELECT name, cashback_rate FROM loyalty_tiers ORDER BY sort_order;"

npx wrangler d1 execute fnb_caffe_db --remote \
  --command="SELECT code, signup_bonus_vnd FROM bonus_campaigns WHERE active=1;"

cd ..
```

---

## 🆘 Rollback nếu lỗi

### Trường hợp 1: Migration local fail
```bash
# Xóa local D1 + recreate
cd worker
rm -rf .wrangler/state/v3/d1
# Re-apply tất cả migrations từ đầu
for f in ../db/migrations/*.sql; do
  npx wrangler d1 execute fnb_caffe_db --local --file="$f"
done
```

### Trường hợp 2: Migration remote fail (nguy hiểm hơn)
```bash
# Restore từ backup
cd /Users/mac/mekong-cli/FnB-Container-Caffe/worker
npx wrangler d1 execute fnb_caffe_db --remote \
  --file=../backups/d1-backup-YYYYMMDD-HHMMSS-pre-task08.sql
```

### Trường hợp 3: PR sai/cần revert
```bash
git revert <merge-commit-sha>
git push origin main
```

---

## ⏭ Sau khi Task 08 xong → Tiếp Task 09

```bash
# Verify Task 08 hoàn toàn merged + DB applied
cd /Users/mac/mekong-cli/FnB-Container-Caffe
git checkout main && git pull origin main

# Copy + dispatch Task 09
cp "$SOURCE/09-loyalty-bonus-campaigns.md" .claude-tasks/loyalty/
./send_task.sh 2 .claude-tasks/loyalty/09-loyalty-bonus-campaigns.md
```

---

## 📞 Em standby

Trong khi worker chạy:
- ✅ Anh có thể tiếp tục checklist daily 18/5 (transfer 1tr deposit, list KOL, đặt standee)
- 📱 Anh có thể ping em qua chat Cowork nếu có lỗi
- 🕐 Estimate worker hoàn thành: ~2h từ lúc dispatch (output PR trên GitHub)

**Báo em khi:**
- Worker stuck > 30 phút không có output
- PR mở rồi nhưng có conflict với main
- Migration apply remote bị lỗi

---

## 🎯 Summary commands (copy-paste 1 lần)

```bash
# Pre-check + Backup + Copy + Dispatch — trong 1 block
cd /Users/mac/mekong-cli/FnB-Container-Caffe && \
git status --short && \
chmod +x send_task.sh && \
mkdir -p backups .claude-tasks/loyalty && \
cd worker && \
npx wrangler d1 export fnb_caffe_db --remote --output=../backups/d1-backup-$(date +%Y%m%d-%H%M%S)-pre-task08.sql && \
cd .. && \
SOURCE="$HOME/Documents/AURA_SPACE/05_Demos/WORKER_TASKS_LOYALTY" && \
cp "$SOURCE/08-loyalty-schema-v2.md" .claude-tasks/loyalty/ && \
echo "✅ Setup done — dispatching Task 08..." && \
./send_task.sh 2 .claude-tasks/loyalty/08-loyalty-schema-v2.md
```

→ Block trên chạy: pre-check → backup → copy task → dispatch — tổng 5-10 phút setup + 2h worker run.
