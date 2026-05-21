# 🎨 BRAND v6 — AURA CAFE Mineral + Cobalt Pipeline

> **Target repo:** `huuthongdongthap/FnB-Container-Caffe`
> **Production:** `https://fnb-caffe-container.pages.dev`
> **Brand mới:** AURA CAFE (Container Rooftop Café, Sa Đéc)
> **Total time:** 25-30 phút worker autonomous (2 phases)

---

## 📦 Files

| File | Mô tả |
|---|---|
| `06-rename-aura-cafe.md` | 🏷 P0 · Rename AURA SPACE → AURA CAFE toàn web |
| `07-brand-v6-mineral.md` | 🎨 P1 · Brand v6 MINERAL + COBALT styling |
| `dispatch-v6.sh` | 🚀 Master dispatcher cho 2 phases |
| `README.md` | 📚 File này |

---

## 🎯 Strategy

### Phase 1: Rename (5-7 phút)
- Find/replace AURA SPACE → AURA CAFE toàn project
- Title, meta tags, og:tags, hero, footer, Schema.org
- Admin pages, manifest, docs
- Test plan + PR

### Phase 2: Brand v6 (20-25 phút)
**Scrolling Mood Arc:**
```
🌑 Hero (navy + ripple + warm night glow)
   ↓
🌑→🌕 transition dark-to-light
   ↓
🌕 Featured Menu (cream + crisscross pattern + cobalt accent)
🌕 Spaces (mineral light + cobalt dashed mockup)
🌕 Loyalty (pearl + cobalt tier hover glow)
🌕 Cashback Calc (cream comfort)
🌕 About (soft mineral storytelling)
   ↓
🌕→🌑 transition light-to-dark
   ↓
🌑 CTA (navy + cobalt button)
🌑 Footer (void + warm tungsten glow @ 5%)
```

---

## 🎨 Brand v6 Color System

### Bát tự rules (bất di bất dịch)
- ✅ **Kim** element: chrome, pearl, mineral light, silver, white
- ✅ **Thủy** element: navy, cobalt blue, blue-grey
- ✅ **Mộc** element (small): forest green tag only
- 🚫 NO Gold/Yellow saturated (Thổ khắc Thủy)
- 🚫 NO Red/Orange (Hỏa hao Thủy)
- 🚫 NO Brown saturated (Thổ khắc Thủy)

### New v6 tokens

| Token | Hex | Use |
|---|---|---|
| `--cobalt-deep` | `#0F2D5E` | Container shadow |
| `--cobalt-mid` | `#1B3A6B` | Container body (real) |
| `--cobalt-bright` | `#2D5A9E` | CTA accent |
| `--mineral-pearl` | `#FAFAFA` | Pure light bg |
| `--mineral-cream` | `#F5EFE0` | Warm wood neutral |
| `--mineral-light` | `#F0F4F7` | Sky polycarbonate |
| `--mineral-soft` | `#E5EAF0` | About bg |
| `--mineral-med` | `#D5DCE2` | Mid grey-blue |
| `--mineral-stone` | `#B8C0CC` | Stair grey |
| `--mineral-text` | `#2A3145` | Dark text on light |
| `--mineral-muted` | `#6B7280` | Muted grey |
| `--warm-glow` | rgba(245,230,211,.05) | Night ambient @ 5% |

### Inspired by real photos (anh Còn cung cấp)
- Container BLUE COBALT → `--cobalt-mid` token
- Khung lan can TRẮNG CRISSCROSS → menu card pattern
- Cầu thang XÁM NHẠT → `--mineral-stone`
- Mái polycarbonate trắng → `--mineral-light`
- Mural xanh forest → `--moc-forest` tag
- Đèn tungsten ban đêm → `--warm-glow` low opacity

---

## 🚀 Cách chạy (Mekong CLI)

### Option A: TỪNG PHASE (recommended)

```bash
# Copy task files vào local repo
cp -r ~/Documents/AURA_SPACE/05_Demos/WORKER_TASKS_V6 \
      /Users/mac/mekong-cli/FnB-Container-Caffe/.claude-tasks/v6/

cd /Users/mac/mekong-cli/FnB-Container-Caffe

# Phase 1 — Rename (5-7 phút)
./send_task.sh 2 .claude-tasks/v6/06-rename-aura-cafe.md
# → Anh review PR + merge

# Phase 2 — Brand v6 styling (20-25 phút)
./send_task.sh 2 .claude-tasks/v6/07-brand-v6-mineral.md
# → Anh review PR + merge
```

### Option B: AUTO toàn bộ

```bash
cd /Users/mac/mekong-cli/FnB-Container-Caffe
./.claude-tasks/v6/dispatch-v6.sh 2
```

Script sẽ:
1. Phase 1 (rename) → pause → anh review + merge
2. Enter → Phase 2 (brand v6) → pause → anh review + merge
3. Force Cloudflare redeploy + final report

---

## 📋 Expected PRs

| # | Branch | Title | Lines diff |
|---|---|---|---|
| 1 | `feat/rename-aura-cafe` | Rename AURA SPACE → AURA CAFE | ~50 |
| 2 | `feat/brand-v6-mineral-cobalt` | Brand v6 MINERAL + COBALT | ~280 |

**Total:** ~330 dòng diff, 2 atomic PRs, ~25-30 min worker autonomous

---

## ✅ Acceptance criteria (after both PRs merged)

### Phase 1
- [ ] `grep -r "AURA SPACE" .` → 0 results
- [ ] Title, meta, og, Schema.org → "AURA CAFE"
- [ ] Admin pages updated
- [ ] No broken layout

### Phase 2
- [ ] Hero giữ dark navy + ripple animation
- [ ] Menu cream + crisscross subtle + cobalt hover
- [ ] Spaces mineral light
- [ ] Loyalty pearl + cobalt tier glow
- [ ] About soft mineral
- [ ] CTA dark + cobalt button
- [ ] Footer void + warm tungsten glow
- [ ] Mobile responsive 6 breakpoints maintained
- [ ] WCAG AA contrast verified
- [ ] Lighthouse Accessibility ≥ 95

---

## 🆘 Troubleshooting

**Worker timeout:** Phase 2 có thể >10 phút. Tăng `MAX_WAIT` trong send_task.sh lên 1800 (30 phút).

**Cloudflare deploy stuck:**
```bash
npx wrangler pages deployment list --project-name=fnb-caffe-container
npx wrangler pages deploy . --project-name=fnb-caffe-container --branch=main --commit-dirty=true
```

**Rollback nếu visual không OK:**
```bash
git revert <merge-commit-sha>
git push origin main
```

Hoặc disable v6 CSS bằng cách comment dòng link trong index.html.

---

## 🎯 Why v6 over v5

| Tiêu chí | v5 BAZI (current) | **v6 MINERAL+COBALT** |
|---|---|---|
| Bát tự alignment | ✅ 100% | ✅ 100% (mineral=Kim) |
| Brand luxury feel | ✅ | ✅ (hero dark giữ) |
| Daytime cafe UX | ⚠️ Quá tối, mỏi mắt | ✅ Light comfortable |
| Real-quán material match | ⚠️ Partial | ✅ Cobalt = container thật |
| Khách tỉnh lẻ appeal | ⚠️ Quá luxury hotel | ✅ Cafe ấm mời gọi |
| Conversion likely | Unknown | ↑ (trust lighter cards) |
| Mobile reading | ⚠️ Dark mệt mắt | ✅ Light dễ đọc |

---

## 🔮 Bám brand bát tự + thực trạng quán

V6 đáp ứng cả 2 ràng buộc:
1. **Bát tự 壬 Thủy + 庚 Kim** — không vi phạm element cấm
2. **Thực trạng quán** — match material thật (container blue, khung trắng, mural xanh)

→ Brand vừa **đúng phong thủy anh Còn**, vừa **upscale positioning** so với competitor xung quanh (Viva Star, các quán đường phố).
