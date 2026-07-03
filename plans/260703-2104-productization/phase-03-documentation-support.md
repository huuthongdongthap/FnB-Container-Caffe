# Phase 3: Documentation + Support (5-8h)

**Date:** 2026-07-03
**Status:** Planned
**Prerequisite:** Phase 1 (branding isolation) and Phase 2 (aura-deploy CLI) must be complete. Brand.json, env-var-driven CSS, and working deploy CLI are required to document accurate setup steps.

**Audience:** Non-technical cafe owners in Vietnam (Vietnamese primary, English as fallback). All docs follow bilingual format (VN + EN) with emoji for clarity, no developer jargon.

---

## 3.1 Bilingual Setup Guide for Clients (1.5-2h)

**Files:**
- `docs/productization/client-setup-guide.md` -- Primary deliverable, client-facing
- `docs/productization/images/` -- Screenshots directory for guide illustrations

**Acceptance Criteria:**
- Complete step-by-step guide for a non-technical cafe owner to get a new AURA instance running
- Covers:
  1. Prerequisites: What the client needs (a domain or use of auraspace.cafe subdomain, a Cloudflare account -- or optionally skip CF setup if operator handles it)
  2. Signing up / engaging the AURA team
  3. What information to provide (cafe name, logo, brand colors, admin email, menu categories)
  4. What the operator does with that info (setup CLI flow explained in plain language)
  5. Timeline expectation (2-4 hours for full setup)
  6. What the client receives after setup (URLs, admin credentials)
  7. First-time login walkthrough
  8. How to customize the menu
  9. How to test QR ordering
  10. How to set up PayOS payment
- Bilingual: Every section has Vietnamese text with English in parentheses or side-by-side
- Uses emoji for visual cues throughout
- Zero developer jargon (no "CLI", "deploy", "D1", "worker" -- use "automatic setup", "install", "system")
- Estimated reading time: 15-20 minutes
- Available as printable PDF (markdown export)
- Includes 5-8 screenshots/annotations of key screens (admin login, menu editor, QR code)
- French-fold or A4-friendly layout

**Implementation Steps:**
1. Outline all sections based on the actual aura-deploy CLI flow
2. Write each section in Vietnamese first, then add English
3. Take screenshots of a working deployment (AURA CAFE) and annotate with arrows/labels
4. Create a visual flow diagram showing the setup process
5. Review for readability by a non-technical person (ask a friend to test-read)
6. Export to PDF for client delivery

**Risks:** Low. Time risk if screenshots need re-taking after Phase 1 branding changes. Mitigation: Take screenshots from the final deployed instance after Phase 1 is done.

---

## 3.2 Bilingual Admin Manual (Customizable) (2h)

**Files:**
- `docs/productization/admin-manual.md` -- Main admin manual template with `{{BRAND_NAME}}` tokens
- `setup/aura-deploy/templates/admin-manual.md.hbs` -- Handlebars template for per-client customization

**Acceptance Criteria:**
- Comprehensive admin guide covering all 30+ features
- Section layout:
  1. Dashboard overview -- key metrics at a glance
  2. Menu management -- add/edit/delete categories and items, set prices, manage modifiers
  3. Order management -- view incoming orders, mark ready, complete, cancel
  4. QR code management -- generate table QR codes, print, replace
  5. Customer management -- view customer list, order history, loyalty points
  6. Kitchen Display System (KDS) -- how the kitchen view works
  7. Payment integration -- PayOS setup and transaction reports
  8. Loyalty program -- configure tiers, points, rewards
  9. Marketing -- create campaigns, broadcast messages
  10. Reports -- sales reports, popular items, peak hours
  11. Settings -- cafe info, tax config, operating hours, language toggle
- Template variables for client-specific content:
  - `{{BRAND_NAME}}` -- Cafe name throughout examples
  - `{{ADMIN_URL}}` -- Client's admin panel URL
  - `{{PUBLIC_URL}}` -- Client's public URL
  - `{{SUPPORT_EMAIL}}` -- AURA support contact
  - `{{SUPPORT_ZALO}}` -- AURA Zalo support number
- Bilingual throughout (VN + EN per section)
- Emoji headings for navigation
- "Quick reference" cheat sheet at the end (1-page summary)
- Handlebars template is tested: `aura-deploy generate-docs --config deployments/{slug}/brand.json` produces a filled-in admin manual

**Implementation Steps:**
1. Write the full admin manual as a markdown document with `{{VAR}}` placeholders
2. Create the Handlebars template version for CLI generation
3. Add `generate-docs` subcommand to aura-deploy CLI (or a separate `docs` command)
4. Test template rendering with a sample brand.json
5. Verify all referenced screens match actual UI (after Phase 1 branding changes)

**Risks:** Low. Main risk is the manual going out of date as features change. Mitigation: Add a "Last updated" field and version number. The template approach makes updates easy.

---

## 3.3 Support Process Document (1-1.5h)

**Files:**
- `docs/productization/support-process.md` -- Internal operations doc
- `docs/productization/sla-template.md` -- SLA terms for client contract

**Acceptance Criteria:**
- Defines the complete support workflow using Zalo as primary channel
- Sections:
  1. Support channels: Zalo (primary), Email (backup), Phone (emergency)
  2. Ticket intake: How a client submits a request (Zalo message format template)
  3. Triage: Urgent vs normal vs enhancement classification
  4. SLA guidelines:
     - Critical (system down, payment broken): 2-hour response, 4-hour fix
     - High (feature broken): 4-hour response, 8-hour fix
     - Normal (question, how-to): 8-hour response, 24-hour fix
     - Low (feature request): 24-hour response, next release
  5. Escalation path: Who handles what (L1: Zalo bot/automated FAQ -> L2: Operator -> L3: Developer)
  6. Handoff procedure: What info to collect before escalating
  7. Monthly reporting: Basic KPIs (tickets opened, resolved, avg response time, avg resolution time)
- SLA template includes:
  - Service hours (Mon-Sat 8:00-18:00 or similar)
  - Response time commitments
  - Exclusions (third-party issues like Cloudflare/DNS outages)
  - Severity definitions
  - Client responsibilities (provide clear description, screenshots, be reachable)
- Bilingual (VN + EN) for both internal and client-facing portions
- Zalo templates: Pre-written message templates for common responses (acknowledgment, status update, resolution, escalation notice)

**Implementation Steps:**
1. Define the support workflow as a simple flow diagram
2. Write the process doc with Zalo integration details
3. Draft the SLA template in client-friendly language
4. Create Zalo quick-reply message templates
5. Optionally set up a Zalo OA (Official Account) for ticketing

**Risks:** Low. Zalo is well understood in Vietnam. No new software to build.

---

## 3.4 Troubleshooting FAQ (1h)

**Files:**
- `docs/productization/troubleshooting-faq.md`

**Acceptance Criteria:**
- 15-20 most common issues with solutions
- Bilingual (VN + EN) question/answer format
- Categories:
  1. **Login issues** (forgot password, account locked, browser issues)
  2. **Menu issues** (items not showing, prices wrong, images broken)
  3. **Order issues** (order not appearing in KDS, customer can't place order)
  4. **QR code issues** (code not scanning, wrong table assignment)
  5. **Payment issues** (PayOS not working, transaction failed, refund how-to)
  6. **Loyalty issues** (points not updating, rewards not applying)
  7. **Display/screen issues** (KDS not refreshing, layout broken on tablet)
  8. **Performance issues** (slow loading, errors at peak hours)
- Each entry: Problem description -> Likely cause -> Step-by-step solution
- "Still stuck?" section pointing to Zalo support
- Emoji labels for severity (Critical / High / Normal / Low)
- Searchable format (alphabetical or categorical index at top)
- Cross-references to relevant sections in the admin manual

**Implementation Steps:**
1. Brainstorm top 20 issues based on AURA CAFE operational experience
2. Write each Q&A entry in Vietnamese + English
3. Validate solutions by reproducing each issue in the dev environment
4. Add cross-references to the admin manual
5. Review with a non-technical person for clarity

**Risks:** Low. Most issues are known from AURA CAFE operations.

---

## Total Hours

| Task | Hours |
|------|-------|
| 3.1 Client setup guide | 2.0 |
| 3.2 Admin manual (customizable) | 2.0 |
| 3.3 Support process doc | 1.5 |
| 3.4 Troubleshooting FAQ | 1.0 |
| Buffer/polish | 1.0 |
| **Total** | **7.5** |

---

## File Inventory

```
docs/productization/
  client-setup-guide.md          # Client-facing setup instructions (VN+EN)
  admin-manual.md                # Full admin manual template (VN+EN)
  support-process.md             # Internal Zalo-based support workflow
  sla-template.md                # SLA terms for client contracts
  troubleshooting-faq.md         # 15-20 common issues with solutions
  images/
    setup-flow.png               # Setup process flowchart
    admin-dashboard.png          # Admin dashboard screenshot
    menu-editor.png              # Menu editor screenshot
    qr-code-sample.png           # QR code example
    kds-view.png                 # KDS screenshot
setup/aura-deploy/templates/
  admin-manual.md.hbs            # Handlebars template for per-client admin manual
```

## Quality Gates

- All docs reviewed by a non-technical person for clarity
- No developer jargon in client-facing docs
- Every section is bilingual (VN + EN)
- `aura-deploy generate-docs` produces valid admin manual from template
- Troubleshooting FAQ covers minimum 15 issues
- SLA template is legally clear (no ambiguous commitments)
- All screenshots are current (match the post-Phase-1 UI)

## Rollback Notes

- Templates are version-controlled; old versions available in git history
- Client docs are not deployed automatically -- delivered manually per client
- SLA template is a starting point; final SLA negotiated per client contract
