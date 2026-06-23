# ADR 012: Four-Tier Loyalty Program with Cashback and Points

**Date:** 2026-03-14  
**Status:** Accepted  
**Decision Maker:** Founder / Marketing

## Context

We needed a loyalty program to:
- Increase customer retention
- Encourage higher spending (up-sell to premium tiers)
- Differentiate from competitors
- Be sustainable (not break finances)

Alternatives:
1. **Four-tier with cashback + points** (Bronze, Silver, Gold, Platinum)
2. **Simple points-only**: Earn points, redeem for items
3. **Flat discount**: All customers get 5% off
4. **Subscription model**: Monthly fee for discounts

## Decision

Chose **Four-tier (Bronze/Silver/Gold/Platinum) with cashback and points**.

## Structure

| Tier | Threshold | Cashback | Points Multiplier | Birthday Benefit | Cashback Expiry |
|------|-----------|----------|-------------------|------------------|-----------------|
| Bronze | 0 - 500K | 3% | 1.0x | 10% off | 90 days |
| Silver | 500K - 2M | 5% | 1.2x | 20% off | 120 days |
| Gold | 2M - 5M | 7% | 1.5x | 35% off | 180 days |
| Platinum | 5M+ | 10% | 2.0x | 50% off + gift | Forever |

**Key rules:**
- Tier based on *lifetime cumulative spend* (not rolling)
- Cashback capped at 50% of order total per use
- Cashback and points expire per tier rules
- Points earned = (cash paid × multiplier) / 1000

## Consequences

### Positive
- ✅ **Simple to explain**: "Spend more, get more back"
- ✅ **Financially sustainable**: Cashback percentage increases but triggered by spending
- ✅ **Upsell incentive**: Customers aim for next tier
- ✅ **Retention**: Cashback expiry encourages repeat visits
- ✅ **Referral synergy**: Referral bonuses count toward tier spend

### Negative
- ⚠️ **Complexity**: 4 tiers + cashback + points + expiry — harder to communicate
  - Mitigation: Clear UI on profile page, explain in terms
- ⚠️ **Accounting**: Cashback is liability on balance sheet (owe customer)
  - Mitigation: Track expired cashback as revenue
- ⚠️ **Fraud potential**: Customers may abuse cashback loopholes
  - Mitigation: Max 50% per order, no stacking, audit logs

### Risks
- **Financial model breaking**: If customers game the system (e.g., refer themselves)
  - Mitigation: Referral requires new phone/email, anti-fraud checks
- **Customer confusion**: Not understanding tier benefits
  - Mitigation: Visual tier progress bar, notifications on upgrade
- **Admin burden**: Manual adjustments needed for edge cases
  - Mitigation: Admin tools to add/subtract with audit trail

## Why Not Simple Points?

Points-only systems feel less immediate ("I have 1000 points, need 5000 for coffee"). Cashback is immediate dollar value ("you have 50,000 VND in wallet"). More psychologically compelling.

## Why Four Tiers?

- Bronze: Entry-level, everyone starts here
- Silver: Reachable with moderate spending (~500K)
- Gold: Target for regulars (~2M lifetime)
- Platinum: VIP tier (5M+) — exclusive, forever status

Three tiers too few, five too many. Four feels right.

## Financial Safety

Even with 10% cashback at Platinum, math works:
- COGS is ~30% of revenue
- 10% cashback on 50% max usage = effective 5% cost
- Still profitable at 15% margin minimum

See `docs/08_BUSINESS_MODEL.md` for full financial model.

## Alternatives Considered (Rejected)

- **Flat 5%**: No tier motivation, same cost to us
- **Points only**: Less psychologically compelling
- **Subscription**: Adds friction, not suitable for casual cafe

## Related

- Loyalty implementation: `worker/src/routes/loyalty.js`
- Wallet schema: `db/schema.sql` (loyalty_wallets, loyalty_transactions, loyalty_points)
- Admin management: `worker/src/routes/admin-loyalty.js`
- Customer UI: `js/loyalty.js`, `loyalty.html`
- Handbook: `docs/loyalty_grand_opening_handbook.md`
- Tier definitions: `docs/loyalty_tier_definitions.md`
