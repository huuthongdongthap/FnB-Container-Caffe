---
date: 2025-06-19
domain: loyalty
status: stable
priority: P1
---

# TASKS — LOYALTY PROGRAM

## Epic: Multi-Tier Membership

**Description:** 4-tier loyalty system with cashback, points, and referral rewards.

### Story 1: Tier definitions and auto-upgrade

**Acceptance Criteria:**
- [ ] Four tiers: Bronze (0-500K), Silver (500K-2M), Gold (2M-5M), Platinum (5M+)
- [ ] Tier based on *lifetime cumulative spend* (not rolling)
- [ ] Auto-upgrade when threshold crossed
- [ ] Tier downgrade NOT implemented (once Platinum, always Platinum)
- [ ] Tier displayed on profile page with progress bar

**Priority:** P1  
**Status:** ✅ Completed (v2.0.0)

---

### Story 2: Cashback system

**Acceptance Criteria:**
- [ ] Cashback rate per tier: Bronze 3%, Silver 5%, Gold 7%, Platinum 10%
- [ ] Cashback credited to wallet immediately after payment
- [ ] Wallet balance displayed on profile
- [ ] Max 50% of order total can be paid with cashback
- [ ] Cashback expires: Bronze 90d, Silver 120d, Gold 180d, Platinum never
- [ ] Expiry cron runs daily to deduct expired amounts

**Priority:** P1  
**Status:** ✅ Completed

---

### Story 3: Points system

**Acceptance Criteria:**
- [ ] Points earned = (order total after discount) × tier multiplier / 1000
- [ ] Multipliers: Bronze 1.0x, Silver 1.2x, Gold 1.5x, Platinum 2.0x
- [ ] Points expire same as cashback
- [ ] Points can be redeemed for rewards (see rewards.md)
- [ ] Points history visible to customer

**Priority:** P1  
**Status:** ✅ Completed

---

### Story 4: Referral program

**Acceptance Criteria:**
- [ ] Each customer gets unique referral code
- [ ] Referral page (`/referral`) displays code and sharing buttons
- [ ] When new customer signs up with referral code:
  - Referrer gets +50,000 VND cashback
  - New customer gets +50,000 VND cashback
- [ ] Additional bonus: if referee spends ≥200K on launch day, referrer gets Silver tier automatically
- [ ] Referral transactions tracked in `referrals` table

**Priority:** P1  
**Status:** ✅ Completed

---

### Story 5: Birthday rewards

**Acceptance Criteria:**
- [ ] Customer provides birthday during signup
- [ ] On birthday week (7 days), customer gets:
  - Bronze/Silver: 10% off
  - Gold: 35% off
  - Platinum: 50% off + free gift
- [ ] Birthday discount auto-applies at checkout (no code needed)
- [ ] One-time use per birthday year

**Priority:** P2  
**Status:** ✅ Completed

---

## Epic: Check-in & Engagement

### Story 6: QR code check-in

**Acceptance Criteria:**
- [ ] Each cafe location displays unique QR code (printed)
- [ ] Customer scans QR → `/checkin?code=LOCATION_ID`
- [ ] Check-in request enters approval queue (admin view)
- [ ] Admin approves → +10 points credited
- [ ] Bonus: if customer posts photo with hashtag #AURACafeSaDec → +30K voucher
- [ ] Max 1 check-in per day per customer

**Priority:** P2  
**Status:** ✅ Completed

---

## Admin Loyalty Management

### Story 7: Admin loyalty dashboard

**Acceptance Criteria:**
- [ ] View all customers with tier, points, cashback balance
- [ ] Filter by tier, search by phone/name
- [ ] Manual adjustment: add/subtract points or cashback (with reason)
- [ ] View referral leaderboard
- [ ] Export loyalty data to CSV

**Priority:** P2  
**Status:** ✅ Completed

---

### Story 8: Reward redemption tracking

**Acceptance Criteria:**
- [ ] Admin can create new reward offers (point cost, discount value)
- [ ] Customer redeems points at checkout → reward applied
- [ ] Redemption deducts points from balance
- [ ] Redemption limit per reward (if set)
- [ ] Redemption history tracked

**Priority:** P2  
- Status: ✅ Completed

---

## Future Tasks (Backlog)

### Task: Dynamic tier thresholds

**Description:** Adjust tier thresholds based on inflation or business strategy changes (configurable, not hardcoded).

**Effort:** 8h  
**Priority:** P3

---

### Task: Loyalty anniversary bonus

**Description:** On signup anniversary (1 year, 2 years...), grant bonus points/cashback.

**Effort:** 4h  
**Priority:** P3

---

### Task: Gamification: achievement badges

**Description:** Unlock badges for milestones (First order, 10 orders, referrer, early bird, etc.)

**Effort:** 16h  
**Priority:** P4

---

### Task: Loyalty program A/B testing

**Description:** Test different tier structures or bonus amounts on customer segments.

**Effort:** 20h  
**Priority:** P4

---

*Related files:*
- `worker/src/routes/loyalty.js`
- `worker/src/routes/admin-loyalty.js`
- `worker/src/routes/referrals.js`
- `worker/src/routes/checkin.js`
- `worker/src/routes/birthday.js`
- `js/loyalty.js`
- `js/signup-loyalty.js`
- `docs/loyalty_grand_opening_handbook.md`
- `docs/loyalty_tier_definitions.md`
- `docs/loyalty-cashback-schema.md`
