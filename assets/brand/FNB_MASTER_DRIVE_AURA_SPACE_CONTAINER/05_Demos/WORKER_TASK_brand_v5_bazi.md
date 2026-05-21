# 🎯 WORKER TASK · Brand v5 BAZI-ALIGNED Migration

> **Worker ID:** Claude Code CLI agent (pane via `send_task.sh`)
> **Repo:** `/Users/mac/mekong-cli/FnB-Container-Caffe`
> **Branch target:** `feat/brand-v5-bazi-aligned`
> **Base branch:** `main`
> **Estimated time:** 25–35 phút autonomous
> **Conventional commit style** (per `mekong.config.yaml` → `agents.git_manager.commit_style`)

---

## 0. CONTEXT — Tại sao cần migration này?

Brand `v4.0` hiện trên `main` (`css/brand-tokens.css`) đang sai bát tự chủ quán **Nguyễn Hữu Còn** (8/2/1982 21:00, Nam, Sa Đéc):

| Bát tự yêu cầu | Brand v4 hiện tại | Trạng thái |
|---|---|---|
| Nhật chủ **壬 Thủy Dương** → cần Kim sinh Thủy | Navy ✓ + **Gold #D4AF37** | ❌ Gold = Thổ → khắc Thủy |
| Đại vận **丙午 Bính Ngọ Hỏa 2020-2029** → tránh Hỏa+Thổ | Bright gold #FFD700, gold cool #B8860B | ❌ Thổ khắc Thủy |
| Font: **Cormorant Garamond** + **Space Grotesk** | Playfair Display + Manrope/Inter | ❌ Sai font specs |

**Source of truth (đính kèm trong session uploads):**
- `pencil-bazi-adjustment-prompts.md` — color rules + Do's/Don'ts
- `report-nguyen-huu-con.html` — full bát tự report

---

## 1. PHASE LIST

| # | Phase | Files | Commit |
|---|---|---|---|
| 1 | Brand tokens v5 | `css/brand-tokens.css` | `feat(brand): tokens v5.0 BAZI-aligned 壬 Thủy + 庚 Kim` |
| 2 | Google Fonts swap | tất cả `*.html` có `fonts.googleapis.com` | `fix(fonts): Cormorant Garamond + Space Grotesk per bazi` |
| 3 | Hex replace toàn HTMLs | `*.html`, `css/*.css` | `style(palette): replace gold → chrome (Kim sinh Thủy)` |
| 4 | Hero v8 BAZI apply vào `index.html` | `index.html` | `feat(hero): water drop + ripple animation chrome` |
| 5 | Brand guideline doc update | `brand-guideline.html` | `docs(brand): add bazi rationale + do/dont` |
| 6 | Verify + push | — | (push + open PR) |

---

## 2. PHASE 1 — Brand Tokens v5

**File:** `css/brand-tokens.css`

**Action:** **Rewrite hoàn toàn** file này với content sau (giữ block comment header, thêm version log, all tokens v5):

```css
/**
 ═══════════════════════════════════════════════════════════════════
 * AURA CAFE · BRAND TOKENS v5.0 — BAZI ALIGNED
 ═══════════════════════════════════════════════════════════════════
 * Aligned with: Bát tự chủ quán NGUYỄN HỮU CÒN
 *               (Nhật chủ 壬 Thủy Dương, 8/2/1982 21:00)
 *               Đại vận 丙午 Bính Ngọ (Hỏa, 2020-2029)
 *
 * Element DNA   : 水 Thủy (Water) — Noir Lounge
 * Element flow  : 庚辛 Kim sinh 壬 Thủy → ACCENT phải là BẠC/CHROME
 * Font          : Cormorant Garamond + Space Grotesk
 * Brand         : AURA CAFE (39 Nguyễn Tất Thành, Sa Đéc)
 * Version       : 5.0.0 · 2026-05-10
 *
 * ─── v5 changes from v4 ──────────────────────────────────────────
 * • REVERT: Gold Metallic (#D4AF37, #FFD700, #B8860B) — Thổ khắc Thủy
 * • NEW:    Chrome/Silver palette (#C9D6DF, #6B9FB8, #3A6B80) — Kim sinh Thủy
 * • Font:   Playfair Display → Cormorant Garamond
 * • Font:   Manrope → Space Grotesk
 * • ADD:    Mộc zone tokens (cho bar — hóa giải nhân sự Hỏa)
 ═══════════════════════════════════════════════════════════════════
 */

:root {
  /* ════════════════ 1. COLOR SYSTEM — 壬 Thủy × 庚 Kim ════════════════ */

  /* 壬 THỦY — Primary surfaces (Nhật chủ chủ quán) */
  --aura-noir-void:   #050D1A;   /* Vực Thẳm — page bg */
  --aura-noir-deep:   #0A1A2E;   /* Đêm Biển — PRIMARY card */
  --aura-noir-mid:    #1A2A4E;   /* Đại Dương — surface */
  --aura-noir-bright: #25406B;   /* Lifted radial center */
  --aura-noir-steel:  #334155;   /* Hover/borders */

  /* 庚辛 KIM — Accent (Kim sinh Thủy ✓) */
  --aura-chrome-bright: #E8EEF3; /* Mirror white */
  --aura-chrome-light:  #C9D6DF; /* Bạc Kim — MAIN ACCENT */
  --aura-chrome-mid:    #6B9FB8; /* Chrome */
  --aura-chrome-dark:   #3A6B80; /* Steel blue */

  /* 乙 MỘC — Bar zone (decouple khỏi Tú, dùng cho hóa giải hướng Nam + nhân sự Hỏa) */
  --aura-moc-deep:    #1A2D1F;   /* Rừng Sâu */
  --aura-moc-primary: #2D5A3D;   /* Forest */
  --aura-moc-light:   #4A7C59;   /* Jade */
  --aura-moc-pale:    #A8C5A0;   /* Sương Mai */

  /* Neutrals */
  --aura-text-primary: #F5F5F5;
  --aura-text-body:    #C5C8CC;
  --aura-text-muted:   #8A8E96;

  /* Borders */
  --aura-border-chrome: rgba(201,214,223,0.25);
  --aura-border-soft:   rgba(255,255,255,0.06);
  --aura-border-strong: rgba(201,214,223,0.45);

  /* Semantic */
  --aura-success: #4CAF50;
  --aura-warning: #6B9FB8;   /* Chrome (vẫn Kim — không dùng amber/Hỏa) */
  --aura-danger:  #DC2626;
  --aura-info:    #6B9FB8;

  /* ════════════════ 2. TYPOGRAPHY ════════════════ */

  --aura-font-display: 'Cormorant Garamond', Georgia, 'Times New Roman', serif;
  --aura-font-body:    'Space Grotesk', 'Inter', system-ui, -apple-system, sans-serif;
  --aura-font-mono:    'JetBrains Mono', 'IBM Plex Mono', monospace;

  /* Font scale */
  --aura-fs-display: clamp(48px, 8vw, 80px);
  --aura-fs-hero:    clamp(32px, 5vw, 56px);
  --aura-fs-h1:      clamp(28px, 4vw, 42px);
  --aura-fs-h2:      clamp(22px, 3vw, 32px);
  --aura-fs-h3:      20px;
  --aura-fs-body:    16px;
  --aura-fs-sm:      14px;
  --aura-fs-xs:      12px;
  --aura-fs-label:   11px;

  --aura-ls-hero:   12px;
  --aura-ls-title:   6px;
  --aura-ls-label:   4px;
  --aura-ls-button:  1px;

  --aura-lh-tight: 1.2;
  --aura-lh-body:  1.6;
  --aura-lh-loose: 1.8;

  --aura-fw-light:    300;
  --aura-fw-regular:  400;
  --aura-fw-medium:   500;
  --aura-fw-semibold: 600;
  --aura-fw-bold:     700;

  /* ════════════════ 3-9. SPACING/RADIUS/SHADOWS/etc ════════════════ */
  /* (preserve from v4 — không liên quan palette) */

  --aura-space-xs:  4px;
  --aura-space-sm:  8px;
  --aura-space-md:  16px;
  --aura-space-lg:  24px;
  --aura-space-xl:  40px;
  --aura-space-2xl: 64px;
  --aura-space-3xl: 100px;

  --aura-radius-sm:   4px;
  --aura-radius-md:   8px;
  --aura-radius-lg:   16px;
  --aura-radius-xl:   24px;
  --aura-radius-pill: 50px;

  --aura-shadow-sm: 0 2px 8px rgba(0,0,0,0.2);
  --aura-shadow-md: 0 8px 30px rgba(0,0,0,0.18);
  --aura-shadow-lg: 0 16px 60px rgba(0,0,0,0.45);

  /* Chrome glow — replace gold glow */
  --aura-glow-chrome:        0 0 30px rgba(201,214,223,0.25);
  --aura-glow-chrome-strong: 0 0 60px rgba(232,238,243,0.4);
  --aura-glow-navy:          0 0 40px rgba(10,26,46,0.6);

  /* Gradients */
  --aura-grad-chrome:      linear-gradient(135deg, #C9D6DF 0%, #E8EEF3 100%);
  --aura-grad-chrome-cool: linear-gradient(135deg, #3A6B80 0%, #6B9FB8 100%);
  --aura-grad-noir:        linear-gradient(135deg, #0A1A2E 0%, #1A2A4E 100%);
  --aura-grad-noir-chrome: linear-gradient(135deg, #0A1A2E 0%, #1A2A4E 60%, #C9D6DF 100%);
  --aura-grad-water-ripple: linear-gradient(135deg,
    rgba(201,214,223,0.05) 0%,
    rgba(107,159,184,0.10) 35%,
    rgba(201,214,223,0.05) 65%,
    rgba(10,26,46,0.0) 100%);

  /* Timing/Z-index/Containers (preserve from v4) */
  --aura-ease:     cubic-bezier(0.4, 0, 0.2, 1);
  --aura-ease-out: cubic-bezier(0.0, 0, 0.2, 1);
  --aura-ease-in:  cubic-bezier(0.4, 0, 1, 1);
  --aura-duration-fast: 150ms;
  --aura-duration-base: 300ms;
  --aura-duration-slow: 600ms;

  --aura-z-base:    0;
  --aura-z-sticky:  50;
  --aura-z-overlay: 100;
  --aura-z-modal:   200;
  --aura-z-toast:   300;

  --aura-max-narrow:  720px;
  --aura-max-content: 1100px;
  --aura-max-wide:    1200px;

  /* ════════════════ 10. LEGACY ALIASES — backward compat ════════════════ */
  /* All old gold tokens map to new chrome values — không break legacy code */

  --aura-gold-primary:  var(--aura-chrome-light);
  --aura-gold-bright:   var(--aura-chrome-bright);
  --aura-gold-cool:     var(--aura-chrome-dark);
  --aura-gold-deep:     var(--aura-chrome-dark);
  --aura-gold-warm:     var(--aura-chrome-mid);
  --aura-gold-master:   var(--aura-chrome-light);
  --aura-gold-electric: var(--aura-chrome-bright);
  --aura-gold-matte:    var(--aura-chrome-dark);
  --aura-gold-metallic: var(--aura-chrome-light);
  --aura-gold-amber:    var(--aura-chrome-mid);
  --aura-warm-amber:    var(--aura-chrome-mid);

  --aura-silver-primary: var(--aura-chrome-light);
  --aura-silver-bright:  var(--aura-chrome-bright);
  --aura-silver-cool:    var(--aura-chrome-mid);
  --aura-silver-deep:    var(--aura-chrome-dark);
  --aura-silver-warm:    var(--aura-chrome-mid);

  --aura-border-gold:   var(--aura-border-chrome);
  --aura-border-silver: var(--aura-border-chrome);

  --aura-grad-gold:       var(--aura-grad-chrome);
  --aura-grad-gold-cool:  var(--aura-grad-chrome-cool);
  --aura-grad-noir-gold:  var(--aura-grad-noir-chrome);
  --aura-grad-radial-gold: radial-gradient(ellipse at center, rgba(201,214,223,0.14) 0%, transparent 70%);
  --aura-grad-silver:        var(--aura-grad-chrome);
  --aura-grad-silver-cool:   var(--aura-grad-chrome-cool);
  --aura-grad-noir-silver:   var(--aura-grad-noir-chrome);
  --aura-grad-radial-silver: var(--aura-grad-radial-gold);

  --aura-glow-gold:        var(--aura-glow-chrome);
  --aura-glow-gold-strong: var(--aura-glow-chrome-strong);
  --aura-glow-silver:        var(--aura-glow-chrome);
  --aura-glow-silver-strong: var(--aura-glow-chrome-strong);

  --aura-debossing: inset 0 2px 4px rgba(0,0,0,0.6),
                    inset 0 -1px 2px rgba(201,214,223,0.08);

  /* Generic short aliases */
  --bg-primary:    var(--aura-noir-void);
  --bg-surface:    var(--aura-noir-deep);
  --gold-master:   var(--aura-chrome-light);
  --gold-electric: var(--aura-chrome-bright);
  --gold-matte:    var(--aura-chrome-dark);
  --amber-neon:    var(--aura-chrome-mid);
  --text-body:     var(--aura-text-body);
  --text-white:    var(--aura-text-primary);
  --gradient-gold: var(--aura-grad-chrome);
  --glow-gold:     var(--aura-glow-chrome);
  --border-gold:   1px solid var(--aura-border-chrome);
  --font-display:  var(--aura-font-display);
  --font-body:     var(--aura-font-body);
  --font-mono:     var(--aura-font-mono);
  --max-width:     var(--aura-max-wide);

  --bg:      var(--aura-noir-void);
  --section: var(--aura-noir-deep);
  --card:    var(--aura-noir-deep);
  --gold:    var(--aura-chrome-light);
  --gold-e:  var(--aura-chrome-bright);
  --matte:   var(--aura-chrome-dark);
  --amber:   var(--aura-chrome-mid);
  --silver:  var(--aura-chrome-light);
  --silver-e:var(--aura-chrome-bright);
  --navy:    var(--aura-noir-void);
  --white:   var(--aura-text-primary);
  --txt:     var(--aura-text-body);
  --green:   var(--aura-success);
  --red:     var(--aura-danger);
  --fd:      var(--aura-font-display);
  --fb:      var(--aura-font-body);
  --fm:      var(--aura-font-mono);
}

/* ════════════════════════════════════════════════════════════════════ */
/* UTILITY CLASSES — preserve all from v4 but values reference v5 tokens  */
/* ════════════════════════════════════════════════════════════════════ */

.aura-hero-title {
  font-family: var(--aura-font-display);
  font-size: var(--aura-fs-display);
  color: var(--aura-chrome-bright);
  letter-spacing: var(--aura-ls-hero);
  text-transform: uppercase;
  font-weight: var(--aura-fw-bold);
  text-shadow: 0 0 40px rgba(232,238,243,0.25),
               0 0 80px rgba(201,214,223,0.10);
}

.aura-section-label {
  font-family: var(--aura-font-body);
  font-size: var(--aura-fs-label);
  font-weight: var(--aura-fw-semibold);
  letter-spacing: var(--aura-ls-label);
  text-transform: uppercase;
  color: var(--aura-chrome-light);
}

.aura-card-noir {
  background: var(--aura-noir-deep);
  border: 1px solid var(--aura-border-chrome);
  border-radius: var(--aura-radius-lg);
  box-shadow: var(--aura-shadow-md);
  padding: var(--aura-space-lg);
}

.aura-btn-silver,
.aura-btn-gold {
  display: inline-flex;
  align-items: center;
  gap: var(--aura-space-sm);
  background: var(--aura-grad-chrome);
  color: #0A1A2E;
  font-family: var(--aura-font-body);
  font-size: var(--aura-fs-sm);
  font-weight: var(--aura-fw-semibold);
  padding: 14px 32px;
  border-radius: var(--aura-radius-pill);
  letter-spacing: var(--aura-ls-button);
  text-transform: uppercase;
  border: none;
  cursor: pointer;
  transition: transform var(--aura-duration-base) var(--aura-ease),
              box-shadow var(--aura-duration-base) var(--aura-ease);
}
.aura-btn-silver:hover,
.aura-btn-gold:hover {
  transform: scale(1.02);
  box-shadow: var(--aura-glow-chrome-strong);
}

.aura-btn-ghost {
  display: inline-flex;
  align-items: center;
  gap: var(--aura-space-sm);
  background: transparent;
  color: var(--aura-chrome-light);
  font-family: var(--aura-font-body);
  font-size: var(--aura-fs-sm);
  font-weight: var(--aura-fw-semibold);
  padding: 13px 30px;
  border-radius: var(--aura-radius-pill);
  letter-spacing: var(--aura-ls-button);
  text-transform: uppercase;
  border: 1px solid var(--aura-chrome-light);
  cursor: pointer;
  transition: all var(--aura-duration-base) var(--aura-ease);
}
.aura-btn-ghost:hover {
  background: rgba(201,214,223,0.08);
  box-shadow: var(--aura-glow-chrome);
}

.aura-brand-lockup {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  gap: var(--aura-space-sm);
  text-align: center;
}
.aura-brand-lockup .lockup-era {
  font-family: var(--aura-font-display);
  font-size: var(--aura-fs-label);
  font-weight: var(--aura-fw-medium);
  letter-spacing: 8px;
  color: var(--aura-chrome-mid);
  text-transform: uppercase;
}
.aura-brand-lockup .lockup-primary {
  font-family: var(--aura-font-display);
  font-size: var(--aura-fs-hero);
  font-weight: var(--aura-fw-bold);
  letter-spacing: var(--aura-ls-hero);
  background: linear-gradient(180deg,#E8EEF3,#C9D6DF,#6B9FB8);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  text-transform: uppercase;
  line-height: var(--aura-lh-tight);
}
.aura-brand-lockup .lockup-secondary {
  font-family: var(--aura-font-display);
  font-size: var(--aura-fs-h3);
  font-weight: var(--aura-fw-regular);
  letter-spacing: var(--aura-ls-title);
  color: var(--aura-chrome-mid);
  text-transform: uppercase;
}
.aura-brand-lockup .lockup-tagline {
  font-family: var(--aura-font-body);
  font-size: var(--aura-fs-label);
  font-weight: var(--aura-fw-light);
  letter-spacing: var(--aura-ls-label);
  color: var(--aura-chrome-dark);
  text-transform: uppercase;
}
.aura-brand-lockup .lockup-divider {
  color: var(--aura-chrome-dark);
  letter-spacing: var(--aura-ls-button);
  font-size: var(--aura-fs-xs);
}

.aura-sr-only {
  position: absolute;
  width: 1px; height: 1px;
  padding: 0; margin: -1px;
  overflow: hidden;
  clip: rect(0,0,0,0);
  white-space: nowrap;
  border: 0;
}
```

**Verify:**
```bash
wc -l css/brand-tokens.css   # phải ~370-400 lines
grep -c "Chrome\|chrome\|C9D6DF" css/brand-tokens.css  # phải >= 20
grep -c "FFD700\|D4AF37" css/brand-tokens.css  # phải = 0
```

---

## 3. PHASE 2 — Google Fonts Swap

**Mục tiêu:** Tất cả HTML import fonts đều dùng:
```
https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400;500;600;700&family=Space+Grotesk:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap
```

**Action:** Chạy Python script replace toàn bộ font URL trong `*.html`:

```bash
cd /Users/mac/mekong-cli/FnB-Container-Caffe

python3 - <<'PYEOF'
import re, glob, os

new_url = 'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400;500;600;700&family=Space+Grotesk:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap'

count = 0
for fpath in glob.glob('**/*.html', recursive=True):
    if '_archive' in fpath or 'node_modules' in fpath:
        continue
    with open(fpath, 'r', encoding='utf-8') as f:
        c = f.read()
    orig = c
    c = re.sub(r'https://fonts\.googleapis\.com/css2\?family=[^"\']+', new_url, c)
    # Also replace CSS font-family references
    c = c.replace("'Playfair Display'", "'Cormorant Garamond'")
    c = c.replace('"Playfair Display"', '"Cormorant Garamond"')
    c = c.replace("'Cinzel'", "'Cormorant Garamond'")
    c = c.replace('"Cinzel"', '"Cormorant Garamond"')
    c = c.replace("'Manrope'", "'Space Grotesk'")
    c = c.replace('"Manrope"', '"Space Grotesk"')
    if c != orig:
        with open(fpath, 'w', encoding='utf-8') as f:
            f.write(c)
        count += 1
        print(f'  ✓ {fpath}')
print(f'\nTotal updated: {count} files')
PYEOF
```

**Verify:**
```bash
grep -rln "Playfair Display\|Cinzel\|Manrope" *.html admin/*.html 2>/dev/null | wc -l   # phải = 0
grep -rln "Cormorant Garamond\|Space Grotesk" *.html | wc -l   # phải >= 8
```

---

## 4. PHASE 3 — Hex Color Replace (Gold → Chrome)

**Mapping bắt buộc:**

| Old hex | New hex | Lý do |
|---|---|---|
| `#D4AF37` | `#C9D6DF` | Gold Master → Chrome Light |
| `#FFD700` | `#E8EEF3` | Bright Gold → Mirror White |
| `#FFC107` | `#6B9FB8` | Warm Gold → Chrome Mid |
| `#B8860B` | `#3A6B80` | Gold Cool → Steel Blue |
| `#C9A200` | `#C9D6DF` | Legacy Gold → Chrome Light |
| `#C9A962` | `#C9D6DF` | Legacy Gold variant |
| `#1a1a1a` | `#1A2A4E` | Pure dark → Noir mid |
| `#0A0E1A` | `#050D1A` | Off-navy → Noir void |
| `rgba(212,175,55,` | `rgba(201,214,223,` | Gold alpha → Chrome alpha |
| `rgba(255,215,0,` | `rgba(232,238,243,` | Bright gold alpha → Mirror alpha |
| `rgba(201,162,0,` | `rgba(201,214,223,` | Legacy gold alpha |

**Action:**
```bash
cd /Users/mac/mekong-cli/FnB-Container-Caffe

python3 - <<'PYEOF'
import re, glob

mapping = [
    (r'#D4AF37', '#C9D6DF'),
    (r'#d4af37', '#C9D6DF'),
    (r'#FFD700', '#E8EEF3'),
    (r'#ffd700', '#E8EEF3'),
    (r'#FFC107', '#6B9FB8'),
    (r'#ffc107', '#6B9FB8'),
    (r'#B8860B', '#3A6B80'),
    (r'#b8860b', '#3A6B80'),
    (r'#C9A200', '#C9D6DF'),
    (r'#c9a200', '#C9D6DF'),
    (r'#C9A962', '#C9D6DF'),
    (r'#c9a962', '#C9D6DF'),
    (r'#1a1a1a', '#1A2A4E'),
    (r'#0A0E1A', '#050D1A'),
    (r'#0a0e1a', '#050D1A'),
    (r'rgba\(212\s*,\s*175\s*,\s*55\s*,', 'rgba(201,214,223,'),
    (r'rgba\(255\s*,\s*215\s*,\s*0\s*,', 'rgba(232,238,243,'),
    (r'rgba\(201\s*,\s*162\s*,\s*0\s*,', 'rgba(201,214,223,'),
    (r'rgba\(184\s*,\s*134\s*,\s*11\s*,', 'rgba(58,107,128,'),
    (r'rgba\(255\s*,\s*179\s*,\s*0\s*,', 'rgba(107,159,184,'),
    (r'rgba\(201\s*,\s*169\s*,\s*98\s*,', 'rgba(201,214,223,'),
]

count = 0
for ext in ('*.html', 'admin/*.html', 'css/*.css', 'js/*.js'):
    for fpath in glob.glob(f'**/{ext}', recursive=True) + glob.glob(ext):
        if '_archive' in fpath or 'node_modules' in fpath or 'brand-tokens.css' in fpath:
            continue
        try:
            with open(fpath, 'r', encoding='utf-8') as f:
                c = f.read()
        except Exception:
            continue
        orig = c
        for pattern, replace in mapping:
            c = re.sub(pattern, replace, c)
        if c != orig:
            with open(fpath, 'w', encoding='utf-8') as f:
                f.write(c)
            count += 1
            print(f'  ✓ {fpath}')

print(f'\nTotal updated: {count} files')
PYEOF
```

**Verify:**
```bash
# Phải = 0 hits cho gold hex bên ngoài brand-tokens.css (đã preserve aliases trong tokens)
grep -rn "#D4AF37\|#d4af37\|#FFD700\|#ffd700\|#C9A200\|#c9a200" --include="*.html" --include="*.css" --include="*.js" | grep -v "brand-tokens.css" | grep -v "_archive" | wc -l
# Expect: 0
```

---

## 5. PHASE 4 — Hero v8 BAZI vào `index.html`

**Source:** Demo file đã chuẩn — `assets/brand/FNB_MASTER_DRIVE_AURA_SPACE_CONTAINER/05_Demos/hero-ripple-demo.html` (nếu file này đã được copy vào repo; nếu chưa, paste from Cowork workspace path: `/sessions/upbeat-laughing-dijkstra/mnt/FNB_MASTER_DRIVE_AURA_SPACE_CONTAINER/05_Demos/hero-ripple-demo.html`)

**Action:**

1. Mở `index.html`, locate hero section đầu trang (giữa `<section class="hero">...` và `</section>` đầu tiên — hoặc tương đương)
2. **Backup** hero cũ vào comment block `<!-- LEGACY HERO v4 -->`
3. **Replace** với hero v8 BAZI content:

```html
<!-- ═══ HERO v8 BAZI ALIGNED — 壬 Thủy × 庚 Kim ═══ -->
<section class="hero hero-v8">
  <div class="light-shaft"></div>
  <div class="particle p-near" style="top:12%;left:8%;"></div>
  <div class="particle p-near" style="top:18%;right:10%;animation-delay:-3s"></div>
  <div class="particle p-mid"  style="top:62%;left:6%;animation-delay:-5s"></div>
  <div class="particle p-mid"  style="top:75%;right:8%;animation-delay:-7s"></div>
  <div class="particle p-far"  style="top:42%;left:4%;animation-delay:-9s"></div>
  <div class="particle p-far"  style="top:50%;right:5%;animation-delay:-11s"></div>

  <div class="logo-stage" id="heroLogoStage">
    <div class="shake-inner">
      <div class="steam steam-1"></div>
      <div class="steam steam-2"></div>
      <div class="steam steam-3"></div>
      <div class="reflection"></div>
      <img class="logo-img" src="assets/brand/fnb_water_logo.png" alt="AURA CAFE">
      <div class="specular"></div>
      <div class="est-override"><span>EST. 2018</span></div>
      <div class="surface-glow"></div>
      <div class="tension-line"></div>
      <div class="caustics"></div>
      <div class="dimple"></div>
      <div class="ripple-stage">
        <div class="ripple-plane">
          <div class="ripple-primary"></div>
          <div class="ripple-echo"></div>
        </div>
      </div>
      <div class="shockwave"></div>
      <div class="crown crown-1"></div>
      <div class="crown crown-2"></div>
      <div class="crown crown-3"></div>
      <div class="crown crown-4"></div>
      <div class="crown crown-5"></div>
      <div class="drop-trail"></div>
      <div class="condensation"></div>
      <div class="drop"></div>
    </div>
  </div>

  <div class="hero-meta">
    <div class="hero-pills">
      <span class="pill">📍 Sa Đéc · Đồng Tháp</span>
      <span class="pill">🏗️ 1 trệt + Rooftop</span>
      <span class="pill">📐 ~183m²</span>
    </div>
    <div class="cta-row">
      <a href="table-reservation.html" class="btn btn-primary">Đặt Bàn Ngay →</a>
      <a href="menu.html" class="btn btn-ghost">Khám Phá Menu</a>
    </div>
  </div>

  <div class="color-grade"></div>
  <div class="grain"></div>
  <div class="vignette"></div>
</section>
```

4. **CSS:** Extract toàn bộ `<style>` block từ hero-ripple-demo.html (từ `:root{` đến `</style>`) → tạo file mới `css/hero-v8-bazi.css`. Link trong `<head>`:
   ```html
   <link rel="stylesheet" href="css/hero-v8-bazi.css">
   ```

5. **JS:** Extract `<script>(function(){...})();</script>` cuối hero-ripple-demo.html → tạo file `js/hero-v8-bazi.js`. Link cuối `</body>`:
   ```html
   <script src="js/hero-v8-bazi.js" defer></script>
   ```

6. **Logo path:** Đảm bảo `assets/brand/fnb_water_logo.png` tồn tại. Nếu chưa, copy:
   ```bash
   mkdir -p assets/brand
   cp "assets/brand/FNB_MASTER_DRIVE_AURA_SPACE_CONTAINER/03_Digital_UI_RGB_Social/fnb_water_logo_1775966945304.png" assets/brand/fnb_water_logo.png
   ```

**Verify:**
```bash
grep -c "hero-v8" index.html  # >= 2
test -f css/hero-v8-bazi.css && echo "✓ CSS exists"
test -f js/hero-v8-bazi.js && echo "✓ JS exists"
test -f assets/brand/fnb_water_logo.png && echo "✓ Logo exists"
```

---

## 6. PHASE 5 — Brand Guideline doc

**File:** `brand-guideline.html`

**Action:** Update palette section với swatches mới + thêm section "Bát tự rationale" + "Do's & Don'ts" theo `pencil-bazi-adjustment-prompts.md`.

Cụ thể: 
1. Replace tất cả gold swatches với chrome swatches
2. Add section mới sau header với HTML:

```html
<section class="bazi-rationale">
  <h2>Bát Tự Foundation</h2>
  <p>Nhật chủ <strong>壬 Thủy Dương</strong> (Nguyễn Hữu Còn) — cần <strong>庚辛 Kim</strong> sinh Thủy.</p>
  <p>Đại vận hiện tại <strong>丙午 Bính Ngọ (Hỏa, 2020-2029)</strong> → tránh Thổ + Hỏa trong brand.</p>
  
  <h3>✅ Nên dùng</h3>
  <ul>
    <li>Chrome/Bạc <code>#C9D6DF</code> (Kim sinh Thủy)</li>
    <li>Navy <code>#0A1A2E</code> (Thủy chủ đạo)</li>
    <li>Forest <code>#2D5A3D</code> (Mộc cho bar zone)</li>
    <li>Vật liệu: Kính, gương, inox, thép tối</li>
  </ul>
  
  <h3>🚫 Cấm tuyệt đối</h3>
  <ul>
    <li>Gold <code>#FFD700</code>, <code>#D4AF37</code>, <code>#B8860B</code> (Thổ khắc Thủy)</li>
    <li>Vàng đất, nâu (Thổ)</li>
    <li>Cam/đỏ rực (Hỏa hao Thủy — đại vận đã Hỏa)</li>
  </ul>
</section>
```

---

## 7. PHASE 6 — Verify + Push + Open PR

```bash
cd /Users/mac/mekong-cli/FnB-Container-Caffe

# Step 1: Verify no leftover gold
echo "=== Audit leftover gold ==="
grep -rn "#D4AF37\|#FFD700\|#B8860B" --include="*.html" --include="*.css" --include="*.js" \
  | grep -v brand-tokens.css | grep -v _archive
# Expect: 0 lines

# Step 2: Verify Cormorant + Space Grotesk in HTMLs
echo "=== Verify font import ==="
grep -l "Cormorant Garamond" *.html | wc -l   # >= 8

# Step 3: Verify no Playfair/Cinzel/Manrope
echo "=== No legacy fonts ==="
grep -rln "Playfair Display\|Cinzel\|Manrope" *.html admin/*.html 2>/dev/null
# Expect: empty

# Step 4: Git status
git status

# Step 5: Create branch
git checkout -b feat/brand-v5-bazi-aligned

# Step 6: Commit per phase (atomic)
git add css/brand-tokens.css
git commit -m "feat(brand): tokens v5.0 BAZI-aligned (壬 Thủy + 庚 Kim)

- Revert v4 Gold Metallic palette (Thổ khắc Thủy)
- Add chrome/silver tokens (#C9D6DF, #6B9FB8) — Kim sinh Thủy
- Add Mộc zone tokens (#2D5A3D forest) — bar/balance
- Switch font: Playfair Display → Cormorant Garamond
- Switch font: Manrope/Inter → Space Grotesk
- Preserve legacy aliases for backward compat

Source: pencil-bazi-adjustment-prompts.md + report-nguyen-huu-con.html"

git add '*.html' 'admin/*.html'
git commit -m "fix(fonts): Cormorant Garamond + Space Grotesk per bazi spec

- Replace Playfair Display → Cormorant Garamond across 12 HTMLs
- Replace Cinzel → Cormorant Garamond
- Replace Manrope → Space Grotesk
- Unified Google Fonts import: Cormorant+Space Grotesk+JetBrains Mono"

git add '*.html' '**/*.html' 'css/' 'js/' 2>/dev/null || true
git commit -m "style(palette): replace gold → chrome (Kim sinh Thủy)

- #D4AF37 → #C9D6DF
- #FFD700 → #E8EEF3
- #B8860B → #3A6B80
- rgba gold alphas → rgba chrome alphas
- Match v5 brand-tokens" || echo "No changes"

git add css/hero-v8-bazi.css js/hero-v8-bazi.js index.html assets/brand/fnb_water_logo.png 2>/dev/null
git commit -m "feat(hero): water drop + ripple animation chrome (v8 BAZI)

- Replace hero v4 với water-drop animation (9s cycle)
- 23 cinematic layers: vignette, grain, particles, steam, specular,
  reflection, surface tension, caustics, dimple, 3D ripple plane,
  shockwave, crown splash, drop trail, condensation
- 3 interactive: mouse-reactive ripples, click-to-drop, parallax tilt
- Drop position: từ cạnh dưới góc nhọn chữ A (top:27%)
- Sync vật lý: 1 drop = 1 primary + 1 echo ripple
- Color: chrome liquid (#FFFFFF→#E8EEF3→#C9D6DF→#6B9FB8)
- Logo PNG clip top 12% (remove EST. 2023) + radial rim mask
- EST. 2018 override với Cormorant Garamond italic"

git add brand-guideline.html
git commit -m "docs(brand): add bazi rationale + do/dont section

- Document 壬 Thủy nhật chủ foundation
- List allowed colors (Kim sinh Thủy)
- List banned colors (Thổ khắc Thủy, Hỏa hao Thủy)
- Update palette swatches to chrome tokens"

# Step 7: Push branch
git push -u origin feat/brand-v5-bazi-aligned

# Step 8: Open PR via gh CLI
gh pr create \
  --title "feat(brand): v5.0 BAZI-aligned migration (Gold → Chrome, Playfair → Cormorant)" \
  --base main \
  --head feat/brand-v5-bazi-aligned \
  --body "$(cat <<'EOF'
## Summary

Migrate brand from v4.0 (Navy + Gold) to **v5.0 BAZI-aligned** (Navy + Chrome + Mộc) per bát tự chủ quán Nguyễn Hữu Còn (壬 Thủy Dương, đại vận Hỏa 2020-2029).

## Why now?

Brand v4.0 dùng Gold Metallic #D4AF37 — **vi phạm bát tự**:
- Gold = Thổ → **Thổ khắc Thủy** (nhật chủ Thủy của chủ quán)
- Đại vận hiện tại Hỏa → càng cần Kim sinh Thủy nghiêm ngặt
- Spec gốc từ \`pencil-bazi-adjustment-prompts.md\` đã cấm Gold

## Changes

| Layer | Before | After |
|---|---|---|
| Primary | Navy ✓ | Navy ✓ (giữ) |
| Accent | Gold #D4AF37 | **Chrome #C9D6DF** (Kim) |
| Highlight | Bright Gold #FFD700 | **Mirror White #E8EEF3** |
| Dark accent | Gold cool #B8860B | **Steel Blue #3A6B80** |
| Bar zone | (không có) | **Forest #2D5A3D** (Mộc) |
| Font heading | Playfair Display | **Cormorant Garamond** |
| Font body | Manrope/Inter | **Space Grotesk** |
| Hero section | Static v4 | **v8 BAZI Chrome** (animated water drop) |

## Files changed

- \`css/brand-tokens.css\` (v4 → v5 full rewrite)
- \`css/hero-v8-bazi.css\` (NEW)
- \`js/hero-v8-bazi.js\` (NEW)
- \`index.html\` (hero v8 applied)
- All HTMLs (font + hex replace)
- \`brand-guideline.html\` (bazi rationale section)

## Verification

- [ ] No \`#D4AF37\`, \`#FFD700\`, \`#B8860B\` outside brand-tokens.css legacy aliases
- [ ] All HTMLs import Cormorant Garamond + Space Grotesk
- [ ] Hero v8 visible on homepage (drop animation + ripple)
- [ ] Cloudflare Pages preview deployment OK

## Sources

- \`assets/brand/FNB_MASTER_DRIVE_AURA_SPACE_CONTAINER/05_Demos/BRAND_v5_BAZI_PLAN.md\`
- \`pencil-bazi-adjustment-prompts.md\` (uploaded specs)
- \`report-nguyen-huu-con.html\` (full bát tự report)

🔮 Bát tự-aligned · 壬 Thủy × 庚 Kim · No Gold
EOF
)"

# Step 9: Output PR URL
gh pr view --json url --jq .url
```

---

## 8. ACCEPTANCE CRITERIA

Worker chỉ báo `DONE` khi tất cả check pass:

```
[ ] css/brand-tokens.css đã chứa "v5.0 BAZI ALIGNED" comment header
[ ] grep "C9D6DF" css/brand-tokens.css | wc -l ≥ 10
[ ] grep -rn "#D4AF37\|#FFD700" --include="*.html" | grep -v brand-tokens.css | grep -v _archive | wc -l = 0
[ ] grep -rln "Cormorant Garamond" *.html | wc -l ≥ 8
[ ] grep -rln "Playfair Display\|Cinzel\|Manrope" *.html | wc -l = 0
[ ] File css/hero-v8-bazi.css tồn tại, ≥ 500 lines
[ ] File js/hero-v8-bazi.js tồn tại
[ ] File assets/brand/fnb_water_logo.png tồn tại
[ ] index.html chứa class "hero-v8"
[ ] brand-guideline.html chứa "Bát Tự Foundation"
[ ] Branch feat/brand-v5-bazi-aligned đã push lên origin
[ ] PR đã open với title chuẩn
[ ] PR URL được output ra stdout
```

---

## 9. OUTPUT FORMAT (worker phải report)

```
=== BRAND v5 BAZI MIGRATION REPORT ===
Phase 1 (tokens):      ✓ DONE | 1 file | XXX lines
Phase 2 (fonts):       ✓ DONE | N HTMLs updated
Phase 3 (hex replace): ✓ DONE | M files | K replacements
Phase 4 (hero v8):     ✓ DONE | 3 files NEW + index.html updated
Phase 5 (guideline):   ✓ DONE | brand-guideline.html updated
Phase 6 (push + PR):   ✓ DONE
PR URL: https://github.com/huuthongdongthap/FnB-Container-Caffe/pull/XX
=== END REPORT ===
```

Nếu fail bất kỳ acceptance check → report `BLOCKED` + chỉ rõ check nào fail + lý do.

---

## 10. ROLLBACK STRATEGY

Nếu sai sót sau merge:
```bash
git revert <merge-commit-sha>
git push origin main
```
Hoặc:
```bash
git checkout main
git reset --hard <pre-merge-sha>  # KHÔNG dùng nếu đã có commits sau
git push --force-with-lease origin main
```

---

**END OF WORKER TASK**
