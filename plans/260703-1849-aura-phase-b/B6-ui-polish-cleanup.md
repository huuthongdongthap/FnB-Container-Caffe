# B6: Remaining UI Polish & Cleanup

**Date:** 2026-07-03
**Status:** Planned
**Priority:** P2 Low
**Source:** UI/UX Pro Max Audit #11 (forest green tokens unused), #13 (container padding)
**Effort:** 3-4 hours
**Dependencies:** None (independent CSS/token cleanup)
**Blocks:** None

---

## 1. Technical Design

### Problem Statement

Two minor but validated items from the UI/UX Pro Max audit are not covered in Phase A:

1. **Forest green tokens unused (#11):** `brand-tokens.css` defines `--aura-forest-*` CSS variables (Rung Sau, Forest, Jade, Suong Mai) for the bar/zone theme. These are dead code — no page or component references them.

2. **Container padding (#13):** DESIGN.md spec says `container-padding: 24px` on desktop, but many pages use `px-4` (16px) or `p-4` on desktop breakpoints instead of `px-6` (24px).

### Approach

Fix #11 by integrating forest green tokens into the `FiveZoneShowcase` component's bar zone (currently using generic dark colors). Fix #13 by auditing and correcting container padding on all customer-facing pages.

#### Forest Green Integration

The `five-zone-showcase.tsx` component displays 5 zones:
- Jade Counter (green)
- Sky Deck (blue/silver)
- Noir Cabin (dark)
- Aura Lounge (chrome)
- VIP Steel Nest (dark steel)

The Jade Counter zone currently uses generic dark colors. Replace with `--aura-forest-*` tokens:
```css
zone: 'Jade Counter 🌿'
bg: 'bg-[var(--aura-forest)]'      /* #2D5A3D */
text: 'text-[var(--aura-forest-light)]'  /* #A8C5A0 */
accent: 'var(--aura-forest-jade)'       /* #4A7C59 */
```

#### Container Padding Audit

Pages to audit and fix:
- `home.tsx` — `px-4` → `px-6` on desktop (already marked in Phase A A5)
- `AboutUs.tsx` — `px-4` → `px-6`
- `Contact.tsx` — `px-4` → `px-6`
- `ReviewsPage.tsx` — `px-4` → `px-6`
- `loyalty.tsx` — verify padding
- `referral.tsx` — verify padding
- `events.tsx` — verify padding

Use Tailwind responsive classes: `px-4 md:px-6`

---

## 2. File List

### Files to Modify

| File | Change |
|------|--------|
| `src/components/home/five-zone-showcase.tsx` | Apply forest green tokens to Jade Counter zone |
| `src/pages/home.tsx` | `px-4` → `px-4 md:px-6` for container padding |
| `src/pages/AboutUs.tsx` | `px-4` → `px-4 md:px-6` |
| `src/pages/Contact.tsx` | `px-4` → `px-4 md:px-6` |
| `src/pages/ReviewsPage.tsx` | `px-4` → `px-4 md:px-6` |
| `src/pages/loyalty.tsx` | Verify and fix container padding |
| `src/pages/referral.tsx` | Verify and fix container padding |
| `src/pages/events.tsx` | Verify and fix container padding |
| `src/styles/brand-tokens.css` | (Optional) Clean up gold alias vars if any remain |

---

## 3. Database Changes

None.

---

## 4. API Endpoints

None.

---

## 5. Frontend Components

No new components. Mini refactors to existing components for padding and color token usage.

---

## 6. Tests

| Test | File | What to verify |
|------|------|----------------|
| Visual regression | Manual | Verify padding looks correct at 375px, 768px, 1280px viewports |
| Zone colors | Visual check | Jade Counter shows green tint from forest tokens |

---

## 7. Acceptance Criteria

### Forest Green Tokens
- [ ] `five-zone-showcase.tsx` Jade Counter zone uses `--aura-forest-*` CSS variables
- [ ] Bar/zone pages show green tint consistent with DESIGN.md forest palette
- [ ] Token usage verified by grep: no forest tokens are unreferenced

### Container Padding
- [ ] Home page: `px-4 md:px-6` on main container
- [ ] About Us: `px-4 md:px-6` on main container
- [ ] Contact: `px-4 md:px-6` on main container
- [ ] Reviews: `px-4 md:px-6` on main container
- [ ] Loyalty: `px-4 md:px-6` on main container
- [ ] Referral: `px-4 md:px-6` on main container
- [ ] Events: `px-4 md:px-6` on main container
- [ ] Padding on 1280px viewport = 24px matching DESIGN.md spec

### Quality Gates
- [ ] `npm run build` = 0 errors
- [ ] `npm test` = all tests pass
- [ ] Zero visual regression on 1024px+ viewports (no horizontal overflow)

---

## 8. Rollback Plan

```bash
git checkout HEAD -- src/pages/AboutUs.tsx src/pages/Contact.tsx src/pages/ReviewsPage.tsx
git checkout HEAD -- src/pages/home.tsx src/pages/loyalty.tsx src/pages/referral.tsx src/pages/events.tsx
git checkout HEAD -- src/components/home/five-zone-showcase.tsx
```

---

## 9. Estimated Effort

| Task | Time |
|------|------|
| Apply forest green tokens to FiveZoneShowcase Jade Counter | 20 min |
| Home page container padding fix | 10 min |
| About Us, Contact, Reviews page padding fix | 15 min |
| Loyalty, Referral, Events page padding fix | 15 min |
| Dead alias cleanup in brand-tokens.css | 10 min |
| Visual verification across 3 viewport sizes | 20 min |
| Build + test verification | 15 min |
| **Total** | **~2h** |
