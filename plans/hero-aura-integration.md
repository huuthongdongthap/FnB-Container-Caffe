# 🌊 AURA SPACE — Hero Section Integration & Polish

> **Plan ID**: `hero-aura-v1`  
> **Branch**: `claude/focused-tharp` (PR #1)  
> **Base commit**: [`cb8cc3f`](https://github.com/huuthongdongthap/FnB-Container-Caffe/commit/cb8cc3f00a7fcd81369606cee2c06666746978cf)  
> **Estimated time**: 30–45 phút  
> **Worker**: Claude Code CLI (any pane)

---

## 🎯 Mission

Verify hero section mới (3 file đã push: `css/hero-aura.css`, `js/hero-aura.js`, `hero-demo.html`) chạy đúng trên local Vite dev server, sau đó tweak design dựa trên feedback của anh Thông.

**Anh Thông sẽ đưa feedback bằng tiếng Việt qua chat hoặc issue comment. Worker phải:**
1. Hỏi rõ trước khi assume — nếu feedback mơ hồ thì comment lên issue và DỪNG.
2. Tweak chỉ trong 3 file đã push, KHÔNG đụng vào file khác.
3. Sau mỗi tweak: smoke test lại + commit với message rõ ràng.

---

## 📋 Acceptance Criteria

### Visual (mở `http://localhost:8082/hero-demo.html`)
- [ ] Background pure black `#0A0A0A` với radial gold glow ở giữa
- [ ] Logo SVG (chữ A monogram + AURA wordmark) hiển thị rõ, không vỡ
- [ ] **Ambient ripples**: 4 vòng tròn lan tỏa liên tục từ tâm logo, mỗi vòng cách nhau ~1.5s
- [ ] **Water waves**: 3 đường sóng ngang dưới logo, drift nhẹ
- [ ] **Particles**: ~18 đốm vàng trôi lên từ dưới
- [ ] **Custom cursor**: dot vàng + ring (chỉ desktop)
- [ ] Title "Where *silence* meets the aroma." với chữ "silence" italic gold
- [ ] 2 button "Đặt bàn ngay" (primary gold) + "Khám phá menu" (ghost)
- [ ] Hover button → fill gold gradient slide từ trái sang
- [ ] Scroll hint dưới cùng có line vàng pulse lên xuống

### Functional
- [ ] **Click bất cứ đâu** → ripple vàng lan ra từ vị trí click
- [ ] **Hover vào logo** → ripple tự bắn ra mỗi 700ms quanh logo
- [ ] Mở DevTools Console: KHÔNG có error đỏ nào
- [ ] Resize browser từ desktop → mobile (<768px): layout vẫn ổn, custom cursor tự ẩn
- [ ] Reload trang nhiều lần: animation reveal chạy đúng staggered (0.3s → 2.2s)

### Performance
- [ ] FPS không tụt dưới 50 khi animation chạy (check trong DevTools Performance)
- [ ] Không có memory leak: mở/đóng tab nhiều lần, RAM không tăng vô hạn
- [ ] Lighthouse Performance score > 85 (mobile)

### Code quality
- [ ] `npx eslint js/hero-aura.js` PASS không warning
- [ ] CSS không có selector conflict với `css/styles.css` (test bằng cách thử nhúng vào `index.html`)

---

## 🔍 Pre-flight Checks

Worker chạy các lệnh sau ĐẦU TIÊN, nếu fail thì DỪNG và báo anh Thông:

```bash
# 1. Đúng repo và branch
cd ~/mekong-cli/FnB-Container-Caffe
git branch --show-current  # phải là claude/focused-tharp

# 2. Pull commit cb8cc3f mới nhất
git fetch origin
git pull origin claude/focused-tharp
git log --oneline -1  # phải thấy commit có 'feat(hero): add AURA SPACE hero section'

# 3. 3 file phải tồn tại
ls -la css/hero-aura.css js/hero-aura.js hero-demo.html

# 4. Node + npm OK
node --version  # >= 18
npm --version
```

---

## 📦 Task Breakdown

### TASK 1 — Smoke test local (5 phút)

**🎯 Goal**: Verify 3 file mới chạy được trên Vite dev server, không có lỗi console.

**🔧 Action**:
```bash
# Start Vite
npm run dev

# Worker mở browser tới http://localhost:8082/hero-demo.html
# (nếu Vite chạy port khác, dùng port đó)
```

**✅ Verify**:
- Trang load không trắng
- Mở DevTools (F12) → tab Console: 0 error đỏ
- Tất cả 4 ambient ring đều hiển thị và animate
- Click giữa màn hình → ripple lan ra

**⚠️ Watch out**:
- Nếu Vite không serve được file ngoài `src/`, cần kiểm tra `vite.config.js`. KHÔNG sửa config nếu không chắc — báo anh Thông trước.
- Nếu fonts Google không load (offline): không sao, fallback `serif`/`sans-serif` vẫn ổn.

---

### TASK 2 — Báo cáo screenshot + chờ feedback (5 phút)

**🎯 Goal**: Worker chụp ảnh state hiện tại và comment vào GitHub Issue để anh Thông xem.

**🔧 Action**:
```bash
# Worker dùng tool screenshot (puppeteer/playwright nếu có) hoặc báo:
echo "📸 Hero demo đang chạy tại http://localhost:8082/hero-demo.html"
echo "   Anh xem rồi cho em feedback nhé."
```

**✅ Verify**:
- Comment lên issue với link preview + question: "Anh xem hero-demo có gì cần chỉnh không ạ?"
- DỪNG và đợi feedback từ anh Thông.

**⚠️ Watch out**:
- KHÔNG tự ý đoán "chắc anh thích thế này" rồi tweak. WAIT for explicit feedback.

---

### TASK 3 — Tweak design dựa feedback (15–25 phút, lặp lại nếu cần)

**🎯 Goal**: Apply từng feedback của anh Thông vào 3 file đã push.

**📥 Input**: Comment của anh Thông trong issue, ví dụ:
- "Ripple lan chậm hơn đi em" → tăng `ambient-pulse` duration từ 6s lên 8–10s
- "Particle ít quá, tăng lên 30" → đổi `PARTICLE_COUNT = 18` thành `30` trong `js/hero-aura.js`
- "Title to quá" → giảm `clamp(3.5rem, 9vw, 7rem)` xuống `clamp(3rem, 7vw, 5.5rem)`
- "Đổi tagline thành 'Where the Mekong meets craft coffee'" → sửa text trong `hero-demo.html`

**🔧 Action**:
Với mỗi feedback:
1. Đọc file cần sửa (`view`)
2. Sửa CHÍNH XÁC chỗ feedback nói (`str_replace`, không re-write toàn file)
3. Reload browser → verify thay đổi trực quan
4. Commit với message rõ:
   ```
   tweak(hero): slow down ambient ripple from 6s to 9s per feedback
   tweak(hero): increase particle count 18 → 30
   tweak(hero): adjust title size for better balance on tablet
   ```
5. Push lên `claude/focused-tharp`

**✅ Verify** (sau MỖI tweak):
- Reload browser: thay đổi đúng như feedback
- Console vẫn 0 error
- Animation vẫn smooth (không bị giật do quá nhiều particles chẳng hạn)

**⚠️ Watch out**:
- Nếu feedback yêu cầu thay đổi LỚN (ví dụ "đổi sang React component", "thêm video background"): DỪNG và confirm với anh Thông trước. Đừng tự rebuild.
- Nếu feedback mâu thuẫn nhau (ví dụ "tăng particles" rồi "giảm performance impact"): hỏi rõ trade-off anh muốn.
- Giữ commit nhỏ, mỗi commit 1 tweak — dễ revert nếu anh Thông đổi ý.

---

### TASK 4 — Final validation (5 phút)

**🎯 Goal**: Sau khi anh Thông OK với design, chạy validation cuối cùng.

**🔧 Action**:
```bash
# 1. ESLint
npx eslint js/hero-aura.js

# 2. Check không có console error
# (mở browser, F12, reload, inspect Console)

# 3. Lighthouse (nếu có CLI)
npx lighthouse http://localhost:8082/hero-demo.html --only-categories=performance --form-factor=mobile --quiet

# 4. Git status sạch sẽ
git status  # phải 'nothing to commit, working tree clean'
git log --oneline -5  # check commits đẹp
```

**✅ Verify**:
- ESLint pass
- Lighthouse Performance > 85
- Tất cả tweak đã commit + push

**🎁 Output**: Comment final lên issue với:
- ✅ Checklist đã pass
- 🔗 Link tới các commit tweak
- 📊 Lighthouse score
- 📸 Screenshot final state

---

## 🚫 Out of Scope (Worker KHÔNG làm)

- ❌ KHÔNG modify `index.html` (file gốc 51KB) — đó là việc khác sau khi PR #1 merge.
- ❌ KHÔNG đụng vào `css/styles.css`, `css/ui-enhancements.css` hay bất cứ CSS hiện có nào.
- ❌ KHÔNG cài thêm npm package mới (GSAP, Framer Motion, anime.js...) trừ khi anh Thông cho phép explicit.
- ❌ KHÔNG rebuild thành React/Vue component.
- ❌ KHÔNG upload PNG logo (giữ inline SVG fallback) trừ khi anh Thông yêu cầu.
- ❌ KHÔNG merge PR #1 — anh Thông tự merge khi sẵn sàng.
- ❌ KHÔNG đụng vào `vite.config.js`, `package.json`, `eslint.config.js`.

---

## 🔄 Rollback Plan

Nếu sau khi tweak mà hero bị hỏng và không fix được nhanh:

```bash
# Revert về commit cb8cc3f (state ban đầu sau khi em push)
git reset --hard cb8cc3f00a7fcd81369606cee2c06666746978cf
git push --force-with-lease origin claude/focused-tharp
```

**⚠️ Chỉ dùng `--force-with-lease` (không phải `--force` thường) để tránh đè commit của người khác.**

---

## 📞 Communication Protocol

- **Hỏi anh Thông** khi: feedback mơ hồ, thay đổi out-of-scope, gặp error không hiểu
- **Báo cáo qua**: comment trên GitHub Issue (xem link issue ở bottom của plan này)
- **DỪNG ngay** khi: gặp lỗi destructive (mất file, git conflict, npm crash)
- **Format báo cáo**:
  ```
  [HH:MM] ✅ Done: <task name>
  [HH:MM] 🔄 In progress: <task name>
  [HH:MM] ⚠️ Blocked: <reason> — cần anh confirm
  ```

---

## 📚 References

- **Brand tokens**: `css/hero-aura.css` (CSS variables ở đầu file, scoped trong `.hero-aura`)
- **Module API**: `js/hero-aura.js` exports `initHeroAura(root)` → returns cleanup function
- **Demo entry**: `hero-demo.html` (standalone, không phụ thuộc `index.html`)
- **AURA brand identity**: background `#0A0A0A`, Master Gold `#C9A200`, Electric Gold `#FFD700`
- **Fonts**: Playfair Display (display), Inter (body), JetBrains Mono (mono/labels)

---

_Plan generated by Claude (Sonnet) on 2026-05-03. Owner: anh Huu Thong._
