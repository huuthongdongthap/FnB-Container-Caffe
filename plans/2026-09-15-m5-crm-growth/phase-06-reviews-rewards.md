# Phase 06 — Reviews + Rewards Catalog

**Priority:** MEDIUM — customer feedback + point-redemption rewards catalog.
**Status:** 🔄 IN PROGRESS

## Overview

Extract review operations (`routes/reviews.ts`) and reward catalog + redemption (`routes/loyalty.ts` rewards section) into domain commands:
- `packages/domain/crm/commands/reviews.ts` — createReview, listReviews, getReviewStats
- `packages/domain/crm/commands/rewards.ts` — listRewards, redeemReward, listCustomerRewards

Then migrate `routes/reviews.ts` and `routes/loyalty.ts` (reward endpoints) to delegate to these domain commands.

## Schema (authoritative — already exists)

- `reviews(id, customer_name, rating, content, tags, status, created_at)` — general feedback (note: `routes/reviews.ts` uses `order_id`, `comment`, `customer_name`, but `schema.sql` line 255 defines `content`, `tags`, `status`. Need to align or support both).
- `rewards(id, title, description, point_cost, discount_type, discount_value, min_order, image_url, stock, is_active, created_at)`
- `user_rewards(id, customer_id, reward_id, code, status, expires_at, created_at)`
- `loyalty_point_logs(id, customer_id, points_change, reason, new_balance, description, created_at)`
- `customers(id, loyalty_points, ...)`

## Design

### 1. `commands/reviews.ts`
- `createReview(db, input: CreateReviewInput): Promise<ReviewResult>`
  - Generates ID `rev_${Date.now()}_${rand}`
  - Inserts into `reviews` (supports `customer_name`, `rating`, `content` / `comment`, optional `order_id` if column exists, `tags`, `status`)
  - Note: checking `routes/reviews.ts` vs `schema.sql` to see what columns actually exist in runtime DB.
- `listReviews(db, opts?: { limit?: number; offset?: number; status?: string }): Promise<ReviewListResult>`
- `getReviewStats(db): Promise<{ totalReviews: number; averageRating: number; distribution?: Record<number, number> }>`

### 2. `commands/rewards.ts`
- `listRewards(db, customerPoints?: number): Promise<RewardCatalogItem[]>`
  - Active rewards ordered by `point_cost ASC`
  - Adds `can_redeem: customerPoints >= point_cost` if points provided
- `redeemReward(db, customerId, rewardId, opts?: { expiryDays?: number }): Promise<RedeemRewardResult>`
  - Validates customer exists + has enough `loyalty_points`
  - Validates reward exists + is active + has stock (if stock != -1, decrements stock)
  - Atomically:
    - Deducts `point_cost` from `customers.loyalty_points`
    - Logs to `loyalty_point_logs`
    - Inserts into `user_rewards` with unique code (`{REWARD_PREFIX}-{timestamp}`)
  - Returns `{ success: true, code, reward, pointsSpent, pointsRemaining, expiresAt }` or error
- `listCustomerRewards(db, customerId, opts?: { limit?: number }): Promise<UserRewardItem[]>`
  - Joins `user_rewards` + `rewards` for title/discount info

## Todo

- [ ] Inspect actual DB schema for `reviews` table (columns in schema.sql vs routes/reviews.ts)
- [ ] Create `packages/domain/crm/commands/reviews.ts`
- [ ] Create `packages/domain/crm/commands/rewards.ts`
- [ ] Barrel export in `packages/domain/crm/index.ts`
- [ ] Add vitest aliases
- [ ] Migrate `routes/reviews.ts` to thin handler calling domain
- [ ] Migrate reward handlers in `routes/loyalty.ts` to call domain
- [ ] Unit tests in `tests/crm-reviews-rewards.test.ts`
- [ ] Run full test suite
- [ ] Update CHANGELOG.md
