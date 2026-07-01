# Red Team Plan Review: FnB Full-Stack Redesign

**Role:** Security Adversary + Fact Checker
**Date:** 2026-07-01
**Plan:** `260701-0942-fnb-fullstack-redesign`
**Codebase:** `/Users/macbook/FnB-Container-Caffe/`

---

## Finding 1: HTML line counts inflated 20-60x — effort estimates and risk profile are fabricated

- **Severity:** Critical
- **Location:** Plan overview + Phases 2-5, "Pages" tables
- **Flaw:** Every HTML file line count in the plan is massively wrong. The plan claims files are 3.7K-39K lines but actual counts are 19-739 lines. The largest HTML file is `loyalty-calculator.html` at 739 lines, not 38,815. `index.html` is 626 lines, not 37,221.
- **Failure scenario:** Effort estimates (120h total), risk assessments (e.g., Phase 2: "37K-line index.html has hidden logic"), and the entire premise of a "massive migration" are based on fabricated complexity. The plan allocates 20h to Phase 2 (revenue path) when those 5 pages total only 1,780 lines. The Phase 3 allocation of 16h for the "38K-line loyalty calculator" is for a 739-line file. This misrepresentation cascades into every phase's effort estimate.
- **Evidence:**
  - Plan says: `index.html` 37,221 lines, `loyalty-calculator.html` 38,815 lines, `brand-guideline.html` 27,888 lines
  - Reality: `wc -l` output:
    ```
       626 index.html
       105 menu.html
       318 checkout.html
       497 success.html
       234 failure.html
       739 loyalty-calculator.html
       601 brand-guideline.html
        19 404.html
    ```
  - Total HTML across all 19 pages counted: **5,995 lines**, not the hundreds of thousands implied by the plan.
- **Suggested fix:** Recalculate all effort estimates from actual file sizes. The migration is at least 5x smaller in scope than the plan assumes. Consider whether the 120h estimate should be 30-40h.

---

## Finding 2: Worker already uses Hono — Phase 6 premise is false

- **Severity:** High
- **Location:** Plan overview ("Backend: Hono + TypeScript refactor"), Phase 6 overview, Risk Assessment ("Hono API differs from vanilla JS Service Worker")
- **Flaw:** The plan describes the backend as "34 vanilla JS route files" and presents Phase 6 as introducing Hono. In reality, the worker is already built on Hono — `worker/src/index.js` imports from `hono`, uses `new Hono()`, mounts Hono Routers, and has `hono` v4.12 as a dependency in `worker/package.json`. Multiple route files (orders-hono.js, signage.js, webhooks.js, referrals.js, reservations.js, loyalty.js, contact.js, etc.) already use the Hono Router pattern. The actual Phase 6 work is JS-to-TypeScript conversion of an existing Hono application, not a framework migration.
- **Failure scenario:** An implementer following the plan's "Hono Scaffold + Middleware" instructions might try to replace the existing Hono app with a new one, breaking all existing route registrations and the production worker. The risk assessment item "Hono API differs from vanilla JS Service Worker" is solving a problem that doesn't exist — the worker has never been a vanilla Service Worker.
- **Evidence:**
  - `worker/src/index.js:9`: `import { Hono } from 'hono';`
  - `worker/src/index.js:79`: `const app = new Hono();`
  - `worker/package.json:16`: `"hono": "^4.12.12"`
  - `worker/src/routes/orders-hono.js:7`: `export const ordersRouter = new Hono();`
  - Plan says: "Refactor the Cloudflare Worker from 34 vanilla JS route files into a typed Hono application"
- **Suggested fix:** Rename Phase 6 to "TypeScript Migration of Existing Hono Backend." Remove all "introduce Hono" language. Replace scaffold steps with a conversion plan that ports each route file in-place from `.js` to `.ts` while preserving the existing Hono app structure.

---

## Finding 3: CSP security regression — React migration will break under existing Content-Security-Policy

- **Severity:** Critical
- **Location:** All phases. No section mentions CSP or `_headers`.
- **Flaw:** The codebase has a strict CSP in `_headers`:
  ```
  Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' https://fonts.googleapis.com https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net; img-src 'self' data: https: blob:; font-src 'self' data: https://fonts.gstatic.com; connect-src 'self' https://api.supabase.co https://aura-space-worker.sadec-marketing-hub.workers.dev https://api-merchant.payos.vn; frame-ancestors 'none'; base-uri 'self'; form-action 'self'
  ```
  The plan introduces multiple CSP violations:
  1. New dependencies (`lucide-react`, `chart.js`, `@calcom/embed-react`) — no CDN origins added to CSP
  2. React CSS-in-JS / style injection requires `'unsafe-inline'` for styles (already present, but the plan mentions "Tailwind v4" which may use different injection patterns)
  3. Cal.com iframe embeds (Phase 4) — `frame-src` is not specified, falls back to `default-src 'self'`, which blocks Cal.com
  4. New API endpoints on different origins (none specified) may violate `connect-src`
  5. Phase 7 mentions "deploy pipeline" but zero mention of CSP updates — the deploy will succeed but all React pages may fail to load
- **Failure scenario:** After Phase 7 deployment, the React app loads a blank white page. Scripts from new CDN origins are blocked. Cal.com booking iframe shows nothing. Lucide icons fail to load. The existing strict CSP silently kills the new application in production.
- **Evidence:**
  - `/Users/macbook/FnB-Container-Caffe/_headers:15-16`: Full CSP directives
  - `_headers:18`: `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload`
  - `_headers:25`: `Cross-Origin-Embedder-Policy: require-corp`
  - Plan: Zero mentions of CSP, `_headers`, security headers, or Content-Security-Policy across all 7 phases
- **Suggested fix:** Add a CSP audit step to Phase 7. Before deployment, enumerate all new script/style/frame/connect origins and update the CSP. Add Cal.com and any new CDN origins to `script-src` and `frame-src`. Consider adding `frame-src https://app.cal.com https://cal.com` for the Cal.com embed. Add `connect-src` entries for any new API origins.

---

## Finding 4: Design system generation command references non-existent path

- **Severity:** High
- **Location:** Phase 1, Step 1.1
- **Flaw:** Step 1.1 instructs:
  ```
  Run python3 src/ui-ux-pro-max/scripts/search.py "food beverage cafe container coffee shop" --design-system --persist -p "FnB Container Caffe"
  ```
  The path `src/ui-ux-pro-max/scripts/search.py` does not exist in `/Users/macbook/FnB-Container-Caffe/`. The `src/` directory doesn't exist yet. No copy of ui-ux-pro-max exists anywhere in the FnB project. The actual search.py lives at `/Users/macbook/ui-ux-pro-max-skill/src/ui-ux-pro-max/scripts/search.py` — a completely different project root.
- **Failure scenario:** Phase 1 Step 1.1 fails immediately. The implementer cannot run the command, the design system is never generated, and all subsequent phases that depend on `design-system/MASTER.md` and `design-system/tokens/` cannot proceed. The entire plan is blocked at step 1 of Phase 1.
- **Evidence:**
  - `ls /Users/macbook/FnB-Container-Caffe/src/` returns "NO SRC DIR"
  - `find /Users/macbook/FnB-Container-Caffe/ -name "search.py"` returns nothing
  - `search.py` exists at: `/Users/macbook/ui-ux-pro-max-skill/src/ui-ux-pro-max/scripts/search.py`
  - Plan Step 1.1: `python3 src/ui-ux-pro-max/scripts/search.py ...`
- **Suggested fix:** Correct the command to reference the actual skill location. Either use an absolute path or specify that the skill must be copied/linked into the project first. Example: `python3 /Users/macbook/ui-ux-pro-max-skill/src/ui-ux-pro-max/scripts/search.py "food beverage cafe container coffee shop" --design-system --persist -p "FnB Container Caffe" --output-dir design-system/`

---

## Finding 5: Test count is fabricated — 576 claimed, 814 actual

- **Severity:** High
- **Location:** Plan overview (Acceptance Criteria #5), Phase 6 (Success Criteria #2), Phase 7 (Step 7.5, Test #10)
- **Flaw:** The plan repeatedly cites "576 test behaviors" as the existing test suite baseline. Running the actual test suite reveals **814 tests** (813 pass, 1 fail). This is a 41% undercount. Phase 6's success criterion "All existing 576 tests pass against refactored worker" and Phase 7's regression test "run adapted 576-test suite" are both wrong.
- **Failure scenario:** An implementer following the 576 target might ignore 238 tests that need porting. Contract verification against the refactored worker would pass 576 tests but fail 238 silently. Production bugs from uncovered test scenarios.
- **Evidence:**
  - Plan: `Tests: ≥ 80% coverage, all existing 576 test behaviors preserved`
  - Reality: `npx jest --verbose` output: `Tests: 1 failed, 813 passed, 814 total`
  - Test file count: `npx jest --listTests | wc -l` → 29 test suites
- **Suggested fix:** Correct all references from 576 to 814. Ensure Phase 6's contract test runs ALL 814 tests, not 576.

---

## Finding 6: Happy Hour feature invented — does not exist in codebase

- **Severity:** Medium
- **Location:** Phase 2, Section 2.2 (Cart + Checkout), Implementation Steps, Risk Assessment
- **Flaw:** The plan specifies "Happy hour discount logic (14:00-16:00, 20% off drinks)" as a feature to implement. A comprehensive grep for "happy", "Happy", "HAPPY", "giờ vàng", "golden hour", "discount", "20%" across all worker routes, all JS files, and all HTML files returns zero results. This feature does not exist. It is scope creep disguised as migration.
- **Failure scenario:** The implementer builds a happy hour system from scratch, introducing new database columns, API endpoints, cron jobs, and frontend state. This is new feature development, not migration. If the feature doesn't match business requirements, it wastes effort. If it does match requirements, it should be a separate tracked feature, not buried in a "migration" phase.
- **Evidence:**
  - `grep -rn "happy\|Happy\|HAPPY\|giờ vàng\|golden hour" /Users/macbook/FnB-Container-Caffe/worker/src/` → no output
  - `grep -rn "happy\|Happy\|HAPPY\|giờ vàng\|golden hour" /Users/macbook/FnB-Container-Caffe/js/` → no output
  - `grep -rn "happy\|Happy\|HAPPY\|giờ vàng\|golden hour" /Users/macbook/FnB-Container-Caffe/*.html` → no output
  - Plan Phase 2: "Happy hour discount logic (14:00-16:00, 20% off drinks)"
- **Suggested fix:** Remove happy hour from the plan. If it is a desired new feature, create a separate plan for it. Do not smuggle new features into a migration.

---

## Finding 7: Referral "30% commission" claim is wrong — actual logic is flat cashback

- **Severity:** Medium
- **Location:** Phase 3, Section 3.3, Architecture (CommissionTable), TDD (commission-table test)
- **Flaw:** The plan claims a "30% commission" rate with "tier-based multipliers" for referrals. The actual referral route (`worker/src/routes/referrals.js`) implements:
  - v1 (legacy): Referrer gets 100 points. Referee gets FIRSTORDER code (20% off), no points.
  - v3 (current, from 2026-05-30): Referrer gets 10,000đ cashback when friend's first order >= 20,000đ. No percentage commission. No tier multipliers. No points for referee.
- **Failure scenario:** An implementer building a percentage-based commission table with tier multipliers will create a referral system that doesn't match the existing business logic. Customers expecting 10,000đ cashback might see 30% commission calculations instead. The existing referral API contract is broken.
- **Evidence:**
  - `worker/src/routes/referrals.js:2-15`: Documents v1 (100 points) and v3 (10,000đ cashback) schemes
  - `grep -rn "30%" /Users/macbook/FnB-Container-Caffe/worker/src/routes/referrals.js` → no matches
  - Plan Phase 3: "CommissionTable (30% commission, tier-based multipliers)"
- **Suggested fix:** Update the plan to match the actual referral logic (10,000đ cashback flat). If a 30% commission model is a desired change, it must be explicitly noted as a business rule change, not presented as migration of existing logic.

---

## Finding 8: Font choices reverse a completed migration and introduce unapproved typeface

- **Severity:** Medium
- **Location:** Phase 1, Architecture (typography.css), Phase 5 (TypographyShowcase)
- **Flaw:** Phase 1 specifies fonts as "Playfair Display SC + Karla + Space Grotesk." The existing `css/brand-tokens.css` documents that the project has already migrated FROM Playfair Display TO Cormorant Garamond:
  ```
  * Font:   Playfair Display → Cormorant Garamond
  * Font:   Manrope → Space Grotesk
  ```
  The actual font stack is Cormorant Garamond + Space Grotesk + Plus Jakarta Sans. The plan proposes reverting to Playfair Display (undoing a deliberate migration) and introducing Karla (which has never been part of the system). The plan's risk assessment ("Design token mismatch with Bazi legacy") mentions Bazi but never addresses the font migration reversal.
- **Failure scenario:** The design system is generated with Playfair Display SC and Karla. When applied, all headings and body text change from the established Cormorant Garamond + Space Grotesk look. Bazi identity (documented in brand-guideline.html as "Thủy Noir Lounge") is disrupted by a font that was previously removed. The visual brand is fragmented between old pages (Cormorant Garamond) and new pages (Playfair Display SC).
- **Evidence:**
  - `css/brand-tokens.css:13-14`: `* Font: Playfair Display → Cormorant Garamond`, `* Font: Manrope → Space Grotesk`
  - `css/brand-tokens.css:22`: `font-family: 'Plus Jakarta Sans';` (used for 12+ font-size classes)
  - Plan Phase 1: `typography.css — Playfair Display SC + Karla + Space Grotesk`
- **Suggested fix:** Use Cormorant Garamond (display) + Space Grotesk (body) + Plus Jakarta Sans (utility) to match the existing migration. Or provide explicit rationale for why the migration is being reversed and what Karla adds that Plus Jakarta Sans doesn't cover.

---

## Finding 9: "Not Touched" route file extensions are all wrong (.ts vs .js)

- **Severity:** Medium
- **Location:** Phase 6, "Files NOT Touched (Other Plans Own)" section
- **Flaw:** Every file listed uses a `.ts` extension:
  - `worker/src/routes/erpnext.ts`
  - `worker/src/routes/erpnext-pos.ts`
  - `worker/src/routes/odoo*.ts`
  - `worker/src/routes/mixpost.ts`
  - etc.
  
  None of these `.ts` files exist. The actual files are all `.js`:
  - `worker/src/routes/erpnext.js`
  - `worker/src/routes/erpnext-pos.js`
  - `worker/src/routes/mixpost.js`
  - etc.
  
  Additionally, `odoo*` routes do not exist at all — there are zero Odoo route files in the worker.
- **Failure scenario:** File ownership boundaries reference non-existent files. The Phase 6 implementer might create `.ts` files alongside `.js` files rather than converting them. The "odoo*.ts" glob matches nothing, so ownership isn't documented for whatever Odoo integration actually exists (in `worker/src/index.js` there's no Odoo import).
- **Evidence:**
  - `ls worker/src/routes/erpnext*.js` → `erpnext-invoices.js`, `erpnext-pos.js`, `erpnext.js`
  - `ls worker/src/routes/odoo*` → no matches
  - Plan Phase 6: `worker/src/routes/erpnext.ts`, `worker/src/routes/odoo*.ts`
- **Suggested fix:** Correct all file extensions from `.ts` to `.js`. Remove the `odoo*` glob if it matches nothing, or replace with the actual Odoo-related file paths.

---

## Finding 10: Payment methods overstated — MoMo and VNPay are disabled

- **Severity:** Low-Medium
- **Location:** Phase 2, TDD #5 (payment-method-selector), Architecture (PaymentMethodSelector), Risk Assessment
- **Flaw:** The plan presents payment methods as "COD/MoMo/VNPay/PayOS" implying all four are active. The actual `js/config.js` documents:
  ```js
  momo: { enabled: false },
  vnpay: { enabled: false }
  ```
  Only PayOS and COD are functional. The backend (`worker/src/routes/payment.js`) implements only PayOS — there are no MoMo or VNPay API routes.
- **Failure scenario:** An implementer builds PaymentMethodSelector with all 4 options, generates QR codes for MoMo and VNPay, but the backend has no routes to process those payments. Customers select MoMo or VNPay, the payment never processes, and orders are lost.
- **Evidence:**
  - `js/config.js:28-30`: `momo: { ..., enabled: false }`
  - `js/config.js:33-37`: `vnpay: { ..., enabled: false }`
  - `worker/src/routes/payment.js:2`: `Payment Routes — PayOS Integration` (PayOS only)
  - Plan Phase 2 TDD #5: "renders COD/MoMo/VNPay/PayOS, keyboard navigation, aria-checked"
- **Suggested fix:** Either remove MoMo/VNPay from the PaymentMethodSelector scope, or add a Phase 2 dependency to build backend routes for MoMo/VNPay. The frontend-only QR generation in `js/checkout/qr-code.js` is not enough.

---

## Summary

| # | Finding | Severity |
|---|---------|----------|
| 1 | HTML line counts inflated 20-60x | Critical |
| 2 | Worker already uses Hono — false premise | High |
| 3 | CSP security regression — React breaks under existing CSP | Critical |
| 4 | Design system command references non-existent path | High |
| 5 | Test count fabricated (576 vs 814 actual) | High |
| 6 | Happy Hour feature invented — doesn't exist | Medium |
| 7 | Referral commission rate wrong (30% vs flat 10Kđ) | Medium |
| 8 | Font choices reverse completed migration | Medium |
| 9 | "Not Touched" file extensions all wrong (.ts vs .js) | Medium |
| 10 | Payment methods overstated (MoMo/VNPay disabled) | Low-Medium |

**Verdict:** This plan contains fabricated file sizes, a false architectural premise, a deployment-blocking CSP omission, a broken first-step command, and multiple factual errors about the existing codebase. It should not proceed to implementation without significant corrections to effort estimates, architecture assumptions, and external dependency handling.
