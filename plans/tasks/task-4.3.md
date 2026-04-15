Tạo file `worker/src/routes/loyalty.js` với các read-only routes:
- GET /api/loyalty/member/:phone → Query users + loyalty_tiers + cashback_wallets → Return member profile + tier + wallet → 404 if not found
- GET /api/loyalty/wallet/:userId → Query cashback_wallets → Return { balance, total_earned, total_spent }
- GET /api/loyalty/transactions/:userId?type=earn|spend|all&limit=20 → Query cashback_transactions → Return { transactions, total }
- GET /api/loyalty/points/:userId?limit=20 → Query loyalty_point_logs → Return { points_logs, total_points }
- GET /api/loyalty/tiers → Query loyalty_tiers ORDER BY min_points → Return { tiers }
- GET /api/loyalty/rewards/:userId → Query user_rewards JOIN rewards → Return { active, used, expired }

Follow existing route patterns. Register trong index.js.
