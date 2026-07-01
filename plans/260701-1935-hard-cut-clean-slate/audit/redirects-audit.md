# _redirects Audit

## Current State (4 explicit .html rules)

```
/index-legacy.html                /                                           301
/checkout.html                    /checkout?payment=pending                   301
/loyalty-calculator.html          /loyalty-calculator                         301
/kds.html                         /kds                                        301
```

## Missing Redirects

### Root HTML without explicit rules (16 files need wildcard)
`about-us.html`, `brand-guideline.html`, `checkin.html`, `contact.html`, `events.html`, `failure.html`, `menu.html`, `promotions.html`, `receipt-template.html`, `referral.html`, `success.html`, `table-reservation.html`, `track-order.html`, `tv-menu.html`, `404.html`, `admin/login.html`

All covered by wildcard `/*.html /:splat 301` — but 4 URL mismatches need explicit rules BEFORE wildcard.

### URL Mismatches (need explicit rules before wildcard)
| Source | Target | Reason |
|--------|--------|--------|
| `/about-us.html` | `/about` | SPA route is `/about`, not `/about-us` |
| `/brand-guideline.html` | `/brand` | SPA route is `/brand`, not `/brand-guideline` |
| `/failure.html` | `/order-failure` | SPA route is `/order-failure` |
| `/success.html` | `/order-success` | SPA route is `/order-success` |
| `/receipt-template.html` | `/checkout` | NO SPA route — nearest equivalent |

### Pages with NO SPA Route
| Source | Action |
|--------|--------|
| `/receipt-template.html` | 301 → `/checkout` (nearest equivalent) |
| `/signup/index.html` | 301 → `/signup` (but `/signup` has NO SPA route — need to add or redirect to home) |

### ⚠️ `/signup` Problem
Current _redirects has `/signup → /signup 200` (SPA rewrite), but SPA has NO `/signup` route.
Result: `/signup` renders NotFound page.
Fix options:
- A) Add `/signup` route to SPA
- B) Change redirect to `/signup → /loyalty 301`

## Recommended `_redirects` (Post-Phase-2)

```
# ── 1. Explicit .html exceptions (BEFORE wildcard, first-match wins) ──
/index-legacy.html            /                           301
/checkout.html                /checkout?payment=pending   301
/loyalty-calculator.html      /loyalty-calculator         301
/kds.html                     /kds                        301
/about-us.html                /about                      301
/brand-guideline.html         /brand                      301
/failure.html                 /order-failure              301
/success.html                 /order-success              301
/receipt-template.html        /checkout                   301
/signup/index.html            /loyalty                    301

# ── 2. BULK wildcard: all remaining .html → clean URL ──
/*.html                       /:splat                     301

# ── 3. Short URL aliases (KEEP 200 — SPA client-side routing) ──
/admin-dashboard              /admin/dashboard            200
/brand                        /brand                      200
# /signup removed — redirects to /loyalty above

# ── 4. Legacy admin aliases ──
/dashboard                    /admin/dashboard            301
/dashboard/                   /admin/dashboard            301
/dashboard/admin              /admin/dashboard            301
/dashboard/login              /admin/login                301
/kitchen                      /kds                        301

# ── 5. Security block ──
/docs/*                       /404                        404
/tests/*                      /404                        404
/tools/*                      /404                        404
/scripts/*                    /404                        404
/plans/*                      /404                        404
/designs/*                    /404                        404
/_archive/*                   /404                        404
/dist/*                       /404                        404
/reports/*                    /404                        404
/worker/*                     /404                        404
/db/*                         /404                        404

# ── 6. SPA fallback (MUST be last) ──
/*                            /index.html                 200
```

## Redirect Coverage

| Category | Before | After |
|----------|--------|-------|
| Explicit .html rules | 4 | 10 |
| Wildcard coverage | 0 .html | ALL .html (via `/*.html /:splat 301`) |
| Short URL aliases | 3 | 2 (signup removed) |
| Security blocks | 11 | 11 (unchanged) |
| SPA fallback | 1 | 1 (unchanged) |
