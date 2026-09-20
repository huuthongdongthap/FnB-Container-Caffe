# AURA OS — Component Matrix & Consolidation Audit

This matrix inventories all UI component systems, maps legacy→MD3 parity, identifies consolidation candidates, and records design-token violations.

---

## 1. Component System Inventory

| System | Location | Real Modules | Barrel Export | Primary Consumers | Status |
|---|---|---|---|---|---|
| **Legacy UI** | `src/components/ui/` | 14 | `src/components/ui/index.ts` (10/14 exported) | 120 files | **Active (to migrate)** |
| **MD3 Primitives** | `src/components/md3/` | 14 | `src/components/md3/index.ts` | 2 files | **Canonical (under-used)** |
| **Stitch Composite** | `src/components/stitch/` | ~30 | `src/components/stitch/index.ts` | Pages + Features | **Active** |
| **Domain Features** | `src/components/{cart,menu,kds,admin,order,tv-menu,chat,reviews,about,kds}/` | 20+ | Various | Pages | **Active** |

---

## 2. Legacy UI → MD3 Primitive Parity Map

| Legacy Primitive (`ui/`) | MD3 Equivalent (`md3/`) | Consumers (Total) | Barrel-Only | Direct Import | Migration Complexity |
|---|---|---|---|---|---|
| `Button` / `button.tsx` | `MD3Button` / `md3-button.tsx` | 75 | 5 | 70 | Medium (variant prop mapping) |
| `Card` / `card.tsx` | `MD3Card` / `md3-card.tsx` | 63 | 9 | 54 | Medium (elevation→variant) |
| `Badge` / `badge.tsx` | `MD3Chip` / `md3-chip.tsx` | 35 | 8 | 27 | Low (similar API) |
| `Input` / `input.tsx` | `MD3TextField` / `md3-text-field.tsx` | 21 | 1 | 20 | High (label/floating API diff) |
| `Skeleton` / `skeleton.tsx` | `MD3ProgressIndicator` / `md3-progress-indicator.tsx` | 24 | 1 | 23 | Medium (linear vs circular) |
| `Modal` / `modal.tsx` | `MD3Dialog` / `md3-dialog.tsx` | 17 | 0 | 17 | High (headless vs controlled) |
| `Toast` / `toast.tsx` | `MD3Snackbar` / `md3-snackbar.tsx` | 4 | 0 | 4 | Low (similar API) |
| `Drawer` / `drawer.tsx` | *No direct MD3* (use Dialog/Sheet) | 1 | 0 | 1 | Custom |
| `Navbar` / `navbar.tsx` | `MD3TopAppBar` / `md3-top-app-bar.tsx` | 0 | 0 | 0 | **Dead** |
| `Footer` / `footer.tsx` | *No MD3 equivalent* | 0 | 0 | 0 | **Dead** |
| `AuraImage` / `AuraImage.tsx` | *No MD3 equivalent* | 3 | 0 | 3 | Keep (domain-specific) |
| `Switch` / `switch.tsx` | *No MD3 equivalent* | 1 | 0 | 1 | Keep |
| `GlassCard` / `glass-card.tsx` | *No MD3 equivalent* | 0 | 0 | 0 | **Dead** |
| `BottomNav` / `bottom-nav.tsx` | `MD3NavigationBar` / `md3-navigation-bar.tsx` | 0 | 0 | 0 | **Dead** |

**Key Finding:** 4 legacy primitives (`navbar`, `footer`, `glass-card`, `bottom-nav`) have **zero consumers** — they exist in `ui/` but are excluded from the barrel and unused. 3 primitives (`AuraImage`, `Switch`, `Drawer`) have consumers but no MD3 equivalent — these are domain keepers.

---

## 3. MD3 Primitive Inventory & Readiness

| MD3 Primitive | File | Tests | API Stability | Used By |
|---|---|---|---|---|
| `MD3AppShell` | `md3-app-shell.tsx` | ✓ | Stable | `CustomerShell`, `OpsShell` |
| `MD3Button` | `md3-button.tsx` | ✓ | Stable | — |
| `MD3Card` | `md3-card.tsx` | ✓ | Stable | — |
| `MD3Chip` | `md3-chip.tsx` | ✓ | Stable | — |
| `MD3Dialog` | `md3-dialog.tsx` | ✓ | Stable | — |
| `MD3Fab` | `md3-fab.tsx` | ✓ | Stable | — |
| `MD3IconButton` | `md3-icon-button.tsx` | ✓ | Stable | — |
| `MD3Menu` | `md3-menu.tsx` | ✓ | Stable | — |
| `MD3NavigationBar` | `md3-navigation-bar.tsx` | ✓ | Stable | — |
| `MD3ProgressIndicator` | `md3-progress-indicator.tsx` | ✓ | Stable | — |
| `MD3Snackbar` | `md3-snackbar.tsx` | ✓ | Stable | — |
| `MD3TextField` | `md3-text-field.tsx` | ✓ | Stable | — |
| `MD3TopAppBar` | `md3-top-app-bar.tsx` | ✓ | Stable | — |
| `MD3NavigationDrawer` | `md3-navigation-drawer.tsx` | ✓ | Stable | — |

**Critical Gap:** MD3 primitives are production-ready (14/14 have tests, stable APIs) but only **2 files consume them directly** (`CustomerShell.tsx`, `ui/index.ts` barrel). The legacy `ui/` barrel re-exports MD3 primitives but 120 consumers still import legacy implementations.

---

## 4. Barrel Export Analysis (`src/components/ui/index.ts`)

```ts
// Legacy re-exports (10 of 14 real modules)
export { Button } from './button';
export { Card, CardHeader, CardContent, CardFooter } from './card';
export { Badge } from './badge';
export { Input } from './input';
export { Skeleton } from './skeleton';
export { Modal } from './modal';
export { AuraImage } from './AuraImage';
export { Drawer } from './drawer';
export { Navbar } from './navbar';        // 0 consumers
export { Footer } from './footer';        // 0 consumers

// MD3 re-exports (all 14 primitives)
export {
  MD3Button, MD3Card, MD3Chip, MD3Dialog, MD3Fab,
  MD3IconButton, MD3Menu, MD3NavigationBar, MD3ProgressIndicator,
  MD3Snackbar, MD3TextField, MD3TopAppBar, MD3NavigationDrawer,
  MD3AppShell,
} from '@/components/md3';
```

**Defect:** The barrel mixes legacy + MD3 without a migration strategy. Consumers importing `Button` from `@/components/ui` get the legacy Tailwind implementation, NOT `MD3Button`. There is no adapter layer.

---

## 5. Design Token Violation Inventory (Raw Tailwind Classes)

**Scan Results:** 432 files / 1,290 occurrences of prohibited raw classes:
- Colors: `bg-white`, `text-white`, `bg-black`, `text-black`, `bg-gray-\d+`, `text-gray-\d+`
- Shapes: `rounded-lg`, `rounded-xl`, `rounded-2xl`, `rounded-md`

### Top 30 Offending Files (by occurrence count)

| Count | File | Primary Violation Types |
|---|---|---|
| 25 | `src/pages/stitch/admin-orders/index.tsx` | bg-white, text-gray, rounded-lg |
| 22 | `src/pages/stitch/admin-pos/index.tsx` | bg-white, text-gray, rounded-lg |
| 18 | `src/components/chat/ChatWidget.tsx` | bg-white, text-gray, rounded-lg |
| 18 | `src/components/ui/navbar.tsx` | bg-white, text-gray, rounded-lg |
| 17 | `src/pages/stitch/order-management/order-management-sub-components.tsx` | bg-white, text-gray, rounded-lg |
| 15 | `src/components/stitch/StitchOrderMgmtNew-dashboard.tsx` | bg-white, text-gray, rounded-lg |
| 15 | `src/pages/promotions.tsx` | bg-white, text-gray, rounded-lg |
| 15 | `src/pages/stitch/referral/index.tsx` | bg-white, text-gray, rounded-lg |
| 13 | `src/components/kds/OrderTicket.tsx` | bg-white, text-gray, rounded-lg |
| 13 | `src/components/tv-menu/QRCodeOverlay.tsx` | bg-white, text-gray, rounded-lg |
| 13 | `src/pages/admin/GenerateQR-qr-card.tsx` | bg-white, text-gray, rounded-lg |
| 13 | `src/pages/admin/TableManagement-card.tsx` | bg-white, text-gray, rounded-lg |
| 12 | `src/pages/admin/TableManagement.tsx` | bg-white, text-gray, rounded-lg |
| 11 | `src/components/order/SplitBillModal.tsx` | bg-white, text-gray, rounded-lg |
| 11 | `src/components/stitch/StitchCheckoutNew.tsx` | bg-white, text-gray, rounded-lg |
| 11 | `src/pages/admin/BroadcastPage-form.tsx` | bg-white, text-gray, rounded-lg |
| 11 | `src/pages/admin/ChatInbox-detail-view.tsx` | bg-white, text-gray, rounded-lg |
| 11 | `src/pages/stitch/kds/index.tsx` | bg-white, text-gray, rounded-lg |
| 10 | `src/pages/admin/ChatInbox.tsx` | bg-white, text-gray, rounded-lg |
| 10 | `src/pages/admin/notification-preferences.tsx` | bg-white, text-gray, rounded-lg |
| 10 | `src/pages/stitch/admin-v2/index.tsx` | bg-white, text-gray, rounded-lg |
| 9 | `src/components/reviews/ReviewForm.tsx` | bg-white, text-gray, rounded-lg |
| 9 | `src/components/stitch/StitchEventsNew2-empty.tsx` | bg-white, text-gray, rounded-lg |
| 9 | `src/components/tv-menu/CategoryCarousel.tsx` | bg-white, text-gray, rounded-lg |
| 9 | `src/pages/Contact.tsx` | bg-white, text-gray, rounded-lg |
| 9 | `src/pages/TableReservation-ReservationSidebar.tsx` | bg-white, text-gray, rounded-lg |
| 9 | `src/pages/admin/BroadcastPage-result-view.tsx` | bg-white, text-gray, rounded-lg |
| 9 | `src/pages/admin/Customers.tsx` | bg-white, text-gray, rounded-lg |
| 9 | `src/pages/stitch/checkout/index.tsx` | bg-white, text-gray, rounded-lg |
| 8 | `src/components/about/ContainerConcept.tsx` | bg-white, text-gray, rounded-lg |

### Violation Categories by Domain

| Domain | Files | Occurrences | Priority |
|---|---|---|---|
| Admin (stitch + pages) | ~45 | ~280 | **High** — HQ data density needs tokens |
| Stitch Pages (KDS, Order, Checkout) | ~35 | ~220 | **High** — Production customer flows |
| Stitch Components | ~25 | ~180 | **High** — Shared composites |
| KDS / TV Menu Components | ~15 | ~95 | **High** — OpsShell must be dark |
| Chat / Reviews / Order | ~20 | ~130 | Medium |
| Promotions / Referral / Contact | ~15 | ~95 | Medium |
| Other / Legacy | ~277 | ~290 | Low (long tail) |

---

## 6. Token Source-of-Truth Conflict

**Finding:** Two token files define overlapping `--aura-*` properties with different import order:

| Token | `brand-tokens.css` (imported 1st) | `aura-tokens.css` (imported 2nd) | Winner (Cascade) |
|---|---|---|---|
| `--aura-noir-deep` | `#0A1A2E` | *undefined* | brand-tokens |
| `--aura-chrome-bright` | `#E8EEF3` | *undefined* | brand-tokens |
| `--aura-chrome-light` | `#C9D6DF` | *undefined* | brand-tokens |
| `--aura-chrome-mid` | `#6B9FB8` | `--aura-chrome-500` = `#6B9FB8` | brand-tokens (same value) |
| `--aura-border-chrome` | `rgba(201,214,223,0.25)` | *undefined* | brand-tokens |
| `--aura-on-primary` | `var(--aura-noir-deep)` | *undefined* | brand-tokens |
| `--aura-secondary` | `var(--aura-chrome-light)` | *undefined* | brand-tokens |
| `--aura-outline` | `var(--aura-chrome-mid)` | *undefined* | brand-tokens |
| `--aura-bg-surface` | `var(--aura-noir-deep)` | *undefined* | brand-tokens |
| `--aura-navy-900` | *undefined* | `#0A1128` | aura-tokens |
| `--aura-noir-void` | *undefined* | `#050814` | aura-tokens |
| `--aura-pearl-50` | *undefined* | `#FAFAF8` | aura-tokens |
| `--aura-bronze-500` | *undefined* | `#D4AF37` | aura-tokens |

**Conflict:** Spec names `aura-tokens.css` as canonical, but `brand-tokens.css` is imported first in `global.css` and defines tokens the canonical file lacks. This creates silent precedence bugs.

**Remediation (Phase 2):** Consolidate into single source `aura-tokens.css`; remove `brand-tokens.css` import; update all references.

---

## 7. Consolidation Decisions

| Component | Decision | Rationale |
|---|---|---|
| `ui/navbar.tsx` | **DELETE** | 0 consumers, replaced by `MD3TopAppBar` |
| `ui/footer.tsx` | **DELETE** | 0 consumers, shell-specific |
| `ui/glass-card.tsx` | **DELETE** | 0 consumers, visual effect only |
| `ui/bottom-nav.tsx` | **DELETE** | 0 consumers, replaced by `MD3NavigationBar` |
| `ui/AuraImage.tsx` | **KEEP** (move to `features/media/`) | 3 consumers, domain-specific lazy/image logic |
| `ui/Switch.tsx` | **KEEP** (move to `features/form/`) | 1 consumer, no MD3 equivalent |
| `ui/Drawer.tsx` | **KEEP** (move to `features/overlay/`) | 1 consumer, no MD3 equivalent |
| `ui/Toast.tsx` | **MIGRATE** → `MD3Snackbar` | 4 consumers, direct API parity |
| `ui/Modal.tsx` | **MIGRATE** → `MD3Dialog` | 17 consumers, high effort |
| `ui/Input.tsx` | **MIGRATE** → `MD3TextField` | 21 consumers, high effort (floating label) |
| `ui/Skeleton.tsx` | **MIGRATE** → `MD3ProgressIndicator` | 24 consumers, medium effort |
| `ui/Badge.tsx` | **MIGRATE** → `MD3Chip` | 35 consumers, low effort |
| `ui/Card.tsx` | **MIGRATE** → `MD3Card` | 63 consumers, medium effort |
| `ui/Button.tsx` | **MIGRATE** → `MD3Button` | 75 consumers, medium effort (highest impact) |

---

## 8. Migration Strategy (Phase 2)

1. **Adapter Layer**: Create `src/components/ui/adapters/` with wrapper components that expose legacy API but delegate to MD3 primitives.
2. **Barrel Swap**: Update `ui/index.ts` to re-export adapters instead of legacy implementations.
3. **Incremental Migration**: Enable per-primitive via feature flag; verify via visual regression.
4. **Delete Dead Code**: Remove 4 zero-consumer legacy files after barrel swap.
5. **Token Consolidation**: Merge `brand-tokens.css` → `aura-tokens.css`; single import in `global.css`.