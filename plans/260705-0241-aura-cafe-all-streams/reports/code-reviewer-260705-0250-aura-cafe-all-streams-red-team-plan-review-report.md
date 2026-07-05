# Red Team Plan Review: AURA CAFE All 4 Workstreams

**Reviewer:** Fact Checker / Security Adversary
**Date:** 2026-07-05
**Role:** Verify every file path, symbol, endpoint, and config key cited in the plan against actual codebase

---

## Finding 1: E2E test counts and directory path are wildly inaccurate

- **Severity:** Critical
- **Location:** plan.md phase 5, phase 6; phase-05-e2e-monitoring.md
- **Flaw:** The plan claims "129+ E2E tests passing" (plan.md line 84) and creates all E2E spec files at `tests/e2e/`, but Playwright is configured to read from `tests/playwright/` and only 48 test cases across 4 spec files exist.
- **Failure scenario:** All 13 new E2E spec files created at `tests/e2e/` will be silently ignored by Playwright, producing zero test coverage and a false sense of security. The "129+ existing E2E tests" claim in the quality gate checklist will fail verification (only 48 actual tests exist), blocking deploy or forcing a misleading override.
- **Evidence:**
  - Playwright config at `/Users/macbook/FnB-Container-Caffe/playwright.config.ts` line 2: `testDir: './tests/playwright'`
  - `ls /Users/macbook/FnB-Container-Caffe/tests/e2e/` returns `NO tests/e2e/ directory exists`
  - Only 4 spec files exist in `tests/playwright/`: `debug_errors.spec.ts` (1 test), `fnb-audit.spec.ts` (15 tests), `stitch-routes.spec.ts` (15 tests), `ui-audit.spec.ts` (17 tests) = **48 total test cases**
  - plan.md line 84: `npx playwright test — 129+ E2E tests passing (new ones added in Phase 5)`
  - phase-05-e2e-monitoring.md lists 13 new spec files at `tests/e2e/*.spec.ts`
- **Suggested fix:** (a) Correct the existing E2E test count from "129+" to "48" (or run actual count). (b) Change all new spec file paths from `tests/e2e/*.spec.ts` to `tests/playwright/*.spec.ts`. (c) Update the quality gate number or run a real count.

---

## Finding 2: 12 of 17 stores referenced in Phase 4 do not exist as Zustand stores

- **Severity:** High
- **Location:** phase-04-component-conversion-wire.md, section "Routes to Wire", store column
- **Flaw:** The plan assigns a Zustand store to nearly every page ("subscription store", "campaign store", "chat store", "birthday store", "erpnext store", "invoice store", "broadcast store", "reports store", "promotions store", "staff store", "audit store", "loyalty store") but only 5 of these exist as Zustand stores. The codebase uses custom hooks (e.g., `useCampaignsAdmin`, `useBroadcast`, `useChat`, `usePromotions`, `useBirthdayAdmin`, `useSubscriptions`) for most admin features. Wiring Stitch components to non-existent stores will produce broken components.
- **Failure scenario:** Phase 4 implementation tries to import `use-subscription-store`, `use-campaign-store`, `use-broadcast-store`, etc., which do not exist. Implementation stalls on store wiring. Developers waste time creating stores that duplicate existing hook functionality, or produce components that do nothing.
- **Evidence:**
  - Grep for existing store files:
    - `use-admin-dashboard-store.ts` -- EXISTS
    - `use-admin-staff-store.ts` -- EXISTS
    - `use-admin-customers-store.ts` -- EXISTS
    - `use-metrics-store.ts` -- EXISTS
    - `use-audit-store.ts` -- EXISTS (in `tree/audit/`)
    - `use-loyalty-store.ts` -- EXISTS
  - Grep for stores that DO NOT exist:
    - `use-subscription-store.ts` -- NOT FOUND
    - `use-subscriptions-store.ts` -- NOT FOUND
    - `use-campaign-store.ts` -- NOT FOUND
    - `use-chat-store.ts` -- NOT FOUND
    - `use-birthday-store.ts` -- NOT FOUND
    - `use-broadcast-store.ts` -- NOT FOUND
    - `use-erpnext-store.ts` -- NOT FOUND
    - `use-invoice-store.ts` -- NOT FOUND
    - `use-promotions-store.ts` -- NOT FOUND
    - `use-reports-store.ts` -- NOT FOUND
    - `use-staff-store.ts` -- NOT FOUND
  - Actual hooks used by admin pages (from src imports):
    - `useCampaignsAdmin` from `@/hooks/use-campaigns-admin`
    - `useBroadcast` from `@/hooks/use-broadcast`
    - `useChat` from `@/hooks/use-chat`
    - `usePromotions` from `@/hooks/use-promotions`
    - `useBirthdayAdmin` from `@/hooks/use-birthday-admin`
    - `usePlans`, `useSubscribe` from `@/hooks/use-subscriptions`
- **Suggested fix:** Replace the "store" column in phase-04 with the correct data-access pattern for each page: some use Zustand stores, most use custom hooks. Survey each page's current imports before assigning a data source.

---

## Finding 3: All 28 routes are already registered in App.tsx -- Phase 4 would add duplicates

- **Severity:** High
- **Location:** phase-04-component-conversion-wire.md, lines 47-82 and step 6
- **Flaw:** Phase 4 step 6 says "Register route in App.tsx" for all 28 screens. Every single route (both customer and admin) is already registered in App.tsx. Adding duplicate route registrations would either break the build or silently shadow the first registration.
- **Failure scenario:** Developer adds 28 duplicate `<Route>` entries to App.tsx, causing duplicate import conflicts, or if using React Router's newer API, a build error. Even if it compiles, the StitchNew components would shadow existing components without replacing them.
- **Evidence:**
  - `/Users/macbook/FnB-Container-Caffe/src/App.tsx` lines 70-110 show all 28 routes already registered:
    - Customer routes: `/order-failure` (line 74), `/promotions` (line 78), `/checkin` (line 85), `/contact` (line 89), `/loyalty-calculator` (line 76), `/track-order` (line 80), `/table-reservation` (line 82), `/tv-menu` (line 83), `/subscriptions` (line 88), `/brand` (line 90)
    - Admin routes: `/admin` (line 100), `/admin/staff` (line 117), `/admin/customers` (line 107), `/admin/manage-menu` (line 111), `/admin/promotions` (line 113), `/admin/subscriptions` (line 118), `/admin/sales-reports` (line 114), `/admin/broadcasts` (line 103), `/admin/campaigns` (line 104), `/admin/chat` (line 105), `/admin/checkin-approve` (line 106), `/admin/birthday-config` (line 102), `/admin/erpnext-sync` (line 109), `/admin/invoice-history` (line 115), `/admin/generate-qr` (line 110), `/admin/metrics` (line 112), `/admin/reservations` (line 116), `/admin/audit-logs` (line 101)
- **Suggested fix:** Phase 4 step 6 should say "Replace route component imports to point to new Stitch components" instead of "add to App.tsx". Include a mapping of old-component-to-new-component for each route.

---

## Finding 4: Phase 3 CLI dependencies claim "commander (already in project)" -- not installed

- **Severity:** High
- **Location:** phase-03-productization-cli.md, line 44
- **Flaw:** The plan states Use `commander` (already in project) or bare `process.argv` for CLI and references `enquirer` for interactive prompts. Neither `commander` nor `enquirer` exist anywhere in the project's `package.json` dependencies. Installing them at the `scripts/aura-deploy/` sub-package level will bloat the deploy tool or be blocked by no-network-access policies.
- **Failure scenario:** The `aura-deploy` CLI scaffold starts with `import { Command } from 'commander'` which throws MODULE_NOT_FOUND. The developer must stop and either install (adding approval drag) or rewrite using bare `process.argv`, wasting implementation time.
- **Evidence:**
  - `grep -rn "commander\|enquirer" /Users/macbook/FnB-Container-Caffe/package.json` returns empty (exit code 1)
  - Plan line 44: `Use commander (already in project) or bare `process.argv` for CLI`
  - Plan line 48: `Interactive prompts (via enquirer or readline)`
- **Suggested fix:** Remove the "(already in project)" qualification. Choose a single approach (recommend `bare process.argv` + `readline` to maintain zero-dependency CLI as stated in line 17: "no external dependencies beyond Node built-ins") and remove enquirer option.

---

## Finding 5: Plan's color, font, and design system values do not match the actual codebase

- **Severity:** Medium
- **Location:** plan.md lines 92-97, design constraints
- **Flaw:** Multiple design constraint claims are factually wrong:
  - Claimed "dark navy #00142c" -- actual page background is `--aura-noir-void: #050D1A`
  - Claimed "bronze #efbd8a (tertiary-only)" -- `#efbd8a` is `--st-secondary` in `global.css`, NOT an `--aura-*` token. There is no `--aura-bronze` token. The actual tertiary color is `--aura-tertiary: #d4a574` in stitch-tokens.css and `--aura-tertiary: var(--aura-chrome-mid)` in brand-tokens.css
  - Claimed "Fonts: Cormorant Garamond (display)" -- actual primary display font is `EB Garamond` as `--aura-font-display: 'EB Garamond', 'Cormorant Garamond'`; Cormorant Garamond is the fallback, not the primary
- **Failure scenario:** New Stitch components built to the plan's color/font specification (#00142c navy, #efbd8a bronze, Cormorant Garamond) will visually clash with existing components that use #050D1A background, #d4a574 tertiary, and EB Garamond display. The 28 new screens will have inconsistent branding with the existing 20+ Stitch components.
- **Evidence:**
  - `/Users/macbook/FnB-Container-Caffe/src/styles/brand-tokens.css` line 23: `--aura-noir-void:   #050D1A;` (not #00142c)
  - `/Users/macbook/FnB-Container-Caffe/src/styles/brand-tokens.css` line 79: `--aura-font-display: 'EB Garamond', 'Cormorant Garamond', Georgia, serif;`
  - `/Users/macbook/FnB-Container-Caffe/src/styles/brand-tokens.css` line 7: `* Font: EB Garamond + Space Grotesk`
  - `/Users/macbook/FnB-Container-Caffe/src/styles/global.css` line 139: `--st-secondary: #efbd8a` (not an `--aura-*` token)
  - `/Users/macbook/FnB-Container-Caffe/src/styles/stitch-tokens.css` line 28: `--aura-tertiary: #d4a574`
- **Suggested fix:** Correct plan.md design constraints to match actual codebase values: `background: #050D1A`, `tertiary: #d4a574`, `display font: EB Garamond (primary)`. Verify by reading `src/styles/brand-tokens.css`.

---

## Finding 6: "Tier enum: BASIC | PREMIUM | ENTERPRISE | MASTER" is copy-pasted from Sophia project -- not relevant to AURA CAFE

- **Severity:** Medium
- **Location:** plan.md line 95
- **Flaw:** The plan lists a tier enum constraint derived from the Sophia AI Factory CLAUDE.md, not from the AURA CAFE codebase. No file in the AURA CAFE `src/` directory references all four tier values. Only `worker/src/tree/mautic/` references "BASIC" and "MASTER" in isolated MAUTIC integration code.
- **Failure scenario:** Future developers assume AURA CAFE has a tier system like Sophia's, leading to confusion during feature development. Could cause accidental import of non-existent tier configs, adding dead code or build failures.
- **Evidence:**
  - `grep -rn "BASIC\|PREMIUM\|ENTERPRISE\|MASTER" /Users/macbook/FnB-Container-Caffe/src/ --include="*.ts" --include="*.tsx" 2>/dev/null | grep -v node_modules | grep -v test` returns zero results
  - Only `worker/src/tree/mautic/campaign-enrollment.ts` uses `'MASTER'` and `'BASIC'` string literals for MAUTIC integration, not as an enum
  - The Sophia CLAUDE.md at `/Users/macbook/FnB-Container-Caffe/CLAUDE.md` line under "Quality Gates" section: `Tier enum values: BASIC | PREMIUM | ENTERPRISE | MASTER (uppercase only)` -- this is from the Sophia project context, not AURA CAFE's own code
- **Suggested fix:** Remove the tier enum constraint from plan.md line 95 or replace with AURA CAFE's actual tier/loyalty structure (which uses point-based tiers in `use-loyalty-store`).

---

## Finding 7: Existing unit test count (1091) is more than 3x the plan's claim of "309+"

- **Severity:** Medium
- **Location:** plan.md lines 26, 83; phase-06-quality-gate-deploy.md line 23
- **Flaw:** The plan repeatedly states "309+ unit tests" and "309 tests" as the baseline, but the actual codebase has 1091 passing unit tests across 106 test files. This is a 3.5x undercount. While not blocking, it undermines trust in the plan's understanding of project scope and will cause the quality gate to use a wrong baseline.
- **Failure scenario:** If a regression reduces the test suite from 1091 to 900, the quality gate looking for "309+ tests" would pass a regressed build.
- **Evidence:**
  - `npx vitest run` output: `Test Files 106 passed (106), Tests 1091 passed (1091)`
  - plan.md line 26: `309 tests`
  - plan.md line 83: `npm test — 309+ unit tests passing`
  - phase-06-quality-gate-deploy.md line 23: `npm test — 309+ unit tests passing`
- **Suggested fix:** Update all references from "309+" to "1091+" (or run `npx vitest run` to get the actual count at time of finalization).

---

## Finding 8: brand.json structure doesn't match Phase 3 template engine assumptions

- **Severity:** Medium
- **Location:** phase-03-productization-cli.md, Steps 2 and 3
- **Flaw:** Phase 3 Step 2 says `aura-deploy init` generates `config/brand.json` with fields: `brand.name`, `brand.domain`, logo, brand colors, admin email, PayOS keys. But the existing `config/brand.json` has a completely different structure: it includes `brand.tagline`, `brand.workerUrl`, `brand.pagesUrl`, `seo.ogImage`, `zones[]`, `contact.zalo`, etc. Step 3 says the template engine substitutes brand values into `manifest.json` -- but `manifest.json` at root already has specific AURA CAFE values hardcoded. The brand.json in `setup/aura-deploy/config/brand.json` uses `{{TEMPLATE_VARS}}` syntax which is incompatible with the `init` wizard approach.
- **Failure scenario:** The `init` command generates brand.json with a different schema than what the template engine expects. The deploy step fails when it tries to read `brand.workerUrl` or `brand.pagesUrl` that the wizard didn't create. Or the template engine tries to substitute into `manifest.json` keys that don't exist.
- **Evidence:**
  - `/Users/macbook/FnB-Container-Caffe/config/brand.json` has fields: `brand.tagline`, `brand.workerUrl`, `brand.pagesUrl`, `seo.ogImage`, `zones[]`, `contact.zalo`, `contact.facebook`, `theme.fonts` -- none of which are in the plan's expected schema
  - `/Users/macbook/FnB-Container-Caffe/setup/aura-deploy/config/brand.json` uses `{{CAFE_NAME}}`, `{{DOMAIN_SLUG}}.pages.dev` template syntax -- incompatible with runtime JS template engine
  - `/Users/macbook/FnB-Container-Caffe/manifest.json` already has hardcoded AURA CAFE name, theme_color #c6c6c7, background_color #0A1A2E
- **Suggested fix:** Phase 3 should (a) analyze the actual brand.json structure and build the CLI to produce a compatible schema, (b) define whether brand.json is the master config (in which case Step 3 needs to handle existing fields) or a new format, (c) clarify whether manifest.json substitution is even needed given it already has values.

---

## Finding 9: Customer pages already have full implementations, not "Basic page exists"

- **Severity:** Medium
- **Location:** phase-01-stitch-screens-customer.md, lines 27-36
- **Flaw:** The plan categorizes all 10 customer screens as "Basic page exists", implying they are minimal or placeholder implementations. In reality, these pages have real state management, API integration, and component trees. For example, `order-failure.tsx` imports `useOrderStore` and uses `useSearchParams`; `promotions.tsx` imports `usePromotions`, `PromotionCard`, `CountdownTimer`; `checkin.tsx` imports `useCheckinStore`, `CheckinForm`, `ApprovalStatus`. Replacing these with Stitch-generated components without preserving existing logic will break functionality.
- **Failure scenario:** Phase 1 generates Stitch-only visual components that lack the store/hook connections these pages already have. Phase 4 tries to "wire" the new components but the existing stores/hooks are designed for the old component interfaces, or the new Stitch components have different data expectations. The result: broken pages that look good but don't function.
- **Evidence:**
  - `/Users/macbook/FnB-Container-Caffe/src/pages/promotions.tsx` lines 1-6: imports `usePromotions`, `PromotionCard`, `CountdownTimer`, `Card`, `Skeleton`, UI components
  - `/Users/macbook/FnB-Container-Caffe/src/pages/checkin.tsx` lines: imports `useCheckinStore`, `CheckinForm`, `ApprovalStatus`
  - `/Users/macbook/FnB-Container-Caffe/src/pages/order-failure.tsx` lines: imports `useOrderStore`, `useSearchParams`, `Link`
- **Suggested fix:** Recategorize each page's current state accurately. Some may not need Stitch redesigns at all if they already have polished UIs. The plan should identify which pages actually need visual redesign vs. which just need refinement.

---

## Finding 10: Plan assumes separate `commander` and `enquirer` packages but also claims "no external dependencies" -- contradiction

- **Severity:** Medium
- **Location:** phase-03-productization-cli.md, line 17 vs lines 44, 48
- **Flaw:** Phase 3 requirements state "Node.js/TypeScript CLI tool (no external dependencies beyond Node built-ins)" but the implementation steps immediately reference `commander` and `enquirer` as options. Installing these packages contradicts the requirement. The requirement should either be loosened or the implementation must use only `process.argv` and `readline`.
- **Failure scenario:** If the dependency-free requirement is enforced by a gate, the CLI won't pass review. If it's ignored, the gate check is meaningless.
- **Evidence:**
  - phase-03-productization-cli.md line 17: `Node.js/TypeScript CLI tool (no external dependencies beyond Node built-ins)`
  - phase-03-productization-cli.md line 44: `Use commander (already in project) or bare process.argv for CLI`
  - phase-03-productization-cli.md line 48: `Interactive prompts (via enquirer or readline)`
  - Neither `commander` nor `enquirer` are in the existing project dependencies (verified by grep)
- **Suggested fix:** Resolve the contradiction: either remove "no external dependencies" (line 17) and add commander/enquirer to the sub-package.json, or remove the package references and commit to process.argv + readline.

---

## Summary of Findings

| # | Severity | Area | Claim | Actual |
|---|----------|------|-------|--------|
| 1 | Critical | E2E Tests | 129+ tests, path `tests/e2e/` | 48 tests, Playwright uses `tests/playwright/` |
| 2 | High | Stores | 17 stores exist for wiring | Only 5 Zustand stores exist; 12 pages use custom hooks |
| 3 | High | Routes | Need to add 28 routes to App.tsx | All 28 routes already registered |
| 4 | High | CLI deps | `commander` already in project | Not in package.json |
| 5 | Medium | Design | #00142c navy, #efbd8a bronze, Cormorant Garamond | #050D1A bg, #d4a574 tertiary, EB Garamond primary |
| 6 | Medium | Tier enum | BASIC/PREMIUM/ENTERPRISE/MASTER | Copied from Sophia; not in AURA codebase |
| 7 | Medium | Test counts | 309+ unit tests | 1091 unit tests |
| 8 | Medium | brand.json schema | Simple 5-field structure | Complex multi-section schema with zones/SEO/contact |
| 9 | Medium | Page state | "Basic page exists" for all 10 customer pages | Full implementations with stores, hooks, components |
| 10 | Medium | CLI constraints | "No external deps" but references commander/enquirer | Contradictory requirements |

---

## Recommended Actions

1. **Rewrite Phase 5 E2E section** to use `tests/playwright/` directory and correct the existing test count. Update all quality gate references accordingly.
2. **Survey every admin and customer page** to determine the actual data-access pattern (Zustand store vs. custom hook) before Phase 4 store wiring.
3. **Change Phase 4 route registration** from "add to App.tsx" to "replace route component imports" -- the routes are already there.
4. **Remove or correct all design constraint values** that don't match the actual codebase (colors, fonts, tier enum).
5. **Resolve the Phase 3 CLI dependency contradiction** -- pick one approach and commit to it.
6. **Fix the brand.json schema documentation** to match the actual file structure.
7. **Correct all test count references** throughout the plan.

---

*Report saved to: `/Users/macbook/FnB-Container-Caffe/plans/260705-0241-aura-cafe-all-streams/reports/code-reviewer-260705-0250-aura-cafe-all-streams-red-team-plan-review-report.md`*
