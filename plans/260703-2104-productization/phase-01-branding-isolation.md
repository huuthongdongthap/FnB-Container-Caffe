---
title: "Pha 1: Cách Ly Thương Hiệu — Branding Isolation"
status: pending
priority: P1
tags: [branding, isolation, config, env-vars, css-tokens]
hours: 10-15
---

# Phase 1: Branding Isolation — Cách Ly Thương Hiệu

**Date:** 2026-07-03
**Status:** Planned
**Prerequisite:** None (this is the first phase)

---

## Overview / Tổng Quan

Extract all hardcoded AURA CAFE brand strings into a single `config/brand.json` source of truth, environment variables, and generated CSS custom properties. No feature changes -- all 1184 tests must still pass.

Chuyển tất cả thông tin thương hiệu AURA CAFE cứng (hardcoded) thành một nguồn dữ liệu duy nhất `config/brand.json`, biến môi trường, và CSS variables được sinh tự động. Không thay đổi tính năng -- 1184 tests phải vẫn pass.

---

## 1.1 Audit Hardcoded Brand Strings / Kiểm Tra Chuỗi Cứng (2h)

**Files cần sửa:** N/A (audit only)

**Acceptance Criteria / Tiêu Chí Chấp Nhận:**
- Full codebase scan for hardcoded AURA CAFE brand strings
- Categories of brand strings to find:
  1. **Cafe name:** "AURA CAFE", "AURA", "Container Caffe Sa Dec"
  2. **Address:** "39 Nguyễn Tất Thành, Sa Đéc"
  3. **Meta tags:** title, description, OG tags in `index.html`
  4. **Social handles:** Mixpost URLs, social media links
  5. **Business info:** hotline, email, operating hours
  6. **Zone names:** "Jade Counter", "Sky Deck", "Noir Cabin", "Aura Lounge", "VIP Steel Nest"
  7. **Copyright:** footer copyright text
- Produce a complete inventory with file paths and line numbers
- Phân loại: critical (visible brand name), cosmetic (zone descriptions), config (API URLs)
- **Deliverable:** `docs/productization/brand-string-inventory.md`

**Implementation Steps / Các Bước Thực Hiện:**
1. Search grep for "AURA", "AURA CAFE", "Sa Dec", "aura" in `src/`, `worker/src/`, `index.html`
2. Search for hardcoded URLs: "auraspace.cafe", "fnb-caffe-container.pages.dev"
3. Search for zone/space names in `src/components/home/five-zone-showcase.tsx`
4. Catalog each occurrence with: file, line, string value, category, replacement strategy
5. Review `worker/wrangler.toml` for hardcoded values to extract

**Rủi ro / Risks:** Low. Read-only audit, no code changes.

---

## 1.2 Create `config/brand.json` Single Source of Truth / Tạo Nguồn Dữ Liệu Duy Nhất (3h)

**Files tạo mới:**
- `config/brand.json` -- JSON schema for brand configuration
- `src/config/brand-types.ts` -- TypeScript types for brand config
- `config/brand.example.json` -- Example with AURA defaults + comments

**Files cần sửa:**
- `tsconfig.json` -- Add `config/` path alias

**Acceptance Criteria / Tiêu Chí Chấp Nhận:**
- `config/brand.json` is the single source of truth for all brand values
- Schema includes:
  ```jsonc
  {
    "brand": {
      "name": "AURA CAFE",
      "nameShort": "AURA",
      "tagline": "Container Caffe & Space",
      "description": "Quán cà phê container industrial-luxury tại Sa Đéc",
      "address": "39 Nguyễn Tất Thành, Sa Đéc, Đồng Tháp",
      "phone": "",
      "email": "",
      "domain": "auraspace.cafe",
      "workerUrl": "https://aura-space-worker.agencyos-openclaw.workers.dev",
      "pagesUrl": "https://fnb-caffe-container.pages.dev"
    },
    "design": {
      "primaryColor": "#C9D6DF",
      "secondaryColor": "#6B9FB8",
      "backgroundColor": "#050D1A",
      "surfaceColor": "#0A1A2E",
      "fontDisplay": "'Cormorant Garamond', Georgia, serif",
      "fontBody": "'Space Grotesk', system-ui, sans-serif",
      "logo": "/assets/logo.svg"
    },
    "zones": [
      { "id": "jade-counter", "name": "Jade Counter", "color": "#2D5A3D" },
      { "id": "sky-deck", "name": "Sky Deck", "color": "#3A6B80" },
      { "id": "noir-cabin", "name": "Noir Cabin", "color": "#1A2A4E" },
      { "id": "aura-lounge", "name": "Aura Lounge", "color": "#6B9FB8" },
      { "id": "vip-steel-nest", "name": "VIP Steel Nest", "color": "#334155" }
    ],
    "social": {
      "facebook": "",
      "instagram": "",
      "zalo": ""
    },
    "seo": {
      "titleTemplate": "%s | AURA CAFE",
      "defaultTitle": "AURA CAFE — Container Caffe Sa Đéc",
      "defaultDescription": "Quán cà phê container industrial-luxury tại Sa Đéc"
    }
  }
  ```
- `brand-types.ts` exports `BrandConfig` TypeScript interface matching the JSON schema
- `brand.example.json` serves as documentation with comments explaining each field
- JSON is valid and passes `JSON.parse()`
- TypeScript compiles with 0 errors

**Implementation Steps / Các Bước Thực Hiện:**
1. Create `config/` directory at project root
2. Write `brand.json` with AURA CAFE values as defaults
3. Write `brand-types.ts` with `BrandConfig` interface
4. Write `brand.example.json` with inline comments
5. Update `tsconfig.json` to include `config/` path
6. Verify TypeScript compilation passes

**Rủi ro / Risks:** Low. New files only, no existing code changed yet.

---

## 1.3 Generate CSS Custom Properties from Config / Sinh CSS Từ Config (2.5h)

**Files tạo mới:**
- `scripts/generate-brand-css.mjs` -- Node script to generate `brand-tokens.css` from `brand.json`

**Files cần sửa:**
- `src/styles/brand-tokens.css` -- Replace hardcoded values with `var()` references
- `src/styles/global.css` -- Ensure references use brand CSS vars
- `src/styles/stitch-tokens.css` -- Replace hardcoded AURA references
- `src/theme/aura-tokens.ts` -- Load from `brand.json` instead of hardcoded values
- `package.json` -- Add `generate:brand-css` script

**Acceptance Criteria / Tiêu Chí Chấp Nhận:**
- `npm run generate:brand-css` reads `config/brand.json` and outputs the CSS `:root` variables
- Generated CSS file maintains the same token names as current `brand-tokens.css` (backward compat)
- All color values, font families, spacing tokens come from `brand.json`
- `aura-tokens.ts` imports colors from `brand.json` instead of hardcoded hex values
- `global.css` references only CSS custom properties (no hardcoded brand values)
- All utility classes in `brand-tokens.css` that reference specific brand values use CSS vars
- Build passes: `npm run build` exits 0
- Visual regression check: dev server shows same colors as before

**Implementation Steps / Các Bước Thực Hiện:**
1. Write `scripts/generate-brand-css.mjs`:
   - Read `config/brand.json`
   - Map brand fields to CSS custom property names
   - Generate `:root { ... }` block
   - Write to `src/styles/brand-tokens.css`
2. Add `"generate:brand-css": "node scripts/generate-brand-css.mjs"` to `package.json`
3. Replace hardcoded hex values in `brand-tokens.css` comments with `/* from config */`
4. Update `aura-tokens.ts` to import theme values from brand config
5. Run `npm run build` to verify no breakage
6. Visual check on dev server

**Rủi ro / Risks:** Medium. CSS variable chain must be correct. Must preserve all legacy alias tokens (``--aura-gold-*``, etc.) mapped to new values. Mitigation: Keep legacy alias section in CSS, just change values to reference `var()`.

---

## 1.4 Extract Hardcoded Brand from Components / Trích Xuất Brand Từ Components (3h)

**Files cần sửa (theo danh sách từ 1.1):**
- `src/components/ui/navbar.tsx` -- "AURA CAFE" text
- `src/components/ui/footer.tsx` -- "AURA CAFE" + copyright + address
- `src/components/home/HeroSection.tsx` -- "AURA CAFE" heading
- `src/components/home/hero-section.tsx` -- "AURA" heading
- `src/components/home/five-zone-showcase.tsx` -- Zone names
- `src/components/chat/ChatWidget.tsx` -- "AURA CAFE Support"
- `src/components/home/location-map.tsx` -- Map title/aria-label
- `index.html` -- Title, meta description
- `worker/wrangler.toml` -- Hardcoded vars (CORS_ORIGIN, MIXPOST_URL)
- `worker/src/` routes -- Any hardcoded brand references

**Acceptance Criteria / Tiêu Chí Chấp Nhận:**
- Create `src/config/brand.ts` -- Singleton loader that reads `brand.json` and exports brand constants
- All components import brand values from `@/config/brand` instead of hardcoded strings:
  ```typescript
  import { BRAND } from '@/config/brand';
  // Usage: {BRAND.name} instead of "AURA CAFE"
  ```
- Zone names/descriptions come from `BRAND.zones` array
- SEO meta tags in components use `BRAND.seo.titleTemplate`, `BRAND.seo.defaultDescription`
- `index.html` loads brand values via build-time injection (Vite env vars or HTML plugin)
- `worker/wrangler.toml` uses `[vars]` section with values from `brand.json`
- All 1184 tests still pass
- No visual regression after changes

**Implementation Steps / Các Bước Thực Hiện:**
1. Create `src/config/brand.ts` with brand singleton
2. Update `navbar.tsx` -- replace "AURA CAFE" with `{BRAND.name}`
3. Update `footer.tsx` -- replace brand name, address, copyright year
4. Update `HeroSection.tsx` and `hero-section.tsx` -- replace brand heading
5. Update `five-zone-showcase.tsx` -- replace zone names from config
6. Update `ChatWidget.tsx` -- replace support title
7. Update `location-map.tsx` -- replace map labels
8. Update `index.html` -- use Vite `%VITE_BRAND_TITLE%` or similar env var injection
9. Update `worker/wrangler.toml` -- move CORS_ORIGIN, URLs to config
10. Run full test suite: `npm test`
11. Run `npm run build`

**Rủi ro / Risks:** Medium. Many files changed, risk of missed reference or broken import. Mitigation: Systematic file-by-file approach, run tests after each batch of changes.

---

## 1.5 Create Deployment Template / Tạo Mẫu Triển Khai (2h)

**Files tạo mới:**
- `config/deploy-template/` directory with:
  - `brand.json.hbs` -- Handlebars template (same structure as 1.2, with `{{VAR}}` tokens)
  - `wrangler.toml.hbs` -- Template for per-client wrangler config
  - `brand-tokens.css.hbs` -- Template for per-client CSS
  - `DEPLOY.md` -- Deployment instructions for setting up a new instance

**Acceptance Criteria / Tiêu Chí Chấp Nhận:**
- `config/deploy-template/` contains all files needed to stand up a new branded instance
- Template brand values use `{{CAFE_NAME}}`, `{{DOMAIN}}`, `{{PRIMARY_COLOR}}`, etc. tokens
- `brand.json.hbs` can be rendered with a simple substitution: `sed "s/{{CAFE_NAME}}/Cafe Xinh/g"`
- `wrangler.toml.hbs` has placeholder for `database_name`, `account_id`, `database_id`
- `brand-tokens.css.hbs` has placeholder for all brand colors and fonts
- `DEPLOY.md` has step-by-step instructions (in Vietnamese + English):
  1. Clone template repo / Sao chép template
  2. Copy deploy-template to new directory / Copy thư mục template
  3. Fill in cafe details / Điền thông tin quán
  4. Run `sed` or a simple script to replace all tokens / Chạy script thay thế biến
  5. Deploy to Cloudflare / Triển khai lên Cloudflare
  6. Set secrets / Cài đặt mật khẩu
- `DEPLOY.md` is the deliverable referenced in the plan overview
- Template files are valid: `brand.json.hbs` renders valid JSON after substitution

**Implementation Steps / Các Bước Thực Hiện:**
1. Create `config/deploy-template/` directory
2. Copy `config/brand.json` structure into `brand.json.hbs` with `{{VAR}}` tokens
3. Create `wrangler.toml.hbs` with template variables for name, D1, account, CORS
4. Create `brand-tokens.css.hbs` with template variables for all colors and fonts
5. Write `DEPLOY.md` bilingual instructions
6. Verify template by rendering with sample values

**Rủi ro / Risks:** Low. Templates are straightforward.

---

## 1.6 Create Setup Script / Tạo Script Thiết Lập (1.5h)

**Files tạo mới:**
- `scripts/setup-new-instance.sh` -- Shell script that automates template rendering + basic deploy prep

**Acceptance Criteria / Tiêu Chí Chấp Nhận:**
- `bash scripts/setup-new-instance.sh` runs interactively and asks for:
  - Cafe name / Tên quán (e.g. "Cafe Xinh")
  - Domain / Tên miền (e.g. "cafe-xinh")
  - Primary color / Màu chính (hex, default from brand.json)
  - Admin email / Email quản trị
- Script creates a new directory `deployments/{domain}/` with all rendered config files
- Script replaces tokens in templates using `sed`
- Outputs summary of what was created
- Dry-run mode: `--dry-run` prints what would be created without writing files
- All generated configs are valid JSON / TOML / CSS

**Implementation Steps / Các Bước Thực Hiện:**
1. Write bash script with interactive prompts
2. Implement token replacement logic using `sed`
3. Add dry-run mode
4. Test with sample cafe values
5. Integrate with `DEPLOY.md` instructions

**Rủi ro / Risks:** Low. Phase 2 will build the full CLI; this is a simpler bash version to unblock Phase 1 deliverable.

---

## Total Hours / Tổng Giờ

| Task / Công Việc | Hours / Giờ |
|------|-------|
| 1.1 Audit hardcoded strings / Kiểm tra chuỗi cứng | 2.0 |
| 1.2 Create brand.json config / Tạo file cấu hình | 3.0 |
| 1.3 Generate CSS from config / Sinh CSS từ config | 2.5 |
| 1.4 Extract brand from components / Trích brand khỏi components | 3.0 |
| 1.5 Create deployment template / Tạo mẫu triển khai | 2.0 |
| 1.6 Create setup script / Tạo script thiết lập | 1.5 |
| Buffer / Dự phòng | 1.0 |
| **Total / Tổng cộng** | **15.0** |

---

## File Inventory / Danh Sách File

```
config/
  brand.json                    # Single source of truth for all brand values
  brand.example.json            # Example with comments/docs
  deploy-template/
    brand.json.hbs              # Template for per-client brand config
    wrangler.toml.hbs           # Template for per-client wrangler config
    brand-tokens.css.hbs        # Template for per-client CSS tokens
    DEPLOY.md                   # Bilingual deployment instructions
scripts/
  generate-brand-css.mjs        # Generate brand-tokens.css from brand.json
  setup-new-instance.sh         # Interactive setup script (bash)
src/
  config/
    brand.ts                    # Brand singleton loader for components
    brand-types.ts              # TypeScript types for BrandConfig
docs/
  productization/
    brand-string-inventory.md   # Audit report of all hardcoded brand strings
```

## Files Modified / Các File Cần Sửa

```
src/styles/brand-tokens.css     # Replace hardcoded values → CSS vars
src/styles/global.css           # Ensure reference brand CSS vars
src/styles/stitch-tokens.css    # Replace hardcoded AURA references
src/theme/aura-tokens.ts        # Load brand colors from config
src/theme/use-aura-theme.ts     # Update if needed
src/components/ui/navbar.tsx    # Replace hardcoded brand name
src/components/ui/footer.tsx    # Replace hardcoded brand + address
src/components/home/HeroSection.tsx  # Replace brand heading
src/components/home/hero-section.tsx # Replace brand heading
src/components/home/five-zone-showcase.tsx  # Replace zone names
src/components/chat/ChatWidget.tsx    # Replace support title
src/components/home/location-map.tsx   # Replace map labels
index.html                      # Inject brand via env vars
worker/wrangler.toml            # Extract hardcoded values
package.json                    # Add generate:brand-css script
tsconfig.json                   # Add config/ path alias
```

## Quality Gates / Tiêu Chuẩn Chất Lượng

- [ ] `npm run build` -- 0 TypeScript errors
- [ ] `npm test` -- all 1184 tests pass
- [ ] `npm run generate:brand-css` produces valid CSS
- [ ] `config/brand.json` is valid JSON
- [ ] No hardcoded "AURA CAFE" brand strings remain in production code (only in `config/brand.json`)
- [ ] Legacy alias tokens preserved (``--aura-gold-*`` map to current values)
- [ ] Visual regression: dev server shows same colors as before
- [ ] `scripts/setup-new-instance.sh --dry-run` works without side effects
- [ ] DEPLOY.md is bilingual (VN + EN)
- [ ] Zero `:any` types in production code

## Rollback Notes / Ghi Chú Khôi Phục

- `config/brand.json` is new; no rollback needed
- Modified components: if something breaks, revert individual file changes
- CSS changes: `brand-tokens.css` changes are cosmetic; revert to git version
- Old hardcoded strings still visible in git history if reversion needed
- Original `brand-tokens.css` v5.0 available in git at commit before this phase
