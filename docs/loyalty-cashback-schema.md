# Loyalty & Cashback Database Schema

## Overview

Hệ thống Loyalty & Cashback cho AURA SPACE bao gồm:
- **Tier system**: Silver → Gold → Platinum (dựa trên điểm tích lũy)
- **Cashback wallet**: Ví hoàn tiền tự động theo % mỗi đơn hàng
- **Point accumulation**: Tích điểm theo giá trị đơn × hệ số tier
- **Reward vouchers**: Đổi điểm lấy mã giảm giá

## New Tables

| Table | Purpose |
|-------|---------|
| `loyalty_tiers` | Cấu hình hạng thành viên (Silver/Gold/Platinum) |
| `cashback_wallets` | Ví cashback 1:1 với users |
| `cashback_transactions` | Lịch sử giao dịch ví (earn/spend/bonus/expire/refund) |
| `loyalty_point_logs` | Lịch sử tích/dùng điểm |
| `user_rewards` | Mã giảm giá đã claim |

## Altered Tables

| Table | New Columns |
|-------|-------------|
| `users` | `email TEXT`, `birthday DATE` |
| `orders` | `user_id`, `cashback_used`, `cashback_earned`, `points_earned`, `reward_code_used` |

## Tier Configuration

| Tier | Min Points | Cashback | Point Mult | Birthday | Upsize/wk | Booking |
|------|-----------|----------|------------|----------|-----------|---------|
| Silver | 0 | 2% | ×1.0 | 10% | 0 | - |
| Gold | 500 | 5% | ×1.5 | 30% | 1 | 24h |
| Platinum | 1000 | 8% | ×2.0 | 50%+gift | unlimited | 48h |

## Database Functions (PostgreSQL only)

### `process_order_cashback(order_id, user_id) → JSONB`

Called after order completion:
1. Gets order total and user tier
2. Cashback = (total - cashback_used) × cashback_rate
3. Points = floor(total / 10000 × point_multiplier)
4. Updates wallet, logs transaction
5. Checks tier upgrade
6. Returns: `{success, cashback_earned, points_earned, wallet_balance, total_points, tier, tier_upgraded}`

### `spend_cashback(user_id, order_id, amount) → JSONB`

Called when paying with cashback:
- Max 50% of order value
- Checks sufficient balance
- Returns: `{success, amount_spent, new_balance}` or `{error, max_allowed}`

## Cashback Rules

- Cashback calculated on `(total - cashback_used)` — no loop
- Cashback does NOT expire
- Max spend per order: 50% of order value
- Bonus cashback (promotions): 30-day validity tracked via `metadata.expires_at`

## Security (Supabase)

- RLS enabled on: `cashback_wallets`, `cashback_transactions`, `loyalty_point_logs`, `user_rewards`
- Users can only SELECT their own data
- `service_role` has full access for backend operations
- Real-time enabled on: `cashback_wallets`, `loyalty_point_logs`

## Migration Commands

### Supabase (PostgreSQL)
```bash
supabase db push
# or manually:
supabase db execute --file supabase/migrations/001_loyalty_cashback.sql
```

### Cloudflare D1 (SQLite)
```bash
npx wrangler d1 execute AURA_DB --file supabase/migrations/002_loyalty_cashback_d1.sql
# remote:
npx wrangler d1 execute AURA_DB --remote --file supabase/migrations/002_loyalty_cashback_d1.sql
```

## View: `v_member_summary`

Joins users + loyalty_tiers + cashback_wallets + next tier info + active rewards count. Use for dashboard and loyalty page API.
