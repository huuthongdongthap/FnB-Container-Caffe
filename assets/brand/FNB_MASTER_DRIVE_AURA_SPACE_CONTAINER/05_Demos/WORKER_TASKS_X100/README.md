# 🔍 AUDIT X100 — Worker Task Pipeline (Mekong CLI)

> **Target repo:** `huuthongdongthap/FnB-Container-Caffe`
> **Production:** `https://fnb-caffe-container.pages.dev`
> **Brand:** v5 BAZI · 壬 Thủy + 庚 Kim
> **Total time:** 75–110 phút worker autonomous (4 phases)

---

## 📦 Files trong folder này

| File | Mô tả |
|---|---|
| `01-hero-seamless.md` | 🔴 P0 · Fix hero phân mảng (mask aggressive 72%) |
| `02-ui-polish.md` | 🟡 P1 · Navbar, stats, menu, loyalty, footer chrome |
| `03-perf-a11y.md` | 🟢 P2 · Lazy load, preload, ARIA, Schema.org |
| `04-mobile-responsive.md` | 🔵 P3 · 6 breakpoints + hamburger menu |
| `dispatch-all.sh` | 🚀 Master dispatcher — chạy 4 phases qua `send_task.sh` |
| `README.md` | 📚 File này |

---

## 🚀 Cách chạy (Mekong CLI workflow)

### Option A: Chạy TỪNG phase (recommended — anh review mỗi PR)

```bash
# Copy task files vào local repo
cp -r ~/Documents/AURA_SPACE/05_Demos/WORKER_TASKS_X100 \
      /Users/mac/mekong-cli/FnB-Container-Caffe/.claude-tasks/x100/

cd /Users/mac/mekong-cli/FnB-Container-Caffe

# Phase 1 — Hero fix (5 phút)
./send_task.sh 2 .claude-tasks/x100/01-hero-seamless.md
# → Anh review PR + merge

# Phase 2 — UI polish (30 phút)
./send_task.sh 2 .claude-tasks/x100/02-ui-polish.md
# → Anh review PR + merge

# Phase 3 — Perf + a11y (25 phút)
./send_task.sh 2 .claude-tasks/x100/03-perf-a11y.md
# → Anh review PR + merge

# Phase 4 — Mobile responsive (30 phút)
./send_task.sh 2 .claude-tasks/x100/04-mobile-responsive.md
# → Anh review PR + merge
```

### Option B: Chạy AUTO toàn bộ (1 lệnh)

```bash
cd /Users/mac/mekong-cli/FnB-Container-Caffe
./.claude-tasks/x100/dispatch-all.sh 2
```

Script sẽ:
1. Chạy phase 1 → đợi worker xong
2. Pause: anh review + merge PR
3. Enter để tiếp phase 2 → đợi xong → pause → review/merge
4. Tiếp tục phase 3, 4
5. Force Cloudflare redeploy + final report

---

## 🔄 Mekong CLI commands được sử dụng

Mỗi task tận dụng tools sẵn có trong repo:

| Command | Mục đích |
|---|---|
| `cd $REPO && cat CLAUDE.md` | Load behavior protocol (per commit 48ad30c0) |
| `git checkout -b feat/...` | Branch convention từ `mekong.config.yaml` |
| `git commit -m "feat(scope): ..."` | Conventional commits (`agents.git_manager.commit_style`) |
| `git push -u origin <branch>` | Push branch |
| `gh pr create --base main --head ...` | Open PR (GitHub CLI) |
| `npx wrangler pages deploy` | Cloudflare Pages deploy (per `deploy.platform`) |
| `./send_task.sh <pane> <task-file>` | Blocking dispatcher (per `send_task.sh`) |
| `python3 - <<'PYEOF'` | Inline scripts (no install needed) |

---

## 📋 Expected PRs sau khi chạy hết

| # | Branch | Title | Estimated lines diff |
|---|---|---|---|
| 1 | `fix/hero-v8-seamless` | Hero phân mảng fix | ~20 |
| 2 | `feat/ui-audit-x100-polish` | UI polish 6 sections | ~350 |
| 3 | `perf/optimize-bundle-a11y` | Perf + a11y | ~80 |
| 4 | `feat/mobile-perfect-v5` | Mobile responsive | ~300 |

**Total:** ~750 dòng diff, 4 atomic PRs, ~80 min worker autonomous

---

## ✅ Acceptance criteria sau hết 4 phases

- [ ] Hero phân mảng → ZERO (logo seamless blend)
- [ ] Drop animation visible mỗi 9s cycle
- [ ] Navbar active state + chrome hover glow
- [ ] Stats counter Cormorant italic chrome
- [ ] Menu cards chrome hover lift
- [ ] Footer chrome social icons
- [ ] Lighthouse Performance ≥ 90
- [ ] Lighthouse Accessibility ≥ 95
- [ ] Lighthouse SEO ≥ 95
- [ ] Mobile responsive 6 breakpoints
- [ ] Touch targets ≥ 44px
- [ ] Cloudflare Pages auto-deploy success

---

## 🆘 Troubleshooting

**Worker không bắt đầu task:**
- Check pane number: `tmux list-panes -t mekong-cto:cto-worker`
- Verify `send_task.sh` executable: `chmod +x send_task.sh`

**Cloudflare deploy stuck:**
```bash
npx wrangler pages deployment list --project-name=fnb-caffe-container
npx wrangler pages deploy . --project-name=fnb-caffe-container --branch=main --commit-dirty=true
```

**Worker timeout (>10 phút):**
- Tăng `MAX_WAIT` trong `send_task.sh` lên 1200 (20 phút) cho phase 2

**Rollback nếu cần:**
```bash
git revert <merge-commit-sha>
git push origin main
```

---

## 🔮 Bám brand v5 BAZI

Tất cả 4 phases tuân thủ:
- ✅ Chrome `#C9D6DF` accent (Kim sinh Thủy)
- ✅ Navy `#0A1A2E` primary (Thủy)
- ✅ Mộc `#2D5A3D` for bar zone only
- ✅ Cormorant Garamond + Space Grotesk fonts
- 🚫 NO gold `#D4AF37/#FFD700/#B8860B` (Thổ khắc Thủy)
- 🚫 NO red/orange (Hỏa hao Thủy)
