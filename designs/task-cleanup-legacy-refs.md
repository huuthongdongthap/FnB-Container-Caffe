# TASK: Deep Cleanup — Remaining Legacy Brand References

> **Priority**: HIGH | **Estimated**: 15 min | **Type**: Search & Replace

## Context
Worker đã hoàn thành 4 task rebranding chính (HTML content, architecture, colors, SEO).
Verification grep cho thấy còn **~35 legacy refs** trong các file chưa được xử lý.

## Verification Command (chạy TRƯỚC và SAU khi fix)
```bash
cd /Users/mac/mekong-cli/FnB-Container-Caffe
echo "=== OLD BRAND ===" && grep -rn "F&B\|FNB\|fnb-caffe\|Caffe Container\|fnbcaffe" --include="*.html" --include="*.js" --include="*.css" --include="*.json" --include="*.toml" . 2>/dev/null | grep -v node_modules | grep -v coverage/ | grep -v ".min." | grep -v tests/ | wc -l
echo "=== ARCHITECTURE ===" && grep -rn "3 tầng\|cyberpunk\|Cyberpunk\|Work Zone\|Meeting Room\|400m²\|10×40\|3-floor" --include="*.html" --include="*.js" --include="*.json" . 2>/dev/null | grep -v node_modules | grep -v coverage/ | wc -l
echo "=== OLD COLORS ===" && grep -rn "#C9A87C\|#1a1612\|#4a2c17" --include="*.css" --include="*.json" --include="*.html" . 2>/dev/null | grep -v node_modules | grep -v coverage/ | grep -v ".min." | wc -l
```

**Target: ALL checks = 0**

---

## FILES TO FIX

### 1. `js/checkout.js` (3 refs)
| Line | Old | New |
|------|-----|-----|
| 17 | `partnerCode: 'FNBCAFFE2026'` | `partnerCode: 'AURASPACE2026'` |
| 26 | `tmnCode: 'FNBCAFFE'` | `tmnCode: 'AURASPACE'` |
| 904 | `info=FNB%20Container%20Cafe` | `info=AURA%20SPACE%20Cafe` |

Also fix:
- Line 54: `fnb_session_id` → `aura_session_id`
- Line 57: `fnb_session_id` → `aura_session_id`

### 2. `dashboard/admin.html` (4 refs)
| Line | Old | New |
|------|-----|-----|
| 8 | `fnb container` in keywords | `aura space container` |
| 11 | `#4a2c17` theme-color | `#0A0A0A` |
| 25 | `F&B Admin` apple-mobile-web-app-title | `AURA Admin` |
| 35 | `F&B Admin Dashboard` JSON-LD name | `AURA SPACE Admin Dashboard` |
| 77 | `F&B Admin` logo-text | `AURA Admin` |

### 3. `dashboard/dashboard-styles.css` (1 ref)
| Line | Old | New |
|------|-----|-----|
| 3 | `Warm F&B × Industrial Design System` | `AURA SPACE × Industrial Design System` |

### 4. `public/translations.json` (8 refs)
| Line | Old | New |
|------|-----|-----|
| 10 | `"hero.title.line1": "F&B"` | `"hero.title.line1": "AURA"` |
| 12 | `Check-in Cyberpunk` | `Check-in Industrial-Luxury` |
| 53 | `hello@fnbcaffe.vn` | `hello@auraspace.vn` |
| 76 | `"hero.title.line1": "F&B"` (EN) | `"hero.title.line1": "AURA"` |
| 78 | `Cyberpunk Check-in` | `Industrial-Luxury Check-in` |
| 109 | `Meeting Room Rental` | `Glass Room Rental` |
| 119 | `hello@fnbcaffe.vn` (EN) | `hello@auraspace.vn` |

### 5. `js/i18n.js` (2 refs)
| Line | Old | New |
|------|-----|-----|
| 28 | `'Không gian container 3 tầng độc đáo, check-in cực chất'` | `'Không gian container industrial-luxury độc đáo, check-in cực chất'` |
| Key | `'feature.cyberpunk'` → rename to `'feature.industrial-luxury'` | value: `'Industrial-Luxury Space'` |

### 6. `loyalty.html` (1 ref)
| Line | Old | New |
|------|-----|-----|
| 224 | `FNB-XXXX-XXX` | `AURA-XXXX-XXX` |

### 7. `admin/admin-dashboard.js` (1 ref)
| Line | Old | New |
|------|-----|-----|
| 2 | `F&B Admin Dashboard` comment | `AURA SPACE Admin Dashboard` |

### 8. `worker/wrangler.toml` (3 refs)
| Line | Old | New |
|------|-----|-----|
| 1 | `name = "fnb-caffe-worker"` | `name = "aura-space-worker"` |
| 7 | `binding = "FNB_DB"` | `binding = "AURA_DB"` |
| 8 | `database_name = "fnb-caffe-db"` | `database_name = "aura-space-db"` |

### 9. `worker/src/routes/orders.js` (~15 refs)
- Replace ALL `env.FNB_DB` → `env.AURA_DB`

### 10. `worker/src/routes/menu.js` (~3 refs)
- Replace ALL `env.FNB_DB` → `env.AURA_DB`

### 11. `data/menu-data.json` (1 ref)
- `"chỉ có tại F&B"` → `"chỉ có tại AURA SPACE"`

### 12. `eslint.config.js` (1 ref)
- `// F&B Debug flag` comment → `// AURA SPACE Debug flag`

### 13. `css/loyalty-styles.css` (2 refs)
| Line | Old | New |
|------|-----|-----|
| 10 | `#1a1612` | `#0A0A0A` |
| 219 | `#1a1612` | `#0A0A0A` |

### 14. `.min.css` files — regenerate after fixing source
After all source files are fixed, regenerate minified files:
```bash
npm run minify
```

---

## EXCLUDED (false positives — DO NOT CHANGE)
- `coverage/` — generated files, will regenerate
- `tests/*.test.js` — test assertions matching old patterns (update separately)
- `apps/fnb-caffe-container/` — mirror/subapp (separate concern)

## Final Verification
```bash
cd /Users/mac/mekong-cli/FnB-Container-Caffe
# Must all return 0
grep -rn "F&B\|FNB\|fnb-caffe\|fnbcaffe\|Caffe Container" --include="*.html" --include="*.js" --include="*.css" --include="*.json" --include="*.toml" . 2>/dev/null | grep -v node_modules | grep -v coverage/ | grep -v ".min." | grep -v tests/ | grep -v "apps/" | wc -l
grep -rn "3 tầng\|cyberpunk\|Cyberpunk\|3-floor\|Meeting Room" --include="*.html" --include="*.js" --include="*.json" . 2>/dev/null | grep -v node_modules | grep -v coverage/ | wc -l
grep -rn "#C9A87C\|#1a1612\|#4a2c17" --include="*.css" --include="*.json" --include="*.html" . 2>/dev/null | grep -v node_modules | grep -v coverage/ | grep -v ".min." | wc -l
```
