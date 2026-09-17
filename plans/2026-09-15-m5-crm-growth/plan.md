# M5 — CRM / Growth (REVISED — Legacy Extraction Reality)
**Date:** 2026-09-15  · **Pattern:** M2/M3/M4 một-nhịp (extract → migrate → delete) · **Status:** ⏳ IN PROGRESS — Phase 01 ✅ COMPLETE — Phase 02 ✅ COMPLETE — Phase 03 ✅ COMPLETE — Phase 04 ✅ COMPLETE — Phase 05 ✅ COMPLETE

## Situational Awareness (post-revision)

M5 is **NOT greenfield**. A complete CRM/growth stack already lives in `worker/src/` and is fully operational in production. NONE of it depends on `packages/domain/crm/`. M5's true job is **extract → migrate callers → delete legacy** (một-nhịp), identical to M2/M3.

### Legacy stack (worker/src/) — production, no domain dependency

| Module | Location | Complexity | Tables |
|---|---|---|---|
| Loyalty process-order | `tree/loyalty/process-order.ts` | HIGH | orders, cashback_*, customers, loyalty_tiers, loyalty_point_logs, loyalty_audit_log |
| Loyalty campaign lookup | `tree/loyalty/campaign.ts` | LOW | bonus_campaigns |
| Loyalty helpers | `tree/loyalty/helpers.ts` | LOW | (KV only) |
| Loyalty routes | `routes/loyalty.ts`, `routes/admin-loyalty.ts` | MED | 10 endpoints total |
| Referral engine | `tree/referrals/*` (4 files) | LOW-MED | referrals, referral_codes, customers, cashback_*, loyalty_point_logs |
| Referral routes | `routes/referrals.ts` | MED | 3 endpoints |
| Campaign engine | `tree/campaigns/` (engine + 5 triggers + 3 channels + cron) | MED | campaign_configs, campaign_logs, customers |
| Campaign routes | `routes/campaigns.ts` | MED | 5 endpoints |
| Reviews | `routes/reviews.ts` | LOW | reviews |
| Mautic bridge | `tree/mautic/` (8 files) | MED | customers, campaign_enrollments |
| Check-ins | `checkin_log` table, checkin routes | LOW | checkin_log |

### Already extracted (packages/domain/crm/ — M1-M4)
`aggregate-events.ts`, `get-customer-account.ts` (has inline nextTier query), `get-fulfillment.ts`, `place-order.ts`, `update-consent.ts`

### Goal
1. Extract business logic from `worker/src/tree/{loyalty,referrals,campaigns}/` + `worker/src/routes/{loyalty,admin-loyalty,referrals,campaigns,reviews}.ts` into `packages/domain/crm/commands/` + thin routes.
2. Migrate callers (admin-loyalty.ts reads → domain commands).
3. Delete legacy `tree/{loyalty,referrals,campaigns}` + `mautic` (mautic is integration, NOT extracted to domain — it stays in worker, only its CRM-touching helpers migrate if needed).
4. Add missing CRM primitives not in legacy: frequency-band (RFM-lite), preference extraction, segments, customer-360, retention overview, feedback scoring.
5. Barrel-export + wire `GET /api/crm/dashboard` (owner CRM health feed).

Mautic bridge is an **integration** (external API sync) — it stays in `worker/src/tree/mautic/`. Only migrate if it grows CRM business logic (currently it's pure sync + enrollment, no rules).

## Schema (authoritative — worker/schema.sql + migrations)

All tables exist. **No new migrations needed** unless M5 adds a `segments` KV-backed definition or retention trend cache (both KV-only → no migration).

- `customers(id, email, name, phone, loyalty_points, lifetime_points, loyalty_tier, date_of_birth, zalo, source)` — `loyalty_tier` text = bronze/silver/gold/platinum
- `loyalty_tiers(tier_name PK, min_points, cashback_rate, point_multiplier, birthday_discount, display_name_vi, min_spent_vnd, max_spent_vnd, expiry_days, sort_order)` — **TIER calc reads `min_points` against `customer.lifetime_points`**
- `loyalty_point_logs(id, customer_id, order_id, points_change, reason, balance_after, description)`
- `cashback_wallets(id, customer_id UNIQUE, balance, total_earned, total_spent)`
- `cashback_transactions(id, wallet_id, order_id, type, amount, balance_after, description)` — type: earn|spend|expire|refund
- `referral_codes(id, customer_id UNIQUE, code UNIQUE, times_used, total_points_earned)`
- `referrals(id, referrer_id, referred_customer_id, referral_code, points_awarded, status, cashback_awarded_vnd, bonus_type, first_order_id, first_order_amount, reward_paid_at)` — status: pending|completed|reversed
- `bonus_campaigns(id, code UNIQUE, name, type, reward_type, reward_value, start_date, end_date, max_uses, used_count, active, metadata)`
- `rewards(id, title, description, point_cost, discount_type, discount_value, min_order, image_url, stock, is_active)`
- `user_rewards(id, customer_id, reward_id, code, status, expires_at)` — status: active|used|expired
- `reviews(id, customer_name, rating 1-5, content, tags, status)`
- `campaign_configs(trigger PK, is_active, channels, timing)` — trigger: welcome|birthday|winback|post_visit|cashback_expiry
- `campaign_logs(id, customer_id, trigger, channel, sent_at, status, error)` — status: sent|failed|skipped
- `checkin_log(id AUTOINCREMENT, customer_id, campaign_code, reward_type, reward_value, post_platform, post_url, staff_id, order_id, notes, checkin_at)`

## Invariants (MUST preserve — verified against legacy + seed)

- **TIER THRESHOLDS MUST STAY: Bronze 0 / Silver 50 / Gold 200 / Platinum 500** (`min_points` in `loyalty_tiers`, code reads this against `customer.lifetime_points`). The `min_spent_vnd` column (0/500k/5M/15M) is DISPLAY-ONLY — do NOT switch tier calc to it. This is the LIVE behavior; changing it silently regrades every customer.
- **Cashback wallet cap 50% of bill** preserved: `maxFromWallet = min(walletBalance, total * 0.5)`.
- **Per-tx earn cap 50,000 VND** preserved.
- **Cashback rates by tier** (from seed): Bronze 3% / Silver 5% / Gold 7% / Platinum 10%.
- **Point multiplier** by tier (from seed): 1.0 / 1.1 / 1.3 / 1.5.
- **Points formula**: `Math.floor(orderTotal / 1000)` (1 point per 1000 VND) — preserved.
- **Referral reward**: 10,000 VND CASHBACK (not points) to referrer on referee's first qualifying order (≥ 20,000 VND). v1 points reward (100 pts) also exists in legacy — preserve both paths.
- **Review table is `reviews`** (NOT `customer_feedback`).
- **Zero Frontend Impact**: preserve byte-identical route paths + JSON schemas.
- **Một Nhịp Standard**: Extract → migrate callers → delete legacy. No lingering shims.
- **Pure Core**: business rules live as Hono-free pure functions in `commands/`. Routes stay thin.
- **KV Policy**: rates/windows in KV for owner tunability; pure-function defaults when KV missing.
- **File Size**: under 200 lines; modularize.
- **File Naming**: kebab-case.
- **No Plan Refs in Code**: explain why, not which phase.
- **2 STRIKES MAX** — escalate to user.

## Scope & Phases (REVISED)

### Phase 01 — Loyalty Domain (extract process-order + inline tier)
Extract loyalty accrual/cashback/tier logic from `tree/loyalty/process-order.ts` + inline nextTier from `get-customer-account.ts` into pure, testable commands. Includes: `loyalty-policy.ts` (load tier config + campaign multiplier), `compute-tier.ts` (pure tier eval — PRESERVE min_points thresholds), `accrual.ts` (points + cashback wallet + tier-upgrade emit). Refactor `get-customer-account.ts` to use computeTier. Wire accrual hook into `place-order.ts`. **No new tables** — reuse loyalty_tiers, loyalty_point_logs, cashback_wallets, cashback_transactions, customers.

### Phase 02 — Referral Domain
Extract `tree/referrals/*` into `referral-policy.ts` + `referral.ts`. Functions: createCode, applyCode, processFirstOrder (cashback 10k + legacy 100pts), reverseOnCancel, getStats. Migrate `routes/referrals.ts` to domain commands. Delete legacy.

### Phase 03 — Reviews + Rewards Catalog
Extract `routes/reviews.ts` + rewards redemption from `routes/loyalty.ts` into `review.ts` + `reward-catalog.ts`. customer-scoped submit, paginated list, summary avg+distribution, reward redemption (deduct points + emit user_rewards). Migrate routes, delete legacy handlers.

### Phase 04 — Campaign Engine
Extract `tree/campaigns/` + `routes/campaigns.ts` into `campaign-config.ts` + `campaign-engine.ts` (deduplicate + logSend + trigger). Preserves 5 triggers (welcome/birthday/winback/post_visit/cashback_expiry) + channel routing. Migrate routes, delete legacy. **Keep channel senders in worker** (they call external APIs).

### Phase 05 — Customer Intelligence (NEW — greenfield)
Read-only analytics. NOT in legacy. `compute-frequency-band.ts` (RFM-lite: new/regular/lapsing/dormant/resurrected), `extract-preferences.ts` (favourite categories/items, avg order, channel), `get-customer-360.ts` (composes account + band + preferences + tier + recent events).

### Phase 06 — Segments + Retention (NEW — greenfield)
`build-segment.ts` (declarative segment eval over customers), `retention.ts` (lapsing/dormant counts + trend). KV-backed segment definitions, defaults: regular_high_value, lapsing_30d, dormant_60d, new_first_week, vip_top10. Routes: GET /segments, GET /segments/:key/customers, GET /retention/overview.

### Phase 07 — Loyalty Routes + Admin Dashboard
Extract `routes/loyalty.ts` + `routes/admin-loyalty.ts` into domain-backed thin routes. Add `GET /api/crm/dashboard` (owner CRM health: segment counts, lapsing count, points today, feedback avg, active campaigns).

### Phase 08 — Verify + Docs
Full suite (367+ files), tsc within legacy band, changelog + phase-map update, delete legacy tree/{loyalty,referrals,campaigns} + old routes. Plan → DONE.

## Acceptance Criteria (M5 done)

- Loyalty accrual/cashback/tier logic extracted to domain; legacy process-order.ts deleted. Tier thresholds PRESERVED (0/50/200/500 min_points).
- Referral create/apply/redeem/reverse extracted; legacy tree/referrals deleted.
- Reviews + reward catalog extracted; legacy routes/reviews.ts + loyalty.ts reward handlers deleted.
- Campaign engine extracted with 5 triggers + cooldown dedup; legacy tree/campaigns deleted. Channel senders remain in worker.
- Frequency bands computed deterministically; covered by unit tests.
- 360-view returns unified CRM payload for owner/staff.
- Segments listed + paginated; 5 defaults active.
- Retention overview returns lapsing/dormant counts.
- Owner /api/crm/dashboard returns top-level CRM health.
- Mautic bridge untouched (integration, not domain).
- Full suite green; tsc within legacy band; changelog + phase-map updated; plan DONE.

## Open Questions (resolved during phases)

1. ~~Does loyalty_point_logs exist?~~ YES (worker/schema.sql line 316).
2. ~~Accrual trigger?~~ On order creation (process-order.ts hook). M5 preserves this — hook into place-order.ts.
3. ~~Accrual rate?~~ 1 point / 1000 VND (Math.floor(total/1000)).
4. ~~Referral code format?~~ 6-char unique (referral_codes.code). Preserved.
5. ~~Campaign V1 scope?~~ 5 triggers (welcome/birthday/winback/post_visit/cashback_expiry), channels SMS/Email/Zalo. V1 = keep all, no new channels.
6. ~~Feedback attach to order?~~ reviews table has NO order_id column — general feedback only. If order-specific feedback needed later, migration. M5: reviews stay general.

## Risks

- **Tier threshold drift (CRITICAL)**: the `min_spent_vnd` vs `min_points` mismatch. M5 MUST preserve `min_points` calc. Any refactor that reads `min_spent_vnd` silently regrades all customers.
- **Accrual idempotency**: guard on order_id to prevent double-credit on retry. Legacy handles via pre-check; M5 must too.
- **Cashback wallet race**: two orders crediting same wallet concurrently. Legacy uses sequential await; M5 preserves.
- **Mautic coupling**: bridge reads customers + campaign_enrollments. NOT extracted. Zero touch.
- **Route path drift**: 20+ loyalty/referral/campaign/review routes must stay byte-identical. Tests verify.
