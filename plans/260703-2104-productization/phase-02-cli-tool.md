---
title: "Pha 2: Công Cụ CLI Thiết Lập — Setup CLI Tool"
status: pending
priority: P1
tags: [cli, automation, deployment, cloudflare, typescript]
hours: 8-10
---

# Phase 2: Setup CLI Tool "aura-deploy"

**Date:** 2026-07-03
**Status:** Planned
**Prerequisite:** Phase 1 (Branding Isolation) must be complete -- `config/brand.json`, env-var-driven CSS, configurable deploy template available.

---

## 2.1 Scaffold aura-deploy CLI / Tạo Khung CLI (1.5h)

**Files tạo mới:**
- `setup/aura-deploy/package.json`
- `setup/aura-deploy/tsconfig.json`
- `setup/aura-deploy/src/index.ts` (entry, commander setup)
- `setup/aura-deploy/src/commands/init.ts` (stub)
- `setup/aura-deploy/README.md`

**Acceptance Criteria / Tiêu Chí Chấp Nhận:**
- `node setup/aura-deploy/dist/index.js --help` prints commands (`init`, `--version`)
- Uses `commander` for CLI framework, `inquirer` for interactive prompts, `chalk` for colored output
- TypeScript compilation passes with 0 errors
- Package name `@aura/deploy` or `aura-deploy` in `package.json`
- Version printed matches `package.json` version

**Implementation Steps:**
1. Create `setup/aura-deploy/` with `npm init`
2. Install dependencies: `commander`, `inquirer`, `chalk`, `execa` (shell), `dotenv`
3. Install devDependencies: `typescript`, `@types/node`, `@types/inquirer`, `tsx`
4. Configure `tsconfig.json` (target ES2022, module ESNext, outDir dist)
5. Write `src/index.ts` with `commander` program definition
6. Add `"bin": {"aura-deploy": "./dist/index.js"}` to package.json
7. Verify `npm run build` compiles clean

**Rủi ro / Risks:** Low / Thấp. Straightforward scaffolding.

---

## 2.2 Implement `init` Command -- Interactive Wizard / Lệnh `init` -- Hướng Dẫn Tương Tác (2h)

**Files tạo mới:**
- `setup/aura-deploy/src/commands/init.ts`
- `setup/aura-deploy/src/wizard/questions.ts`
- `setup/aura-deploy/src/wizard/validators.ts`

**Các câu hỏi bằng tiếng Việt (with emoji):**
- Tên quán cà phê / Cafe name (required, Unicode-friendly, vd: "Cafe Xinh")
- Tên miền / Domain slug (auto-suggested from name, editable, alphanumeric-dash only)
- Màu chính / Primary color (hex, default `#C9A962` -- AURA gold)
- Màu phụ / Secondary color (hex, default `#1a1a2e`)
- Khẩu hiệu / Cafe tagline (optional, max 100 chars)
- Email quản trị / Admin email (required, email validated)
- Mật khẩu quản trị / Admin password (required, min 8 chars)
- Ngôn ngữ / Language (Tiếng Việt / English / Song ngữ Bilingual)
- Cloudflare API token (required, validated by pinging CF API)
- Cloudflare account ID (required, validated)

**Acceptance Criteria / Tiêu Chí Chấp Nhận:**
- `aura-deploy init` launches interactive prompt sequence (all questions in Vietnamese with emoji)
- All inputs validated client-side before proceeding
- Invalid input shows clear error message and re-prompts
- On completion, prints a summary of all entered values and asks for confirmation before writing
- Bilingual output: prompts in Vietnamese, English in parentheses

**Implementation Steps:**
1. Define `CafeConfig` interface in `types.ts`
2. Write question prompts in `questions.ts` with `inquirer`
3. Write validators in `validators.ts` (domain slug regex, email regex, hex color, password length)
4. Implement `init.ts` orchestrator: ask questions -> validate -> confirm -> pass to template engine
5. Basic CF API token validation via `curl -s -o /dev/null -w '%{http_code}' "https://api.cloudflare.com/client/v4/user/tokens/verify" -H "Authorization: Bearer $token"`

**Rủi ro / Risks:** Low / Thấp. Standard inquirer flow.

---

## 2.3 Template Engine -- brand.json + Env Vars / Engine Mẫu (2h)

**Files tạo mới:**
- `setup/aura-deploy/src/template/engine.ts`
- `setup/aura-deploy/src/template/replacements.ts`
- `setup/aura-deploy/templates/brand.json.hbs`
- `setup/aura-deploy/templates/wrangler.toml.hbs`
- `setup/aura-deploy/templates/.env.hbs`
- `setup/aura-deploy/templates/brand-tokens.css.hbs`

**Acceptance Criteria / Tiêu Chí Chấp Nhận:**
- Takes `CafeConfig` from wizard, generates 4 output files:
  - `config/brand.json` -- structured brand config (single source of truth)
  - `worker/wrangler.toml` -- with correct D1 db name, account_id
  - `worker/.env` or `worker/.dev.vars` -- env vars for the worker
  - `brand-tokens.css` -- CSS custom properties matching brand colors
- Replaces tokens in existing template files using Handlebars or simple string interpolation
- Generated `brand.json` is valid JSON
- Generated `brand-tokens.css` sets `--brand-primary`, `--brand-secondary`, `--brand-accent`, `--brand-name`
- Generates `env/wrangler.toml` with correct `name`, `account_id`, `database_name` per deployment

**Implementation Steps:**
1. Create Handlebars templates for each output file
2. Implement `engine.ts` with `generateBrandConfig()`, `generateCssVars()`, `generateWranglerConfig()`
3. Replacements table: `{{CAFE_NAME}}`, `{{DOMAIN_SLUG}}`, `{{PRIMARY_COLOR}}`, `{{SECONDARY_COLOR}}`, `{{ADMIN_EMAIL}}`, `{{CF_ACCOUNT_ID}}`, `{{CF_API_TOKEN}}`, `{{DB_NAME}}`
4. Output directory: create `deployments/{domain-slug}/` folder with all generated assets
5. Write a `replaceInFile()` utility that reads a template, substitutes tokens, writes result

**Rủi ro / Risks:** Low / Thấp. Template engines are well understood.

---

## 2.4 Cloudflare Deploy Integration / Tích Hợp Triển Khai Cloudflare (2h)

**Files tạo mới:**
- `setup/aura-deploy/src/deploy/cf-deploy.ts`
- `setup/aura-deploy/src/deploy/wrangler-exec.ts`
- `setup/aura-deploy/src/deploy/secrets.ts`

**Acceptance Criteria / Tiêu Chí Chấp Nhận:**
- Runs `wrangler deploy` in the generated deployment directory
- Sets required secrets via `wrangler secret put` (JWT_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD)
- If wrangler is not installed globally, auto-installs via `npx wrangler`
- Reports progress with bilingual messages:
  - "Dang trien khai Worker..." / "Deploying Worker..."
  - "Dang ap dung migrations..." / "Applying migrations..."
  - "Dang cai dat mat khau..." / "Setting secrets..."
- Returns the deployed worker URL on success
- Handles errors: if CF token invalid or deploy fails, prints actionable error message and exits non-zero

**Implementation Steps:**
1. Implement `wranglerExec()` utility using `execa` to run wrangler
2. Generate a random JWT_SECRET via `crypto.randomBytes(32).toString('hex')`
3. Execute wrangler deploy sequence:
   - `wrangler deploy --config wrangler.toml`
   - `wrangler secret put JWT_SECRET`
   - `wrangler secret put ADMIN_EMAIL`
   - `wrangler secret put ADMIN_PASSWORD`
4. Read deployed URL from wrangler output (grep for "Published" or use `wrangler deployments list`)
5. On failure, print the wrangler stderr output and suggest checking the CF token

**Rủi ro / Risks:** Medium / Trung Binh. Wrangler version compatibility, CF API changes. Mitigation: Pin wrangler version, run in `npx wrangler@3` for consistent behavior.

---

## 2.5 Seed Data -- Menu Categories + Default Items / Dữ Liệu Mẫu (1.5h)

**Files tạo mới:**
- `setup/aura-deploy/src/deploy/seed-db.ts`
- `setup/aura-deploy/templates/seed.sql.hbs`

**Acceptance Criteria / Tiêu Chí Chấp Nhận:**
- Runs seed SQL against the newly deployed D1 database
- Inserts default menu categories (Vietnamese names): Ca phe, Tra, Da xay, Sinh to, Nuoc ep, Banh ngot
- Inserts 5-10 default placeholder items per category
- Seed data can be customized via `CafeConfig` (e.g. cafe type: coffee vs tea house)
- Uses `wrangler d1 execute` with the seed SQL file
- Verifies seed succeeded by running a count query

**Implementation Steps:**
1. Create seed SQL template with placeholders for customizable fields
2. Categories: Ca phe, Tra, Da xay, Sinh to, Nuoc ep, Banh ngot
3. Items: 2-3 generic placeholders per category ("[Cafe Name] Special", etc.)
4. Execute via `npx wrangler d1 execute <db-name> --file=seed.sql --remote`
5. Verify with `npx wrangler d1 execute <db-name> --command="SELECT COUNT(*) FROM menu_items" --remote`

**Rủi ro / Risks:** Low / Thấp. Risk if D1 not yet provisioned. Mitigation: Check D1 exists first, offer to create.

---

## 2.6 Output -- URLs, Credentials, Next Steps / Kết Quả Đầu Ra (0.5h)

**Files tạo mới:**
- `setup/aura-deploy/src/output/summary.ts`

**Acceptance Criteria / Tiêu Chí Chấp Nhận:**
- Prints a clean, colorful summary after successful deploy (bilingual VN + EN):
  ```
  ========================================
  Ten quan:     Cafe Xinh
  Admin URL:    https://cafe-xinh.workers.dev/admin
  Public URL:   https://cafe-xinh.workers.dev
  Email admin:  admin@cafexinh.com
  Mat khau:     ******** (chi hien mot lan / shown once)
  ========================================
  Cac buoc tiep theo / Next steps:
  1. Truy cap Admin URL va dang nhap / Visit Admin URL and log in
  2. Tuy chinh thuc don trong trang quan tri / Customize menu items in admin panel
  3. Tro ten mien rieng trong Cloudflare Dashboard / Point custom domain
  4. Thiet lap thanh toan PayOS / Set up PayOS payment integration
  ========================================
  ```
- Admin password shown only once, with warning to save it
- Output is also saved to `deployments/{domain-slug}/deployment-summary.txt`

**Implementation Steps:**
1. Write summary formatter with chalk for colors
2. Generate next-steps text from bilingual templates
3. Write to both stdout and deployment summary file

**Rủi ro / Risks:** None / Khong co.

---

## 2.7 Integration Tests / Kiểm Thử Tích Hợp (0.5h)

**Files tạo mới:**
- `setup/aura-deploy/__tests__/integration.test.ts`
- `setup/aura-deploy/__tests__/template-engine.test.ts`
- `setup/aura-deploy/vitest.config.ts`

**Acceptance Criteria / Tiêu Chí Chấp Nhận:**
- Template engine tests: Given a CafeConfig object, all 4 output files generated correctly
- Token replacement tests: All `{{VAR}}` tokens in templates are replaced
- Validator tests: Invalid domain, email, color, password rejected; valid inputs pass
- Integration smoke test: Runs the full init CLI with mocked CF deployment (dry-run mode)
- All tests pass with `npm test`
- No test depends on actual Cloudflare credentials

**Implementation Steps:**
1. Create vitest config in `setup/aura-deploy/`
2. Write unit tests for validators (7-8 cases each)
3. Write unit tests for template engine (generate each output, verify content)
4. Write integration test: pipe answers into CLI, capture output, verify summary printed
5. Mock `wrangler`/`execa` calls in integration tests using vitest mocking

**Rủi ro / Risks:** Low / Thấp. Standard testing patterns.

---

## Total Hours / Tổng Giờ

| Task / Công Việc | Hours / Giờ |
|------|-------|
| 2.1 Scaffold CLI / Tao khung CLI | 1.5 |
| 2.2 Init command wizard / Lenh init tuong tac | 2.0 |
| 2.3 Template engine / Engine mau | 2.0 |
| 2.4 CF deploy integration / Tich hop trien khai CF | 2.0 |
| 2.5 Seed data / Du lieu mau | 1.5 |
| 2.6 Output summary / Ket qua dau ra | 0.5 |
| 2.7 Integration tests / Kiem thu tich hop | 0.5 |
| Buffer / Du phong | 0.5 |
| **Total / Tong cong** | **10.0** |

---

## File Inventory / Danh Sách File

```
setup/
  aura-deploy/
    package.json
    tsconfig.json
    vitest.config.ts
    README.md
    src/
      index.ts                    # CLI entry
      types.ts                    # CafeConfig interface
      commands/
        init.ts                   # init command orchestrator
      wizard/
        questions.ts              # inquirer prompt definitions (bilingual)
        validators.ts             # input validators
      template/
        engine.ts                 # template generation logic
        replacements.ts           # token substitution map
        templates/
          brand.json.hbs          # brand.json template
          wrangler.toml.hbs       # wrangler config template
          .env.hbs                # env vars template
          brand-tokens.css.hbs    # CSS custom properties template
          seed.sql.hbs            # seed SQL template
      deploy/
        cf-deploy.ts              # deploy orchestrator
        wrangler-exec.ts          # wrangler shell wrapper
        secrets.ts                # secrets management
        seed-db.ts                # D1 seed data
      output/
        summary.ts                # deployment summary printer (bilingual)
    __tests__/
      integration.test.ts
      template-engine.test.ts
```

## Dependencies / Phụ Thuộc

**Runtime (npm):**
- `commander` ^12 -- CLI framework
- `inquirer` ^9 -- interactive prompts
- `chalk` ^5 -- colored output (bilingual messages)
- `execa` ^8 -- shell command execution
- `dotenv` ^16 -- env file generation
- `handlebars` ^4 -- template engine

**Dev:**
- `typescript` ^5
- `@types/node` ^20
- `tsx` ^4 -- dev runner
- `vitest` ^1 -- test runner
- `wrangler` ^3 (referenced via npx)

## Quality Gates / Tiêu Chuẩn Chất Lượng

- [ ] `npm run build` -- 0 TypeScript errors
- [ ] `npm test` -- all unit + integration tests pass
- [ ] CLI --help output documents all commands
- [ ] Every user-facing string is bilingual (VN + EN)
- [ ] Zero `:any` types in production code
- [ ] No hardcoded credentials
- [ ] Dry-run mode (`--dry-run`) skips actual CF deploy for testing
- [ ] Wizard prompts in Vietnamese with English fallback

## Rollback Notes / Ghi Chú Khôi Phục

- Deployment creates a `deployments/{domain-slug}/` folder with all generated configs
- To tear down a deployment: `wrangler delete --name {domain-slug}` + delete D1 database
- All generated files are reproducible from the template + CafeConfig -- nothing manual
- CLI tool is independent: delete `setup/aura-deploy/` to remove entirely
