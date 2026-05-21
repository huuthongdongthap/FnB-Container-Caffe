# 🎯 TASK 01/04 · Hero Phân Mảng Fix (P0 CRITICAL)

> **Repo:** `/Users/mac/mekong-cli/FnB-Container-Caffe`
> **Branch target:** `fix/hero-v8-seamless`
> **Base:** `main`
> **Estimated:** 5–8 phút
> **Conventional commits** · Mekong CLI workflow

---

## 🔧 PRE-FLIGHT (Mekong protocol)

```bash
cd /Users/mac/mekong-cli/FnB-Container-Caffe
cat CLAUDE.md                                   # Load behavior protocol
git fetch origin && git pull origin main        # Sync latest
git checkout -b fix/hero-v8-seamless            # New branch
```

---

## 🎯 GOAL

Fix logo PNG phân mảng (visible square edge) trên hero v8 production:
- **Issue 1:** mask radial 88%×88% chưa đủ aggressive → outer 12% fade lộ cạnh
- **Issue 2:** PNG bg `#1A1A2E` lệch nhẹ hero halo `#15152C` → seam visible
- **Issue 3:** EST. 2018 ở top:5% (trong vùng clipped) → float awkward
- **Issue 4:** Drop animation không thấy lúc static phase

---

## 📝 STEP 1 — Edit `css/hero-v8-bazi.css`

### 1a. Update `.logo-img` (line ~211-228):

**Find:**
```css
.logo-img{
  position:absolute;inset:0;
  width:100%;height:100%;
  object-fit:contain;
  z-index:2;
  filter:drop-shadow(0 0 30px rgba(201,214,223,.18));
  animation:logoBreath 9s ease-in-out infinite;
  clip-path:inset(12% 0 0 0);
  mask-image:radial-gradient(ellipse 88% 88% at 50% 56%,
    black 60%,
    rgba(0,0,0,.5) 85%,
    transparent 100%);
  -webkit-mask-image:radial-gradient(ellipse 88% 88% at 50% 56%,
    black 60%,
    rgba(0,0,0,.5) 85%,
    transparent 100%);
}
```

**Replace với:**
```css
.logo-img{
  position:absolute;inset:0;
  width:100%;height:100%;
  object-fit:contain;
  z-index:2;
  filter:drop-shadow(0 0 30px rgba(201,214,223,.22));
  animation:logoBreath 9s ease-in-out infinite;
  /* AGGRESSIVE all-side mask — outer 30% fade smooth (no square edge) */
  mask-image:radial-gradient(ellipse 72% 72% at 50% 52%,
    black 40%,
    rgba(0,0,0,.85) 60%,
    rgba(0,0,0,.4) 80%,
    transparent 100%);
  -webkit-mask-image:radial-gradient(ellipse 72% 72% at 50% 52%,
    black 40%,
    rgba(0,0,0,.85) 60%,
    rgba(0,0,0,.4) 80%,
    transparent 100%);
}
```

### 1b. Update `.hero` background (line ~51-66):

**Find:**
```css
  background:
    radial-gradient(ellipse 90% 80% at 50% 48%, #15152C 0%, #1A1A30 45%, rgba(26,26,48,.4) 70%, transparent 92%),
    radial-gradient(ellipse 140% 120% at 50% 50%, var(--noir-bright) 0%, var(--noir-mid) 35%, var(--noir-deep) 70%, var(--noir-void) 100%);
```

**Replace với** (halo lớn hơn, match PNG navy exact `#1A1A2E`):
```css
  background:
    radial-gradient(ellipse 95% 85% at 50% 50%, #1A1A2E 0%, #15152C 35%, rgba(21,21,44,.6) 60%, transparent 88%),
    radial-gradient(ellipse 140% 120% at 50% 50%, var(--noir-bright) 0%, var(--noir-mid) 35%, var(--noir-deep) 70%, var(--noir-void) 100%);
```

### 1c. Update `.est-override` (line ~241-260):

**Find:**
```css
.est-override{
  position:absolute;
  top:5%;
```

**Replace với:**
```css
.est-override{
  position:absolute;
  top:12%;
```

### 1d. Add static drop hint (pulse) — sau `@keyframes condense`:

**Append:**
```css
/* STATIC DROP HINT — subtle pulse luôn hiện để báo có animation */
.drop::before{
  content:'';
  position:absolute;
  top:-4px;left:50%;
  width:5px;height:5px;
  margin-left:-2.5px;
  background:radial-gradient(circle,rgba(232,238,243,.45),transparent 70%);
  border-radius:50%;
  animation:dropHint 9s ease-in-out infinite;
  pointer-events:none;
}
@keyframes dropHint{
  0%,5%,90%,100%{opacity:0;transform:scale(.6)}
  10%,85%{opacity:.6;transform:scale(1)}
}
```

---

## 📝 STEP 2 — Verify

```bash
# Verify mask change
grep -c "ellipse 72% 72%" css/hero-v8-bazi.css   # Expect: 2

# Verify clip-path removed
grep "clip-path:inset(12%" css/hero-v8-bazi.css  # Expect: empty (removed)

# Verify navy match
grep "#1A1A2E 0%" css/hero-v8-bazi.css           # Expect: 1+

# Verify EST top change
grep "top:12%" css/hero-v8-bazi.css              # Expect: 1+
```

---

## 📝 STEP 3 — Commit + Push + PR (Mekong git_manager style)

```bash
git add css/hero-v8-bazi.css
git commit -m "fix(hero): seamless logo blend — remove visible square edge

- Aggressive radial mask 72%×72% center (was 88%×88% at 56%)
- Outer 30% fade smooth (no more clip-path hard edge)
- Match hero halo navy to PNG bg #1A1A2E exact (no seam)
- Move EST. 2018 from top:5% to top:12% (inside visible PNG zone)
- Add subtle drop hint pulse for static-phase visibility

Production audit: https://13f3535c.fnb-caffe-container.pages.dev
Issue: phân mảng PNG vs hero bg visible
Fix: mask aggressive + bg color exact match"

git push -u origin fix/hero-v8-seamless

gh pr create \
  --title "fix(hero): seamless logo blend — eliminate visible square edge (v5 BAZI)" \
  --base main \
  --head fix/hero-v8-seamless \
  --body "$(cat <<'EOF'
## Summary

Fix phân mảng (visible square edge) trên hero v8 production.

## Issues addressed

1. **Mask not aggressive enough** — was 88%×88% center 56% → only outer 12% fade
2. **PNG bg color mismatch** — hero halo #15152C vs PNG #1A1A2E
3. **EST. 2018 misplaced** — was top:5% (in clipped zone)
4. **No visible animation hint** — drop only visible 5.4s of 9s cycle

## Changes

- `css/hero-v8-bazi.css` only
- Aggressive radial mask 72%×72% center 52%
- Match hero halo to PNG navy exact (#1A1A2E)
- Move EST. 2018 down to top:12%
- Add pre-drop hint pulse

## Test

After merge → Cloudflare auto-deploy → hard refresh production:
- [ ] No visible square edge around logo
- [ ] Logo blends into hero bg seamlessly
- [ ] EST. 2018 positioned naturally above chữ A
- [ ] Animation hint pulse always visible
EOF
)"
```

---

## 📝 STEP 4 — Verify deploy + Report

```bash
# Wait for Cloudflare deploy (auto-trigger on merge)
# Or force redeploy:
sleep 30  # Let CF queue
npx wrangler pages deployment list --project-name=fnb-caffe-container | head -5

# Output PR URL
echo "PR URL: $(gh pr view --json url --jq .url)"
```

**Report format (worker output):**

```
=== TASK 01/04 HERO SEAMLESS — DONE ===
Branch:     fix/hero-v8-seamless
Commit SHA: <sha>
PR URL:     <url>
Verify:     mask 72%×72% ✓ | navy #1A1A2E ✓ | EST top:12% ✓ | drop hint ✓
=== END ===
```

---

## 🚫 OUT OF SCOPE (đừng làm)

- ❌ KHÔNG động vào `index.html` (hero markup giữ nguyên)
- ❌ KHÔNG động sang sections khác (stats/menu/loyalty/footer)
- ❌ KHÔNG động `js/hero-v8-bazi.js`
- ❌ KHÔNG đổi color tokens (`css/brand-tokens.css`)
- ❌ KHÔNG merge PR — chỉ open + report URL

→ Sau khi report, NEXT TASK 02 sẽ được dispatch tự động.
