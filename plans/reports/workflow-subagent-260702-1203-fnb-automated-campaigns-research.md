# F&B Automated SMS/Email Campaigns Research

## Existing Infrastructure Inventory

### Channels (fully configured)
| Channel | File | Status | Notes |
|---------|------|--------|-------|
| **SpeedSMS** | `worker/src/lib/speedsms-client.ts` | Production-ready | VN phone normalization, `sendSMS(env, {phone, message})` |
| **Resend** | `worker/src/lib/resend-client.ts` | Production-ready | `sendEmail(env, {to, subject, html})` — preferred email channel |
| **SendGrid** | `worker/src/lib/email.ts` | Legacy dual | `sendEmail(env, {to, subject, html})` — kept for compatibility |
| **Zalo ZNS** | `worker/src/tree/zalo/zns-sender.ts` | Production-ready | 4 templates: welcome_signup, cashback_earned, tier_upgrade, cashback_expiry_warning |
| **Telegram** | Via cron/digest routes | Admin-only | Internal ops, not customer-facing |

### Campaign Detection (already built)
- `worker/src/tree/mautic/campaign-detection.ts` — `detectWinbackCandidates()` (30d inactive query), `detectBirthdayCandidates()` (current month birthday query)
- `worker/src/tree/mautic/promo-campaign.ts` — `triggerPromoCampaign()` tier-segmented promo
- `worker/src/tree/mautic/enrollment-tracker.ts` — `trackEnrollment()`, `isAlreadyEnrolled()` with dedup via `campaign_enrollments` table
- Cron runs daily in `worker/src/index.ts` `scheduled.fetch()` — winback + birthday detection already wired

### Content Templates (already built)
- `worker/src/lib/campaign-templates.ts` — `winbackTemplate()`, `birthdayTemplate()`, `promoTemplate()` — all bilingual VN/EN with HTML+ SMS variants
- `worker/src/templates/welcome.ts` — `renderWelcome()` HTML email template
- `worker/src/templates/receipt.ts`, `worker/src/templates/order-confirm.ts` — transactional

### Data Available (D1 schema — `worker/schema.sql`)
- `customers`: id, email, name, phone, loyalty_points, lifetime_points, loyalty_tier (bronze/silver/gold/platinum), created_at
- `orders`: id, total, status, customer_name, customer_phone, customer_email, cashback_earned, created_at
- `cashback_wallets`: balance, total_earned, total_spent
- `loyalty_tiers`: cashback_rate, birthday_discount, min_spent_vnd
- `bonus_campaigns`: type (checkin/referral/birthday/signup), reward config
- `referrals/codes`: referral tracking
- `notification_audit_log`: channel (zalo_zns/telegram/email/sms) audit
- `campaign_enrollments`: campaign_type (winback/birthday/promo) with dedup

---

## Recommended Campaign Types

### Priority 1: Wire existing detection to SMS + Email (week 1)
The Mautic bridge currently detects winback and birthday candidates but only syncs them to Mautic. **Add direct SMS/email sends** using existing SpeedSMS and Resend clients so the system works without a Mautic instance.

### Priority 2: Post-Visit Follow-up (week 2)
Add a trigger in the order completion flow (when order status changes to `delivered` or payment `completed`) to send SMS + Zalo ZNS with cashback earned and review invitation.

### Priority 3: Welcome Series Enhancement (week 3)
Current welcome_signup ZNS template is single-shot. Add a multi-step series: Day 0 (welcome + wallet bonus), Day 3 (benefits reminder + referral code), Day 7 (first order discount).

### Priority 4: Campaign Management API (week 4)
Build a lightweight `campaigns` config table + admin UI for manual promo creation, segment selection (by tier, by last visit), and multi-channel dispatch.

---

## Concrete Campaign Types

| Campaign | Trigger | Channel | Effort | Notes |
|----------|---------|---------|--------|-------|
| Welcome Series | customer.signup | SMS + Email + Zalo ZNS | Medium | Extend single-shot ZNS to 3-email drip |
| Birthday | cron monthly | SMS + Email + Zalo ZNS | Low | Already detected; just wire channels |
| Win-Back 30d | cron daily | SMS + Email | Low | Already detected; wire SMS+email |
| Post-Visit | order.delivered | SMS + Zalo ZNS | Medium | Add to order completion webhook |
| Cashback Expiry | cron weekly | SMS + Zalo ZNS | Low | ZNS template exists; add SMS fallback |
| Tier Upgrade | points.threshold | SMS + Zalo ZNS | Medium | Now in loyalty flow; add SMS+email |
| Referral Reward | referral.completed | SMS + Zalo ZNS | Low | Wire to existing referral completion |
| Promo / Seasonal | admin.manual | SMS + Email + Zalo ZNS | Medium | Build campaign config API |
| Abandoned Cart | cart.timeout | SMS + Email | High | Requires session tracking infra |

---

## Implementation Recommendations

1. **Remove Mautic dependency for core flows** — Use the existing detection SQL directly and call SpeedSMS/Resend/ZNS clients inline. Mautic can remain for advanced segmentation but should not be a hard requirement.
2. **Extend campaign-templates.ts** to include post-visit, referral notification, cashback expiry, tier upgrade, and abandoned cart templates.
3. **Create a `campaign-dispatcher.ts`** module that takes a customer record + campaign type + channel list and sends via the appropriate client(s), recording to `notification_audit_log`.
4. **Consent gate**: Check `odoo_customer_consent.consent_email` and `.consent_marketing` before sending, per data privacy requirements.
5. **Rate limit**: 1 SMS/hour per customer max; 2 emails/week per campaign type.

### File creation plan
- `worker/src/tree/campaign/dispatcher.ts` — Multi-channel dispatch orchestration
- `worker/src/tree/campaign/post-visit.ts` — Post-visit follow-up trigger
- `worker/src/tree/campaign/welcome-series.ts` — Welcome series scheduler
- `worker/src/tree/campaign/consent-gate.ts` — Consent check before send
- `tests/post-visit-campaign.test.ts` — Tests for post-visit flow
- `tests/welcome-series.test.ts` — Tests for welcome series
