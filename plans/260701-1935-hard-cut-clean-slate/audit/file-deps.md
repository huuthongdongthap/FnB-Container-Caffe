# File Dependency Map

## CSS Files

### css/ Directory (32 files — ALL STATIC-ONLY → SAFE TO DELETE)

| File | Lines | Consumers | Verdict |
|------|-------|-----------|---------|
| `homepage-v6.css` | ~4568 | 4 static HTML only | 🗑️ DELETE — largest file, 212 !important |
| `brand-tokens.css` | - | Static HTML `<link>` tags | 🗑️ DELETE — SPA bundles equivalent via Tailwind |
| `styles.css` | - | Most static HTML | 🗑️ DELETE |
| `menu-v6.css` | - | menu.html | 🗑️ DELETE |
| `checkout-styles.css` | - | checkout.html | 🗑️ DELETE |
| `kds-styles.css` | - | kds.html | 🗑️ DELETE |
| `kds-m3.css` | - | kds.html | 🗑️ DELETE |
| `about-m3.css` | - | about-us.html | 🗑️ DELETE |
| `about-us-page.css` | - | about-us.html | 🗑️ DELETE |
| `asian-wow.css` | - | loyalty.html? | 🗑️ DELETE |
| `brand-guideline.css` | - | brand-guideline.html | 🗑️ DELETE |
| `checkin-approve.css` | - | admin/checkin-approve.html | 🗑️ DELETE |
| `dashboard.css` | - | admin/dashboard.html | 🗑️ DELETE |
| `events.css` | - | events.html | 🗑️ DELETE |
| `failure.css` | - | failure.html | 🗑️ DELETE |
| `failure-page.css` | - | failure.html | 🗑️ DELETE |
| `hero-aura.css` | - | index.html? | 🗑️ DELETE |
| `loyalty.css` | - | loyalty.html | 🗑️ DELETE |
| `loyalty-calculator.css` | - | loyalty-calculator.html | 🗑️ DELETE |
| `pos.css` | - | admin/pos.html | 🗑️ DELETE |
| `premium-upgrade.css` | - | loyalty.html? | 🗑️ DELETE |
| `print-receipt.css` | - | receipt-template.html | 🗑️ DELETE |
| `promotions.css` | - | promotions.html | 🗑️ DELETE |
| `proposal-deck-v2.css` | - | reports/proposal-deck-v2.html | 🗑️ DELETE |
| `public.css` | - | public/offline.html? | 🗑️ DELETE |
| `referral.css` | - | referral.html | 🗑️ DELETE |
| `reservations.css` | - | admin/reservations.html | 🗑️ DELETE |
| `staff.css` | - | admin/staff.html | 🗑️ DELETE |
| `success.css` | - | success.html | 🗑️ DELETE |
| `track-order-styles.css` | - | track-order.html | 🗑️ DELETE |
| `ui-enhancements.css` | - | various static pages | 🗑️ DELETE |
| `CHU-QUAN-BAO-CAO.css` | - | reports/CHU-QUAN-BAO-CAO.html | 🗑️ DELETE |

### Root-Level CSS (8 files — ALL STATIC-ONLY → SAFE TO DELETE)
| File | Consumers | Verdict |
|------|-----------|---------|
| `404.css` | 404.html | 🗑️ DELETE |
| `checkin.css` | checkin.html | 🗑️ DELETE |
| `checkout.css` | checkout.html | 🗑️ DELETE |
| `contact.css` | contact.html | 🗑️ DELETE |
| `kds.css` | kds.html | 🗑️ DELETE |
| `promotions.css` | promotions.html | 🗑️ DELETE |
| `receipt-template.css` | receipt-template.html | 🗑️ DELETE |
| `table-reservation.css` | table-reservation.html | 🗑️ DELETE |

### Admin CSS (6 files — ALL STATIC-ONLY → SAFE TO DELETE)
| File | Consumers | Verdict |
|------|-----------|---------|
| `admin/shared.css` | admin/*.html | 🗑️ DELETE |
| `admin/dashboard.css` | admin/dashboard.html | 🗑️ DELETE |
| `admin/login.css` | admin/login.html | 🗑️ DELETE |
| `admin/orders.css` | admin/orders.html | 🗑️ DELETE |
| `admin/erpnext-sync.css` | admin/erpnext-sync.html | 🗑️ DELETE |
| `admin/staff.css` | admin/staff.html | 🗑️ DELETE |

### Other CSS (2 files)
| File | Consumers | Verdict |
|------|-----------|---------|
| `signup/signup.css` | signup/index.html | 🗑️ DELETE |
| `public/offline.css` | public/offline.html | 🗑️ DELETE (after PWA audit) |

### CSS Total: 48 files → all safe to delete
### SPA CSS: 0 of these 48 files (SPA uses Tailwind v4 + global.css in src/)

## JS Files

### js/ Directory (35 files — ALL STATIC-ONLY → SAFE TO DELETE)

| File/Dir | Type | Verdict |
|----------|------|---------|
| `js/main.js` | Entry point | 🗑️ DELETE |
| `js/menu.js` | Menu page logic | 🗑️ DELETE |
| `js/cart.js` | Cart logic | 🗑️ DELETE |
| `js/checkout.js` | Checkout page | 🗑️ DELETE |
| `js/checkout/` | Checkout sub-modules | 🗑️ DELETE |
| `js/loyalty.js` | Loyalty page | 🗑️ DELETE |
| `js/kds-app.js` | KDS app | 🗑️ DELETE |
| `js/kds/` | KDS sub-modules | 🗑️ DELETE |
| `js/kds-poll.js` | KDS polling | 🗑️ DELETE |
| `js/pos.js` | POS app | 🗑️ DELETE |
| `js/api-client.js` | API client | 🗑️ DELETE |
| `js/auth.js` | Auth module | 🗑️ DELETE |
| `js/config.js` | Config module | 🗑️ DELETE |
| `js/i18n.js` | i18n module | 🗑️ DELETE |
| `js/theme.js` | Theme module | 🗑️ DELETE |
| `js/sw.js` | **Service Worker** | ⚠️ UPDATE before delete |
| `js/utils.js` | Utilities | 🗑️ DELETE |
| `js/hero.js` | Hero animations | 🗑️ DELETE |
| `js/hero-aura.js` | Hero aura | 🗑️ DELETE |
| `js/script.js` | Generic script | 🗑️ DELETE |
| `js/shared-nav.js` | Shared nav | 🗑️ DELETE |
| `js/mobile-nav.js` | Mobile nav | 🗑️ DELETE |
| `js/ui-animations.js` | UI animations | 🗑️ DELETE |
| `js/websocket-client.js` | WebSocket client | 🗑️ DELETE |
| `js/wow-engine.js` | WOW engine | 🗑️ DELETE |
| `js/wow-upgrade.js` | WOW upgrade | 🗑️ DELETE |
| `js/premium-ui.js` | Premium UI | 🗑️ DELETE |
| `js/signup-loyalty.js` | Signup loyalty | 🗑️ DELETE |
| `js/track-order.js` | Track order | 🗑️ DELETE |
| `js/asian-wow.js` | Asian WOW | 🗑️ DELETE |
| `js/landing/` | Landing pages JS | 🗑️ DELETE |

### ⚠️ PWA Service Worker (`js/sw.js`)
- Hardcodes `STATIC_ASSETS` array referencing files to delete
- Must update BEFORE deleting js/ directory
- Check if SPA has its own SW in `src/`

### JS Total: 35 files → all safe to delete (after updating sw.js)

## Cross-Reference: SPA Imports from Legacy Files
```bash
grep -r "from.*js/" src/ --include="*.ts" --include="*.tsx"
```
Expected result: ZERO imports. SPA never imports from legacy js/.
