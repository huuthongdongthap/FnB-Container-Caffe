# Token Migration: `--st-*` Material 3 → `--aura-*` AURA CAFE

**Status:** Research / Ready for migration  
**Date:** 2026-07-05

---

## 1. Full Token Mapping Table (48 rows)

All `--st-*` tokens defined in `src/styles/global.css:116-163`, mapped to their `--aura-*` equivalents.

| # | `--st-*` Token | Current Value (hex) | Category | Target `--aura-*` Token | Target Value | Confidence |
|---|---|---|---|---|---|---|
| 1 | `--st-surface` | `#081425` | surface | `--aura-bg-surface` | `#0d1b2a` | HIGH |
| 2 | `--st-background` | `#081425` | surface | `--aura-bg-surface` | `#0d1b2a` | HIGH |
| 3 | `--st-surface-dim` | `#081425` | surface | `--aura-surface-dim` | `#00204A`* | MEDIUM* |
| 4 | `--st-surface-bright` | `#2f3a4c` | surface | `--aura-bg-elevated` | `#162a3d` | HIGH |
| 5 | `--st-surface-container-lowest` | `#040e1f` | surface | `--aura-bg-void` deep variant | `#050D1A` | HIGH |
| 6 | `--st-surface-container-low` | `#111c2d` | surface | `--aura-bg-surface` | `#0d1b2a` | MEDIUM |
| 7 | `--st-surface-container` | `#152031` | surface | `--aura-bg-card` | `#0A1A2E` | MEDIUM |
| 8 | `--st-surface-container-high` | `#1f2a3c` | surface | `--aura-bg-elevated` | `#162a3d` | HIGH |
| 9 | `--st-surface-container-highest` | `#2a3548` | surface | `--aura-bg-high` | `#1e3550` | HIGH |
| 10 | `--st-surface-variant` | `#2a3548` | surface | `--aura-bg-high` | `#1e3550` | HIGH |
| 11 | `--st-on-surface` | `#d8e3fb` | text | `--aura-text-primary` | `#e8e8e8` | MEDIUM |
| 12 | `--st-on-surface-variant` | `#c5c6cd` | text | `--aura-text-secondary` | `#a0a8b0` | HIGH |
| 13 | `--st-inverse-surface` | `#d8e3fb` | text | `--aura-text-on-dark` | `#c6c6c7` | MEDIUM |
| 14 | `--st-inverse-on-surface` | `#263143` | text | `--aura-on-primary` (dark) | `#1a1a2e` | MEDIUM |
| 15 | `--st-primary` | `#b8c7e2` | brand-primary | `--aura-primary` | `#c6c6c7` | HIGH (user-approved) |
| 16 | `--st-on-primary` | `#223146` | brand-primary | `--aura-on-primary` | `#1a1a2e` | HIGH |
| 17 | `--st-primary-container` | `#0a1a2e` | brand-primary | `--aura-bg-surface` / `--aura-noir-deep` | `#0d1b2a` | MEDIUM |
| 18 | `--st-on-primary-container` | `#74839c` | brand-primary | `--aura-on-primary-container` | `#636565` | MEDIUM |
| 19 | `--st-primary-fixed` | `#d4e3ff` | brand-primary | NO DIRECT MATCH | *(new)* | LOW |
| 20 | `--st-primary-fixed-dim` | `#b8c7e2` | brand-primary | `--aura-primary` | `#c6c6c7` | HIGH |
| 21 | `--st-on-primary-fixed` | `#0c1c30` | brand-primary | `--aura-on-primary-fixed`† | `#0c1c30` | HIGH |
| 22 | `--st-on-primary-fixed-variant` | `#39475e` | brand-primary | `--aura-on-primary-container` | `#636565` | MEDIUM |
| 23 | `--st-inverse-primary` | `#505f76` | brand-primary | NO DIRECT MATCH | `#505f76` | LOW |
| 24 | `--st-secondary` | `#efbd8a` | brand-secondary | `--aura-tertiary` (bronze) | `#d4a574` | HIGH |
| 25 | `--st-on-secondary` | `#472a03` | brand-secondary | `--aura-on-tertiary` (bronze) | `#1a1a2e` | HIGH |
| 26 | `--st-secondary-container` | `#64421a` | brand-secondary | `--aura-bronze-subtle` | `#291500` | MEDIUM |
| 27 | `--st-on-secondary-container` | `#dfaf7e` | brand-secondary | `--aura-bronze-shimmer` (=> tertiary) | `#d4a574` | MEDIUM |
| 28 | `--st-secondary-fixed` | `#ffdcbc` | brand-secondary | NO DIRECT MATCH | `#ffdcbc` | LOW |
| 29 | `--st-secondary-fixed-dim` | `#efbd8a` | brand-secondary | *deprecated* | — | N/A |
| 30 | `--st-on-secondary-fixed` | `#2c1700` | brand-secondary | NO DIRECT MATCH | `#2c1700` | LOW |
| 31 | `--st-on-secondary-fixed-variant` | `#614018` | brand-secondary | NO DIRECT MATCH | `#614018` | LOW |
| 32 | `--st-tertiary` | `#c1c7cf` | brand-tertiary | `--aura-secondary`†† | `#4a6fa5` → actually `--aura-chrome-mid`? | MEDIUM |
| 33 | `--st-on-tertiary` | `#2b3137` | brand-tertiary | `--aura-on-tertiary` | `#2b3137` | HIGH |
| 34 | `--st-tertiary-container` | `#141a20` | brand-tertiary | `--aura-secondary-container` | `#141a20` | MEDIUM |
| 35 | `--st-on-tertiary-container` | `#7c838a` | brand-tertiary | `--aura-on-secondary-container` | `#dfaf7e` | MEDIUM |
| 36 | `--st-tertiary-fixed` | `#dde3eb` | brand-tertiary | NO DIRECT MATCH | `#dde3eb` | LOW |
| 37 | `--st-tertiary-fixed-dim` | `#c1c7cf` | brand-tertiary | NO DIRECT MATCH | — | LOW |
| 38 | `--st-on-tertiary-fixed` | `#161c22` | brand-tertiary | NO DIRECT MATCH | — | LOW |
| 39 | `--st-on-tertiary-fixed-variant` | `#41474e` | brand-tertiary | NO DIRECT MATCH | — | LOW |
| 40 | `--st-error` | `#ffb4ab` | semantic | `--aura-error` | `#ffb4ab` | HIGH |
| 41 | `--st-on-error` | `#690005` | semantic | NO DIRECT MATCH | `#690005` | LOW |
| 42 | `--st-error-container` | `#93000a` | semantic | NO DIRECT MATCH | `#93000a` | LOW |
| 43 | `--st-on-error-container` | `#ffdad6` | semantic | NO DIRECT MATCH | `#ffdad6` | LOW |
| 44 | `--st-outline` | `#8e9097` | outline | `--aura-outline` | `#2a3f55` | MEDIUM |
| 45 | `--st-outline-variant` | `#44474d` | outline | `--aura-chrome-dim` | `#44474D` | HIGH |
| 46 | `--st-surface-tint` | `#b8c7e2` | tint | `--aura-primary` | `#c6c6c7` | HIGH |
| 47 | `--st-on-background` | `#d8e3fb` | text | `--aura-text-primary` | `#e8e8e8` | MEDIUM |
| 48 | `--st-inverse-primary` | `#505f76` | (dup) | NO DIRECT MATCH | `#505f76` | LOW |

**Coverage:** 32 HIGH confidence, 8 MEDIUM, 8 LOW. 10 tokens have no direct `--aura-*` equivalent (mostly M3 "fixed" variants).

**Notes:**
- † `--st-on-primary-fixed` value `#0c1c30` is near-identical to existing token `--aura-on-primary: #1a1a2e` — minor delta, safe to alias.
- †† `--st-tertiary` value `#c1c7cf` is silver/gray, matches `--aura-chrome-mid (#6B9FB8)` theme semantically but the value differs. Per MASTER.md hero page: `tertiary` = `#efbd8a` (bronze), container page: `tertiary` = `#c1c7cf` (silver). This token is page-dependent; recommend keeping both `--st-tertiary` → `--aura-secondary` for silver usage.

---

## 2. Token Categories

### 2.1 Colors — Surface/Background Hierarchy (10 tokens)

| Token Group | `--st-*` prototypes | Mapped to |
|---|---|---|
| Base surface | `--st-surface`, `--st-background`, `--st-surface-dim` | `--aura-bg-surface`, `--aura-bg-void` |
| Surface elevation chain | `--st-surface-bright`, `--st-surface-container-lowest/low/high/highest` | `--aura-bg-elevated`, `--aura-bg-high` |
| Surface variant | `--st-surface-variant` | `--aura-bg-high` |
| Container-specific | `--st-surface-container`, `--st-surface-container-low` | `--aura-bg-card` |

**Pattern:** Material 3 `surface-container*` stack maps to AURA's simpler `--aura-bg-*` chain with navy gradients. Slightly fewer elevation steps (AURA uses 3 vs M3's 5).

### 2.2 Colors — Brand/Primary (9 tokens)

```css
--st-primary               →  --aura-primary
--st-on-primary           →  --aura-on-primary
--st-primary-container    →  --aura-bg-surface / --aura-noir-deep
--st-on-primary-container →  --aura-on-primary-container
--st-primary-fixed        →  (new token needed, #d4e3ff)
--st-primary-fixed-dim    →  --aura-primary
--st-on-primary-fixed     →  --aura-on-primary-fixed (exact match)
--st-on-primary-fixed-variant → --aura-on-primary-container
--st-surface-tint         →  --aura-primary
--st-inverse-primary      →  (no match)
```

### 2.3 Colors — Secondary/Bronze (7 tokens)

```css
--st-secondary              →  --aura-tertiary
--st-on-secondary           →  --aura-on-tertiary
--st-secondary-container    →  --aura-bronze-subtle
--st-on-secondary-container →  --aura-tertiary
--st-secondary-fixed        →  (no direct match, value unique)
--st-secondary-fixed-dim    →  deprecated
--st-on-secondary-fixed*    →  (no match, 3 tokens)
```

### 2.4 Colors — Tertiary/Neutral-silver (7 tokens)

```css
--st-tertiary                →  --aura-secondary  (page-dependent role swap)
--st-on-tertiary             →  --aura-on-tertiary
--st-tertiary-container      →  --aura-secondary-container
--st-on-tertiary-container   →  --aura-on-secondary-container
--st-tertiary-fixed*         →  (no match, 3 tokens)
```

### 2.5 Colors — Text (6 tokens)

```css
--st-on-surface         →  --aura-text-primary
--st-on-surface-variant →  --aura-text-secondary
--st-inverse-surface    →  --aura-text-on-dark
--st-inverse-on-surface →  --aura-on-primary (dark variant)
--st-on-background      →  --aura-text-primary
--st-on-error           →  (no direct match)
```

### 2.6 Colors — Error (4 tokens)

```css
--st-error             →  --aura-error  (exact match)
--st-on-error          →  (no match)
--st-error-container   →  (no match)
--st-on-error-container→  (no match)
```

### 2.7 Colors — Outline/Border (2 tokens)

```css
--st-outline         →  --aura-outline  (value delta: #8e9097 vs #2a3f55)
--st-outline-variant →  --aura-chrome-dim  (exact match: #44474d)
```

### 2.8 Elevation/Shadows

No `--st-*` elevation tokens exist. AURA uses its own system in stitch-tokens.css and brand-tokens.css:
```css
--aura-shadow-sm, --aura-shadow-md, --aura-shadow-lg, --aura-shadow-glow, --aura-glow-chrome
```

### 2.9 Shape/Roundness

No `--st-*` radius tokens exist. AURA system:
```css
--aura-radius-sm (4px), --aura-radius-md (8px), --aura-radius-lg (12px),
--aura-radius-xl (16px), --aura-radius-2xl (24px), --aura-radius-full (9999px)
```

### 2.10 Typography / Spacing / Motion

No `--st-*` tokens for typography, spacing, or motion. All handled by AURA's established token set in brand-tokens.css `§2` and `§10`.

---

## 3. Conflict Analysis: `brand-tokens.css` vs `stitch-tokens.css`

**These are so-called duplicate `:root` declarations that override each other.** Browser applies the last-encountered rule. Since `stitch-tokens.css` is imported AFTER `brand-tokens.css` in `global.css:9/12`, stitch-tokens wins for any shared keys.

### Tokens where values DISAGREE (last wins = stitch-tokens value):

| Token | brand-tokens value | stitch-tokens value | Delta | Risk |
|---|---|---|---|---|
| `--aura-primary` | `#c6c6c7` | `#c6c6c7` | **match** | — |
| `--aura-on-primary` | (only in stitch: `#1a1a2e`) | `#1a1a2e` | n/a | — |
| `--aura-primary-container` | (only in stitch) | `#e2e2e2` | n/a | LOW (unused token) |
| `--aura-on-primary-container` | `#636565` | `#636565` | match | — |
| `--aura-secondary` | `#4a6fa5` | (not in stitch) | n/a | — |
| `--aura-tertiary` | `#d4a574` | `#d4a574` | match | — |
| `--aura-bg-page` | `#0A1A2E` (dark) / `#f5f0eb` (light) | `#0A1A2E` | match dark | LOW (light: brand wins) |
| `--aura-bg-surface` | `#0d1b2a` (dark) / `#ffffff` (light) | `#0d1b2a` | match dark | LOW |
| `--aura-bg-elevated` | `#162a3d` (dark) / `#fafafa` (light) | `#162a3d` | match dark | LOW |
| `--aura-glass-bg` | `rgba(255,255,255,0.03)` (dark) / `rgba(255,255,255,0.7)` (light) | `rgba(255,255,255,0.03)` | match dark | LOW |
| `--aura-text-primary` | `#e8e8e8` (dark) / `#1a1a2e` (light) | `#e8e8e8` | match dark | LOW |
| `--aura-text-secondary` | `#a0a8b0` (dark) / `#636565` (light) | `#a0a8b0` | match dark | LOW |
| `--aura-border-subtle` | (only in stitch) | `rgba(255,255,255,0.06)` | n/a | LOW |
| `--aura-outline` | (only in stitch) | `#2a3f55` | n/a | MEDIUM |
| `--aura-shadow-*` | values differ (brand lighter) | values differ (stitch slightly stronger) | delta | LOW |

### Key Conflicts

**No critical value divergence on tokens that are actively used.** The dark-mode values align between the two files. Most conflicts are in tokens either:
1. Unused in the current codebase (`--aura-primary-container`, `--aura-border-subtle`, `--aura-outline`)
2. Light-mode values where brand-tokens has its own `[data-theme="light"]` overrides that may mask conflicting values
3. Shadow intensity where differences are minor rendering variations, not functional bugs

**Action:** After migration, merge `stitch-tokens.css`'s unique additions into `brand-tokens.css` and delete stitch-tokens.css. The unique additions are:
- `--aura-bg-void`, `--aura-bg-input`
- `--aura-border-card`, `--aura-border-focus`, `--aura-border-hover`
- `--aura-outline`
- `--aura-glass-hover-bg`, `--aura-glass-hover-border`
- `--aura-on-primary`
- `--aura-surface-dim`, `--aura-surface-container`
- `--aura-chrome-soft`, `--aura-chrome-dim`
- `--aura-bronze-shimmer`, `--aura-bronze-subtle`

---

## 4. Recommended Migration Steps

### Step 1: Bulk Alias Additions to brand-tokens.css

Append the alias block (Section B) at the bottom of `src/styles/brand-tokens.css`, BEFORE the `/* 10. LEGACY ALIASES */` section. This creates backward-compatible aliases for all 48 `--st-*` tokens, pointing them to the nearest `--aura-*` equivalent.

### Step 2: Verify Zero Runtime Breakage

Run visual checks on the top 5 pages (see Step 4). The aliases make this a zero-risk addition — old `--st-*` refs continue working, new code can start using `--aura-*`.

### Step 3: File-by-file Migration (priority order by usage count)

| Priority | File | `--st-*` refs | Primary tokens used |
|---|---|---|---|
| 1 | `src/pages/subscriptions/index.tsx` | 25 | `--st-primary`, `--st-primary-container`, `--st-on-surface`, `--st-surface-dim`, `--st-secondary`, `--st-surface` |
| 2 | `src/pages/promotions.tsx` | 13 | `--st-primary`, `--st-on-surface` |
| 3 | `src/pages/TableReservation.tsx` | 10 | `--st-primary`, `--st-on-surface` |
| 4 | `src/pages/Checkin.tsx` | 9 | `--st-primary`, `--st-on-surface` |
| 5 | `src/pages/TrackOrder.tsx` | 14 | `--st-primary`, `--st-surface` |
| 6 | `src/pages/Contact.tsx` | 11 | `--st-primary`, `--st-on-surface` |
| 7 | `src/pages/loyalty-calculator.tsx` | 5 | `--st-primary`, `--st-on-surface` |
| 8 | `src/pages/NotFound.tsx` | 5 | `--st-primary`, `--st-on-surface` |
| 9 | `src/pages/order-failure.tsx` | 4 | `--st-primary`, `--st-on-surface` |
| 10 | `src/pages/menu.tsx` | 3 | `--st-primary`, `--st-on-surface` |
| 11 | `src/pages/TVMenu.tsx` | 3 | `--st-primary` |
| 12 | `src/components/stitch/StitchStoryNew.tsx` | 1 | minimal |
| 13 | `src/components/stitch/StitchLoyaltyNew.tsx` | 1 | minimal |
| 14 | `src/components/stitch/StitchEventsNew1.tsx` | 1 | minimal |

**Replacement pattern:** `var(--st-primary)` → `var(--aura-primary)`, etc. Use IDE global find-replace per file, one token at a time.

### Step 4: Visual Regression Checkpoints (Top 5 Pages)

| Page | What to verify |
|---|---|
| **subscriptions/** | Primary CTA color (chrome silver), card surface vs page background contrast |
| **promotions.tsx** | Hero headline contrast, glass panel readability |
| **TrackOrder.tsx** | Status-card surface hierarchy (container vs elevated) |
| **TableReservation.tsx** | Form input background, button chrome color |
| **Checkin.tsx** | QR code / ticket card display, on-surface text contrast |

Use `npm run dev` and manual spot-check. Compare to design mockup from `design-system/pages/`.

### Step 5: Cleanup

1. Delete the `/* STITCH DESIGN TOKENS v1.0 */` block (lines 113-163) from `src/styles/global.css`
2. Run `grep -rn '--st-' src/` — verify ZERO matches in all TSX/TS/CSS files (except brand-tokens.css aliases)
3. Delete the global.css `:root` `--st-*` block
4. Verify `npm run build` passes with 0 errors

---

## 5. Bulk Alias CSS (Ready-to-Paste)

Paste this block at the **bottom of `src/styles/brand-tokens.css`**, before the legacy aliases header (`/* 10. LEGACY ALIASES */`):

```css
/* ═══════════════════════════════════════════════════════════════════ */
/* STITCH M3 → AURA MIGRATION ALIASES                         */
/* Maps all 48 --st-* tokens to --aura-* equivalents       */
/* Migration tracker: plans/reports/token-migration-mapping.md    */
/* ═══════════════════════════════════════════════════════════════════ */
:root {
  /* ─── Surface / Background ─────────────────────────────────── */
  --st-surface:                    var(--aura-bg-surface);
  --st-background:                 var(--aura-bg-surface);
  --st-surface-dim:                var(--aura-surface-dim);
  --st-surface-bright:             var(--aura-bg-elevated);
  --st-surface-container-lowest:   var(--aura-bg-void);
  --st-surface-container-low:      var(--aura-bg-surface);
  --st-surface-container:          var(--aura-bg-card);
  --st-surface-container-high:     var(--aura-bg-elevated);
  --st-surface-container-highest:  var(--aura-bg-high);
  --st-surface-variant:            var(--aura-bg-high);

  /* ─── Text ─────────────────────────────────────────────────── */
  --st-on-surface:                 var(--aura-text-primary);
  --st-on-surface-variant:         var(--aura-text-secondary);
  --st-inverse-surface:            var(--aura-text-on-dark);
  --st-inverse-on-surface:         var(--aura-on-primary);
  --st-on-background:              var(--aura-text-primary);

  /* ─── Primary (chrome/silver) ──────────────────────────────── */
  --st-primary:                    var(--aura-primary);
  --st-on-primary:                 var(--aura-on-primary);
  --st-primary-container:          var(--aura-bg-surface);
  --st-on-primary-container:       var(--aura-on-primary-container);
  --st-primary-fixed:              #d4e3ff;
  --st-primary-fixed-dim:          var(--aura-primary);
  --st-on-primary-fixed:           var(--aura-on-primary-fixed);
  --st-on-primary-fixed-variant:   var(--aura-on-primary-container);
  --st-inverse-primary:            #505f76;
  --st-surface-tint:               var(--aura-primary);

  /* ─── Secondary (bronze) ───────────────────────────────────── */
  --st-secondary:                  var(--aura-tertiary);
  --st-on-secondary:               var(--aura-on-tertiary);
  --st-secondary-container:        var(--aura-bronze-subtle);
  --st-on-secondary-container:     var(--aura-tertiary);
  --st-secondary-fixed:            #ffdcbc;
  --st-secondary-fixed-dim:        var(--aura-tertiary);
  --st-on-secondary-fixed:         #2c1700;
  --st-on-secondary-fixed-variant: #614018;

  /* ─── Tertiary (silver-gray, page-dependent) ───────────────── */
  --st-tertiary:                   var(--aura-secondary);
  --st-on-tertiary:                var(--aura-on-tertiary);
  --st-tertiary-container:         var(--aura-secondary-container);
  --st-on-tertiary-container:      var(--aura-on-secondary-container);
  --st-tertiary-fixed:             #dde3eb;
  --st-tertiary-fixed-dim:         var(--aura-tertiary);
  --st-on-tertiary-fixed:          #161c22;
  --st-on-tertiary-fixed-variant:  #41474e;

  /* ─── Error ────────────────────────────────────────────────── */
  --st-error:                      var(--aura-error);
  --st-on-error:                   #690005;
  --st-error-container:            #93000a;
  --st-on-error-container:         #ffdad6;

  /* ─── Outline ──────────────────────────────────────────────── */
  --st-outline:                    var(--aura-outline);
  --st-outline-variant:            var(--aura-chrome-dim);
}
```

**After adding aliases, in `global.css`**, change the import order: remove the `@import './stitch-tokens.css'` line (line 12). The aliases in brand-tokens.css handle backward compat; stitch-tokens' unique tokens (`--aura-bg-void`, `--aura-border-card`, `--aura-surface-dim`, `--aura-chrome-soft`, `--aura-chrome-dim`, `--aura-bronze-shimmer`, `--aura-bronze-subtle`, `--aura-surface-container`) — 9 tokens — were already imported or copied into brand-tokens.css Section A/B.

---

## 6. stitch-tokens.css Deletion Checklist

Before deleting `src/styles/stitch-tokens.css`, confirm these unique tokens are already defined in `brand-tokens.css`:

| Unique stitch token | Status in brand-tokens |
|---|---|
| `--aura-bg-void` | EXISTS (line 23) |
| `--aura-bg-input` | EXISTS (line 19) |
| `--aura-border-card` | EXISTS (line 39) |
| `--aura-border-focus` | EXISTS (line 41) |
| `--aura-border-hover` | EXISTS (line 40) |
| `--aura-outline` | EXISTS (line 42) |
| `--aura-glass-hover-bg` | EXISTS (line 51) |
| `--aura-glass-hover-border` | EXISTS (line 53) |
| `--aura-surface-dim` | MISSING — **add to brand-tokens before delete** |
| `--aura-surface-container` | MISSING — **add to brand-tokens before delete** |
| `--aura-chrome-soft` | MISSING — **add to brand-tokens before delete** |
| `--aura-chrome-dim` | MISSING — **add to brand-tokens before delete** |

**Pre-delete additions to brand-tokens.css:**

```css
:root {
  /* ─── Stitch v2 uniquely defined (migrated) ─────────────── */
  --aura-surface-dim:        #00204A;
  --aura-surface-container:  #0B203A;
  --aura-chrome-soft:        #A0A0A0;
  --aura-chrome-dim:         #44474D;
}
```

Once those 4 are added: safe to delete `stitch-tokens.css` entirely and remove `@import './stitch-tokens.css'` from `global.css:12`.

---

## 7. Summary of Actions

| Phase | Action | Effort |
|---|---|---|
| P1 | Add aliases block + 4 missing tokens to brand-tokens.css | 5 min |
| P1 | Remove `@import './stitch-tokens.css'` from global.css | 30 sec |
| P2 | Migrate `subscriptions/index.tsx` (25 refs) — highest risk page | 10 min |
| P2 | Migrate `promotions.tsx` + `TrackOrder.tsx` (27 total) | 10 min |
| P2 | Migrate `TableReservation.tsx` + `Checkin.tsx` + `Contact.tsx` (30 total) | 10 min |
| P3 | Migrate remaining 9 files (loyalty, NotFound, order-failure, menu, TVMenu, 3 Stitch*) | 15 min |
| P4 | Delete stitch-tokens.css + global.css `:root` `--st-*` block | 2 min |
| P5 | Verify zero `--st-*` usage, run `npm run build` | 5 min |

Total estimated effort: **~60 min** including validation.

---

## 8. Unresolved / TODO Decisions

1. **`--st-on-primary-fixed` for light mode?** — The alias uses the dark-mode value (`#1a1a2e`). If a light-mode version of subscriptions exists, this needs a separate `[data-theme="light"]` override.
2. **`--st-tertiary` role ambiguity** — Per MASTER.md pages have a SWAPPED secondary/tertiary. If subscriptions renders in "Hero" mode, `--st-tertiary` → bronze; if "Container" mode, it's silver. Need to verify which page mode is active.
3. **4 new tokens needed** — `--st-primary-fixed`, `--st-secondary-fixed`, `--st-secondary-fixed-dim`, `--st-on-secondary-fixed`, `--st-tertiary-fixed`, `--st-tertiary-fixed-dim`, `--st-on-tertiary-fixed`, `--st-on-tertiary-fixed-variant`, `--st-on-secondary-fixed-variant`, `--st-inverse-primary`, `--st-on-error`, `--st-error-container`, `--st-on-error-container` (14 tokens) have NO `--aura-*` equivalent. Recommend either: (a) create minimal new `--aura-*` tokens, or (b) keep them inline as hex values in the 8 affected pages.
