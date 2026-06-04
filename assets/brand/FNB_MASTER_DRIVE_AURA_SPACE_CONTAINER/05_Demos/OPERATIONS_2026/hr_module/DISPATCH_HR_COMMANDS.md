# 🚀 DISPATCH HR TASKS 19-23 — Mekong CLI Commands

> **Mục đích:** Giao 5 tasks HR cho Claude Code CLI worker
> **Estimated:** 20-26h worker total, spread ~1 tuần calendar
> **Khuyến nghị:** Dispatch sau khai trương 6/6 ổn (8-14/6)

---

## 📊 Plan tổng quan

| Task | Branch | Estimate | Dependency | Calendar |
|---|---|---|---|---|
| 19 | `feat/hr-schema-v1` | 3-4h | Standalone | T2 8/6 |
| 20 | `feat/hr-attendance-qr` | 4-6h | Task 19 | T3 9/6 |
| 21 | `feat/hr-uniform-check` | 3-4h | Tasks 19+20 | T4 10/6 |
| 22 | `feat/hr-performance-review` | 5-6h | Tasks 19+20+21 | T5-T6 11-12/6 |
| 23 | `feat/hr-admin-ui` | 5-6h | Tasks 19-22 | T7-CN 13-14/6 |

---

## 🛤 Workflow lựa chọn

### Option A: Mekong CLI worker (recommended)

```bash
# 1. Pre-check
cd /Users/mac/mekong-cli/FnB-Container-Caffe
git checkout main && git pull
git status --short
tmux list-panes -t mekong-cto:cto-worker 2>&1 | head -3

# 2. Copy 5 task files
SOURCE="$HOME/Documents/AURA_SPACE/05_Demos/OPERATIONS_2026/hr_module"
DEST="/Users/mac/mekong-cli/FnB-Container-Caffe/.claude-tasks/hr"
mkdir -p "$DEST"
cp "$SOURCE"/19-*.md "$SOURCE"/20-*.md "$SOURCE"/21-*.md "$SOURCE"/22-*.md "$SOURCE"/23-*.md "$DEST/"
ls -la "$DEST"

# 3. Dispatch Task 19 trước
./send_task.sh 2 .claude-tasks/hr/19-hr-schema.md
```

### Option B: Em (Claude) dispatch qua GitHub MCP (fallback)

Nếu tmux không ổn, anh chat em "Em dispatch Task 19 HR qua GitHub MCP" — em sẽ tự tạo PR.

---

## 📋 Sequence step-by-step

### Phase 1: T2 08/06 — Task 19 Schema

```bash
# Pre-check + Backup D1 production (BẮT BUỘC)
cd /Users/mac/mekong-cli/FnB-Container-Caffe/worker
npx wrangler d1 export fnb_caffe_db --remote \
  --output=../backups/d1-backup-$(date +%Y%m%d-%H%M%S)-pre-hr.sql

# Dispatch
cd ..
./send_task.sh 2 .claude-tasks/hr/19-hr-schema.md

# Sau worker xong (3-4h), verify
git fetch --all
git branch -a | grep feat/hr-schema-v1
gh pr list --state open --head feat/hr-schema-v1

# Apply local
cd worker
npx wrangler d1 execute fnb_caffe_db --local \
  --file=../db/migrations/20260603_01_hr_schema_v1.sql

# Verify 4 staff seeded
npx wrangler d1 execute fnb_caffe_db --local \
  --command="SELECT id, full_name, department, monthly_salary_vnd FROM staff_profiles ORDER BY monthly_salary_vnd DESC;"
# Expected:
# STAFF_CUONG | Cường R   | barista | 7500000
# STAFF_THU   | Thư PC    | barista | 7000000
# STAFF_KHANH | Khánh PC  | cashier | 6500000
# STAFF_NGOC  | Ngọc      | mixed   | 5000000

# Merge + apply remote
gh pr merge --squash --delete-branch
git pull origin main
npx wrangler d1 execute fnb_caffe_db --remote \
  --file=../db/migrations/20260603_01_hr_schema_v1.sql

# Verify remote
npx wrangler d1 execute fnb_caffe_db --remote \
  --command="SELECT COUNT(*) FROM staff_profiles WHERE is_active=1;"
# Expected: 4
```

### Phase 2: T3 09/06 — Task 20 Attendance QR

```bash
./send_task.sh 2 .claude-tasks/hr/20-hr-attendance-qr.md

# Sau merge → deploy worker
cd worker && npx wrangler deploy

# Smoke test
curl https://aura-space-worker.sadec-marketing-hub.workers.dev/api/hr/staff/qr/STAFF_CUONG
# Expected: SVG response (image/svg+xml)
```

### Phase 3: T4 10/06 — Task 21 Uniform Check

```bash
./send_task.sh 2 .claude-tasks/hr/21-hr-uniform-check.md
```

### Phase 4: T5-T6 11-12/06 — Task 22 Performance Review

```bash
./send_task.sh 2 .claude-tasks/hr/22-hr-performance-review.md

# Sau merge, trigger generate first batch (Q2-2026 cover Apr-Jun)
curl -X POST https://aura-space-worker.sadec-marketing-hub.workers.dev/api/hr/review/generate \
  -H "Authorization: Bearer $OWNER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"period_label":"Q2-2026"}'
# Expected: 4 drafts created
```

### Phase 5: T7-CN 13-14/06 — Task 23 Admin UI

```bash
./send_task.sh 2 .claude-tasks/hr/23-hr-admin-ui.md

# Sau merge:
open https://fnb-caffe-container.pages.dev/admin/hr/index.html

# Print QR cho 4 staff
for s in STAFF_CUONG STAFF_THU STAFF_KHANH STAFF_NGOC; do
  curl -o "qr-$s.svg" "https://aura-space-worker.../api/hr/staff/qr/$s"
done

# In + laminate + đưa cho từng staff
```

---

## ⚡ Quick Deploy script (sau khi 5 PRs sẵn sàng merge)

```bash
cd /Users/mac/mekong-cli/FnB-Container-Caffe && \
echo "═══════════════════════════════════════════" && \
echo "🔄 Sync main" && \
git checkout main && git pull && \
echo "" && \
echo "═══════════════════════════════════════════" && \
for pr in 45 46 47 48 49; do \
  echo "🟢 Merge PR #$pr (HR)" && \
  gh pr merge $pr --squash --delete-branch && \
  git pull origin main; \
done && \
echo "" && \
echo "📥 Apply migrations" && \
cd worker && \
npx wrangler d1 execute fnb_caffe_db --remote --file=../db/migrations/20260603_01_hr_schema_v1.sql && \
echo "" && \
echo "🚀 Deploy worker" && \
npx wrangler deploy && \
echo "" && \
echo "✅ HR Module deployed"
```

→ Note: PR numbers `45-49` là **giả định** — anh check thực tế qua `gh pr list`.

---

## 🔍 Verify production sau full deploy

```bash
echo "═══════════════════════════════════════════"
echo "🔍 Verify HR endpoints"

# 1. Staff list
curl -s https://aura-space-worker.sadec-marketing-hub.workers.dev/api/hr/staff \
  -H "Authorization: Bearer $OWNER_TOKEN" | jq '.data[] | {id, full_name, department}'

# 2. QR generator
curl -I https://aura-space-worker.sadec-marketing-hub.workers.dev/api/hr/staff/qr/STAFF_CUONG
# Expected: 200 OK, Content-Type: image/svg+xml

# 3. Attendance check-in (test)
curl -X POST https://aura-space-worker.sadec-marketing-hub.workers.dev/api/hr/attendance/check-in \
  -H "Content-Type: application/json" \
  -d '{"staff_id":"STAFF_CUONG","shift_type":"morning","source":"manual","expected_in":"06:00","expected_out":"11:00"}'

# 4. Generate Q3 reviews (sau Q3 bắt đầu)
curl -X POST https://aura-space-worker.sadec-marketing-hub.workers.dev/api/hr/review/generate \
  -H "Authorization: Bearer $OWNER_TOKEN" \
  -d '{"period_label":"Q3-2026"}'
```

---

## 🆘 Rollback options

### Trường hợp 1: Schema migration lỗi (Task 19)

```bash
# Restore từ backup pre-HR
cd /Users/mac/mekong-cli/FnB-Container-Caffe/worker
LATEST=$(ls -t ../backups/d1-backup-*-pre-hr.sql | head -1)
npx wrangler d1 execute fnb_caffe_db --remote --file="$LATEST"
```

### Trường hợp 2: QR security lo lắng

```bash
# Tạm tắt endpoint QR
# Edit worker/src/routes/hr-attendance.js → comment route GET /staff/qr
git revert <PR-Task-20-merge-sha>
git push origin main
cd worker && npx wrangler deploy
```

### Trường hợp 3: Performance review tính sai

```bash
# Bỏ rows draft, generate lại
npx wrangler d1 execute fnb_caffe_db --remote \
  --command="DELETE FROM performance_review WHERE period_label='Q3-2026' AND status='draft';"

# Re-generate
curl -X POST .../api/hr/review/generate -d '{"period_label":"Q3-2026"}'
```

---

## 📞 Notify em khi

- ✅ Worker xong Task 19 (schema) — em verify migration
- ⚠ Worker stuck > 1h không output
- ❌ Migration fail
- ⚠ QR signature verification fail
- ✅ Tất cả 5 PRs merged — em verify production

---

## ⏭ Sau khi 5 PRs merged

### 1. Train staff (1 buổi sáng 15/6)

- 30 phút mỗi staff:
  - Cài app/web vào điện thoại
  - Scan QR cá nhân test check-in/out
  - Show admin/hr/index dashboard
  - Khánh: train uniform check (vì manager ca chiều)

### 2. Update SOP (em sẽ làm)

File `01_OPENING_CHECKLIST.md` + `02_CLOSING_CHECKLIST.md` — link URL chấm công chính xác:
- Cũ: "App chấm công của AURA"
- Mới: `https://fnb-caffe-container.pages.dev/staff/checkin?staff_id=...` (qua QR)

### 3. Print QR cho 4 staff

A6 size, laminate, gắn móc khoá → mỗi staff đeo theo người.

### 4. First review Q2-2026 (cuối tháng 6)

- T2 30/6: anh + em meeting 1 tiếng
- Generate Q2 reviews
- Anh fill manual scores (quality/attitude/teamwork) cho 4 staff
- Sign + meet 1-1 từng staff

---

## ✅ Summary

Sau full deploy HR Module:

**Backend (D1 + Workers):**
- ✅ 4 staff với monthly salary (7.5/7.0/6.5/5tr)
- ✅ 6 attendance endpoints + QR signature security
- ✅ 3 uniform check endpoints với 5-item checklist
- ✅ 4 review endpoints với quarterly auto-generate
- ✅ Auto-calc 2 KPI (punctuality, uniform) từ data

**Frontend:**
- ✅ 1 staff checkin page mobile (QR landing)
- ✅ 7 admin pages (dashboard, staff CRUD, timesheet, uniform check, review, payroll, reports)

**Process:**
- ✅ Quy trình chấm công digital qua QR (thay Excel BCC)
- ✅ Quy trình check đồng phục daily với 5-item rule
- ✅ Quy trình đánh giá quarterly với 5 KPI weighted

→ **AURA CAFE sẵn sàng quản lý 4 staff + scale lên 8-12 staff trong tương lai.**
