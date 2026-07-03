# Phase 4: First Client Deployment (5-8h)

**Date:** 2026-07-03
**Status:** Planned
**Prerequisite:** Phase 1 (branding isolation), Phase 2 (aura-deploy CLI), Phase 3 (documentation + support process) must be complete. The CLI tool must be tested in dry-run mode. Client docs must be ready for handover.

---

## 4.1 Find First Client -- Strategy (1h)

**Files:**
- `docs/productization/client-prospecting.md` -- Prospecting script + outreach templates

**Acceptance Criteria:**
- Document defines target client profile:
  - Independent F&B business in Vietnam (cafe, container cafe, tea house, juice bar)
  - Currently using paper/manual ordering OR a generic POS they dislike
  - Has at least 10-15 seats (QR ordering provides clear value)
  - Owner is tech-curious but not technical
  - Located within accessible distance for on-site setup (HCMC preferred for first deployment)
- Outreach script created with:
  - Cold Zalo message template (friendly, non-salesy)
  - Value proposition in 2 sentences max
  - Pain point: "Are your staff still running back and forth to take orders?"
  - Solution: "We set up a QR ordering system for your cafe. No app, no complicated POS, just a QR code on each table."
  - Offer: "Free setup for the first month -- you only pay for payment processing."
- Identification channels:
  - Google Maps search for container cafes / indie cafes in HCMC
  - Facebook groups (cafe owner communities)
  - Zalo groups (F&B networking)
  - Walk-in visits to nearby cafes
- Target: Contact 10-15 cafes, aim for 1-2 serious conversations, close 1
- Decision criteria for first client:
  - Willing to let us use their cafe for real deployment
  - Has stable internet (WiFi for QR ordering)
  - Accepts digital payments (or willing to set up PayOS)
  - Understands this is a pilot -- may have rough edges
- Pricing conversation guide: How to discuss the setup fee and monthly support

**Implementation Steps:**
1. Write the client profile with specific examples of ideal cafes
2. Draft cold outreach messages for Zalo and Facebook
3. Create a simple tracking sheet (Google Sheets or markdown table) for prospects
4. Prepare the pricing conversation script

**Risks:** Low effort, high uncertainty. First client may take multiple rounds of outreach. Mitigation: Start outreach early in Phase 3 so conversations are warm by Phase 4.

---

## 4.2 Dogfood Deployment -- Real Cafe (2-3h)

**Files:**
- `logs/deployments/first-client-deployment-log.md` -- Timestamped deployment log
- `deployments/{client-slug}/` -- Generated deployment files (from Phase 2 CLI)

**Acceptance Criteria:**
- Select a real non-AURA cafe (not AURA CAFE itself) for deployment
- Run the full `aura-deploy init` workflow with the cafe's actual info:
  - Cafe name, brand colors, logo
  - Admin email and password
  - Domain (auraspace.cafe subdomain or custom)
  - PayOS account credentials
- Complete deployment to Cloudflare (Worker + D1 + Pages)
- Verify deployment output: URLs are live, admin login works
- Seed initial data: categories and menu items based on the cafe's actual menu
- Customize brand tokens to match cafe's visual identity
- Print QR codes for each table (at least 5-10)
- Deploy time: Under 2 hours from start to functional
- Document any deviations from the expected flow in the deployment log
- Screenshots taken at each stage for documentation updates

**Implementation Steps:**
1. Coordinate with cafe owner: schedule a 2-hour block when they are least busy
2. Prepare on-site: laptop, QR code printer (or print ahead), measurement tape for QR placement
3. Run `aura-deploy init` with cafe owner present to collect info
4. Wait for Cloudflare deployment to complete (2-5 min)
5. Log in as admin and verify: dashboard loads, menu editor works
6. Input 10-15 actual menu items from the cafe's current menu
7. Test QR ordering flow: scan QR code from a phone, place a test order
8. Test KDS: verify order appears on the kitchen screen
9. Test payment: process a test transaction (if PayOS is set up)
10. Place QR codes on tables and train staff (5 min walkthrough)
11. Write deployment log with timestamps, issues, resolutions

**Risks:**
- **Medium**: Cafe's internet may be unreliable. Mitigation: Test WiFi speed on arrival; have 4G hotspot backup.
- **Medium**: PayOS setup may have issues. Mitigation: Test PayOS sandbox first; have manual backup payment process.
- **Low**: Cafe may change their mind mid-setup. Mitigation: Keep setup fast; have clear communication.
- **Low**: Cloudflare deploy fails due to account limits. Mitigation: Use the AURA operator's CF account if client's has issues.

---

## 4.3 Validate All Features in New Deployment (1.5h)

**Files:**
- `logs/deployments/first-client-validation-checklist.md` -- Validation checklist with pass/fail for each feature

**Acceptance Criteria:**
- Systematic validation of all 30+ features in the new deployment:
  - **Customer-facing:**
    - [ ] Home page loads with cafe branding (logo, colors, name)
    - [ ] Menu displays with correct categories and items
    - [ ] QR code scanning opens correct table menu
    - [ ] Add items to cart works
    - [ ] Cart modification (quantity change, remove) works
    - [ ] Checkout flow works
    - [ ] PayOS payment redirect works (if configured)
    - [ ] Order confirmation screen displays
    - [ ] Multiple languages toggle works (VN/EN)
  - **Admin panel:**
    - [ ] Admin login with configured credentials
    - [ ] Dashboard shows accurate metrics (or zeros for new deployment)
    - [ ] Menu CRUD (add/edit/delete categories and items)
    - [ ] Order management (view, mark ready, complete)
    - [ ] KDS displays incoming orders in real time
    - [ ] Customer list populates after orders
    - [ ] Loyalty configuration (tiers, points)
    - [ ] Report generation (sales, popular items)
    - [ ] QR code management (generate, reprint)
    - [ ] Payment history
    - [ ] Settings (cafe info, tax, hours)
  - **Operations:**
    - [ ] Staff can log in (if staff accounts configured)
    - [ ] Order flow: customer -> QR -> admin -> KDS -> complete
    - [ ] Receipt/order printing (if configured)
    - [ ] Notification/broadcast works
- Each feature tested and marked pass/fail
- Fails documented with: feature name, actual behavior, expected behavior, environment details
- At least 2 end-to-end flows tested:
  1. Full happy path: scan QR -> browse -> order -> pay -> KDS -> serve -> complete
  2. Edge case: empty cart -> add -> remove -> add -> order -> cancel
- Test from multiple devices: 1 phone (customer), 1 tablet (KDS), 1 laptop (admin)

**Implementation Steps:**
1. Create the validation checklist as a markdown document
2. Walk through each feature systematically on the live deployment
3. Test from both customer and admin perspectives
4. Document any issues immediately with screenshots
5. For each failing feature, determine: is this a branding isolation bug, a new deployment issue, or a pre-existing AURA bug?

**Risks:** Low. Features are already tested in the AURA CAFE instance (1184 tests). The main risk is branding isolation breaking something. Mitigation: Phase 1 tests should catch this, but on-site validation is the safety net.

---

## 4.4 Document Issues and Fixes (1h)

**Files:**
- `docs/productization/deployment-lessons-learned.md` -- Lessons learned from first deployment
- `plans/260703-2104-productization/phase-04-fixes.md` -- Fix plan for identified issues

**Acceptance Criteria:**
- Full retrospective document with sections:
  1. **Deployment summary**: Cafe name, date, total time, who was involved
  2. **What went well**: Smooth aspects of the process
  3. **What went wrong**: Issues encountered, severity, root cause
  4. **CLI improvements**: Changes needed to aura-deploy based on real usage
  5. **Doc gaps**: What was missing or unclear in the Phase 3 documentation
  6. **Client feedback**: Direct quotes or paraphrased feedback from the cafe owner
  7. **Feature gaps**: Features the client asked for that don't exist yet
  8. **Pricing feedback**: Client's reaction to pricing model
- For each issue, document:
  - Title and description
  - Root cause (branding isolation, CLI bug, env difference, user error)
  - Fix applied (or pending)
  - Recurrence prevention
- Prioritized fix plan with effort estimates
- Updated docs if deployment revealed gaps in setup guide or admin manual
- All fixes tracked in the Phase 4 fix plan for immediate execution

**Implementation Steps:**
1. Immediately after deployment, write the deployment summary while details are fresh
2. Review all validation failures from 4.3 and categorize them
3. Interview the cafe owner (5 min): "What was confusing? What would you change?"
4. Review the Phase 3 docs against the real experience and note gaps
5. Produce the fix plan with prioritized issues

**Risks:** Low. Time-boxed to 1h; don't over-document.

---

## 4.5 Create Client Handover Checklist (0.5-1h)

**Files:**
- `docs/productization/client-handover-checklist.md` -- Standardized handover template
- `docs/productization/handover-log-first-client.md` -- Completed handover for the first client

**Acceptance Criteria:**
- Client handover checklist includes:
  - **Before handover:**
    - [ ] Deployment complete and live (URL verified)
    - [ ] All 30+ features validated (from 4.3 checklist)
    - [ ] Branding verified (logo, colors, name across all pages)
    - [ ] Menu fully populated with actual items and prices
    - [ ] QR codes printed and placed on tables
    - [ ] PayOS payment integration tested (sandbox or live)
    - [ ] Admin credentials documented (password reset recommended after first login)
    - [ ] Staff accounts created (if applicable)
    - [ ] WiFi QR code or instructions available for customers
    - [ ] Backup menu (printed) available in case system goes down
  - **Handover session:**
    - [ ] Schedule 30-minute training with cafe owner + 1-2 staff
    - [ ] Walk through admin panel (dashboard, menu editor, orders)
    - [ ] Show staff how the KDS works
    - [ ] Demonstrate a full order flow (customer places order -> KDS -> serve)
    - [ ] Show how to handle problems (network down, wrong order, refund)
    - [ ] Give the setup guide and admin manual (printed + digital)
    - [ ] Save Zalo support number in their phone
    - [ ] Explain SLA and escalation path
    - [ ] Collect feedback (what's unclear, what's missing)
  - **After handover:**
    - [ ] Send handover confirmation email with all URLs, credentials, and docs
    - [ ] Add client to support system (Zalo contact list)
    - [ ] Set a 3-day follow-up check-in
    - [ ] Set a 2-week follow-up review
    - [ ] Invoice for setup fee (if applicable)
- First-client handover log completed with actual data
- Handover template is reusable for all future clients

**Implementation Steps:**
1. Write the reusable handover checklist template
2. Complete it for the first client during the handover session
3. Print (or have ready) the setup guide and admin manual for the cafe owner
4. Conduct the 30-min training session
5. Send the confirmation email/post-handover summary
6. Schedule the follow-up check-ins

**Risks:** Low. The checklist is a template; each client reuse reduces risk.

---

## Total Hours

| Task | Hours |
|------|-------|
| 4.1 Find first client (strategy) | 1.0 |
| 4.2 Dogfood deployment (on-site) | 3.0 |
| 4.3 Validate all features | 1.5 |
| 4.4 Document issues/fixes | 1.0 |
| 4.5 Client handover checklist | 1.0 |
| Buffer/follow-up | 0.5 |
| **Total** | **8.0** |

---

## File Inventory

```
docs/productization/
  client-prospecting.md                 # Target profile, outreach templates
  client-handover-checklist.md          # Standardized handover checklist template
  handover-log-first-client.md          # Completed handover for first client
  deployment-lessons-learned.md         # Lessons learned from first deployment
logs/deployments/
  first-client-deployment-log.md        # Timestamped deployment record
  first-client-validation-checklist.md  # Pass/fail for every feature
plans/260703-2104-productization/
  phase-04-fixes.md                     # Prioritized fix plan from issues found
deployments/{client-slug}/
  (generated by Phase 2 CLI)
```

## Dependencies

- Phase 1 complete (branding isolation) -- hard prerequisite
- Phase 2 complete (aura-deploy CLI) -- hard prerequisite
- Phase 3 complete (docs + support process) -- needed for handover
- A valid Cloudflare account (operator's or client's)
- PayOS merchant account for the client (or operator-assisted setup)
- QR code printer or print shop access
- 4G hotspot as backup internet

## Quality Gates

- First client deployment is a real cafe (not AURA CAFE itself)
- All 30+ features validated and documented
- Deployment log captures all timestamps, issues, and resolutions
- Client handover checklist completed and signed off (implicitly by delivery)
- Lessons learned document produced and shared with the team
- Fix plan produced with prioritized issues for immediate execution
- Cafe owner can independently place a test order after training
- No regression introduced to AURA CAFE (original instance still works)

## Rollback Notes

- If deployment fails catastrophically, the cafe's operations are unaffected (they use their existing system)
- Cloudflare deployment can be deleted: `wrangler delete --name {slug}`
- D1 database can be deleted via Cloudflare Dashboard
- No changes to the AURA CAFE production instance
- Client handover is reversible: remove QR codes, revert to previous system
- The first client is a pilot -- offer a free first month to lower their risk
