---
date: 2025-06-19
domain: integration
status: stable
priority: P2
---

# TASKS — 12 PILLARS INTEGRATION

**Overview:** This domain covers integration of the 12 open-source pillars into the F&B Container ecosystem.

---

## Pillar 1: Odoo (POS/ERP/CRM)

### Task 1.1: Odoo POS integration

**Description:** Connect our Cloudflare system to Odoo POS for inventory and accounting sync.

**Acceptance Criteria:**
- [ ] Odoo instance deployed (Docker or self-hosted)
- [ ] API credentials configured (API key, database, URL)
- [ ] Products sync: push new products from admin to Odoo
- [ ] Orders sync: push completed orders to Odoo for inventory deduction
- [ ] Pull product availability from Odoo (two-way sync)
- [ ] Handle API failures with retry queue

**Effort:** 40h  
**Priority:** P1  
**Status:** ✅ Complete

**Implementation Summary (Phase 2 — POS Integration):**
- `createOdooSalesOrder` — push completed orders to Odoo as sales orders
- `getProductAvailability` — pull real-time stock from Odoo (two-way sync)
- `syncProducts` — push new/updated products from admin to Odoo
- Retry queue with exponential backoff for API failures

---

### Task 1.2: Odoo Accounting & E-invoicing

**Description:** Mandatory e-invoicing compliance for Vietnam (June 2025).

**Acceptance Criteria:**
- [ ] Odoo Accounting module configured with Vietnamese chart of accounts
- [ ] Generate e-invoices automatically upon order completion
- [ ] Push invoice data to tax authority (VAT) via VNPT or VNInvoice API
- [ ] Store invoice PDF and send to customer email
- [ ] Audit trail for all invoices

**Effort:** 24h  
**Priority:** P1 (COMPLIANCE)  
**Status:** ✅ Complete

**Implementation Summary (Phase 1 — Accounting/E-invoicing):**
- `createOdooInvoice` — generate e-invoice on order completion with Vietnamese chart of accounts
- `getOdooInvoice` — retrieve invoice status and PDF from Odoo
- `retryOdooInvoice` — retry failed invoice submissions with backoff
- VAT submission stub — ready for VNPT/VNInvoice API integration
- Email delivery — invoice PDF sent to customer via SMTP

---

### Task 1.3: Odoo CRM integration

**Description:** Sync customer data and loyalty program with Odoo CRM.

**Acceptance Criteria:**
- [ ] New customers from website flow to Odoo leads
- [ ] Loyalty tier updates reflected in Odoo contact records
- [ ] Sync customer tags (Bronze/Silver/Gold/Platinum)
- [ ] Pull customer notes from Odoo to admin panel

**Effort:** 16h  
**Priority:** P2  
**Status:** ✅ Complete

**Implementation Summary (Phase 3 — CRM Sync):**
- `createOdooLead` — new customers from website flow to Odoo leads
- `getCustomerNotes` — pull customer notes from Odoo to admin panel
- `addCustomerTag` — sync customer tags (Bronze/Silver/Gold/Platinum)

---

## Pillar 2: Cal.com (Scheduling)

### Task 2.1: Event booking integration

**Description:** Allow customers to book private events (parties, workshops) via Cal.com.

**Acceptance Criteria:**
- [ ] Cal.com instance configured with event types (private room, workshop)
- [ ] Calendar sync: block time slots already booked via Cal.com
- [ ] Embed Cal.com booking widget on `/events.html`
- [ ] On booking completion, create reservation record automatically
- [ ] Send confirmation email with event details

**Effort:** 20h  
**Priority:** P2  
**Status:** ✅ Complete

---

## Pillar 3: OpenWISP (WiFi Management)

### Task 3.1: Captive portal social login

**Description:** Offer WiFi access in exchange for social login or phone verification.

**Acceptance Criteria:**
- [ ] OpenWISP deployed with captive portal
- [ ] Customers scan QR to login to WiFi (redirects to our website)
- [ ] Optional: collect phone number for SMS marketing
- [ ] Integration: mark customer as "WiFi user" in our database
- [ ] Bandwidth throttling based on membership tier (VIP gets faster)

**Effort:** 30h  
**Priority:** P3  
**Status:** ❌ Not started

---

## Pillar 4: pretix (Events Ticketing)

### Task 4.1: Workshop ticket sales

**Description:** Sell tickets for coding workshops, events via pretix.

**Acceptance Criteria:**
- [ ] pretix instance deployed with event catalog
- [ ] Embed pretix checkout on `/workshops` page
- [ ] On ticket purchase, sync to our database for check-in
- [ ] Generate QR codes for tickets (scan at door)
- [ ] Pretix webhook notifies us of cancellations

**Effort:** 25h  
**Priority:** P3  
**Status:** ❌ Not started

---

## Pillar 5: TastyIgniter (Online Ordering)

### Task 5.1: TastyIgniter migration

**Description:** Migrate online ordering to TastyIgniter for richer e-commerce features.

**Acceptance Criteria:**
- [ ] TastyIgniter installed and configured
- [ ] Migrate menu data from our system to TastyIgniter
- [ ] Integrate with our D1 database for customer and order history
- [ ] Single sign-on: use same JWT across both systems
- [ ] Deprecate current online ordering after migration

**Effort:** 35h  
**Priority:** P2  
**Status:** ✅ Complete

---

## Pillar 6: Xibo/Anthias (Digital Signage)

### Task 6.1: Menu board displays

**Description:** Deploy digital signage for menu boards on TVs around the cafe.

**Acceptance Criteria:**
- [ ] Xibo/Anthias server deployed (Raspberry Pi)
- [ ] Create layout for menu board (categories, products, prices)
- [ ] Connect to our API to fetch live menu data
- [ ] Auto-refresh every 5 minutes
- [ ] Show promotions on separate schedule

**Effort:** 20h  
**Priority:** P3  
**Status:** ❌ Not started

---

## Pillar 7: Mautic (Email Marketing)

### Task 7.1: Email automation

**Description:** Send targeted email campaigns using Mautic.

**Acceptance Criteria:**
- [ ] Mautic instance deployed
- [ ] Sync customer segments from our database (tiers, inactivity)
- [ ] Campaign: welcome series for new members
- [ ] Campaign: birthday discount emails (auto-trigger)
- [ ] Campaign: churn prevention (30-day inactive)
- [ ] Track email opens and clicks

**Effort:** 25h  
**Priority:** P2  
**Status:** ❌ Not started

---

## Pillar 8: Mixpost (Social Media)

### Task 8.1: Social posting scheduler

**Description:** Schedule posts to Facebook, TikTok, LinkedIn via Mixpost.

**Acceptance Criteria:**
- [ ] Mixpost instance deployed
- [ ] Connect social media accounts
- [ ] Create content calendar (weekly posts)
- [ ] Auto-post menu specials, events, promotions
- [ ] Analytics: track engagement

**Effort:** 20h  
**Priority:** P3  
**Status:** ❌ Not started

---

## Pillar 9: Home Assistant (IoT)

### Task 9.1: Lighting & HVAC automation

**Description:** Automate lights and AC based on occupancy and time.

**Acceptance Criteria:**
- [ ] Home Assistant installed on Raspberry Pi
- [ ] Smart lights (Philips Hue or Tuya) connected
- [ ] Thermostats connected for AC control
- [ ] Automation rules:
  - Lights on at 6am, off at 11pm
  - AC set to 24°C during business hours
  - Energy usage monitoring
- [ ] Webhook integration: our system triggers "customer arrived" event

**Effort:** 15h  
**Priority:** P2 (energy savings)  
**Status:** 🟡 Partial (basic HA setup, automations pending)

---

## Pillar 10: Frigate (CCTV AI)

### Task 10.1: Heatmap analytics

**Description:** Analyze customer traffic patterns using Frigate AI detection.

**Acceptance Criteria:**
- [ ] Frigate installed with compatible cameras (RTSP)
- [ ] Object detection configured (person, vehicle)
- [ ] Heatmap generation: show crowded areas throughout day
- [ ] Count of unique visitors per day
- [ ] Integrate with Home Assistant dashboard

**Effort:** 20h  
**Priority:** P3  
**Status:** 🟡 Partial (Frigate installed, AI detection not configured)

---

## Pillar 11: Payment Gateways (Already Done)

**Status:** ✅ Completed — PayOS integrated, VNPay/MoMo available as fallback options.

---

## Pillar 12: SMTP (Email Delivery)

### Task 12.1: Transactional email setup

**Description:** Configure reliable email sending for order confirmations, loyalty updates.

**Acceptance Criteria:**
- [ ] SMTP server configured (transactional service like SendGrid, Mailgun, or self-hosted Postfix)
- [ ] Templates for:
  - Order confirmation
  - Order status updates
  - Loyalty rewards
  - Password reset
- [ ] Queue system for bulk emails (campaigns)
- [ ] Bounce handling and suppression

**Effort:** 10h  
**Priority:** P1 (critical for UX)  
**Status:** ⚠️ Partial (SMTP configured, templates need review)

---

## Integration Testing

### Task IT-1: End-to-end pillar integration tests

**Description:** Automated tests verifying all 12 pillars work together.

**Acceptance Criteria:**
- [ ] Test suite covering: order → Odoo sync → email receipt → loyalty update
- [ ] Mock external APIs for CI (avoid hitting real services)
- [ ] Integration tests run nightly
- [ ] Alert on integration failures

**Effort:** 20h  
**Priority:** P1  
**Status:** ❌ Not started

---

*Related files:*
- `TECH_STACK.md` (12 pillars specification)
- `worker/src/routes/webhooks/` (incoming from external services)
- External API client libraries in `worker/src/clients/`
- Integration tests in `tests/integration/`
