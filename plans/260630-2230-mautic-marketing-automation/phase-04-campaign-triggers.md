# Phase 04 — Campaign Triggers (TDD)

**Status:** complete
**Priority:** High
**TDD:** ✅ Write tests first, then implement (12 tests)

## Overview

Automated campaign enrollment triggers that detect customers who should receive marketing messages and enroll them in Mautic campaigns. Three trigger types: win-back, birthday offers, promotional.

## Trigger Types

### 1. Win-Back (30d inactive)
- Query: customers with `last_order_date >= 30 days ago AND < 31 days ago`
- Action: enroll in Mautic "Win-Back" campaign
- Campaign sends: Zalo ZNS message + optional SMS reminder
- Frequency: daily cron check

### 2. Birthday Offers
- Query: customers whose birthday month = current month, haven't used birthday discount yet
- Action: enroll in Mautic "Birthday" campaign
- Campaign sends: Zalo ZNS with birthday offer + discount code
- Frequency: daily cron check (only first detection per month per customer)

### 3. Promotional Campaigns
- Manual trigger: admin selects segment + template → bulk enroll
- Optional: admin endpoint `POST /api/admin/mautic/campaigns` for manual promo blasts
- Segment options: by tier, by recency, by zone preference

## Requirements

### Functional
- `detectWinbackCandidates(env)` → enrolls 30d inactive customers
- `detectBirthdayCandidates(env)` → enrolls birthday-month customers
- `triggerPromoCampaign(env, segment, template)` → bulk enroll for promos
- Dedup: don't re-enroll same customer in same campaign (track campaign_enrollments in D1)
- Campaign enrollment tracking table for audit

### Non-functional
- Cron-only (no request-path execution)
- Idempotent enrollment (check existing enrollment before adding)
- Zalo ZNS reuse existing `sendZNS()` — no new Zalo work

## Implementation Steps (Complete)

1. [x] Write 4+ TDD tests for campaign triggers (12 written)
2. [x] Implement win-back detection + Mautic enrollment (30d inactive, SQL dedup via campaign_enrollments)
3. [x] Implement birthday detection + Mautic enrollment (current month matches, skip if discount used)
4. [x] Implement promo campaign trigger (tier/recency filter, admin-triggered)
5. [x] Add campaign triggers to cron.js (re-exported from mautic-bridge.js)
6. [x] Add `campaign_enrollments` tracking table (INSERT via trackEnrollment, check via isAlreadyEnrolled)
7. [x] Verify all 12 tests pass, build clean

## Files

- **NEW:** `tests/campaign-triggers.test.js`
- **MODIFY:** `worker/src/routes/mautic-bridge.js` — add trigger functions
- **MODIFY:** `worker/src/routes/cron.js` — add trigger runs
- **MODIFY:** `worker/schema.sql` — add campaign_enrollments table

## Success Criteria (All Met)

- [x] Win-back candidates detected (31-day threshold SQL) and enrolled in Mautic campaign
- [x] Birthday candidates detected (month-match SUBSTR) and enrolled; skip if discount already used
- [x] Promo campaign enrolls selected segment (tier/recency filter, manual trigger)
- [x] Dedup prevents double enrollment (SQL NOT IN on campaign_enrollments)
- [x] Tracking table records all enrollments (INSERT into campaign_enrollments with customer_id, campaign_type, status)
- [x] 12 TDD tests pass, 0 build errors

## Risk

- Edge case: customer birthday on month boundary → test Feb 28/29
- Win-back re-trigger: if customer remains inactive after campaign, re-enroll after 60 days? (out of scope — revisit in Phase B)
- Mautic campaign must be pre-configured in Mautic UI (document setup steps)
