# 05_TASKS/loyalty.md

## Domain: Loyalty Program

This document breaks down tasks for the Loyalty Program domain, including tier management, points system, rewards, check-ins, and referrals.

---

## Epic 1: Tier Structure & Benefits

### Story 1: Define loyalty tiers

**Acceptance Criteria:**
- [ ] Bronze tier: 0-{BRONZE_MAX} points
- [ ] Silver tier: {SILVER_MIN}-{SILVER_MAX} points
- [ ] Gold tier: {GOLD_MIN}-{GOLD_MAX} points
- [ ] Platinum tier: {PLATINUM_MIN}+ points
- [ ] Tier upgrade/downgrade logic implemented
- [ ] Benefits per tier documented and enforced

**Priority:** P1
**Status:** {STATUS_1_1}
**Assignee:** {ASSIGNEE_1_1}

---

### Story 2: Points multiplier by tier

**Acceptance Criteria:**
- [ ] Bronze: {BRONZE_MULTIPLIER}x multiplier
- [ ] Silver: {SILVER_MULTIPLIER}x multiplier
- [ ] Gold: {GOLD_MULTIPLIER}x multiplier
- [ ] Platinum: {PLATINUM_MULTIPLIER}x multiplier
- [ ] Multiplier applied at checkout automatically

**Priority:** P1
**Status:** {STATUS_1_2}
**Assignee:** {ASSIGNEE_1_2}

---

## Epic 2: Check-in & Rewards

### Story 1: Daily check-in feature

**Acceptance Criteria:**
- [ ] Customer can check in once per day
- [ ] {CHECKIN_POINTS} points awarded per check-in
- [ ] Consecutive day streak bonus
- [ ] Social media share integration

**Priority:** P2
**Status:** {STATUS_2_1}
**Assignee:** {ASSIGNEE_2_1}

---

### Story 2: Birthday rewards

**Acceptance Criteria:**
- [ ] Birthday voucher auto-issued on birthday month
- [ ] {BIRTHDAY_DISCOUNT}% discount or fixed amount
- [ ] Valid for {BIRTHDAY_VALIDITY} days
- [ ] One-time use per year

**Priority:** P2
**Status:** {STATUS_2_2}
**Assignee:** {ASSIGNEE_2_2}

---

## Epic 3: Referral System

### Story 1: Referral link generation

**Acceptance Criteria:**
- [ ] Each customer gets unique referral code/link
- [ ] Referrer gets {REFERRER_REWARD} when referee makes first purchase
- [ ] Referee gets {REFEREE_REWARD} signup bonus
- [ ] Anti-fraud: prevent self-referral

**Priority:** P2
**Status:** {STATUS_3_1}
**Assignee:** {ASSIGNEE_3_1}

---

## Epic 4: Redemption & Cashback

### Story 1: Points redemption

**Acceptance Criteria:**
- [ ] Points converted to discount at {POINTS_TO_VND_RATE} points/VND
- [ ] Max {MAX_REDEMPTION_PERCENTAGE}% of order total
- [ ] Partial redemption allowed
- [ ] Points deducted from balance immediately

**Priority:** P1
**Status:** {STATUS_4_1}
**Assignee:** {ASSIGNEE_4_1}

---

## Backlog Tasks

| Task | Estimate | Priority | Dependencies |
|------|----------|----------|--------------|
| {TASK_1} - Tier upgrade automation | {EST_1}h | P{PRIORITY_1} | {DEP_1} |
| {TASK_2} - Points expiration policy | {EST_2}h | P{PRIORITY_2} | {DEP_2} |
| {TASK_3} - Loyalty dashboard UI | {EST_3}h | P{PRIORITY_3} | {DEP_3} |
| {TASK_4} - Points transaction history | {EST_4}h | P{PRIORITY_4} | {DEP_4} |
| {TASK_5} - Admin loyalty management | {EST_5}h | P{PRIORITY_5} | {DEP_5} |

---

## Related Documentation

- **Business Model:** See [08_BUSINESS_MODEL.md](../08_BUSINESS_MODEL.md) - Loyalty economics
- **Architecture:** [03_ARCHITECTURE.md](../03_ARCHITECTURE.md) - Loyalty integration
- **API:** `worker/src/routes/loyalty.js`
- **Database:** `rewards`, `users` tables (loyalty fields)

---

*Replace placeholders `{}` with project-specific values. Adjust tier thresholds, points rates, rewards to match your business model.*
