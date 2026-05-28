# 🚀 DISPATCH INVENTORY TASKS 14-18 — Commands

> **Mục đích:** Chạy 5 tasks Inventory qua Mekong CLI hoặc fallback GitHub MCP
> **Estimated:** ~24-34h worker total, spread 4-6 ngày calendar
> **Khuyến nghị:** Bắt đầu sau khi merge xong 3 PR loyalty (#27, #28, #29)

---

## 📊 Plan tổng quan

| Task | Branch | Estimate | Run after | Critical for 6/6 launch? |
|---|---|---|---|---|
| 14 | `feat/inventory-schema-v1` | 4-6h | (start) | ⚠ Nên có trước 6/6 |
| 15 | `feat/inventory-receiving-po` | 4-6h | Task 14 | Không bắt buộc, có thể sau 6/6 |
| 16 | `feat/inventory-recipe-deduct` | 6-8h | Task 14 | ❌ Sau 6/6 (cần test kỹ) |
| 17 | `feat/inventory-waste-cogs` | 4-6h | Tasks 14, 16 | Sau 6/6 |
| 18 | `feat/inventory-admin-ui` | 6-8h | Tasks 14-17 | Sau 6/6 |

→ **Khuyến nghị mạnh: Task 14 trước 6/6** để có baseline schema + data migration. Task 15-18 dispatch sau khai trương (8/6 trở đi) để team focus vận hành.

---

## 🛤 Lựa chọn workflow

### Option A: Mekong CLI worker (Recommended nếu tmux ổn định)

```bash
# 1. Pre-check tmux
tmux list-panes -t mekong-cto:cto-worker 2>&1 | head -5

# 2. Verify repo clean
cd /Users/mac/mekong-cli/FnB-Container-Caffe
git checkout main && git pull origin main
git status --short

# 3. Copy task files
SOURCE="$HOME/Documents/AURA_SPACE/05_Demos/OPERATIONS_2026/inventory_plan"
DEST="/Users/mac/mekong-cli/FnB-Container-Caffe/.claude-tasks/inventory"
mkdir -p "$DEST"
cp "$SOURCE"/14-*.md "$SOURCE"/15-*.md "$SOURCE"/16-*.md "$SOURCE"/17-*.md "$SOURCE"/18-*.md "$DEST/"
ls -la "$DEST/"

# 4. Dispatch Task 14 trước
./send_task.sh 2 .claude-tasks/inventory/14-inventory-schema-multi-supplier.md
```

### Option B: Em (Claude) dispatch qua GitHub MCP (fallback)

Nếu tmux không ổn, em sẽ tự tạo PR trực tiếp tương tự cách đã làm với task 08, 09 (PR #25, #26).

```
Anh chat: "Em dispatch Task 14 inventory qua GitHub MCP"
Em sẽ:
1. Create branch feat/inventory-schema-v1
2. Tạo migration SQL file
3. Tạo routes file mới
4. Mở PR mô tả full
5. Anh review + merge
```

---

## 📋 Sequence — Cách dispatch optimal

### Phase 1 (29-31/5, before launch — chỉ Task 14)

#### Step 1: Backup D1 production trước migration

```bash
cd /Users/mac/mekong-cli/FnB-Container-Caffe/worker
mkdir -p ../backups

npx wrangler d1 export fnb_caffe_db \
  --remote \
  --output=../backups/d1-backup-$(date +%Y%m%d-%H%M%S)-pre-inventory.sql

ls -la ../backups/ | tail -3
cd ..
```

#### Step 2: Verify Excel data freeze
**Quan trọng:** Anh phải khoá sheet NGUYÊN LIỆU Excel cuối ngày 31/5. Sau đó dùng "đầu kỳ" để init opening_balance.

```bash
# Kiểm tra file Excel có đủ data đầu kỳ
# (Sheet NGUYÊN LIỆU cột "Đầu kỳ" phải đầy đủ 41 dòng)
```

#### Step 3: Dispatch Task 14

```bash
cd /Users/mac/mekong-cli/FnB-Container-Caffe
./send_task.sh 2 .claude-tasks/inventory/14-inventory-schema-multi-supplier.md
```

#### Step 4: Sau khi worker xong → Verify

```bash
# 1. Verify branch + PR
git fetch --all
git branch -a | grep feat/inventory-schema-v1
gh pr list --state open --head feat/inventory-schema-v1

# 2. Pull branch local
git checkout feat/inventory-schema-v1
git pull

# 3. Apply migration --local
cd worker
npx wrangler d1 execute fnb_caffe_db --local \
  --file=../db/migrations/20260527_01_inventory_v1.sql

# 4. Verify 41 ingredients
npx wrangler d1 execute fnb_caffe_db --local \
  --command="SELECT COUNT(*) FROM ingredients WHERE is_active=1;"
# Expected: 41

# 5. Verify view
npx wrangler d1 execute fnb_caffe_db --local \
  --command="SELECT ingredient_id, name_vi, current_qty, status FROM v_current_stock WHERE status != 'ok' ORDER BY name_vi;"

# 6. Test endpoint local
npx wrangler dev &
sleep 5
curl http://localhost:8787/api/admin/inventory/ingredients \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq '.total'
# Expected: 41
```

#### Step 5: Apply migration --remote (production)

```bash
cd /Users/mac/mekong-cli/FnB-Container-Caffe/worker
npx wrangler d1 execute fnb_caffe_db --remote \
  --file=../db/migrations/20260527_01_inventory_v1.sql

# Verify
npx wrangler d1 execute fnb_caffe_db --remote \
  --command="SELECT name_vi, current_qty FROM v_current_stock ORDER BY name_vi LIMIT 5;"
```

#### Step 6: Merge PR

```bash
gh pr merge --squash --delete-branch
cd worker && npx wrangler deploy
```

---

### Phase 2 (8-13/6, after launch ổn định — Tasks 15, 16, 17, 18)

```bash
# Sau khi khai trương 6/6 ổn (>=2-3 ngày), dispatch tiếp:

# T2 8/6: Task 15 (Receiving)
./send_task.sh 2 .claude-tasks/inventory/15-inventory-receiving-po.md

# T4 10/6 (sau khi 15 merge): Task 16 (Recipe — task khó nhất)
./send_task.sh 2 .claude-tasks/inventory/16-recipe-auto-deduct.md

# T6 12/6: Task 17 (Waste + COGS)
./send_task.sh 2 .claude-tasks/inventory/17-waste-cogs-margin.md

# T7 13/6: Task 18 (Admin UI consolidate)
./send_task.sh 2 .claude-tasks/inventory/18-inventory-admin-ui.md
```

---

## ⚡ Quick Deploy Script (sau khi 5 PRs đã review)

```bash
cd /Users/mac/mekong-cli/FnB-Container-Caffe && \
echo "═══════════════════════════════════════════" && \
echo "🔄 Step 1: Sync main" && \
git checkout main && git pull origin main && \
echo "" && \
echo "═══════════════════════════════════════════" && \
for pr in 30 31 32 33 34; do \
  echo "🟢 Merge PR #$pr" && \
  gh pr merge $pr --squash --delete-branch && \
  git pull origin main; \
done && \
echo "" && \
echo "═══════════════════════════════════════════" && \
echo "📥 Apply tất cả migrations còn lại trên remote" && \
cd worker && \
for f in ../db/migrations/20260527_*.sql; do \
  echo "→ $f" && \
  npx wrangler d1 execute fnb_caffe_db --remote --file="$f"; \
done && \
echo "" && \
echo "🚀 Deploy worker" && \
npx wrangler deploy && \
cd .. && \
echo "✅ Inventory module ALL deployed"
```

→ Note: PR numbers `30 31 32 33 34` là **giả định** — anh cần check số PR thực tế qua `gh pr list`.

---

## 🔍 Verify production sau full deploy

```bash
echo "═══════════════════════════════════════════" && \
echo "🔍 Verify inventory endpoints" && \
\
echo "1. List ingredients:" && \
curl -s https://fnb-caffe-container.pages.dev/api/admin/inventory/ingredients?is_active=true \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq '.total' && \
\
echo "2. List suppliers:" && \
curl -s https://fnb-caffe-container.pages.dev/api/admin/inventory/suppliers \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq '.data | length' && \
\
echo "3. PO suggestions:" && \
curl -s https://fnb-caffe-container.pages.dev/api/admin/inventory/po/suggestions \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq '.total_estimated' && \
\
echo "4. Dashboard:" && \
curl -s https://fnb-caffe-container.pages.dev/api/admin/inventory/dashboard \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq '.summary' && \
\
echo "5. Margin report:" && \
curl -s "https://fnb-caffe-container.pages.dev/api/admin/inventory/margin-report?period=month" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq '.summary'
```

---

## 🆘 Rollback options

### Trường hợp Task 14 migration lỗi remote

```bash
# Restore từ backup pre-inventory
cd /Users/mac/mekong-cli/FnB-Container-Caffe/worker
ls -la ../backups/d1-backup-*-pre-inventory.sql

# Pick file mới nhất
LATEST=$(ls -t ../backups/d1-backup-*-pre-inventory.sql | head -1)
npx wrangler d1 execute fnb_caffe_db --remote --file="$LATEST"
```

### Trường hợp Task 16 (recipe deduct) làm chậm POS

```bash
# Tắt feature flag tạm thời (worker đã thiết kế cờ)
# Set env var trong wrangler.toml:
[vars]
INVENTORY_DEDUCT_ENABLED = "false"

cd worker && npx wrangler deploy
```

### Revert 1 PR cụ thể

```bash
gh pr view <number>  # check merge commit SHA
git revert <merge-commit-sha>
git push origin main
cd worker && npx wrangler deploy
```

---

## 📞 Notify em khi:

- ✅ Worker xong Task 14 — em verify + suggest migration apply
- ⚠ Worker stuck > 1h không output
- ❌ Migration fail (local hoặc remote)
- ⚠ POS bị chậm sau khi deploy Task 16
- ✅ Tất cả 5 PRs merged — em verify production endpoints

---

## ⏭ Sau khi 5 PRs merged

1. **Data migration script (em sẽ viết)**:
   - Import 263 dòng nhập hàng từ Excel → `purchase_orders` + `stock_movements` historical
   - Anh + em review để verify số tổng

2. **Recipe finalize**:
   - Anh + Cường ngồi 1 buổi (2-3h) test recipe thực tế
   - Pha 1 ly, cân đo từng nguyên liệu thật → update recipes vào v2

3. **Train staff** (1 ngày 14-15/6):
   - Cường: dispatch nhập hàng + waste log + kiểm kê
   - Khánh: POS không thay đổi (vẫn bán như cũ, kho tự trừ)
   - Anh Còn: dashboard + reports

---

## 📊 Sau 1 tháng (6-13/7) — Review

- Margin report thực tế
- Top món lãi cao → push marketing
- Top món lỗ → tăng giá / bỏ menu / điều chỉnh recipe
- Waste analysis → bài học tiết kiệm
