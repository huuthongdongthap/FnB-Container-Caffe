# Brainstorm: Next Direction

## Current State (Problem)
5 cleanup rounds done: 1,033 tests, 0 `:any`, 0 TS errors, 35 routes ≤204 lines, deployed & verified. The system is stable. Time to build revenue-generating features.

## 4 Parallel Research Findings

### 1. Automated Marketing Campaigns — **Best ROI, lowest effort**
- Triggers: Welcome series, Birthday discount, Win-back (30d inactive), Post-visit follow-up
- Channels: SpeedSMS (configured), SendGrid (configured), Zalo OA (needs business verification)
- Impact: $5.44 return/$1 spent. SMS 98% open rate. Win-back recovers 25-35% of inactive customers
- Effort: **Low** (most infra exists: campaign detection Mautic module, SpeedSMS client, email client)
- Ready for: Immediate — wiring existing modules to cron schedule

### 2. QR Table Ordering — **Big CX win**
- 80% infra exists (tables, menu, cart/checkout, PayOS, KDS)
- Add: `?table=B01` URL param → auto-occupy table → KDS shows table # → auto-release on payment
- Effort: **Medium** (1.5 days MVP, 3-4 full)
- Reduces staff workload, faster table turns

### 3. Push Notifications (Web Push API)
- PWA already set up. Add service worker push for order status updates
- Effort: Medium. Moderate reach (requires opt-in)
- Lower priority than marketing campaigns

### 4. QR + campaigns together
- QR ordering feeds order data → marketing campaigns use order history → win-back triggers for QR customers who haven't returned
- Combined effort: ~1 week

## Recommendation
Automated marketing campaigns first (highest ROI, infra ready, immediate impact). QR ordering second. They complement each other.

## Decision needed
- Which to build first (or both)?
- If marketing: which campaign triggers to start with?
- If QR: MVP or full-featured?
