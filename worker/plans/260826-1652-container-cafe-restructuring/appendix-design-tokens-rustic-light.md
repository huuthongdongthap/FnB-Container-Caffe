# Appendix — AURA Design Tokens v6.1 "Rustic Light"

**Date:** 2026-08-26
**Supersedes:** DESIGN.md v6.0 token *values* (dark noir / navy `#00142c`)
**Frozen:** All `--aura-*` variable NAMES, typography, fonts, spacing scale, radius, motion
**Brand:** AURA CAFE (unchanged — fictional brand retained)
**Source imagery:** Real Sa Dec cafe photos `IMG_6790`–`IMG_6796` (originals: `assets/ảnh mới/`; processed: `public/images/hero/`, `public/images/zones/`, 18 WebP files)

---

## 1. Full Token Block — v6.1 Rustic Light

```css
:root {
  /* ── Core palette ─────────────────────────────── */
  --aura-bg-page:      #F7F4EE;  /* warm lime-wash off-white (page background) */
  --aura-bg-card:      #FFFFFF;  /* card surfaces */
  --aura-bg-sunken:    #EFEAE0;  /* cement-tile beige (wells, insets, table headers) */
  --aura-primary:      #4A7C59;  /* Forest green — PRIMARY ACTION (unchanged from v6.0) */
  --aura-secondary:    #2E5E8C;  /* Container Blue — secondary actions, links, brew-bar accents */
  --aura-accent-warm:  #C08A3E;  /* Wood amber — warm accents, highlights, badges */

  /* ── Chrome (neutral metallics, carried over) ─── */
  --aura-chrome-light: #E8E8E8;
  --aura-chrome-mid:   #8E9097;

  /* ── Text (warm charcoal on light) ────────────── */
  --aura-text-primary: #2B2B26;
  --aura-text-muted:   #6E6E64;
  --aura-text-on-primary: #FFFFFF;
  --aura-text-on-secondary: #FFFFFF;

  /* ── Surface & elevation variants ─────────────── */
  --aura-surface-raised:    #FFFFFF;            /* cards above page bg */
  --aura-surface-hover:     #F1F5F2;            /* faint green-tint hover on white cards */
  --aura-surface-active:    #E4EAE6;            /* pressed/selected state */
  --aura-surface-overlay:   rgba(43, 43, 38, 0.45);  /* modal/drawer scrim over light page */
  --aura-border-subtle:     #E3DDD0;            /* hairline borders on sunken/card edges */
  --aura-border-strong:     #D4CCBC;            /* input borders, dividers */
  --aura-border-focus:      #4A7C59;            /* focus rings = primary green */

  /* ── Elevation shadows (soft, daylight) ───────── */
  --aura-shadow-sm: 0 1px 2px rgba(43, 43, 38, 0.06);
  --aura-shadow-md: 0 2px 8px rgba(43, 43, 38, 0.10);
  --aura-shadow-lg: 0 8px 24px rgba(43, 43, 38, 0.14);

  /* ── Glass (DEMOTED — sticky nav over photos only) ── */
  --aura-glass-bg:     rgba(247, 244, 238, 0.82);
  --aura-glass-blur:   8px;
  --aura-glass-border: rgba(43, 43, 38, 0.08);

  /* ── Status (light-mode adjusted) ─────────────── */
  --aura-success: #4A7C59;
  --aura-success-bg: #E4EEE7;
  --aura-warning: #B8862E;   /* darkened amber for WCAG contrast on light */
  --aura-warning-bg: #F6EDDA;
  --aura-error: #A63D33;     /* darkened red for contrast on light */
  --aura-error-bg: #F5E3E1;
}
```

---

## 2. Rationale Table — Color → Physical Source in Real Cafe

| Token | Value | Physical source (photo reference) |
|-------|-------|-----------------------------------|
| `--aura-bg-page` | `#F7F4EE` | Light lime-wash courtyard walls (IMG_6790, IMG_6791) |
| `--aura-bg-card` | `#FFFFFF` | Whitewashed wall panels + painted signage boards |
| `--aura-bg-sunken` | `#EFEAE0` | Encaustic cement floor tiles, beige tones (IMG_6790 patio floor) |
| `--aura-primary` | `#4A7C59` | Lush potted plants + pale-green painted walls (IMG_6790, IMG_6791); unchanged — v6.0 forest green already matched |
| `--aura-secondary` | `#2E5E8C` | Painted blue brew-bar counter + blue container cladding (IMG_6792, IMG_6795) |
| `--aura-accent-warm` | `#C08A3E` | Wooden communal tables, rattan chairs, Edison bulb glow (IMG_6796, IMG_6795) |
| `--aura-chrome-light/mid` | `#E8E8E8` / `#8E9097` | Metal staircase railings, steel frames (IMG_6791) — kept from v6.0 |
| `--aura-text-primary` | `#2B2B26` | Warm charcoal of weathered wood grain shadows on light surfaces |
| `--aura-text-muted` | `#6E6E64` | Faded gray-green patina on exterior container paint |

---

## 3. Glassmorphism Demotion Rules

v6.0 defaulted all cards/modals/sheets to glass panels. **v6.1 demotes glass to a single use case:**

| Rule | Detail |
|------|--------|
| Default surface | Solid opaque (`--aura-bg-card` / `--aura-surface-*`). `.glass-panel` must NOT wrap general content. |
| Allowed use | Sticky navigation bar overlaying hero/zone photography only (`--aura-glass-bg` at 0.82 opacity, blur 8px). |
| Forbidden | Glass cards, glass modals, glass sheets, glass tables, glass form containers. Replace with solid surface + `--aura-shadow-md`. |
| Migration mapping | `.glass-panel` on nav → keep; `.glass-panel` elsewhere → swap to `bg-[var(--aura-bg-card)] border border-[var(--aura-border-subtle)] shadow-md`. |

---

## 4. Migration Notes

- **Values change only. Variable names are frozen** — every existing `var(--aura-*)` reference across components remains valid with zero code churn.
- Typography (Quicksand + Be Vietnam Pro), spacing base (4px), radius scale (4/8/12/16), motion timings: **UNCHANGED from v6.0**.
- Dark-noir-specific patterns retire: `.chrome-text` gradient text, `.bronze-glow` (re-evaluate as amber glow `#C08A3E` if still needed for CTAs).
- Contrast checks: `#2B2B26` on `#F7F4EE` ≈ 13.4:1 ✓; `#FFFFFF` on `#4A7C59` ≈ 4.6:1 ✓ (AA normal text borderline — prefer large text/icons on primary buttons); warning/error tokens were darkened specifically to hold AA on the light page background.
- Imagery is already processed and on disk (18 WebP, q80, 640/1024/1920): do NOT regenerate.
